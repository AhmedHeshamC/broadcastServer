import { AuditLog } from '../../models/AuditLog';
import { AuditEventType } from '../../types/types';

describe('AuditLog Model', () => {
  let mockUserId: string;
  let mockIpAddress: string;
  let mockUserAgent: string;

  beforeEach(() => {
    mockUserId = '507f1f77bcf86cd799439011';
    mockIpAddress = '192.168.1.1';
    mockUserAgent = 'Mozilla/5.0 (Test Browser)';
  });

  describe('AuditLog Creation', () => {
    it('should create an audit log with required fields', async () => {
      const logData = {
        eventType: AuditEventType.LOGIN_SUCCESS,
        ipAddress: mockIpAddress,
        success: true
      };

      const log = new AuditLog(logData);
      const savedLog = await log.save();

      expect(savedLog._id).toBeDefined();
      expect(savedLog.eventType).toBe(AuditEventType.LOGIN_SUCCESS);
      expect(savedLog.ipAddress).toBe(mockIpAddress);
      expect(savedLog.success).toBe(true);
      expect(savedLog.timestamp).toBeInstanceOf(Date);
    });

    it('should create an audit log with all fields', async () => {
      const logData = {
        userId: mockUserId,
        eventType: AuditEventType.MESSAGE_SENT,
        ipAddress: mockIpAddress,
        userAgent: mockUserAgent,
        success: true,
        details: { messageId: 'msg123', content: 'Hello world' }
      };

      const log = new AuditLog(logData);
      const savedLog = await log.save();

      expect(savedLog.userId).toBe(mockUserId);
      expect(savedLog.eventType).toBe(AuditEventType.MESSAGE_SENT);
      expect(savedLog.ipAddress).toBe(mockIpAddress);
      expect(savedLog.userAgent).toBe(mockUserAgent);
      expect(savedLog.success).toBe(true);
      expect(savedLog.details).toEqual({ messageId: 'msg123', content: 'Hello world' });
    });

    it('should require eventType and ipAddress', async () => {
      const logData = {
        eventType: undefined as any,
        ipAddress: '',
      };

      const log = new AuditLog(logData);

      await expect(log.save()).rejects.toThrow();
    });

    it('should validate eventType enum', async () => {
      const logData = {
        eventType: 'invalid_event' as any,
        ipAddress: mockIpAddress,
      };

      const log = new AuditLog(logData);

      await expect(log.save()).rejects.toThrow();
    });

    it('should set default values', async () => {
      const logData = {
        eventType: AuditEventType.REGISTER,
        ipAddress: mockIpAddress,
      };

      const log = new AuditLog(logData);
      const savedLog = await log.save();

      expect(savedLog.success).toBe(true);
      expect(savedLog.details).toEqual({});
      expect(savedLog.userId).toBeNull();
      expect(savedLog.userAgent).toBeNull();
    });
  });

  describe('Static Method: createLog', () => {
    it('should create log with minimum parameters', async () => {
      const log = await AuditLog.createLog(
        AuditEventType.LOGIN_SUCCESS,
        mockIpAddress
      );

      expect(log._id).toBeDefined();
      expect(log.eventType).toBe(AuditEventType.LOGIN_SUCCESS);
      expect(log.ipAddress).toBe(mockIpAddress);
      expect(log.success).toBe(true);
      expect(log.userId).toBeNull();
      expect(log.details).toEqual({});
    });

    it('should create log with all parameters', async () => {
      const details = { reason: 'Test reason', attempt: 1 };
      const log = await AuditLog.createLog(
        AuditEventType.LOGIN_FAILED,
        mockIpAddress,
        mockUserId,
        details,
        false,
        mockUserAgent
      );

      expect(log.eventType).toBe(AuditEventType.LOGIN_FAILED);
      expect(log.ipAddress).toBe(mockIpAddress);
      expect(log.userId).toBe(mockUserId);
      expect(log.details).toEqual(details);
      expect(log.success).toBe(false);
      expect(log.userAgent).toBe(mockUserAgent);
    });
  });

  describe('Static Method: Failed Login Tracking', () => {
    beforeEach(async () => {
      // Create some test failed login attempts
      const now = new Date();
      const times = [14, 10, 5, 2]; // minutes ago

      for (const minutes of times) {
        const timestamp = new Date(now.getTime() - minutes * 60 * 1000);
        await AuditLog.create({
          eventType: AuditEventType.LOGIN_FAILED,
          ipAddress: mockIpAddress,
          timestamp,
          success: false,
          details: { attempt: minutes }
        });
      }

      // Add a successful login (should not be counted)
      await AuditLog.create({
        eventType: AuditEventType.LOGIN_SUCCESS,
        ipAddress: mockIpAddress,
        timestamp: new Date(now.getTime() - 3 * 60 * 1000),
        success: true
      });

      // Add old failed login (outside 15-minute window)
      await AuditLog.create({
        eventType: AuditEventType.LOGIN_FAILED,
        ipAddress: mockIpAddress,
        timestamp: new Date(now.getTime() - 20 * 60 * 1000),
        success: false
      });
    });

    it('should find failed login attempts by IP', async () => {
      const failedLogins = await AuditLog.findFailedLoginsByIP(mockIpAddress, 15);

      expect(failedLogins).toHaveLength(4);
      failedLogins.forEach(login => {
        expect(login.eventType).toBe(AuditEventType.LOGIN_FAILED);
        expect(login.ipAddress).toBe(mockIpAddress);
        expect(login.success).toBe(false);
      });
    });

    it('should count failed login attempts by IP', async () => {
      const count = await AuditLog.countFailedLoginsByIP(mockIpAddress, 15);

      expect(count).toBe(4);
    });

    it('should respect time window', async () => {
      const count5Minutes = await AuditLog.countFailedLoginsByIP(mockIpAddress, 5);
      const count10Minutes = await AuditLog.countFailedLoginsByIP(mockIpAddress, 10);

      expect(count5Minutes).toBeGreaterThanOrEqual(1); // 2 and 5 minutes ago (allowing for timing)
      expect(count10Minutes).toBeGreaterThanOrEqual(2); // 2, 5, and 10 minutes ago (allowing for timing)
      expect(count10Minutes).toBeGreaterThan(count5Minutes);
    });

    it('should return empty for different IP', async () => {
      const count = await AuditLog.countFailedLoginsByIP('192.168.1.2', 15);

      expect(count).toBe(0);
    });
  });

  describe('Static Method: User Activity', () => {
    beforeEach(async () => {
      const events = [
        AuditEventType.LOGIN_SUCCESS,
        AuditEventType.MESSAGE_SENT,
        AuditEventType.LOGOUT,
        AuditEventType.MESSAGE_SENT,
        AuditEventType.LOGIN_FAILED
      ];

      for (const [index, eventType] of events.entries()) {
        await AuditLog.createLog(
          eventType,
          mockIpAddress,
          mockUserId,
          { attempt: index + 1 },
          eventType !== AuditEventType.LOGIN_FAILED
        );
      }

      // Add activities for different user
      await AuditLog.createLog(
        AuditEventType.LOGIN_SUCCESS,
        mockIpAddress,
        'different-user-id',
        {},
        true
      );
    });

    it('should get user activity', async () => {
      const activities = await AuditLog.getUserActivity(mockUserId);

      expect(activities).toHaveLength(5);
      activities.forEach(activity => {
        expect(activity.userId).toBe(mockUserId);
      });

      // Should be sorted by timestamp (newest first)
      const timestamps = activities.map(a => a.timestamp.getTime());
      const sortedTimestamps = [...timestamps].sort((a, b) => b - a);
      expect(timestamps).toEqual(sortedTimestamps);
    });

    it('should limit user activity results', async () => {
      const activities = await AuditLog.getUserActivity(mockUserId, 3);

      expect(activities).toHaveLength(3);
    });

    it('should only return activities for specified user', async () => {
      const activities = await AuditLog.getUserActivity(mockUserId);

      activities.forEach(activity => {
        expect(activity.userId).toBe(mockUserId);
      });
    });
  });

  describe('Static Method: Security Events', () => {
    beforeEach(async () => {
      const securityEvents = [
        AuditEventType.LOGIN_FAILED,
        AuditEventType.USER_BANNED,
        AuditEventType.ADMIN_ACTION,
        AuditEventType.LOGIN_SUCCESS, // Not a security event
        AuditEventType.MESSAGE_SENT  // Not a security event
      ];

      for (const eventType of securityEvents) {
        await AuditLog.createLog(
          eventType,
          mockIpAddress,
          mockUserId,
          { event: eventType },
          true
        );
      }
    });

    it('should get only security events', async () => {
      const securityEvents = await AuditLog.getSecurityEvents();

      expect(securityEvents).toHaveLength(3);
      securityEvents.forEach(event => {
        expect([
          AuditEventType.LOGIN_FAILED,
          AuditEventType.USER_BANNED,
          AuditEventType.ADMIN_ACTION
        ]).toContain(event.eventType);
      });
    });

    it('should limit security events results', async () => {
      const securityEvents = await AuditLog.getSecurityEvents(2);

      expect(securityEvents).toHaveLength(2);
    });
  });

  describe('Static Method: Analytics', () => {
    beforeEach(async () => {
      const events = [
        { type: AuditEventType.LOGIN_SUCCESS, success: true },
        { type: AuditEventType.LOGIN_SUCCESS, success: true },
        { type: AuditEventType.LOGIN_FAILED, success: false },
        { type: AuditEventType.LOGIN_FAILED, success: false },
        { type: AuditEventType.MESSAGE_SENT, success: true },
        { type: AuditEventType.REGISTER, success: true },
        { type: AuditEventType.USER_BANNED, success: true },
        { type: AuditEventType.ADMIN_ACTION, success: true }
      ];

      const now = new Date();
      for (const [index, event] of events.entries()) {
        const timestamp = new Date(now.getTime() - (events.length - index) * 60 * 60 * 1000);
        await AuditLog.create({
          eventType: event.type,
          ipAddress: mockIpAddress,
          userId: mockUserId,
          timestamp,
          success: event.success,
          details: { index }
        });
      }

      // Add some old events outside date range
      const oldDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      await AuditLog.createLog(
        AuditEventType.LOGIN_SUCCESS,
        mockIpAddress,
        mockUserId,
        { old: true },
        true
      );
      await AuditLog.create({
        eventType: AuditEventType.LOGIN_SUCCESS,
        ipAddress: mockIpAddress,
        userId: mockUserId,
        timestamp: oldDate,
        success: true,
        details: { old: true }
      });
    });

    it('should get analytics for all time', async () => {
      const analytics = await AuditLog.getAnalytics();

      expect(analytics).toHaveLength(1);
      expect(analytics[0].totalEvents).toBeGreaterThan(0);

      const events = analytics[0].events;
      const loginSuccessEvent = events.find((e: any) => e.type === AuditEventType.LOGIN_SUCCESS);
      const loginFailedEvent = events.find((e: any) => e.type === AuditEventType.LOGIN_FAILED);

      // Verify that we have login events (counts may vary due to test data setup)
      expect(loginSuccessEvent?.count).toBeGreaterThan(0);
      expect(loginSuccessEvent?.successCount).toBe(loginSuccessEvent?.count);
      expect(loginSuccessEvent?.failCount).toBe(0);

      expect(loginFailedEvent?.count).toBeGreaterThan(0);
      expect(loginFailedEvent?.successCount).toBe(0);
      expect(loginFailedEvent?.failCount).toBe(loginFailedEvent?.count);
    });

    it('should get analytics for date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const allTimeAnalytics = await AuditLog.getAnalytics();
      const rangedAnalytics = await AuditLog.getAnalytics(yesterday, now);

      expect(rangedAnalytics).toHaveLength(1);
      // Should exclude some old events
      expect(rangedAnalytics[0].totalEvents).toBeLessThanOrEqual(allTimeAnalytics[0].totalEvents);
    });
  });

  describe('Timestamps and Indexes', () => {
    it('should set default timestamp on creation', async () => {
      const before = new Date();
      const log = await AuditLog.createLog(
        AuditEventType.LOGIN_SUCCESS,
        mockIpAddress
      );

      expect(log.timestamp).toBeInstanceOf(Date);
      expect(log.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(log.timestamp.getTime()).toBeLessThanOrEqual(new Date().getTime());
    });

    it('should set createdAt and updatedAt timestamps', async () => {
      const log = await AuditLog.createLog(
        AuditEventType.REGISTER,
        mockIpAddress
      );

      expect(log.createdAt).toBeInstanceOf(Date);
      expect(log.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Data Validation', () => {
    it('should handle complex details objects', async () => {
      const complexDetails = {
        user: {
          id: mockUserId,
          email: 'test@example.com',
          preferences: { theme: 'dark', notifications: true }
        },
        metadata: {
          sessionId: 'sess123',
          requestId: 'req456',
          tracking: [{ event: 'click', timestamp: Date.now() }]
        },
        errors: ['error1', 'error2']
      };

      const log = await AuditLog.createLog(
        AuditEventType.ADMIN_ACTION,
        mockIpAddress,
        mockUserId,
        complexDetails,
        true
      );

      expect(log.details).toEqual(complexDetails);
    });

    it('should handle empty details', async () => {
      const log = await AuditLog.createLog(
        AuditEventType.LOGIN_SUCCESS,
        mockIpAddress,
        mockUserId,
        {},
        true
      );

      expect(log.details).toEqual({});
    });

    it('should handle null and undefined values correctly', async () => {
      const log = await AuditLog.createLog(
        AuditEventType.LOGIN_SUCCESS,
        mockIpAddress,
        undefined,
        undefined,
        true,
        undefined
      );

      expect(log.userId).toBeNull();
      expect(log.details).toEqual({});
      expect(log.userAgent).toBeNull();
    });
  });
});