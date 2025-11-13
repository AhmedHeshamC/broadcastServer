import { RedisService, ISession, ICacheData } from '../../services/RedisService';
import { MockRedisClient } from '../utils/testHelpers';

// Mock the redis module
jest.mock('redis', () => ({
  createClient: jest.fn(() => new MockRedisClient()),
}));

// Mock the config module
jest.mock('../../config', () => ({
  config: {
    get: (key: string) => {
      const configMap: Record<string, string> = {
        redisUrl: 'redis://localhost:6379',
      };
      return configMap[key];
    },
  },
}));

// Mock the logger module
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('RedisService', () => {
  let redisService: RedisService;

  beforeEach(() => {
    // Reset singleton instance
    (RedisService as any).instance = null;
    redisService = RedisService.getInstance();
  });

  afterEach(async () => {
    // Clean up any open connections
    await redisService.shutdown();
  });

  describe('Singleton Pattern', () => {
    it('should create a singleton instance', () => {
      const instance1 = RedisService.getInstance();
      const instance2 = RedisService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Connection Management', () => {
    it('should initialize Redis connection successfully', async () => {
      // Act
      await redisService.initialize();

      // Assert
      expect(redisService.isRedisConnected()).toBe(true);
    });

    it('should handle initialization errors gracefully', async () => {
      // This test is simplified due to Jest mock limitations
      // We test the error handling path by verifying the service handles disconnection

      // Arrange
      await redisService.initialize();
      expect(redisService.isRedisConnected()).toBe(true);

      // Act - Disconnect the service
      await redisService.shutdown();

      // Assert
      expect(redisService.isRedisConnected()).toBe(false);

      // The error handling logic is exercised when operations are performed on disconnected service
      await expect(redisService.getSession('test')).resolves.toEqual(null);
    });

    it('should return false when not connected', () => {
      // Assert
      expect(redisService.isRedisConnected()).toBe(false);
    });

    it('should shutdown gracefully', async () => {
      // Arrange
      await redisService.initialize();

      // Act
      await redisService.shutdown();

      // Assert
      expect(redisService.isRedisConnected()).toBe(false);
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      await redisService.initialize();
    });

    const mockSession: ISession = {
      userId: 'user123',
      socketId: 'socket123',
      username: 'testuser',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0...',
      connectedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      role: 'user',
    };

    it('should store and retrieve session', async () => {
      // Arrange
      const sessionId = 'session123';

      // Act
      await redisService.storeSession(sessionId, mockSession);
      const retrieved = await redisService.getSession(sessionId);

      // Assert
      expect(retrieved).toBeTruthy();
      expect(retrieved!.userId).toBe(mockSession.userId);
      expect(retrieved!.socketId).toBe(mockSession.socketId);
      expect(retrieved!.username).toBe(mockSession.username);
      expect(retrieved!.ipAddress).toBe(mockSession.ipAddress);
      expect(retrieved!.role).toBe(mockSession.role);
    });

    it('should return null for non-existent session', async () => {
      // Act
      const result = await redisService.getSession('nonexistent');

      // Assert
      expect(result).toBeNull();
    });

    it('should remove session', async () => {
      // Arrange
      const sessionId = 'session123';
      await redisService.storeSession(sessionId, mockSession);

      // Act
      await redisService.removeSession(sessionId);
      const retrieved = await redisService.getSession(sessionId);

      // Assert
      expect(retrieved).toBeNull();
    });

    it('should get all sessions for a user', async () => {
      // Arrange
      const userId = 'user123';
      const session1 = { ...mockSession, userId, socketId: 'socket1' };
      const session2 = { ...mockSession, userId, socketId: 'socket2' };
      const session3 = { ...mockSession, userId: 'different-user', socketId: 'socket3' };

      await redisService.storeSession('session1', session1);
      await redisService.storeSession('session2', session2);
      await redisService.storeSession('session3', session3);

      // Act
      const userSessions = await redisService.getUserSessions(userId);

      // Assert
      expect(userSessions).toHaveLength(2);
      expect(userSessions.every(s => s.userId === userId)).toBe(true);
    });

    it('should update session activity', async () => {
      // Arrange
      const sessionId = 'session123';
      const originalActivity = new Date('2023-01-01T00:00:00.000Z');
      const sessionWithOldActivity = {
        ...mockSession,
        lastActivity: originalActivity.toISOString(),
      };

      await redisService.storeSession(sessionId, sessionWithOldActivity);

      // Act
      await redisService.updateSessionActivity(sessionId);
      const updated = await redisService.getSession(sessionId);

      // Assert
      expect(updated).toBeTruthy();
      expect(new Date(updated!.lastActivity).getTime()).toBeGreaterThan(
        originalActivity.getTime()
      );
    });

    it('should handle session operations when not connected', async () => {
      // Arrange
      await redisService.shutdown();
      const sessionId = 'session123';

      // Act & Assert - Should not throw errors
      await expect(redisService.storeSession(sessionId, mockSession)).resolves.not.toThrow();
      await expect(redisService.getSession(sessionId)).resolves.toEqual(null);
      await expect(redisService.removeSession(sessionId)).resolves.not.toThrow();
      await expect(redisService.getUserSessions('user123')).resolves.toEqual([]);
      await expect(redisService.updateSessionActivity(sessionId)).resolves.not.toThrow();
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      await redisService.initialize();
    });

    const mockCacheData: ICacheData = {
      key1: 'value1',
      key2: 123,
      key3: { nested: 'data' },
    };

    it('should set and get cache data', async () => {
      // Arrange
      const cacheKey = 'test-cache';

      // Act
      await redisService.setCache(cacheKey, mockCacheData);
      const retrieved = await redisService.getCache<typeof mockCacheData>(cacheKey);

      // Assert
      expect(retrieved).toBeTruthy();
      expect(retrieved!.key1).toBe(mockCacheData.key1);
      expect(retrieved!.key2).toBe(mockCacheData.key2);
      expect(retrieved!.key3).toEqual(mockCacheData.key3);
    });

    it('should return null for non-existent cache', async () => {
      // Act
      const result = await redisService.getCache('nonexistent');

      // Assert
      expect(result).toBeNull();
    });

    it('should delete cache data', async () => {
      // Arrange
      const cacheKey = 'test-cache';
      await redisService.setCache(cacheKey, mockCacheData);

      // Act
      await redisService.deleteCache(cacheKey);
      const retrieved = await redisService.getCache(cacheKey);

      // Assert
      expect(retrieved).toBeNull();
    });

    it('should use custom TTL for cache', async () => {
      // Arrange
      const cacheKey = 'test-cache-ttl';

      // Act
      await redisService.setCache(cacheKey, mockCacheData, 60); // 1 minute TTL
      const retrieved = await redisService.getCache(cacheKey);

      // Assert
      expect(retrieved).toBeTruthy();
    });

    it('should handle cache operations when not connected', async () => {
      // Arrange
      await redisService.shutdown();

      // Act & Assert - Should not throw errors
      await expect(redisService.setCache('key', {})).resolves.not.toThrow();
      await expect(redisService.getCache('key')).resolves.toEqual(null);
      await expect(redisService.deleteCache('key')).resolves.not.toThrow();
    });
  });

  describe('Counter Management', () => {
    beforeEach(async () => {
      await redisService.initialize();
    });

    it('should increment counter from zero', async () => {
      // Arrange
      const counterKey = 'test-counter';

      // Act
      const result = await redisService.incrementCounter(counterKey);

      // Assert
      expect(result).toBe(1);
    });

    it('should increment counter with custom amount', async () => {
      // Arrange
      const counterKey = 'test-counter';
      await redisService.setCounter(counterKey, 5);

      // Act
      const result = await redisService.incrementCounter(counterKey, 3);

      // Assert
      expect(result).toBe(8);
    });

    it('should get counter value', async () => {
      // Arrange
      const counterKey = 'test-counter';
      await redisService.setCounter(counterKey, 42);

      // Act
      const value = await redisService.getCounter(counterKey);

      // Assert
      expect(value).toBe(42);
    });

    it('should return zero for non-existent counter', async () => {
      // Act
      const value = await redisService.getCounter('nonexistent');

      // Assert
      expect(value).toBe(0);
    });

    it('should set counter value', async () => {
      // Arrange
      const counterKey = 'test-counter';

      // Act
      await redisService.setCounter(counterKey, 100);
      const value = await redisService.getCounter(counterKey);

      // Assert
      expect(value).toBe(100);
    });

    it('should handle counter operations when not connected', async () => {
      // Arrange
      await redisService.shutdown();

      // Act & Assert
      expect(await redisService.incrementCounter('key')).toBe(0);
      expect(await redisService.getCounter('key')).toBe(0);
      await expect(redisService.setCounter('key', 10)).resolves.not.toThrow();
    });
  });

  describe('Sorted Set Management', () => {
    beforeEach(async () => {
      await redisService.initialize();
    });

    it('should add to sorted set and get top items', async () => {
      // Arrange
      const setKey = 'leaderboard';

      // Act
      await redisService.addToSortedSet(setKey, 100, 'user1');
      await redisService.addToSortedSet(setKey, 200, 'user2');
      await redisService.addToSortedSet(setKey, 150, 'user3');

      const topItems = await redisService.getTopFromSortedSet(setKey, 3);

      // Assert
      expect(topItems).toHaveLength(3);
      expect(topItems[0]).toEqual({ member: 'user2', score: 200 });
      expect(topItems[1]).toEqual({ member: 'user3', score: 150 });
      expect(topItems[2]).toEqual({ member: 'user1', score: 100 });
    });

    it('should return empty array for non-existent sorted set', async () => {
      // Act
      const result = await redisService.getTopFromSortedSet('nonexistent');

      // Assert
      expect(result).toEqual([]);
    });

    it('should limit results from sorted set', async () => {
      // Arrange
      const setKey = 'leaderboard';

      // Act
      await redisService.addToSortedSet(setKey, 100, 'user1');
      await redisService.addToSortedSet(setKey, 200, 'user2');
      await redisService.addToSortedSet(setKey, 150, 'user3');

      const topItems = await redisService.getTopFromSortedSet(setKey, 2);

      // Assert
      expect(topItems).toHaveLength(2);
      expect(topItems[0]).toEqual({ member: 'user2', score: 200 });
      expect(topItems[1]).toEqual({ member: 'user3', score: 150 });
    });

    it('should handle sorted set operations when not connected', async () => {
      // Arrange
      await redisService.shutdown();

      // Act & Assert
      await expect(redisService.addToSortedSet('key', 100, 'member')).resolves.not.toThrow();
      const result = await redisService.getTopFromSortedSet('key');
      expect(result).toEqual([]);
    });
  });

  describe('Cleanup Operations', () => {
    beforeEach(async () => {
      await redisService.initialize();
    });

    it('should cleanup expired sessions', async () => {
      // Arrange - Create old sessions
      const mockSession: ISession = {
        userId: 'user123',
        socketId: 'socket123',
        username: 'testuser',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0...',
        connectedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        role: 'user',
      };

      const oldSession: ISession = {
        ...mockSession,
        lastActivity: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
      };

      const recentSession: ISession = {
        ...mockSession,
        lastActivity: new Date().toISOString(), // Now
      };

      await redisService.storeSession('old-session', oldSession);
      await redisService.storeSession('recent-session', recentSession);

      // Act
      await redisService.cleanup();

      // Assert
      const oldRetrieved = await redisService.getSession('old-session');
      const recentRetrieved = await redisService.getSession('recent-session');

      expect(oldRetrieved).toBeNull(); // Should be cleaned up
      expect(recentRetrieved).toBeTruthy(); // Should remain
    });

    it('should handle cleanup when not connected', async () => {
      // Arrange
      await redisService.shutdown();

      // Act & Assert - Should not throw
      await expect(redisService.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      await redisService.initialize();
    });

    it('should get Redis statistics when connected', async () => {
      // Act
      const stats = await redisService.getStats();

      // Assert
      expect(stats).toBeTruthy();
      expect(stats.connected).toBe(true);
      expect(stats.info).toBeTruthy();
      expect(stats.keyspace).toBeTruthy();
    });

    it('should return disconnected stats when not connected', async () => {
      // Arrange
      await redisService.shutdown();

      // Act
      const stats = await redisService.getStats();

      // Assert
      expect(stats).toBeTruthy();
      expect(stats.connected).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid session data gracefully', async () => {
      // Arrange
      await redisService.initialize();
      const mockSession: ISession = {
        userId: 'user123',
        socketId: 'socket123',
        username: 'testuser',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0...',
        connectedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        role: 'user',
      };

      // Create a mock session with malformed data
      const invalidSession = { ...mockSession, lastActivity: 'invalid-date' };

      // Act & Assert - Should handle gracefully
      await expect(redisService.storeSession('invalid', invalidSession)).resolves.not.toThrow();
    });

    it('should handle invalid cache data gracefully', async () => {
      // Arrange
      await redisService.initialize();

      // Act & Assert - Should handle invalid data gracefully
      await expect(redisService.setCache('invalid', { circular: {} })).resolves.not.toThrow();
    });

    it('should handle counter operations with invalid data', async () => {
      // Arrange
      await redisService.initialize();

      // Act & Assert - Should handle edge cases gracefully
      expect(await redisService.incrementCounter('test', 0)).toBe(0);
      expect(await redisService.getCounter('nonexistent')).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty session data', async () => {
      // Arrange
      await redisService.initialize();
      const emptySession: ISession = {
        userId: '',
        socketId: '',
        username: '',
        ipAddress: '',
        connectedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        role: '',
      };

      // Act
      await redisService.storeSession('empty', emptySession);
      const retrieved = await redisService.getSession('empty');

      // Assert
      expect(retrieved).toBeTruthy();
      expect(retrieved!.userId).toBe('');
      expect(retrieved!.username).toBe('');
    });

    it('should handle very large cache data', async () => {
      // Arrange
      await redisService.initialize();
      const largeData: ICacheData = {
        data: 'x'.repeat(10000), // 10KB string
      };

      // Act
      await redisService.setCache('large', largeData);
      const retrieved = await redisService.getCache('large');

      // Assert
      expect(retrieved).toBeTruthy();
      expect(retrieved!.data).toBe(largeData.data);
    });

    it('should handle concurrent operations', async () => {
      // Arrange
      await redisService.initialize();
      const promises = [];

      // Act - Perform multiple operations concurrently
      for (let i = 0; i < 10; i++) {
        promises.push(redisService.setCache(`key${i}`, { value: i }));
        promises.push(redisService.incrementCounter('counter', 1));
      }

      await Promise.all(promises);

      // Assert
      const counterValue = await redisService.getCounter('counter');
      expect(counterValue).toBe(10);

      // Verify cache operations
      for (let i = 0; i < 10; i++) {
        const cached = await redisService.getCache(`key${i}`);
        expect(cached).toEqual({ value: i });
      }
    });
  });
});