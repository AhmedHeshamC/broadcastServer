import { Request, Response } from 'express';
import { Message } from '../models/Message';
import { User } from '../models/User';
import { webSocketService } from '../services/WebSocketService';
import { IAuthenticatedRequest } from '../types/AuthenticatedRequest';
import { logger } from '../utils/logger';
import { UserRole } from '../types/types';

export interface ICreateMessageRequest {
  content: string;
  type?: 'message' | 'system';
  metadata?: Record<string, any>;
}

export interface IMessageQuery {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | '-createdAt';
  senderId?: string;
  type?: string;
  search?: string;
}

export interface IMessageUpdateRequest {
  content?: string;
  metadata?: Record<string, any>;
}

export class MessageController {
  /**
   * Create and send a new message
   */
  public createMessage = async (req: IAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { content, type = 'message', metadata }: ICreateMessageRequest = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: 'NOT_AUTHENTICATED'
        });
        return;
      }

      // Validate required fields
      if (!content || content.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: 'Message content is required',
          error: 'MISSING_CONTENT'
        });
        return;
      }

      // Validate message length
      if (content.length > 1000) {
        res.status(400).json({
          success: false,
          message: 'Message content too long (max 1000 characters)',
          error: 'CONTENT_TOO_LONG'
        });
        return;
      }

      // Get user information
      const user = await User.findById(userId).select('username email role');
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        });
        return;
      }

      // Create message
      const message = await Message.createMessage({
        content: content.trim(),
        senderId: userId,
        senderName: user.username,
        type: type as any,
        metadata: metadata || {}
      });

      // Get populated message for response
      const populatedMessage = await Message.findById(message._id)
        .populate('senderId', 'username email avatar role');

      // Broadcast message via WebSocket
      webSocketService.broadcastMessage({
        type: type as 'message' | 'system',
        content: message.content,
        senderId: userId,
        senderName: user.username,
        timestamp: (message as any).createdAt || message.timestamp,
        messageId: (message as any)._id?.toString() || '',
        metadata
      });

      logger.info(`Message created: ${message._id} by user ${userId}`);

      res.status(201).json({
        success: true,
        message: 'Message created successfully',
        data: {
          message: populatedMessage
        }
      });
    } catch (error) {
      logger.error('Create message error:', error);

      res.status(500).json({
        success: false,
        message: 'Internal server error while creating message',
        error: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * Get messages with pagination and filtering
   */
  public getMessages = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 50,
        sortBy = '-createdAt',
        senderId,
        type,
        search
      }: IMessageQuery = req.query;

      // Parse query parameters
      const pageNum = parseInt(page.toString(), 10);
      const limitNum = parseInt(limit.toString(), 10);
      const skip = (pageNum - 1) * limitNum;

      // Validate pagination
      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        res.status(400).json({
          success: false,
          message: 'Invalid pagination parameters',
          error: 'INVALID_PAGINATION'
        });
        return;
      }

      // Build filter
      const filter: any = {};
      if (senderId) filter.senderId = senderId;
      if (type) filter.type = type;
      if (search) {
        filter.content = { $regex: search, $options: 'i' };
      }

      // Get messages
      const messages = await Message.getMessagesPaginated(filter, {
        page: pageNum,
        limit: limitNum,
        sortBy
      });

      // Get total count for pagination info
      const total = await Message.countDocuments(filter);

      res.status(200).json({
        success: true,
        message: 'Messages retrieved successfully',
        data: {
          messages,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum)
          }
        }
      });
    } catch (error) {
      logger.error('Get messages error:', error);

      res.status(500).json({
        success: false,
        message: 'Internal server error while retrieving messages',
        error: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * Get a specific message by ID
   */
  public getMessageById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Message ID is required',
          error: 'MISSING_MESSAGE_ID'
        });
        return;
      }

      const message = await Message.findById(id)
        .populate('senderId', 'username email avatar role');

      if (!message) {
        res.status(404).json({
          success: false,
          message: 'Message not found',
          error: 'MESSAGE_NOT_FOUND'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Message retrieved successfully',
        data: {
          message
        }
      });
    } catch (error) {
      logger.error('Get message by ID error:', error);

      res.status(500).json({
        success: false,
        message: 'Internal server error while retrieving message',
        error: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * Update a message (only by sender or admin)
   */
  public updateMessage = async (req: IAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      const userRole = req.user?.role;
      const { content, metadata }: IMessageUpdateRequest = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: 'NOT_AUTHENTICATED'
        });
        return;
      }

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Message ID is required',
          error: 'MISSING_MESSAGE_ID'
        });
        return;
      }

      // Find message
      const message = await Message.findById(id);
      if (!message) {
        res.status(404).json({
          success: false,
          message: 'Message not found',
          error: 'MESSAGE_NOT_FOUND'
        });
        return;
      }

      // Check permissions
      const isSender = message.senderId.toString() === userId;
      const isAdmin = userRole === UserRole.ADMIN;

      if (!isSender && !isAdmin) {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions to update this message',
          error: 'INSUFFICIENT_PERMISSIONS'
        });
        return;
      }

      // Validate content if provided
      if (content && content.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: 'Message content cannot be empty',
          error: 'EMPTY_CONTENT'
        });
        return;
      }

      if (content && content.length > 1000) {
        res.status(400).json({
          success: false,
          message: 'Message content too long (max 1000 characters)',
          error: 'CONTENT_TOO_LONG'
        });
        return;
      }

      // Update message
      if (content) (message as any).content = content.trim();
      if (metadata) (message as any).metadata = { ...(message as any).metadata, ...metadata };

      (message as any).updatedAt = new Date();
      await message.save();

      logger.info(`Message updated: ${id} by user ${userId}`);

      res.status(200).json({
        success: true,
        message: 'Message updated successfully',
        data: {
          message
        }
      });
    } catch (error) {
      logger.error('Update message error:', error);

      res.status(500).json({
        success: false,
        message: 'Internal server error while updating message',
        error: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * Delete a message (only by sender or admin)
   */
  public deleteMessage = async (req: IAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      const userRole = req.user?.role;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: 'NOT_AUTHENTICATED'
        });
        return;
      }

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Message ID is required',
          error: 'MISSING_MESSAGE_ID'
        });
        return;
      }

      // Find message
      const message = await Message.findById(id);
      if (!message) {
        res.status(404).json({
          success: false,
          message: 'Message not found',
          error: 'MESSAGE_NOT_FOUND'
        });
        return;
      }

      // Check permissions
      const isSender = message.senderId.toString() === userId;
      const isAdmin = userRole === UserRole.ADMIN;

      if (!isSender && !isAdmin) {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions to delete this message',
          error: 'INSUFFICIENT_PERMISSIONS'
        });
        return;
      }

      // Delete message
      await Message.findByIdAndDelete(id);

      logger.info(`Message deleted: ${id} by user ${userId}`);

      res.status(200).json({
        success: true,
        message: 'Message deleted successfully'
      });
    } catch (error) {
      logger.error('Delete message error:', error);

      res.status(500).json({
        success: false,
        message: 'Internal server error while deleting message',
        error: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * Get message history for a user or globally
   */
  public getMessageHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        userId,
        page = 1,
        limit = 20,
        hours = 24
      } = req.query;

      // Parse parameters
      const pageNum = parseInt(page.toString(), 10);
      const limitNum = parseInt(limit.toString(), 10);
      const hoursNum = parseInt(hours.toString(), 10);
      const skip = (pageNum - 1) * limitNum;

      // Validate parameters
      if (pageNum < 1 || limitNum < 1 || limitNum > 100 || hoursNum < 1 || hoursNum > 168) {
        res.status(400).json({
          success: false,
          message: 'Invalid parameters',
          error: 'INVALID_PARAMETERS'
        });
        return;
      }

      // Calculate time range
      const startDate = new Date(Date.now() - hoursNum * 60 * 60 * 1000);

      // Build filter
      const filter: any = {
        createdAt: { $gte: startDate }
      };

      if (userId) {
        filter.senderId = userId;
      }

      // Get messages
      const messages = await Message.getMessagesPaginated(filter, {
        page: pageNum,
        limit: limitNum,
        sortBy: '-createdAt'
      });

      // Get statistics
      const [userStats, typeStats] = await Promise.all([
        Message.aggregateByUser(filter),
        Message.aggregateByType(filter)
      ]);

      res.status(200).json({
        success: true,
        message: 'Message history retrieved successfully',
        data: {
          messages,
          timeRange: {
            hours: hoursNum,
            startDate,
            endDate: new Date()
          },
          statistics: {
            userStats,
            typeStats
          }
        }
      });
    } catch (error) {
      logger.error('Get message history error:', error);

      res.status(500).json({
        success: false,
        message: 'Internal server error while retrieving message history',
        error: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * Search messages
   */
  public searchMessages = async (req: Request, res: Response): Promise<void> => {
    try {
      const { q, page = 1, limit = 20, senderId, type } = req.body;

      if (!q || q.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: 'Search query is required',
          error: 'MISSING_SEARCH_QUERY'
        });
        return;
      }

      // Parse pagination
      const pageNum = parseInt(page.toString(), 10);
      const limitNum = parseInt(limit.toString(), 10);
      const skip = (pageNum - 1) * limitNum;

      // Validate parameters
      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        res.status(400).json({
          success: false,
          message: 'Invalid pagination parameters',
          error: 'INVALID_PAGINATION'
        });
        return;
      }

      // Build search filter
      const filter: any = {
        content: { $regex: q.trim(), $options: 'i' }
      };

      if (senderId) filter.senderId = senderId;
      if (type) filter.type = type;

      // Search messages
      const messages = await Message.getMessagesPaginated(filter, {
        page: pageNum,
        limit: limitNum,
        sortBy: '-createdAt'
      });

      // Get total count
      const total = await Message.countDocuments(filter);

      res.status(200).json({
        success: true,
        message: 'Search completed successfully',
        data: {
          messages,
          searchQuery: q.trim(),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum)
          }
        }
      });
    } catch (error) {
      logger.error('Search messages error:', error);

      res.status(500).json({
        success: false,
        message: 'Internal server error while searching messages',
        error: 'INTERNAL_ERROR'
      });
    }
  };
}

export const messageController = new MessageController();