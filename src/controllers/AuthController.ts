import { Request, Response } from 'express';
import { authService } from '../services/AuthService';
import { jwtService } from '../services/JwtService';
import { rateLimitService } from '../services/RateLimitService';
import { logger } from '../utils/logger';
import { IAuthenticatedRequest } from '../types/AuthenticatedRequest';
import { UserRole } from '../types/types';

export class AuthController {
  /**
   * Register a new user
   */
  public register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, username, password, authProvider, avatar } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent');

      // Validate required fields
      if (!email || !username || !password) {
        res.status(400).json({
          success: false,
          message: 'Email, username, and password are required',
          error: 'MISSING_FIELDS'
        });
        return;
      }

      // Basic validation
      if (password.length < 8) {
        res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long',
          error: 'PASSWORD_TOO_SHORT'
        });
        return;
      }

      if (username.length < 3) {
        res.status(400).json({
          success: false,
          message: 'Username must be at least 3 characters long',
          error: 'USERNAME_TOO_SHORT'
        });
        return;
      }

      const result = await authService.registerUser(
        { email, username, password, authProvider, avatar },
        ipAddress,
        userAgent
      );

      // Set HTTP-only cookies for tokens
      res.cookie('accessToken', result.tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: result.user,
          tokens: {
            accessToken: result.tokens.accessToken,
            expiresIn: 15 * 60 // 15 minutes
          }
        }
      });
    } catch (error) {
      logger.error('Registration error:', error);

      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          res.status(409).json({
            success: false,
            message: error.message,
            error: 'USER_EXISTS'
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error during registration',
        error: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * Authenticate user
   */
  public login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent');

      // Validate required fields
      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Email and password are required',
          error: 'MISSING_CREDENTIALS'
        });
        return;
      }

      const result = await authService.loginUser(
        { email, password },
        ipAddress,
        userAgent
      );

      // Set HTTP-only cookies for tokens
      res.cookie('accessToken', result.tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          tokens: {
            accessToken: result.tokens.accessToken,
            expiresIn: 15 * 60 // 15 minutes
          }
        }
      });
    } catch (error) {
      logger.error('Login error:', error);

      if (error instanceof Error) {
        if (error.message.includes('Invalid credentials') || error.message.includes('Account is inactive')) {
          res.status(401).json({
            success: false,
            message: error.message,
            error: 'AUTHENTICATION_FAILED'
          });
          return;
        }

        if (error.message.includes('Too many failed login attempts')) {
          res.status(429).json({
            success: false,
            message: 'Too many failed login attempts. Please try again later.',
            error: 'RATE_LIMIT_EXCEEDED'
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error during login',
        error: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * Refresh access token
   */
  public refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent');

      // Check for refresh token in body or cookie
      const tokenToUse = refreshToken || req.cookies?.refreshToken;

      if (!tokenToUse) {
        res.status(401).json({
          success: false,
          message: 'Refresh token is required',
          error: 'MISSING_REFRESH_TOKEN'
        });
        return;
      }

      const tokens = await authService.refreshToken(tokenToUse, ipAddress, userAgent);

      // Set new access token cookie
      res.cookie('accessToken', tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: tokens.accessToken,
          expiresIn: 15 * 60 // 15 minutes
        }
      });
    } catch (error) {
      logger.error('Token refresh error:', error);

      if (error instanceof Error) {
        if (error.message.includes('Invalid refresh token') || error.message.includes('expired')) {
          res.status(401).json({
            success: false,
            message: 'Invalid or expired refresh token',
            error: 'INVALID_REFRESH_TOKEN'
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error during token refresh',
        error: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * Logout user
   */
  public logout = async (req: IAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent');

      if (userId) {
        await authService.logout(userId, ipAddress, userAgent);
      }

      // Clear cookies
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');

      res.status(200).json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      logger.error('Logout error:', error);

      // Always clear cookies even if logout fails
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');

      res.status(500).json({
        success: false,
        message: 'Internal server error during logout',
        error: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * Get current user profile
   */
  public getProfile = async (req: IAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: 'NOT_AUTHENTICATED'
        });
        return;
      }

      const user = await authService.getUserById(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          user: {
            id: user._id,
            email: user.email,
            username: user.username,
            role: user.role,
            avatar: user.avatar,
            isActive: user.isActive,
            lastSeen: user.lastSeen,
            createdAt: user.createdAt
          }
        }
      });
    } catch (error) {
      logger.error('Get profile error:', error);

      res.status(500).json({
        success: false,
        message: 'Internal server error while retrieving profile',
        error: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * Verify token (for client-side validation)
   */
  public verifyToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.body;

      if (!token) {
        res.status(400).json({
          success: false,
          message: 'Token is required',
          error: 'MISSING_TOKEN'
        });
        return;
      }

      const user = await authService.validateToken(token);

      res.status(200).json({
        success: true,
        message: 'Token is valid',
        data: { user }
      });
    } catch (error) {
      logger.debug('Token verification failed:', error);

      res.status(401).json({
        success: false,
        message: 'Token is invalid',
        error: 'INVALID_TOKEN'
      });
    }
  };

  /**
   * Change password
   */
  public changePassword = async (req: IAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user?.userId;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: 'NOT_AUTHENTICATED'
        });
        return;
      }

      // Validate required fields
      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          message: 'Current password and new password are required',
          error: 'MISSING_FIELDS'
        });
        return;
      }

      // Validate new password strength
      if (newPassword.length < 8) {
        res.status(400).json({
          success: false,
          message: 'New password must be at least 8 characters long',
          error: 'PASSWORD_TOO_SHORT'
        });
        return;
      }

      await authService.changePassword(userId, currentPassword, newPassword, ipAddress);

      res.status(200).json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      logger.error('Change password error:', error);

      if (error instanceof Error) {
        if (error.message.includes('Current password is incorrect')) {
          res.status(400).json({
            success: false,
            message: 'Current password is incorrect',
            error: 'INVALID_CURRENT_PASSWORD'
          });
          return;
        }

        if (error.message.includes('User not found')) {
          res.status(404).json({
            success: false,
            message: 'User not found',
            error: 'USER_NOT_FOUND'
          });
          return;
        }

        if (error.message.includes('does not meet security requirements')) {
          res.status(400).json({
            success: false,
            message: 'New password does not meet security requirements',
            error: 'WEAK_PASSWORD'
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error while changing password',
        error: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * Admin: Ban user
   */
  public banUser = async (req: IAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId: targetUserId, reason } = req.body;
      const adminId = req.user?.userId;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      if (!adminId) {
        res.status(401).json({
          success: false,
          message: 'Admin not authenticated',
          error: 'NOT_AUTHENTICATED'
        });
        return;
      }

      // Validate required fields
      if (!targetUserId || !reason) {
        res.status(400).json({
          success: false,
          message: 'Target user ID and reason are required',
          error: 'MISSING_FIELDS'
        });
        return;
      }

      await authService.banUser(adminId, targetUserId, reason, ipAddress);

      res.status(200).json({
        success: true,
        message: 'User banned successfully'
      });
    } catch (error) {
      logger.error('Ban user error:', error);

      if (error instanceof Error) {
        if (error.message.includes('Insufficient permissions')) {
          res.status(403).json({
            success: false,
            message: 'Insufficient permissions to ban users',
            error: 'INSUFFICIENT_PERMISSIONS'
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error while banning user',
        error: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * Admin: Unban user
   */
  public unbanUser = async (req: IAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId: targetUserId, reason } = req.body;
      const adminId = req.user?.userId;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      if (!adminId) {
        res.status(401).json({
          success: false,
          message: 'Admin not authenticated',
          error: 'NOT_AUTHENTICATED'
        });
        return;
      }

      // Validate required fields
      if (!targetUserId || !reason) {
        res.status(400).json({
          success: false,
          message: 'Target user ID and reason are required',
          error: 'MISSING_FIELDS'
        });
        return;
      }

      await authService.unbanUser(adminId, targetUserId, reason, ipAddress);

      res.status(200).json({
        success: true,
        message: 'User unbanned successfully'
      });
    } catch (error) {
      logger.error('Unban user error:', error);

      if (error instanceof Error) {
        if (error.message.includes('Insufficient permissions')) {
          res.status(403).json({
            success: false,
            message: 'Insufficient permissions to unban users',
            error: 'INSUFFICIENT_PERMISSIONS'
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error while unbanning user',
        error: 'INTERNAL_ERROR'
      });
    }
  };
}

export const authController = new AuthController();