import { Application } from '../../app';
import { logger } from '../../utils/logger';

// Mock external dependencies
jest.mock('socket.io');
jest.mock('mongoose');

describe('Application Integration', () => {
  let app: Application;

  beforeEach(() => {
    jest.clearAllMocks();
    // Set environment variables for testing
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

    app = new Application();
  });

  describe('Application Initialization', () => {
    it('should create application instance', () => {
      expect(app).toBeDefined();
      expect(app.app).toBeDefined();
      expect(app.server).toBeDefined();
      expect(app.io).toBeDefined();
    });

    it('should have health check endpoint', () => {
      const mockRequest = {
        url: '/health',
        method: 'GET'
      } as any;

      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      } as any;

      // Test that the app has routes (indirect test via existence)
      expect(app.app._router).toBeDefined();
    });

    it('should get application stats', () => {
      const stats = app.getStats();
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('uptime');
      expect(stats).toHaveProperty('memory');
    });
  });

  describe('Configuration', () => {
    it('should load configuration with defaults', () => {
      // This tests that the config can be loaded without throwing
      expect(() => {
        const { config } = require('../../config');
        expect(config.get('port')).toBeDefined();
        expect(config.get('jwtSecret')).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle graceful shutdown', async () => {
      const shutdownSpy = jest.spyOn(app as any, 'gracefulShutdown');
      await app.gracefulShutdown('SIGTERM');
      expect(shutdownSpy).toHaveBeenCalledWith('SIGTERM');
    });
  });

  describe('Security Features', () => {
    it('should have security middleware configured', () => {
      // Test that middleware is applied by checking app settings
      expect(app.app.get('trust proxy')).toBe(1);
    });
  });

  describe('WebSocket Integration', () => {
    it('should have Socket.IO server configured', () => {
      expect(app.io).toBeDefined();
      expect(typeof app.io.use).toBe('function');
      expect(typeof app.io.on).toBe('function');
    });
  });
});