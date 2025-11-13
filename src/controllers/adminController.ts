import { Request, Response } from 'express';
import { User, Message, AuditLog } from '../models';
import { UserRole, IApiResponse } from '../types/types';
import { IAuthenticatedRequest } from '../types/AuthenticatedRequest';
import { logger } from '../utils/logger';
import { rateLimitService } from '../services/RateLimitService';

export class AdminController {
  private static instance: AdminController;

  private constructor() {}

  public static getInstance(): AdminController {
    if (!AdminController.instance) {
      AdminController.instance = new AdminController();
    }
    return AdminController.instance;
  }

  /**
   * Get all users (admin only)
   */
  public async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const users = await User.find({})
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await User.countDocuments();

      const response: IApiResponse = {
        success: true,
        data: {
          users: users.map(user => user.toSafeObject()),
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Get all users error:', error);
      const response: IApiResponse = {
        success: false,
        error: 'Failed to retrieve users',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Get user by ID (admin only)
   */
  public async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        const response: IApiResponse = {
          success: false,
          error: 'User ID is required',
        };
        res.status(400).json(response);
        return;
      }

      const user = await User.findById(userId).select('-password');

      if (!user) {
        const response: IApiResponse = {
          success: false,
          error: 'User not found',
        };
        res.status(404).json(response);
        return;
      }

      // Get user statistics
      const messageCount = await Message.countDocuments({ senderId: userId });

      const response: IApiResponse = {
        success: true,
        data: {
          user: user.toSafeObject(),
          statistics: {
            messageCount,
          },
        },
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Get user by ID error:', error);
      const response: IApiResponse = {
        success: false,
        error: 'Failed to retrieve user',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Update user role (admin only)
   */
  public async updateUserRole(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!userId || !role) {
        const response: IApiResponse = {
          success: false,
          error: 'User ID and role are required',
        };
        res.status(400).json(response);
        return;
      }

      if (!Object.values(UserRole).includes(role)) {
        const response: IApiResponse = {
          success: false,
          error: 'Invalid role',
        };
        res.status(400).json(response);
        return;
      }

      const user = await User.findById(userId);

      if (!user) {
        const response: IApiResponse = {
          success: false,
          error: 'User not found',
        };
        res.status(404).json(response);
        return;
      }

      // Prevent self-role modification
      if (userId === (req as IAuthenticatedRequest).user?.userId) {
        const response: IApiResponse = {
          success: false,
          error: 'Cannot modify your own role',
        };
        res.status(400).json(response);
        return;
      }

      const oldRole = user.role;
      user.role = role;
      await user.save();

      logger.info(`User role updated: ${user.email} from ${oldRole} to ${role} by admin ${(req as IAuthenticatedRequest).user?.email}`);

      const response: IApiResponse = {
        success: true,
        data: {
          user: user.toSafeObject(),
          oldRole,
          newRole: role,
        },
        message: 'User role updated successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Update user role error:', error);
      const response: IApiResponse = {
        success: false,
        error: 'Failed to update user role',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Ban/unban user (admin only)
   */
  public async toggleUserBan(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { active } = req.body;

      if (!userId || typeof active !== 'boolean') {
        const response: IApiResponse = {
          success: false,
          error: 'User ID and active status are required',
        };
        res.status(400).json(response);
        return;
      }

      const user = await User.findById(userId);

      if (!user) {
        const response: IApiResponse = {
          success: false,
          error: 'User not found',
        };
        res.status(404).json(response);
        return;
      }

      // Prevent self-ban
      if (userId === (req as IAuthenticatedRequest).user?.userId) {
        const response: IApiResponse = {
          success: false,
          error: 'Cannot ban yourself',
        };
        res.status(400).json(response);
        return;
      }

      const wasActive = user.isActive;
      user.isActive = active;
      await user.save();

      // Disconnect all active WebSocket connections for banned users
      if (!active) {
        // This would need to be implemented in the WebSocket service
        logger.info(`User banned: ${user.email} by admin ${(req as IAuthenticatedRequest).user?.email}`);
      } else {
        logger.info(`User unbanned: ${user.email} by admin ${(req as IAuthenticatedRequest).user?.email}`);
      }

      const response: IApiResponse = {
        success: true,
        data: {
          user: user.toSafeObject(),
          wasActive,
          isActive: active,
        },
        message: active ? 'User unbanned successfully' : 'User banned successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Toggle user ban error:', error);
      const response: IApiResponse = {
        success: false,
        error: 'Failed to update user status',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Get system statistics (admin only)
   */
  public async getSystemStats(req: Request, res: Response): Promise<void> {
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [
        totalUsers,
        activeUsers,
        totalMessages,
        messages24h,
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isActive: true }),
        Message.countDocuments(),
        Message.countDocuments({ timestamp: { $gte: last24h } }),
      ]);

      const rateLimitStats = rateLimitService.getStats();

      const response: IApiResponse = {
        success: true,
        data: {
          users: {
            total: totalUsers,
            active: activeUsers,
            inactive: totalUsers - activeUsers,
          },
          messages: {
            total: totalMessages,
            last24h: messages24h,
          },
          rateLimits: rateLimitStats,
          server: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
          },
        },
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Get system stats error:', error);
      const response: IApiResponse = {
        success: false,
        error: 'Failed to retrieve system statistics',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Get audit logs (admin only)
   */
  public async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = (page - 1) * limit;
      const { eventType, userId } = req.query;

      const filters: any = {};
      if (eventType) filters.eventType = eventType;
      if (userId) filters.userId = userId;

      const logs = await AuditLog.find(filters)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'username email');

      const total = await AuditLog.countDocuments(filters);

      const response: IApiResponse = {
        success: true,
        data: {
          logs,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Get audit logs error:', error);
      const response: IApiResponse = {
        success: false,
        error: 'Failed to retrieve audit logs',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Delete message (admin only)
   */
  public async deleteMessage(req: Request, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;

      if (!messageId) {
        const response: IApiResponse = {
          success: false,
          error: 'Message ID is required',
        };
        res.status(400).json(response);
        return;
      }

      const message = await Message.findById(messageId);

      if (!message) {
        const response: IApiResponse = {
          success: false,
          error: 'Message not found',
        };
        res.status(404).json(response);
        return;
      }

      await message.softDelete();

      logger.info(`Message deleted: ${messageId} by admin ${(req as IAuthenticatedRequest).user?.email}`);

      const response: IApiResponse = {
        success: true,
        message: 'Message deleted successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Delete message error:', error);
      const response: IApiResponse = {
        success: false,
        error: 'Failed to delete message',
      };
      res.status(500).json(response);
    }
  }
}

export const adminController = AdminController.getInstance();