import { User, IUserDocument } from '../models';
import { jwtService } from './JwtService';
import { rateLimitService } from './RateLimitService';
import { IAuthTokens, IUserCreateInput, IUserLoginInput, IJwtPayload, IUser, UserRole } from '../types/types';
import { logger } from '../utils/logger';
import { AuditLog } from '../models/AuditLog';
import { AuditEventType } from '../types/types';

export class AuthService {
  private static instance: AuthService;
  private usedRefreshTokens = new Set<string>();

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Register a new user
   */
  public async registerUser(
    userData: IUserCreateInput,
    ipAddress: string,
    userAgent?: string
  ): Promise<{ user: Partial<IUser>; tokens: IAuthTokens }> {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [
          { email: userData.email.toLowerCase() },
          { username: userData.username.trim() }
        ]
      });

      if (existingUser) {
        await AuditLog.createLog(
          AuditEventType.REGISTER,
          ipAddress,
          undefined,
          { email: userData.email, username: userData.username, reason: 'User already exists' },
          false,
          userAgent
        );

        throw new Error('User with this email or username already exists');
      }

      // Create new user
      const user = await User.createUser({
        email: userData.email.toLowerCase(),
        username: userData.username.trim(),
        password: userData.password,
        authProvider: userData.authProvider,
        avatar: userData.avatar,
      });

      // Generate tokens
      const tokens = jwtService.generateTokens({
        userId: (user._id as any).toString(),
        email: user.email,
        role: user.role,
      });

      // Log successful registration
      await AuditLog.createLog(
        AuditEventType.REGISTER,
        ipAddress,
        (user._id as any).toString(),
        { userId: user._id, email: user.email },
        true,
        userAgent
      );

      logger.info(`User registered successfully: ${user.email}`);

      return { user: user.toSafeObject(), tokens };
    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Authenticate user with email and password
   */
  public async authenticateUser(
    loginData: IUserLoginInput,
    ipAddress: string,
    userAgent?: string
  ): Promise<{ user: Partial<IUser>; tokens: IAuthTokens }> {
    try {
      // Check rate limiting for login attempts
      const loginRateLimit = rateLimitService.checkLoginRate(loginData.email, ipAddress);
      if (!loginRateLimit.allowed) {
        await AuditLog.createLog(
          AuditEventType.LOGIN_FAILED,
          ipAddress,
          undefined,
          { email: loginData.email, reason: 'Rate limit exceeded' },
          false,
          userAgent
        );

        throw new Error('Too many failed login attempts');
      }

      // Find user with password
      const user = await User.findByEmail(loginData.email, true);

      if (!user) {
        await AuditLog.createLog(
          AuditEventType.LOGIN_FAILED,
          ipAddress,
          undefined,
          { email: loginData.email, reason: 'User not found' },
          false,
          userAgent
        );

        throw new Error('Invalid credentials');
      }

      // Check if user is active
      if (!user.isActive) {
        await AuditLog.createLog(
          AuditEventType.LOGIN_FAILED,
          ipAddress,
          (user._id as any).toString(),
          { email: loginData.email, reason: 'User is inactive' },
          false,
          userAgent
        );

        throw new Error('Account is inactive');
      }

      // Check if user has password (for OAuth users)
      if (!user.password) {
        await AuditLog.createLog(
          AuditEventType.LOGIN_FAILED,
          ipAddress,
          (user._id as any).toString(),
          { email: loginData.email, reason: 'No password set for OAuth user' },
          false,
          userAgent
        );

        throw new Error('Please use OAuth login for this account');
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(loginData.password);

      if (!isPasswordValid) {
        await AuditLog.createLog(
          AuditEventType.LOGIN_FAILED,
          ipAddress,
          (user._id as any).toString(),
          { email: loginData.email, reason: 'Invalid password' },
          false,
          userAgent
        );

        throw new Error('Invalid credentials');
      }

      // Update last seen
      user.lastSeen = new Date();
      await user.save();

      // Generate tokens
      const tokens = jwtService.generateTokens({
        userId: (user._id as any).toString(),
        email: user.email,
        role: user.role,
      });

      // Log successful login
      await AuditLog.createLog(
        AuditEventType.LOGIN_SUCCESS,
        ipAddress,
        (user._id as any).toString(),
        { userId: user._id, email: user.email },
        true,
        userAgent
      );

      logger.info(`User authenticated successfully: ${user.email}`);

      return { user: user.toSafeObject(), tokens };
    } catch (error) {
      logger.error('Authentication error:', error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  public async refreshToken(
    refreshToken: string,
    ipAddress: string,
    userAgent?: string
  ): Promise<IAuthTokens> {
    try {
      // Check if refresh token has been used before (rotation)
      if (this.usedRefreshTokens.has(refreshToken)) {
        throw new Error('Invalid refresh token');
      }

      // Verify refresh token
      const payload = jwtService.verifyRefreshToken(refreshToken);

      // Find user to ensure they still exist and are active
      const user = await User.findById(payload.userId);

      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Mark current refresh token as used
      this.usedRefreshTokens.add(refreshToken);

      // Generate new tokens
      const tokens = jwtService.generateTokens({
        userId: (user._id as any).toString(),
        email: user.email,
        role: user.role,
      });

      logger.info(`Token refreshed for user: ${user.email}`);

      return tokens;
    } catch (error) {
      logger.error('Token refresh error:', error);

      // Log failed refresh attempt
      await AuditLog.createLog(
        AuditEventType.LOGIN_FAILED,
        ipAddress,
        undefined,
        { reason: 'Invalid refresh token', error: (error as Error).message },
        false,
        userAgent
      );

      throw error;
    }
  }

  /**
   * Validate token and return payload
   */
  public validateToken(token: string): IJwtPayload {
    try {
      return jwtService.verifyAccessToken(token);
    } catch (error) {
      logger.debug('Token validation failed:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  public async getUserById(userId: string): Promise<IUserDocument | null> {
    try {
      return await User.findById(userId).select('-password');
    } catch (error) {
      logger.error('Error getting user by ID:', error);
      throw new Error('Failed to get user');
    }
  }

  /**
   * Log user logout
   */
  public async logout(
    userId: string,
    ipAddress: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await AuditLog.createLog(
        AuditEventType.LOGOUT,
        ipAddress,
        userId,
        { userId },
        true,
        userAgent
      );

      logger.info(`User logged out: ${userId}`);
    } catch (error) {
      logger.error('Logout error:', error);
      // Don't throw error on logout to avoid client issues
    }
  }

  /**
   * Login user (alias for authenticateUser)
   */
  public async loginUser(
    loginData: IUserLoginInput,
    ipAddress: string,
    userAgent?: string
  ): Promise<{ user: Partial<IUser>; tokens: IAuthTokens }> {
    return this.authenticateUser(loginData, ipAddress, userAgent);
  }

  /**
   * Update user last seen timestamp
   */
  public async updateUserLastSeen(userId: string): Promise<void> {
    try {
      await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
    } catch (error) {
      logger.error('Error updating user last seen:', error);
      // Don't throw error as this is non-critical
    }
  }

  /**
   * Change user password
   */
  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ipAddress: string
  ): Promise<void> {
    try {
      // Validate new password strength
      if (!this.validatePasswordStrength(newPassword)) {
        throw new Error('Password does not meet security requirements');
      }

      const user = await User.findById(userId).select('+password');
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      user.password = newPassword;
      await user.save();

      // Create audit log
      await AuditLog.createLog(
        AuditEventType.ADMIN_ACTION,
        ipAddress,
        userId,
        { action: 'password_change' },
        true
      );

      logger.info(`Password changed successfully for user: ${user.email}`);
    } catch (error) {
      logger.error('Change password error:', error);
      throw error;
    }
  }

  /**
   * Ban a user (admin only)
   */
  public async banUser(
    adminId: string,
    userId: string,
    reason: string,
    ipAddress: string
  ): Promise<void> {
    try {
      // Verify admin has permission
      const admin = await User.findById(adminId);
      if (!admin || admin.role !== UserRole.ADMIN) {
        throw new Error('Insufficient permissions');
      }

      // Ban the user
      await User.findByIdAndUpdate(userId, { isActive: false });

      // Create audit log
      await AuditLog.createLog(
        AuditEventType.USER_BANNED,
        ipAddress,
        userId,
        { reason, bannedBy: adminId },
        true
      );

      logger.info(`User ${userId} banned by admin ${adminId} for reason: ${reason}`);
    } catch (error) {
      logger.error('Ban user error:', error);
      throw error;
    }
  }

  /**
   * Unban a user (admin only)
   */
  public async unbanUser(
    adminId: string,
    userId: string,
    reason: string,
    ipAddress: string
  ): Promise<void> {
    try {
      // Verify admin has permission
      const admin = await User.findById(adminId);
      if (!admin || admin.role !== UserRole.ADMIN) {
        throw new Error('Insufficient permissions');
      }

      // Unban the user
      await User.findByIdAndUpdate(userId, { isActive: true });

      // Create audit log
      await AuditLog.createLog(
        AuditEventType.USER_BANNED,
        ipAddress,
        userId,
        { reason, unbannedBy: adminId, action: 'unban' },
        true
      );

      logger.info(`User ${userId} unbanned by admin ${adminId} for reason: ${reason}`);
    } catch (error) {
      logger.error('Unban user error:', error);
      throw error;
    }
  }

  /**
   * Validate password strength
   */
  private validatePasswordStrength(password: string): boolean {
    // Basic password strength validation
    if (!password || password.length < 8) {
      return false;
    }

    // Check for at least one uppercase letter, one lowercase letter, and one number
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    // Require at least 3 of the 4 criteria
    const criteriaMet = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;

    return criteriaMet >= 3;
  }
}

export const authService = AuthService.getInstance();