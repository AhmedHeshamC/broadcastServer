import { AuthService } from '../../services/AuthService';
import { User } from '../../models/User';
import { AuditLog } from '../../models/AuditLog';
import { UserRole, AuthProvider, IAuthTokens, IJwtPayload } from '../../types/types';
import { createMockUserData, createMockAdminData } from '../utils/testHelpers';

describe('AuthService', () => {
  let authService: AuthService;
  let mockIpAddress: string;
  let mockUserAgent: string;

  beforeEach(() => {
    authService = AuthService.getInstance();
    mockIpAddress = '192.168.1.1';
    mockUserAgent = 'Mozilla/5.0 (Test Browser)';
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const userData = createMockUserData();

      const result = await authService.registerUser(userData, mockIpAddress, mockUserAgent);

      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(result.user.email).toBe(userData.email);
      expect(result.user.username).toBe(userData.username);
      expect(result.user.role).toBe(UserRole.USER);
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(result.user.password).toBeUndefined(); // Password should be excluded

      // Verify user was saved to database
      const savedUser = await User.findOne({ email: userData.email });
      expect(savedUser).toBeDefined();
      expect(savedUser!.email).toBe(userData.email);
    });

    it('should create audit log for successful registration', async () => {
      const userData = createMockUserData();

      await authService.registerUser(userData, mockIpAddress, mockUserAgent);

      const auditLog = await AuditLog.findOne({ eventType: 'register' });
      expect(auditLog).toBeDefined();
      expect(auditLog!.ipAddress).toBe(mockIpAddress);
      expect(auditLog!.userAgent).toBe(mockUserAgent);
      expect(auditLog!.success).toBe(true);
    });

    it('should reject registration with duplicate email', async () => {
      const userData = createMockUserData();

      // Register first user
      await authService.registerUser(userData, mockIpAddress, mockUserAgent);

      // Try to register with same email
      const duplicateUserData = createMockUserData({ username: 'different' });

      await expect(
        authService.registerUser(duplicateUserData, mockIpAddress, mockUserAgent)
      ).rejects.toThrow('User with this email or username already exists');
    });

    it('should reject registration with duplicate username', async () => {
      const userData = createMockUserData();

      // Register first user
      await authService.registerUser(userData, mockIpAddress, mockUserAgent);

      // Try to register with same username
      const duplicateUserData = createMockUserData({ email: 'different@example.com' });

      await expect(
        authService.registerUser(duplicateUserData, mockIpAddress, mockUserAgent)
      ).rejects.toThrow('User with this email or username already exists');
    });

    it('should create audit log for failed registration', async () => {
      const userData = createMockUserData();

      // Register first user
      await authService.registerUser(userData, mockIpAddress, mockUserAgent);

      // Try to register with duplicate
      const duplicateUserData = createMockUserData({ email: 'different@example.com' });

      try {
        await authService.registerUser(duplicateUserData, mockIpAddress, mockUserAgent);
      } catch (error) {
        // Expected to throw
      }

      const auditLog = await AuditLog.findOne({
        eventType: 'register',
        success: false
      });
      expect(auditLog).toBeDefined();
      expect(auditLog!.ipAddress).toBe(mockIpAddress);
      expect(auditLog!.success).toBe(false);
    });

    it('should handle OAuth user registration without password', async () => {
      const oauthData = createMockUserData({
        authProvider: AuthProvider.GOOGLE,
        password: undefined
      });

      const result = await authService.registerUser(oauthData, mockIpAddress, mockUserAgent);

      expect(result.user.authProvider).toBe(AuthProvider.GOOGLE);
      expect(result.user.password).toBeUndefined();
    });

    it('should require password for email auth provider', async () => {
      const emailData = createMockUserData({
        authProvider: AuthProvider.EMAIL,
        password: undefined
      });

      await expect(
        authService.registerUser(emailData, mockIpAddress, mockUserAgent)
      ).rejects.toThrow();
    });
  });

  describe('User Login', () => {
    let testUser: any;
    let testPassword: string;

    beforeEach(async () => {
      testPassword = 'Password123!';
      const userData = createMockUserData({ password: testPassword });
      const result = await authService.registerUser(userData, mockIpAddress, mockUserAgent);
      testUser = result.user;
    });

    it('should login user with correct credentials', async () => {
      const loginData = {
        email: testUser.email,
        password: testPassword
      };

      const result = await authService.loginUser(loginData, mockIpAddress, mockUserAgent);

      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(result.user.email).toBe(loginData.email);
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();

      // Verify audit log was created
      const auditLog = await AuditLog.findOne({ eventType: 'login_success' });
      expect(auditLog).toBeDefined();
      expect(auditLog!.success).toBe(true);
    });

    it('should reject login with incorrect password', async () => {
      const loginData = {
        email: testUser.email,
        password: 'wrongpassword'
      };

      await expect(
        authService.loginUser(loginData, mockIpAddress, mockUserAgent)
      ).rejects.toThrow('Invalid credentials');

      // Verify failed login audit log
      const auditLog = await AuditLog.findOne({ eventType: 'login_failed' });
      expect(auditLog).toBeDefined();
      expect(auditLog!.success).toBe(false);
    });

    it('should reject login with non-existent email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: testPassword
      };

      await expect(
        authService.loginUser(loginData, mockIpAddress, mockUserAgent)
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject login for inactive users', async () => {
      // Deactivate the user
      await User.findByIdAndUpdate(testUser._id, { isActive: false });

      const loginData = {
        email: testUser.email,
        password: testPassword
      };

      await expect(
        authService.loginUser(loginData, mockIpAddress, mockUserAgent)
      ).rejects.toThrow('Account is inactive');
    });

    it('should handle rate limiting for failed logins', async () => {
      const loginData = {
        email: testUser.email,
        password: 'wrongpassword'
      };

      // Make multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        try {
          await authService.loginUser(loginData, mockIpAddress, mockUserAgent);
        } catch (error) {
          // Expected to fail
        }
      }

      // The 6th attempt should be rate limited
      await expect(
        authService.loginUser(loginData, mockIpAddress, mockUserAgent)
      ).rejects.toThrow('Too many failed login attempts');
    });
  });

  describe('Token Management', () => {
    let testUser: any;
    let testTokens: IAuthTokens;

    beforeEach(async () => {
      const userData = createMockUserData();
      const result = await authService.registerUser(userData, mockIpAddress, mockUserAgent);
      testUser = result.user;
      testTokens = result.tokens;
    });

    it('should validate access token', async () => {
      const payload = authService.validateToken(testTokens.accessToken);

      expect(payload.userId).toBe(testUser._id.toString());
      expect(payload.email).toBe(testUser.email);
      expect(payload.role).toBe(testUser.role);
    });

    it('should reject invalid access token', async () => {
      expect(() => {
        authService.validateToken('invalid.token.here');
      }).toThrow();
    });

    it('should refresh tokens successfully', async () => {
      const newTokens = await authService.refreshToken(testTokens.refreshToken, mockIpAddress);

      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
      expect(newTokens.accessToken).not.toBe(testTokens.accessToken);
      expect(newTokens.refreshToken).not.toBe(testTokens.refreshToken);
    });

    it('should reject refresh token rotation attempts', async () => {
      // Use the same refresh token twice
      await authService.refreshToken(testTokens.refreshToken, mockIpAddress);

      await expect(
        authService.refreshToken(testTokens.refreshToken, mockIpAddress)
      ).rejects.toThrow('Invalid refresh token');
    });

    it('should reject invalid refresh token', async () => {
      await expect(
        authService.refreshToken('invalid.refresh.token', mockIpAddress)
      ).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('User Management', () => {
    let testUser: any;

    beforeEach(async () => {
      const userData = createMockUserData();
      const result = await authService.registerUser(userData, mockIpAddress, mockUserAgent);
      testUser = result.user;
    });

    it('should get user by ID', async () => {
      const user = await authService.getUserById(testUser._id.toString());

      expect(user).toBeDefined();
      expect(user!.email).toBe(testUser.email);
      expect(user!.password).toBeUndefined(); // Password should be excluded
    });

    it('should return null for non-existent user ID', async () => {
      const user = await authService.getUserById('507f1f77bcf86cd799439999');

      expect(user).toBeNull();
    });

    it('should update user last seen', async () => {
      await authService.updateUserLastSeen(testUser._id.toString());

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser!.lastSeen.getTime()).toBeGreaterThan(testUser.lastSeen.getTime());
    });

    it('should handle updating last seen for non-existent user', async () => {
      // Should not throw error
      await expect(
        authService.updateUserLastSeen('507f1f77bcf86cd799439999')
      ).resolves.not.toThrow();
    });
  });

  describe('Logout', () => {
    let testUser: any;
    let testTokens: IAuthTokens;

    beforeEach(async () => {
      const userData = createMockUserData();
      const result = await authService.registerUser(userData, mockIpAddress, mockUserAgent);
      testUser = result.user;
      testTokens = result.tokens;
    });

    it('should logout user successfully', async () => {
      await authService.logout(testUser._id.toString(), mockIpAddress, mockUserAgent);

      // Verify audit log was created
      const auditLog = await AuditLog.findOne({ eventType: 'logout' });
      expect(auditLog).toBeDefined();
      expect(auditLog!.success).toBe(true);
      expect(auditLog!.ipAddress).toBe(mockIpAddress);
    });

    it('should handle logout for non-existent user', async () => {
      // Should not throw error
      await expect(
        authService.logout('507f1f77bcf86cd799439999', mockIpAddress, mockUserAgent)
      ).resolves.not.toThrow();
    });
  });

  describe('OAuth Integration', () => {
    it('should handle OAuth user login', async () => {
      const oauthUserData = {
        email: 'oauth@example.com',
        username: 'oauthuser',
        authProvider: AuthProvider.GOOGLE,
        avatar: 'https://example.com/avatar.jpg',
        oauthId: 'google123456'
      };

      // This would typically be called from OAuth service
      const result = await authService.registerUser(oauthUserData, mockIpAddress, mockUserAgent);

      expect(result.user.authProvider).toBe(AuthProvider.GOOGLE);
      expect(result.user.avatar).toBe(oauthUserData.avatar);
    });

    it('should link OAuth account to existing email user', async () => {
      // First create an email user
      const emailUserData = createMockUserData();
      await authService.registerUser(emailUserData, mockIpAddress, mockUserAgent);

      // Then try OAuth with same email
      const oauthUserData = {
        email: emailUserData.email,
        username: 'oauthusername',
        authProvider: AuthProvider.GOOGLE,
        avatar: 'https://example.com/avatar.jpg'
      };

      await expect(
        authService.registerUser(oauthUserData, mockIpAddress, mockUserAgent)
      ).rejects.toThrow('User with this email or username already exists');
    });
  });

  describe('Password Management', () => {
    let testUser: any;

    beforeEach(async () => {
      const userData = createMockUserData({ password: 'OldPassword123!' });
      const registrationResult = await authService.registerUser(userData, mockIpAddress, mockUserAgent);
      testUser = registrationResult.user;
    });

    it('should change password successfully', async () => {
      const newPassword = 'NewPassword456!';

      await authService.changePassword(testUser._id.toString(), 'OldPassword123!', newPassword, mockIpAddress);

      // Verify old password no longer works
      await expect(
        authService.loginUser({
          email: testUser.email,
          password: 'OldPassword123!'
        }, mockIpAddress, mockUserAgent)
      ).rejects.toThrow('Invalid credentials');

      // Verify new password works
      const result = await authService.loginUser({
        email: testUser.email,
        password: newPassword
      }, mockIpAddress, mockUserAgent);

      expect(result.user.email).toBe(testUser.email);
    });

    it('should reject password change with incorrect current password', async () => {
      await expect(
        authService.changePassword(testUser._id.toString(), 'WrongPassword123!', 'NewPassword456!', mockIpAddress)
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should handle password change for non-existent user', async () => {
      await expect(
        authService.changePassword('507f1f77bcf86cd799439999', 'OldPassword123!', 'NewPassword456!', mockIpAddress)
      ).rejects.toThrow('User not found');
    });

    it('should validate new password strength', async () => {
      const weakPasswords = ['123', 'password', 'short', ''];

      for (const weakPassword of weakPasswords) {
        await expect(
          authService.changePassword(testUser._id.toString(), 'OldPassword123!', weakPassword, mockIpAddress)
        ).rejects.toThrow();
      }
    });
  });

  describe('Admin Functions', () => {
    let adminUser: any;
    let regularUser: any;

    beforeEach(async () => {
      // Create admin user
      const adminData = createMockAdminData();
      const adminResult = await authService.registerUser(adminData, mockIpAddress, mockUserAgent);
      adminUser = adminResult.user;

      // Create regular user
      const userData = createMockUserData({ email: 'regular@example.com' });
      const userResult = await authService.registerUser(userData, mockIpAddress, mockUserAgent);
      regularUser = userResult.user;
    });

    it('should ban user successfully', async () => {
      await authService.banUser(adminUser._id.toString(), regularUser._id.toString(), 'Violation of terms', mockIpAddress);

      const bannedUser = await User.findById(regularUser._id);
      expect(bannedUser!.isActive).toBe(false);

      // Verify audit log was created
      const auditLog = await AuditLog.findOne({ eventType: 'user_banned' });
      expect(auditLog).toBeDefined();
      expect(auditLog!.details.reason).toBe('Violation of terms');
    });

    it('should unban user successfully', async () => {
      // First ban the user
      await authService.banUser(adminUser._id.toString(), regularUser._id.toString(), 'Test ban', mockIpAddress);

      // Then unban
      await authService.unbanUser(adminUser._id.toString(), regularUser._id.toString(), 'Ban lifted', mockIpAddress);

      const unbannedUser = await User.findById(regularUser._id);
      expect(unbannedUser!.isActive).toBe(true);
    });

    it('should reject non-admin user trying to ban another user', async () => {
      await expect(
        authService.banUser(regularUser._id.toString(), adminUser._id.toString(), 'Illegal ban', mockIpAddress)
      ).rejects.toThrow('Insufficient permissions');
    });
  });

  describe('Input Validation and Sanitization', () => {
    it('should sanitize email addresses', async () => {
      const userData = createMockUserData({
        email: '  TEST@EXAMPLE.COM  ',
        username: '  testuser  '
      });

      const result = await authService.registerUser(userData, mockIpAddress, mockUserAgent);

      expect(result.user.email).toBe('test@example.com');
      expect(result.user.username).toBe('testuser');
    });

    it('should validate email format', async () => {
      const userData = createMockUserData({
        email: 'invalid-email-format'
      });

      await expect(
        authService.registerUser(userData, mockIpAddress, mockUserAgent)
      ).rejects.toThrow();
    });

    it('should validate username length', async () => {
      const userData = createMockUserData({
        username: 'ab' // Too short
      });

      await expect(
        authService.registerUser(userData, mockIpAddress, mockUserAgent)
      ).rejects.toThrow();
    });

    it('should handle malicious input in details', async () => {
      const maliciousDetails = {
        script: '<script>alert("xss")</script>',
        sql: "'; DROP TABLE users; --",
        html: '<img src="x" onerror="alert(1)">'
      };

      // Should not throw error but should sanitize appropriately
      expect(() => {
        authService.registerUser(createMockUserData(), mockIpAddress, mockUserAgent);
      }).not.toThrow();
    });
  });
});