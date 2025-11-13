import { RateLimitService } from '../../services/RateLimitService';

// Mock the logger module
jest.mock('../../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock the AuditLog module
jest.mock('../../models/AuditLog', () => ({
  AuditLog: {
    createLog: jest.fn(),
  },
}));

describe('RateLimitService', () => {
  let rateLimitService: RateLimitService;

  beforeEach(() => {
    // Reset singleton instance
    (RateLimitService as any).instance = null;
    rateLimitService = RateLimitService.getInstance();
  });

  afterEach(() => {
    // Clean up any timers or intervals
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Singleton Pattern', () => {
    it('should create a singleton instance', () => {
      const instance1 = RateLimitService.getInstance();
      const instance2 = RateLimitService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('IP Blocking', () => {
    it('should not block IP initially', () => {
      // Act
      const isBlocked = rateLimitService.isIPBlocked('127.0.0.1');

      // Assert
      expect(isBlocked).toBe(false);
    });

    it('should block IP for specified duration', () => {
      // Arrange
      const ipAddress = '192.168.1.100';
      const blockDuration = 60000; // 1 minute

      // Act
      rateLimitService.blockIP(ipAddress, blockDuration);

      // Assert
      expect(rateLimitService.isIPBlocked(ipAddress)).toBe(true);
    });

    it('should automatically unblock IP after duration', () => {
      // Arrange
      jest.useFakeTimers();
      const ipAddress = '192.168.1.100';
      const blockDuration = 60000; // 1 minute

      // Act
      rateLimitService.blockIP(ipAddress, blockDuration);
      expect(rateLimitService.isIPBlocked(ipAddress)).toBe(true);

      // Fast-forward time past block duration
      jest.advanceTimersByTime(blockDuration + 1000);

      // Assert
      expect(rateLimitService.isIPBlocked(ipAddress)).toBe(false);
    });

    it('should handle default block duration', () => {
      // Arrange
      const ipAddress = '192.168.1.100';

      // Act
      rateLimitService.blockIP(ipAddress); // Should use default duration

      // Assert
      expect(rateLimitService.isIPBlocked(ipAddress)).toBe(true);
    });

    it('should not unblock IP before duration expires', () => {
      // Arrange
      jest.useFakeTimers();
      const ipAddress = '192.168.1.100';
      const blockDuration = 300000; // 5 minutes

      // Act
      rateLimitService.blockIP(ipAddress, blockDuration);

      // Fast-forward time but not past block duration
      jest.advanceTimersByTime(blockDuration - 1000);

      // Assert
      expect(rateLimitService.isIPBlocked(ipAddress)).toBe(true);
    });
  });

  describe('Message Rate Limiting', () => {
    const userId = 'user123';
    const ipAddress = '127.0.0.1';

    it('should allow first message', () => {
      // Act
      const result = rateLimitService.checkMessageRate(userId, ipAddress);

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(29); // 30 - 1
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it('should allow messages within limit', () => {
      // Arrange
      for (let i = 0; i < 5; i++) {
        rateLimitService.checkMessageRate(userId, ipAddress);
      }

      // Act
      const result = rateLimitService.checkMessageRate(userId, ipAddress);

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(24); // 30 - 6
    });

    it('should block messages when limit exceeded', () => {
      // Arrange
      for (let i = 0; i < 30; i++) {
        rateLimitService.checkMessageRate(userId, ipAddress);
      }

      // Act
      const result = rateLimitService.checkMessageRate(userId, ipAddress);

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(rateLimitService.isIPBlocked(ipAddress)).toBe(true);
    });

    it('should reset limit after window expires but IP remains blocked', () => {
      // Arrange
      jest.useFakeTimers();

      // Use up the limit
      for (let i = 0; i < 30; i++) {
        rateLimitService.checkMessageRate(userId, ipAddress);
      }
      const blockedResult = rateLimitService.checkMessageRate(userId, ipAddress);
      expect(blockedResult.allowed).toBe(false);

      // Act - Fast-forward past the window but not the block duration
      jest.advanceTimersByTime(60000 + 1000); // 1 minute + buffer

      // Assert - IP should still be blocked due to rate limit violation
      const newResult = rateLimitService.checkMessageRate(userId, ipAddress);
      expect(newResult.allowed).toBe(false);
      expect(rateLimitService.isIPBlocked(ipAddress)).toBe(true);
    });

    it('should block immediately for blocked IP', () => {
      // Arrange
      rateLimitService.blockIP(ipAddress);

      // Act
      const result = rateLimitService.checkMessageRate(userId, ipAddress);

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it('should create audit log on rate limit violation', () => {
      // Arrange
      const { AuditLog } = require('../../models/AuditLog');

      // Use up the limit
      for (let i = 0; i < 30; i++) {
        rateLimitService.checkMessageRate(userId, ipAddress);
      }

      // Act
      rateLimitService.checkMessageRate(userId, ipAddress);

      // Assert
      expect(AuditLog.createLog).toHaveBeenCalledWith(
        expect.any(String),
        ipAddress,
        userId,
        { action: 'rate_limit_exceeded', count: 30 },
        false
      );
    });
  });

  describe('Connection Rate Limiting', () => {
    const ipAddress = '192.168.1.100';

    it('should allow first connection attempt', () => {
      // Act
      const result = rateLimitService.checkConnectionRate(ipAddress);

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 5 - 1
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it('should allow connections within limit', () => {
      // Arrange
      for (let i = 0; i < 3; i++) {
        rateLimitService.checkConnectionRate(ipAddress);
      }

      // Act
      const result = rateLimitService.checkConnectionRate(ipAddress);

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1); // 5 - 4
    });

    it('should block connections when limit exceeded', () => {
      // Arrange
      for (let i = 0; i < 5; i++) {
        rateLimitService.checkConnectionRate(ipAddress);
      }

      // Act
      const result = rateLimitService.checkConnectionRate(ipAddress);

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(rateLimitService.isIPBlocked(ipAddress)).toBe(true);
    });

    it('should reset connection limit after window expires but IP remains blocked', () => {
      // Arrange
      jest.useFakeTimers();

      // Use up the limit
      for (let i = 0; i < 5; i++) {
        rateLimitService.checkConnectionRate(ipAddress);
      }
      const blockedResult = rateLimitService.checkConnectionRate(ipAddress);
      expect(blockedResult.allowed).toBe(false);

      // Act - Fast-forward past the window but not the block duration
      jest.advanceTimersByTime(60000 + 1000); // 1 minute + buffer

      // Assert - IP should still be blocked due to connection limit violation
      const newResult = rateLimitService.checkConnectionRate(ipAddress);
      expect(newResult.allowed).toBe(false);
      expect(rateLimitService.isIPBlocked(ipAddress)).toBe(true);
    });

    it('should use different limits for different IPs', () => {
      // Arrange
      const ip1 = '192.168.1.100';
      const ip2 = '192.168.1.101';

      // Use up limit for first IP
      for (let i = 0; i < 5; i++) {
        rateLimitService.checkConnectionRate(ip1);
      }

      // Act & Assert
      const ip1Result = rateLimitService.checkConnectionRate(ip1);
      const ip2Result = rateLimitService.checkConnectionRate(ip2);

      expect(ip1Result.allowed).toBe(false);
      expect(ip2Result.allowed).toBe(true);
    });
  });

  describe('Login Rate Limiting', () => {
    const email = 'test@example.com';
    const ipAddress = '192.168.1.100';

    it('should allow first login attempt', () => {
      // Act
      const result = rateLimitService.checkLoginRate(email, ipAddress);

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 5 - 1
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it('should allow login attempts within limit', () => {
      // Arrange
      for (let i = 0; i < 3; i++) {
        rateLimitService.checkLoginRate(email, ipAddress);
      }

      // Act
      const result = rateLimitService.checkLoginRate(email, ipAddress);

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1); // 5 - 4
    });

    it('should block login attempts when limit exceeded', () => {
      // Arrange
      for (let i = 0; i < 5; i++) {
        rateLimitService.checkLoginRate(email, ipAddress);
      }

      // Act
      const result = rateLimitService.checkLoginRate(email, ipAddress);

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(rateLimitService.isIPBlocked(ipAddress)).toBe(true);
    });

    it('should reset login limit after window expires but IP remains blocked', () => {
      // Arrange
      jest.useFakeTimers();

      // Use up the limit
      for (let i = 0; i < 5; i++) {
        rateLimitService.checkLoginRate(email, ipAddress);
      }
      const blockedResult = rateLimitService.checkLoginRate(email, ipAddress);
      expect(blockedResult.allowed).toBe(false);

      // Act - Fast-forward past the window but not the block duration
      jest.advanceTimersByTime(900000 + 1000); // 15 minutes + buffer

      // Assert - IP should still be blocked due to login limit violation
      const newResult = rateLimitService.checkLoginRate(email, ipAddress);
      expect(newResult.allowed).toBe(false);
      expect(rateLimitService.isIPBlocked(ipAddress)).toBe(true);
    });

    it('should use different limits for different emails but block IP when exceeded', () => {
      // Arrange
      const ip1 = '192.168.1.100';
      const ip2 = '192.168.1.101';
      const email1 = 'user1@example.com';
      const email2 = 'user2@example.com';

      // Use up limit for first email with first IP
      for (let i = 0; i < 5; i++) {
        rateLimitService.checkLoginRate(email1, ip1);
      }

      // Act & Assert
      const email1Result = rateLimitService.checkLoginRate(email1, ip1);
      const email2Result = rateLimitService.checkLoginRate(email2, ip2);

      expect(email1Result.allowed).toBe(false); // Should be blocked due to rate limit
      expect(email2Result.allowed).toBe(true);  // Should be allowed with different IP
      expect(rateLimitService.isIPBlocked(ip1)).toBe(true);  // First IP should be blocked
      expect(rateLimitService.isIPBlocked(ip2)).toBe(false); // Second IP should not be blocked
    });
  });

  describe('Generic Rate Limiting', () => {
    const ipAddress = '192.168.1.100';

    it('should apply message config for message endpoints', () => {
      // Act
      const result = rateLimitService.checkRateLimit(ipAddress, '/api/messages');

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(29); // Messages: 30 - 1
    });

    it('should apply login config for login endpoints', () => {
      // Act
      const result = rateLimitService.checkRateLimit(ipAddress, '/auth/login');

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // Login: 5 - 1
    });

    it('should apply connection config for other endpoints', () => {
      // Act
      const result = rateLimitService.checkRateLimit(ipAddress, '/api/users');

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // Connections: 5 - 1
    });

    it('should return retryAfter for blocked IPs', () => {
      // Arrange
      rateLimitService.blockIP(ipAddress, 120000); // 2 minutes

      // Act
      const result = rateLimitService.checkRateLimit(ipAddress, '/api/test');

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfter).toBeLessThanOrEqual(120);
    });

    it('should reset after block expires', () => {
      // Arrange
      jest.useFakeTimers();
      rateLimitService.blockIP(ipAddress, 60000); // 1 minute

      // Fast-forward past block duration
      jest.advanceTimersByTime(61000);

      // Act
      const result = rateLimitService.checkRateLimit(ipAddress, '/api/test');

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBeUndefined();
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should return correct statistics', () => {
      // Arrange
      const userId = 'user123';
      const ipAddress = '192.168.1.100';
      const email = 'test@example.com';

      // Create some activity
      rateLimitService.checkMessageRate(userId, ipAddress);
      rateLimitService.checkConnectionRate(ipAddress);
      rateLimitService.checkLoginRate(email, ipAddress);
      rateLimitService.blockIP(ipAddress);

      // Act
      const stats = rateLimitService.getStats();

      // Assert
      expect(stats).toHaveProperty('activeUsers');
      expect(stats).toHaveProperty('blockedIPs');
      expect(stats).toHaveProperty('rateLimits');

      expect(stats.activeUsers).toBeGreaterThan(0);
      expect(stats.blockedIPs).toBe(1);

      expect(stats.rateLimits).toHaveProperty('messages');
      expect(stats.rateLimits).toHaveProperty('connections');
      expect(stats.rateLimits).toHaveProperty('logins');

      expect(stats.rateLimits.messages.windowMs).toBe(60000);
      expect(stats.rateLimits.messages.maxRequests).toBe(30);
      expect(stats.rateLimits.connections.maxRequests).toBe(5);
      expect(stats.rateLimits.logins.maxRequests).toBe(5);
    });

    it('should track multiple active users', () => {
      // Arrange
      const users = ['user1', 'user2', 'user3'];
      const ip = '192.168.1.100';

      // Act
      users.forEach(userId => {
        rateLimitService.checkMessageRate(userId, ip);
      });

      const stats = rateLimitService.getStats();

      // Assert
      expect(stats.activeUsers).toBe(3);
    });
  });

  describe('Cleanup Operations', () => {
    it('should cleanup expired entries', () => {
      // Arrange
      jest.useFakeTimers();
      const userId = 'user123';
      const ipAddress = '192.168.1.100';

      // Create activity that will expire
      rateLimitService.checkMessageRate(userId, ipAddress);
      rateLimitService.blockIP(ipAddress, 30000); // 30 seconds

      // Act - Fast-forward past cleanup thresholds
      jest.advanceTimersByTime(301000); // 5 minutes + buffer for cleanup interval

      // Trigger cleanup manually (since setInterval is mocked)
      (rateLimitService as any).cleanup();

      const stats = rateLimitService.getStats();

      // Assert
      expect(rateLimitService.isIPBlocked(ipAddress)).toBe(false);
    });

    it('should not cleanup active entries', () => {
      // Arrange
      const userId = 'user123';
      const ipAddress = '192.168.1.100';

      // Create recent activity
      rateLimitService.checkMessageRate(userId, ipAddress);

      // Act - Don't advance time much
      jest.useFakeTimers();
      jest.advanceTimersByTime(1000); // 1 second
      (rateLimitService as any).cleanup();

      const stats = rateLimitService.getStats();

      // Assert
      expect(stats.activeUsers).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent requests', () => {
      // Arrange
      const userId = 'user123';
      const ipAddress = '192.168.1.100';
      const promises = [];

      // Act - Make multiple concurrent requests
      for (let i = 0; i < 35; i++) { // More than the limit
        promises.push(Promise.resolve(rateLimitService.checkMessageRate(userId, ipAddress)));
      }

      const results = Promise.all(promises);

      // Assert
      return results.then(responses => {
        const blockedCount = responses.filter(r => !r.allowed).length;
        const allowedCount = responses.filter(r => r.allowed).length;

        expect(allowedCount).toBe(30); // Should allow exactly 30
        expect(blockedCount).toBe(5);  // Should block exactly 5
      });
    });

    it('should handle empty strings', () => {
      // Act & Assert - Should not throw
      expect(() => {
        rateLimitService.checkMessageRate('', '');
        rateLimitService.checkConnectionRate('');
        rateLimitService.checkLoginRate('', '');
        rateLimitService.checkRateLimit('', '/test');
        rateLimitService.isIPBlocked('');
        rateLimitService.blockIP('');
      }).not.toThrow();
    });

    it('should handle special characters in inputs', () => {
      // Arrange
      const specialUserId = 'user-with-special-chars_123';
      const specialEmail = 'test+special@example.com';
      const specialIp = '192.168.1.100';

      // Act & Assert
      expect(() => {
        rateLimitService.checkMessageRate(specialUserId, specialIp);
        rateLimitService.checkLoginRate(specialEmail, specialIp);
      }).not.toThrow();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high volume of requests efficiently', () => {
      // Arrange
      const start = Date.now();
      const ipAddresses = Array.from({ length: 1000 }, (_, i) => `192.168.1.${i % 255}`);

      // Act
      ipAddresses.forEach(ip => {
        rateLimitService.checkConnectionRate(ip);
      });

      const duration = Date.now() - start;

      // Assert
      expect(duration).toBeLessThan(100); // Should complete in less than 100ms
    });

    it('should maintain consistent performance with many active users', () => {
      // Arrange
      const userIds = Array.from({ length: 500 }, (_, i) => `user${i}`);
      const start = Date.now();

      // Act
      userIds.forEach(userId => {
        rateLimitService.checkMessageRate(userId, '127.0.0.1');
      });

      const duration = Date.now() - start;

      // Assert
      expect(duration).toBeLessThan(50); // Should be very fast
    });
  });
});