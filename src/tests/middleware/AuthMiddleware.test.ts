import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/AuthMiddleware';
import { jwtService } from '../../services/JwtService';
import { User } from '../../models/User';
import { UserRole, IAuthenticatedRequest } from '../../types/types';

// Mock the services and models
jest.mock('../../services/JwtService');
jest.mock('../../models/User');
jest.mock('../../utils/logger');

describe('AuthMiddleware', () => {
  let mockRequest: Partial<Request & IAuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('Authentication Token Validation', () => {
    it('should successfully authenticate with valid token', async () => {
      const mockToken = 'valid.jwt.token';
      const mockPayload = {
        userId: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        role: UserRole.USER
      };
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        username: 'testuser',
        role: UserRole.USER,
        isActive: true,
        lastSeen: new Date(),
        createdAt: new Date()
      };

      mockRequest = {
        headers: {
          authorization: `Bearer ${mockToken}`
        }
      };

      (jwtService.verifyAccessToken as jest.Mock).mockReturnValue(mockPayload);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(jwtService.verifyAccessToken).toHaveBeenCalledWith(mockToken);
      expect(User.findById).toHaveBeenCalledWith(mockPayload.userId);
      expect(mockRequest.user).toEqual(mockPayload);
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject request with missing authorization header', async () => {
      mockRequest = {
        headers: {}
      };

      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access token is required',
        error: 'MISSING_TOKEN'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with malformed authorization header', async () => {
      mockRequest = {
        headers: {
          authorization: 'InvalidFormat token'
        }
      };

      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid authorization header format',
        error: 'INVALID_AUTH_FORMAT'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token', async () => {
      const mockToken = 'invalid.jwt.token';

      mockRequest = {
        headers: {
          authorization: `Bearer ${mockToken}`
        }
      };

      (jwtService.verifyAccessToken as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(jwtService.verifyAccessToken).toHaveBeenCalledWith(mockToken);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired access token',
        error: 'INVALID_TOKEN'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request for inactive user', async () => {
      const mockToken = 'valid.jwt.token';
      const mockPayload = {
        userId: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        role: UserRole.USER
      };
      const mockInactiveUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        username: 'testuser',
        role: UserRole.USER,
        isActive: false,
        lastSeen: new Date(),
        createdAt: new Date()
      };

      mockRequest = {
        headers: {
          authorization: `Bearer ${mockToken}`
        }
      };

      (jwtService.verifyAccessToken as jest.Mock).mockReturnValue(mockPayload);
      (User.findById as jest.Mock).mockResolvedValue(mockInactiveUser);

      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User account is inactive',
        error: 'USER_INACTIVE'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request for non-existent user', async () => {
      const mockToken = 'valid.jwt.token';
      const mockPayload = {
        userId: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        role: UserRole.USER
      };

      mockRequest = {
        headers: {
          authorization: `Bearer ${mockToken}`
        }
      };

      (jwtService.verifyAccessToken as jest.Mock).mockReturnValue(mockPayload);
      (User.findById as jest.Mock).mockResolvedValue(null);

      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Token Source Priority', () => {
    it('should prioritize authorization header over cookie', async () => {
      const mockHeaderToken = 'header.token';
      const mockCookieToken = 'cookie.token';
      const mockPayload = {
        userId: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        role: UserRole.USER
      };
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        username: 'testuser',
        role: UserRole.USER,
        isActive: true,
        lastSeen: new Date(),
        createdAt: new Date()
      };

      mockRequest = {
        headers: {
          authorization: `Bearer ${mockHeaderToken}`
        },
        cookies: {
          accessToken: mockCookieToken
        }
      };

      (jwtService.verifyAccessToken as jest.Mock).mockReturnValue(mockPayload);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(jwtService.verifyAccessToken).toHaveBeenCalledWith(mockHeaderToken);
      expect(jwtService.verifyAccessToken).not.toHaveBeenCalledWith(mockCookieToken);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should use cookie token when authorization header is missing', async () => {
      const mockCookieToken = 'cookie.token';
      const mockPayload = {
        userId: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        role: UserRole.USER
      };
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        username: 'testuser',
        role: UserRole.USER,
        isActive: true,
        lastSeen: new Date(),
        createdAt: new Date()
      };

      mockRequest = {
        headers: {},
        cookies: {
          accessToken: mockCookieToken
        }
      };

      (jwtService.verifyAccessToken as jest.Mock).mockReturnValue(mockPayload);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(jwtService.verifyAccessToken).toHaveBeenCalledWith(mockCookieToken);
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('Rate Limiting and Security', () => {
    it('should handle token verification errors gracefully', async () => {
      const mockToken = 'malformed.token';
      const userAgent = 'Test-Agent/1.0';
      const ipAddress = '192.168.1.1';

      mockRequest = {
        headers: {
          authorization: `Bearer ${mockToken}`,
          'user-agent': userAgent
        },
        ip: ipAddress
      };

      (jwtService.verifyAccessToken as jest.Mock).mockImplementation(() => {
        throw new Error('Token verification failed');
      });

      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired access token',
        error: 'INVALID_TOKEN'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const mockToken = 'valid.jwt.token';
      const mockPayload = {
        userId: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        role: UserRole.USER
      };

      mockRequest = {
        headers: {
          authorization: `Bearer ${mockToken}`
        }
      };

      (jwtService.verifyAccessToken as jest.Mock).mockReturnValue(mockPayload);
      (User.findById as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error during authentication',
        error: 'INTERNAL_ERROR'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Role-based Access Control', () => {
    it('should correctly populate user role in request object', async () => {
      const mockToken = 'valid.jwt.token';
      const mockPayload = {
        userId: '507f1f77bcf86cd799439011',
        email: 'admin@example.com',
        role: UserRole.ADMIN
      };
      const mockAdminUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'admin@example.com',
        username: 'admin',
        role: UserRole.ADMIN,
        isActive: true,
        lastSeen: new Date(),
        createdAt: new Date()
      };

      mockRequest = {
        headers: {
          authorization: `Bearer ${mockToken}`
        }
      };

      (jwtService.verifyAccessToken as jest.Mock).mockReturnValue(mockPayload);
      (User.findById as jest.Mock).mockResolvedValue(mockAdminUser);

      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual({
        userId: mockPayload.userId,
        email: mockPayload.email,
        role: UserRole.ADMIN
      });
      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});