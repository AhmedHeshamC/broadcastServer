import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/AuthService';
import { jwtService } from '../services/JwtService';
import { IApiResponse, UserRole } from '../types/types';
import { IAuthenticatedRequest } from '../types/AuthenticatedRequest';
import { logger } from '../utils/logger';

/**
 * Authentication middleware to verify JWT token
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = jwtService.extractTokenFromHeader(authHeader);

    if (!token) {
      const response: IApiResponse = {
        success: false,
        error: 'Access token required',
      };
      res.status(401).json(response);
      return;
    }

    const payload = authService.validateToken(token);
    (req as IAuthenticatedRequest).user = payload;

    next();
  } catch (error) {
    logger.debug('Authentication failed:', error);

    const response: IApiResponse = {
      success: false,
      error: 'Invalid or expired access token',
    };
    res.status(401).json(response);
    return;
  }
};

/**
 * Authorization middleware to check user role
 */
export const requireRole = (requiredRole: UserRole) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authenticatedReq = req as IAuthenticatedRequest;

    if (!authenticatedReq.user) {
      const response: IApiResponse = {
        success: false,
        error: 'Authentication required',
      };
      res.status(401).json(response);
      return;
    }

    if (authenticatedReq.user.role !== requiredRole && authenticatedReq.user.role !== UserRole.ADMIN) {
      const response: IApiResponse = {
        success: false,
        error: 'Insufficient permissions',
      };
      res.status(403).json(response);
      return;
    }

    next();
  };
};

/**
 * Middleware to require admin role
 */
export const requireAdmin = requireRole(UserRole.ADMIN);

/**
 * Optional authentication middleware - doesn't fail if no token
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = jwtService.extractTokenFromHeader(authHeader);

    if (token) {
      const payload = authService.validateToken(token);
      (req as IAuthenticatedRequest).user = payload;
    }

    next();
  } catch (error) {
    // Continue without authentication for optional routes
    logger.debug('Optional authentication failed:', error);
    next();
  }
};

/**
 * Middleware to extract IP address and user agent
 */
export const extractRequestInfo = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Get IP address from various sources
  const ipAddress = req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection as any)?.socket?.remoteAddress ||
    '127.0.0.1';

  // Get user agent
  const userAgent = req.headers['user-agent'];

  // Attach to request for use in other middleware/controllers
  (req as any).ipAddress = ipAddress;
  (req as any).userAgent = userAgent;

  next();
};