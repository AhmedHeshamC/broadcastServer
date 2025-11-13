import { Request, Response, NextFunction } from 'express';
import { rateLimitMiddleware } from '../../middleware/SecurityMiddleware';
import { rateLimitService } from '../../services/RateLimitService';
import { logger } from '../../utils/logger';

// Mock the services and utilities
jest.mock('../../services/RateLimitService');
jest.mock('../../utils/logger');

describe('SecurityMiddleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('Rate Limiting Middleware', () => {
    it('should allow request within rate limit', async () => {
      const mockIp = '192.168.1.1';
      const mockUserAgent = 'Test-Agent/1.0';

      mockRequest = {
        ip: mockIp,
        get: jest.fn().mockImplementation((header: string) => {
          if (header === 'User-Agent') return mockUserAgent;
          return undefined;
        }) as any,
        method: 'POST',
        originalUrl: '/api/messages'
      };

      (rateLimitService.checkRateLimit as jest.Mock).mockReturnValue({
        allowed: true,
        remaining: 99,
        resetTime: new Date(Date.now() + 60000)
      });

      await rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        mockIp,
        expect.any(String),
        mockUserAgent
      );
      expect(mockResponse.set).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(String));
      expect(mockResponse.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '99');
      expect(mockResponse.set).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject request exceeding rate limit', async () => {
      const mockIp = '192.168.1.1';
      const mockUserAgent = 'Test-Agent/1.0';

      mockRequest = {
        ip: mockIp,
        get: jest.fn().mockImplementation((header: string) => {
          if (header === 'User-Agent') return mockUserAgent;
          return undefined;
        }) as any,
        method: 'POST',
        originalUrl: '/api/messages'
      };

      (rateLimitService.checkRateLimit as jest.Mock).mockReturnValue({
        allowed: false,
        remaining: 0,
        resetTime: new Date(Date.now() + 60000),
        retryAfter: 60
      });

      await rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        mockIp,
        expect.any(String),
        mockUserAgent
      );
      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Too many requests',
        error: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 60
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle rate limit service errors gracefully', async () => {
      const mockIp = '192.168.1.1';

      mockRequest = {
        ip: mockIp,
        get: jest.fn() as any,
        method: 'GET',
        originalUrl: '/api/messages'
      };

      (rateLimitService.checkRateLimit as jest.Mock).mockImplementation(() => {
        throw new Error('Rate limit service error');
      });

      await rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should use fallback IP when req.ip is undefined', async () => {
      mockRequest = {
        ip: undefined,
        socket: {
          remoteAddress: '127.0.0.1'
        } as any,
        get: jest.fn() as any,
        method: 'GET',
        originalUrl: '/api/messages'
      };

      (rateLimitService.checkRateLimit as jest.Mock).mockReturnValue({
        allowed: true,
        remaining: 100,
        resetTime: new Date(Date.now() + 60000)
      });

      await rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        '127.0.0.1',
        expect.any(String),
        undefined
      );
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('Input Validation Middleware', () => {
    it('should sanitize request body for XSS', async () => {
      const mockBody = {
        content: '<script>alert("xss")</script>Hello',
        metadata: {
          safeField: 'safe value',
          maliciousField: '<img src=x onerror=alert(1)>'
        }
      };

      mockRequest = {
        body: mockBody,
        ip: '192.168.1.1',
        get: jest.fn() as any,
        method: 'POST',
        originalUrl: '/api/messages'
      };

      (rateLimitService.checkRateLimit as jest.Mock).mockReturnValue({
        allowed: true,
        remaining: 100,
        resetTime: new Date(Date.now() + 60000)
      });

      await rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      // The request body should be sanitized (this will be implemented in the actual middleware)
    });

    it('should validate request size limits', async () => {
      const largePayload = 'x'.repeat(10 * 1024 * 1024); // 10MB payload

      mockRequest = {
        body: { data: largePayload },
        ip: '192.168.1.1',
        get: jest.fn().mockReturnValue((10 * 1024 * 1024).toString()) as any,
        method: 'POST',
        originalUrl: '/api/messages'
      };

      (rateLimitService.checkRateLimit as jest.Mock).mockReturnValue({
        allowed: true,
        remaining: 100,
        resetTime: new Date(Date.now() + 60000)
      });

      await rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(413);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Request entity too large',
        error: 'PAYLOAD_TOO_LARGE'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should validate URL length', async () => {
      const longUrl = '/api/' + 'x'.repeat(2000);

      mockRequest = {
        ip: '192.168.1.1',
        get: jest.fn() as any,
        method: 'GET',
        originalUrl: longUrl
      };

      (rateLimitService.checkRateLimit as jest.Mock).mockReturnValue({
        allowed: true,
        remaining: 100,
        resetTime: new Date(Date.now() + 60000)
      });

      await rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(414);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Request URI too long',
        error: 'URI_TOO_LONG'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Security Headers Middleware', () => {
    it('should set security headers', async () => {
      mockRequest = {
        ip: '192.168.1.1',
        get: jest.fn() as any,
        method: 'GET',
        originalUrl: '/api/messages',
        headers: {}
      };

      (rateLimitService.checkRateLimit as jest.Mock).mockReturnValue({
        allowed: true,
        remaining: 100,
        resetTime: new Date(Date.now() + 60000)
      });

      await rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Check for security headers
      expect(mockResponse.set).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockResponse.set).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockResponse.set).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(mockResponse.set).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
      expect(mockResponse.set).toHaveBeenCalledWith('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set CORS headers for allowed origins', async () => {
      mockRequest = {
        ip: '192.168.1.1',
        get: jest.fn().mockImplementation((header: string) => {
          if (header === 'Origin') return 'https://trusted-domain.com';
          return undefined;
        }) as any,
        method: 'GET',
        originalUrl: '/api/messages',
        headers: {
          origin: 'https://trusted-domain.com'
        }
      };

      (rateLimitService.checkRateLimit as jest.Mock).mockReturnValue({
        allowed: true,
        remaining: 100,
        resetTime: new Date(Date.now() + 60000)
      });

      await rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://trusted-domain.com');
      expect(mockResponse.set).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      expect(mockResponse.set).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      expect(mockResponse.set).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject requests from disallowed origins', async () => {
      mockRequest = {
        ip: '192.168.1.1',
        get: jest.fn().mockImplementation((header: string) => {
          if (header === 'Origin') return 'https://malicious-site.com';
          return undefined;
        }) as any,
        method: 'POST',
        originalUrl: '/api/messages',
        headers: {
          origin: 'https://malicious-site.com'
        }
      };

      (rateLimitService.checkRateLimit as jest.Mock).mockReturnValue({
        allowed: true,
        remaining: 100,
        resetTime: new Date(Date.now() + 60000)
      });

      await rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'CORS policy violation',
        error: 'CORS_VIOLATION'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Request Logging and Monitoring', () => {
    it('should log request details for monitoring', async () => {
      const mockIp = '192.168.1.1';
      const mockUserAgent = 'Test-Agent/1.0';

      mockRequest = {
        ip: mockIp,
        method: 'POST',
        originalUrl: '/api/messages',
        get: jest.fn().mockImplementation((header: string) => {
          if (header === 'User-Agent') return mockUserAgent;
          if (header === 'Content-Length') return '123';
          if (header === 'Content-Type') return 'application/json';
          return undefined;
        }) as any,
        headers: {
          'content-type': 'application/json',
          'content-length': '123'
        }
      };

      (rateLimitService.checkRateLimit as jest.Mock).mockReturnValue({
        allowed: true,
        remaining: 100,
        resetTime: new Date(Date.now() + 60000)
      });

      await rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.info).toHaveBeenCalledWith('Request processed', expect.objectContaining({
        ip: mockIp,
        method: 'POST',
        url: '/api/messages',
        userAgent: mockUserAgent,
        contentLength: '123'
      }));
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle OPTIONS requests with CORS preflight', async () => {
      mockRequest = {
        ip: '192.168.1.1',
        get: jest.fn().mockImplementation((header: string) => {
          if (header === 'Origin') return 'https://trusted-domain.com';
          if (header === 'Access-Control-Request-Method') return 'POST';
          if (header === 'Access-Control-Request-Headers') return 'Content-Type';
          return undefined;
        }) as any,
        method: 'OPTIONS',
        originalUrl: '/api/messages',
        headers: {
          origin: 'https://trusted-domain.com',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'Content-Type'
        }
      };

      (rateLimitService.checkRateLimit as jest.Mock).mockReturnValue({
        allowed: true,
        remaining: 100,
        resetTime: new Date(Date.now() + 60000)
      });

      await rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://trusted-domain.com');
      expect(mockResponse.set).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'POST');
      expect(mockResponse.set).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type');
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});