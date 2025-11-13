import { Request, Response, NextFunction } from 'express';
import { jwtService } from '../services/JwtService';
import { User } from '../models/User';
import { IAuthenticatedRequest, UserRole } from '../types/types';
import { logger } from '../utils/logger';

/**
 * Authentication middleware that validates JWT tokens and populates request.user
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from authorization header or cookie
    let token;
    try {
      token = extractToken(req);
    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid authorization header format') {
        res.status(401).json({
          success: false,
          message: 'Invalid authorization header format',
          error: 'INVALID_AUTH_FORMAT'
        });
        return;
      }
      // Other errors, continue to missing token check
      token = null;
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token is required',
        error: 'MISSING_TOKEN'
      });
      return;
    }

    // Verify JWT token
    let payload;
    try {
      payload = jwtService.verifyAccessToken(token);
    } catch (error) {
      logger.warn('Invalid token attempt:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(401).json({
        success: false,
        message: 'Invalid or expired access token',
        error: 'INVALID_TOKEN'
      });
      return;
    }

    // Validate token payload
    if (!payload || !payload.userId || !payload.email) {
      res.status(401).json({
        success: false,
        message: 'Invalid token payload',
        error: 'INVALID_TOKEN_PAYLOAD'
      });
      return;
    }

    // Check if user exists and is active
    let user;
    try {
      user = await User.findById(payload.userId);
    } catch (error) {
      logger.error('Database error during authentication:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during authentication',
        error: 'INTERNAL_ERROR'
      });
      return;
    }

    if (!user) {
      logger.warn('Authentication failed: User not found', {
        userId: payload.userId,
        email: payload.email
      });

      res.status(401).json({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND'
      });
      return;
    }

    if (!user.isActive) {
      logger.warn('Authentication failed: User inactive', {
        userId: payload.userId,
        email: payload.email
      });

      res.status(401).json({
        success: false,
        message: 'User account is inactive',
        error: 'USER_INACTIVE'
      });
      return;
    }

    // Update user's last seen timestamp
    try {
      user.lastSeen = new Date();
      await user.save();
    } catch (error) {
      // Log error but don't fail authentication
      logger.warn('Failed to update last seen timestamp:', error);
    }

    // Attach user payload to request object
    (req as IAuthenticatedRequest).user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role || UserRole.USER
    };

    logger.info('User authenticated successfully', {
      userId: payload.userId,
      email: payload.email,
      role: payload.role
    });

    next();
  } catch (error) {
    logger.error('Unexpected error in authentication middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication',
      error: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Extract JWT token from authorization header or cookie
 */
export const extractToken = (req: Request): string | null => {
  // Priority 1: Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader) {
    // Check for malformed authorization header
    if (!authHeader.startsWith('Bearer ')) {
      throw new Error('Invalid authorization header format');
    }
    return authHeader.substring(7);
  }

  // Priority 2: Cookie
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }

  // Priority 3: Query parameter (less secure, for WebSocket connections)
  if (req.query && req.query.token) {
    return req.query.token as string;
  }

  return null;
};

/**
 * Middleware to require admin role
 */
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const user = (req as IAuthenticatedRequest).user;

  if (!user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
      error: 'AUTHENTICATION_REQUIRED'
    });
    return;
  }

  if (user.role !== UserRole.ADMIN) {
    res.status(403).json({
      success: false,
      message: 'Admin privileges required',
      error: 'INSUFFICIENT_PERMISSIONS'
    });
    return;
  }

  next();
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = extractToken(req);

  if (!token) {
    // No token provided, continue without authentication
    next();
    return;
  }

  // Token provided, attempt authentication
  await authMiddleware(req, res, next);
};

/**
 * Middleware to require specific roles
 */
export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as IAuthenticatedRequest).user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'AUTHENTICATION_REQUIRED'
      });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        error: 'INSUFFICIENT_PERMISSIONS'
      });
      return;
    }

    next();
  };
};