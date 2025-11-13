import { Request, Response } from 'express';
import { AuthController } from '../../controllers/AuthController';
import { authService } from '../../services/AuthService';
import { UserRole, IAuthenticatedRequest } from '../../types/types';
import { createMockUserData, createMockAdminData } from '../utils/testHelpers';

// Mock the services
jest.mock('../../services/AuthService');
jest.mock('../../utils/logger');

describe('AuthController', () => {
  let authController: AuthController;
  let mockRequest: Partial<Request & IAuthenticatedRequest>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    authController = new AuthController();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      body: {},
      ip: '127.0.0.1',
      get: jest.fn(),
      user: {
        userId: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        role: UserRole.USER
      }
    };

    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register user successfully', async () => {
      const userData = createMockUserData();
      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      };

      mockRequest.body = userData;
      (authService.registerUser as jest.Mock).mockResolvedValue({
        user: { ...userData, _id: 'user123', role: 'user' },
        tokens: mockTokens
      });

      await authController.register(mockRequest as Request, mockResponse as Response);

      expect(authService.registerUser).toHaveBeenCalledWith(
        {
          email: userData.email,
          username: userData.username,
          password: userData.password,
          authProvider: userData.authProvider,
          avatar: undefined
        },
        '127.0.0.1',
        undefined
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'User registered successfully',
        data: {
          user: { ...userData, _id: 'user123', role: 'user' },
          tokens: {
            accessToken: mockTokens.accessToken,
            expiresIn: 900
          }
        }
      });
    });

    it('should reject registration with missing fields', async () => {
      mockRequest.body = { email: 'test@example.com' };

      await authController.register(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email, username, and password are required',
        error: 'MISSING_FIELDS'
      });
    });

    it('should reject registration with short password', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        username: 'testuser',
        password: '123'
      };

      await authController.register(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Password must be at least 8 characters long',
        error: 'PASSWORD_TOO_SHORT'
      });
    });

    it('should handle registration conflict', async () => {
      const userData = createMockUserData();
      mockRequest.body = userData;
      (authService.registerUser as jest.Mock).mockRejectedValue(
        new Error('User with this email or username already exists')
      );

      await authController.register(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User with this email or username already exists',
        error: 'USER_EXISTS'
      });
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login user successfully', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'Password123!'
      };
      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      };

      mockRequest.body = loginData;
      (authService.loginUser as jest.Mock).mockResolvedValue({
        user: { ...loginData, _id: 'user123', username: 'testuser' },
        tokens: mockTokens
      });

      await authController.login(mockRequest as Request, mockResponse as Response);

      expect(authService.loginUser).toHaveBeenCalledWith(
        loginData,
        '127.0.0.1',
        undefined
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Login successful',
        data: {
          user: { ...loginData, _id: 'user123', username: 'testuser' },
          tokens: {
            accessToken: mockTokens.accessToken,
            expiresIn: 900
          }
        }
      });
    });

    it('should reject login with missing credentials', async () => {
      mockRequest.body = { email: 'test@example.com' };

      await authController.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email and password are required',
        error: 'MISSING_CREDENTIALS'
      });
    });

    it('should handle invalid credentials', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };
      (authService.loginUser as jest.Mock).mockRejectedValue(
        new Error('Invalid credentials')
      );

      await authController.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid credentials',
        error: 'AUTHENTICATION_FAILED'
      });
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh token successfully', async () => {
      const mockTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      };

      mockRequest.body = { refreshToken: 'old-refresh-token' };
      mockRequest.cookies = {};
      (authService.refreshToken as jest.Mock).mockResolvedValue(mockTokens);

      await authController.refreshToken(mockRequest as Request, mockResponse as Response);

      expect(authService.refreshToken).toHaveBeenCalledWith(
        'old-refresh-token',
        '127.0.0.1',
        undefined
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: mockTokens.accessToken,
          expiresIn: 900
        }
      });
    });

    it('should use refresh token from cookie if not in body', async () => {
      const mockTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      };

      mockRequest.body = {};
      mockRequest.cookies = { refreshToken: 'cookie-refresh-token' };
      (authService.refreshToken as jest.Mock).mockResolvedValue(mockTokens);

      await authController.refreshToken(mockRequest as Request, mockResponse as Response);

      expect(authService.refreshToken).toHaveBeenCalledWith(
        'cookie-refresh-token',
        '127.0.0.1',
        undefined
      );
    });

    it('should reject refresh without token', async () => {
      mockRequest.body = {};
      mockRequest.cookies = {};

      await authController.refreshToken(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Refresh token is required',
        error: 'MISSING_REFRESH_TOKEN'
      });
    });

    it('should handle invalid refresh token', async () => {
      mockRequest.body = { refreshToken: 'invalid-token' };
      (authService.refreshToken as jest.Mock).mockRejectedValue(
        new Error('Invalid refresh token')
      );

      await authController.refreshToken(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired refresh token',
        error: 'INVALID_REFRESH_TOKEN'
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user successfully', async () => {
      await authController.logout(mockRequest as IAuthenticatedRequest, mockResponse as Response);

      expect(authService.logout).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        '127.0.0.1',
        undefined
      );
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('accessToken');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logout successful'
      });
    });

    it('should handle logout without authenticated user', async () => {
      mockRequest.user = undefined;

      await authController.logout(mockRequest as IAuthenticatedRequest, mockResponse as Response);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith('accessToken');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logout successful'
      });
    });
  });

  describe('GET /api/auth/me', () => {
    it('should get user profile successfully', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        username: 'testuser',
        role: UserRole.USER,
        avatar: null,
        isActive: true,
        lastSeen: new Date(),
        createdAt: new Date()
      };

      (authService.getUserById as jest.Mock).mockResolvedValue(mockUser);

      await authController.getProfile(mockRequest as IAuthenticatedRequest, mockResponse as Response);

      expect(authService.getUserById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          user: {
            id: 'user123',
            email: 'test@example.com',
            username: 'testuser',
            role: UserRole.USER,
            avatar: null,
            isActive: true,
            lastSeen: mockUser.lastSeen,
            createdAt: mockUser.createdAt
          }
        }
      });
    });

    it('should handle profile request without authentication', async () => {
      mockRequest.user = undefined;

      await authController.getProfile(mockRequest as IAuthenticatedRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not authenticated',
        error: 'NOT_AUTHENTICATED'
      });
    });

    it('should handle user not found', async () => {
      (authService.getUserById as jest.Mock).mockResolvedValue(null);

      await authController.getProfile(mockRequest as IAuthenticatedRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND'
      });
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('should change password successfully', async () => {
      mockRequest.body = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword456!'
      };

      await authController.changePassword(mockRequest as IAuthenticatedRequest, mockResponse as Response);

      expect(authService.changePassword).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        'OldPassword123!',
        'NewPassword456!',
        '127.0.0.1'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password changed successfully'
      });
    });

    it('should reject password change without authentication', async () => {
      mockRequest.user = undefined;

      await authController.changePassword(mockRequest as IAuthenticatedRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not authenticated',
        error: 'NOT_AUTHENTICATED'
      });
    });

    it('should reject password change with weak new password', async () => {
      mockRequest.body = {
        currentPassword: 'OldPassword123!',
        newPassword: '123'
      };

      await authController.changePassword(mockRequest as IAuthenticatedRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'New password must be at least 8 characters long',
        error: 'PASSWORD_TOO_SHORT'
      });
    });

    it('should handle incorrect current password', async () => {
      mockRequest.body = {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewPassword456!'
      };
      (authService.changePassword as jest.Mock).mockRejectedValue(
        new Error('Current password is incorrect')
      );

      await authController.changePassword(mockRequest as IAuthenticatedRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Current password is incorrect',
        error: 'INVALID_CURRENT_PASSWORD'
      });
    });
  });

  describe('Admin Functions', () => {
    let adminRequest: Partial<IAuthenticatedRequest>;

    beforeEach(() => {
      adminRequest = {
        ...mockRequest,
        user: {
          userId: 'admin123',
          email: 'admin@example.com',
          role: UserRole.ADMIN
        }
      };
    });

    it('should ban user successfully', async () => {
      adminRequest.body = {
        userId: 'target123',
        reason: 'Violation of terms'
      };

      await authController.banUser(adminRequest as IAuthenticatedRequest, mockResponse as Response);

      expect(authService.banUser).toHaveBeenCalledWith(
        'admin123',
        'target123',
        'Violation of terms',
        '127.0.0.1'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'User banned successfully'
      });
    });

    it('should reject ban with insufficient permissions', async () => {
      const userRequest = {
        ...mockRequest,
        user: {
          userId: 'user123',
          email: 'user@example.com',
          role: UserRole.USER
        }
      };
      userRequest.body = {
        userId: 'target123',
        reason: 'Just because'
      };
      (authService.banUser as jest.Mock).mockRejectedValue(
        new Error('Insufficient permissions')
      );

      await authController.banUser(userRequest as IAuthenticatedRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions to ban users',
        error: 'INSUFFICIENT_PERMISSIONS'
      });
    });

    it('should unban user successfully', async () => {
      adminRequest.body = {
        userId: 'target123',
        reason: 'Ban lifted'
      };

      await authController.unbanUser(adminRequest as IAuthenticatedRequest, mockResponse as Response);

      expect(authService.unbanUser).toHaveBeenCalledWith(
        'admin123',
        'target123',
        'Ban lifted',
        '127.0.0.1'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'User unbanned successfully'
      });
    });

    it('should reject unban without admin permissions', async () => {
      const userRequest = {
        ...mockRequest,
        user: {
          userId: 'user123',
          email: 'user@example.com',
          role: UserRole.USER
        }
      };
      userRequest.body = {
        userId: 'target123',
        reason: 'Unban request'
      };
      (authService.unbanUser as jest.Mock).mockRejectedValue(
        new Error('Insufficient permissions')
      );

      await authController.unbanUser(userRequest as IAuthenticatedRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions to unban users',
        error: 'INSUFFICIENT_PERMISSIONS'
      });
    });
  });
});