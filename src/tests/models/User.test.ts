import { User } from '../../models/User';
import { UserRole, AuthProvider } from '../../types/types';
import { createMockUserData, createMockAdminData } from '../utils/testHelpers';

describe('User Model', () => {
  describe('User Creation', () => {
    it('should create a user with valid data', async () => {
      const userData = createMockUserData();

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser._id).toBeDefined();
      expect(savedUser.email).toBe(userData.email);
      expect(savedUser.username).toBe(userData.username);
      expect(savedUser.role).toBe(UserRole.USER);
      expect(savedUser.authProvider).toBe(AuthProvider.EMAIL);
      expect(savedUser.isActive).toBe(true);
      expect(savedUser.password).toBeDefined(); // Password should be hashed
      expect(savedUser.password).not.toBe(userData.password); // Should not be plain text
    });

    it('should create an admin user', async () => {
      const adminData = createMockAdminData();

      const user = new User({ ...adminData, role: UserRole.ADMIN });
      const savedUser = await user.save();

      expect(savedUser.role).toBe(UserRole.ADMIN);
    });

    it('should require email and username', async () => {
      const userData = createMockUserData({ email: '', username: '' });

      const user = new User(userData);

      await expect(user.save()).rejects.toThrow();
    });

    it('should require unique email', async () => {
      const userData = createMockUserData();

      await User.createUser(userData);

      await expect(User.createUser(userData)).rejects.toThrow();
    });

    it('should require unique username', async () => {
      const userData1 = createMockUserData({ email: 'user1@example.com' });
      const userData2 = createMockUserData({ email: 'user2@example.com', username: userData1.username });

      await User.createUser(userData1);

      await expect(User.createUser(userData2)).rejects.toThrow();
    });

    it('should validate email format', async () => {
      const userData = createMockUserData({ email: 'invalid-email' });

      const user = new User(userData);

      await expect(user.save()).rejects.toThrow();
    });

    it('should validate username length', async () => {
      const userData = createMockUserData({ username: 'ab' }); // Too short

      const user = new User(userData);

      await expect(user.save()).rejects.toThrow();
    });
  });

  describe('Password Management', () => {
    it('should hash password before saving', async () => {
      const userData = createMockUserData({ password: 'plainpassword' });

      const user = new User(userData);
      await user.save();

      expect(user.password).not.toBe('plainpassword');
      expect(user.password?.length).toBeGreaterThan(10); // Hashed password should be longer
    });

    it('should compare passwords correctly', async () => {
      const userData = createMockUserData({ password: 'correctpassword' });

      const user = new User(userData);
      await user.save();

      const isCorrect = await user.comparePassword('correctpassword');
      const isWrong = await user.comparePassword('wrongpassword');

      expect(isCorrect).toBe(true);
      expect(isWrong).toBe(false);
    });

    it('should not require password for OAuth users', async () => {
      const oauthData = createMockUserData({
        authProvider: AuthProvider.GOOGLE,
        password: undefined
      });

      const user = new User(oauthData);
      const savedUser = await user.save();

      expect(savedUser._id).toBeDefined();
      expect(savedUser.authProvider).toBe(AuthProvider.GOOGLE);
    });

    it('should require password for email auth users', async () => {
      const userData = createMockUserData({ password: undefined });

      const user = new User(userData);

      await expect(user.save()).rejects.toThrow();
    });
  });

  describe('Static Methods', () => {
    it('should find user by email', async () => {
      const userData = createMockUserData();
      await User.createUser(userData);

      const foundUser = await User.findByEmail(userData.email);

      expect(foundUser).toBeDefined();
      expect(foundUser?.email).toBe(userData.email);
      expect(foundUser?.password).toBeUndefined(); // Password should be excluded by default
    });

    it('should find user by email with password', async () => {
      const userData = createMockUserData();
      await User.createUser(userData);

      const foundUser = await User.findByEmail(userData.email, true);

      expect(foundUser).toBeDefined();
      expect(foundUser?.password).toBeDefined(); // Password should be included when requested
    });

    it('should find user by username', async () => {
      const userData = createMockUserData();
      await User.createUser(userData);

      const foundUser = await User.findByUsername(userData.username);

      expect(foundUser).toBeDefined();
      expect(foundUser?.username).toBe(userData.username);
    });

    it('should not find inactive users', async () => {
      const userData = createMockUserData();
      const user = await User.createUser(userData);

      await User.findByIdAndUpdate(user._id, { isActive: false });

      const foundUser = await User.findByEmail(userData.email);

      expect(foundUser).toBeNull();
    });
  });

  describe('Instance Methods', () => {
    it('should convert user to safe object', async () => {
      const userData = createMockUserData();
      const user = await User.createUser(userData);

      const safeObject = user.toSafeObject();

      expect(safeObject.email).toBe(userData.email);
      expect(safeObject.username).toBe(userData.username);
      expect(safeObject.password).toBeUndefined(); // Password should be excluded
    });

    it('should convert user to JWT payload', async () => {
      const userData = createMockUserData();
      const user = await User.createUser(userData);

      const jwtPayload = user.toJwtPayload();

      expect(jwtPayload.userId).toBe((user._id as any).toString());
      expect(jwtPayload.email).toBe(userData.email);
      expect(jwtPayload.role).toBe(userData.role);
      expect(jwtPayload).not.toHaveProperty('password');
      expect(jwtPayload).not.toHaveProperty('username');
    });
  });

  describe('Timestamps and Default Values', () => {
    it('should set createdAt and updatedAt timestamps', async () => {
      const userData = createMockUserData();
      const user = await User.createUser(userData);

      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
      expect(user.lastSeen).toBeInstanceOf(Date);
    });

    it('should update updatedAt on save', async () => {
      const userData = createMockUserData();
      const user = await User.createUser(userData);
      const originalUpdatedAt = user.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      user.username = 'newusername';
      await user.save();

      expect(user.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });
});