import { Request, Response, NextFunction } from 'express';
import { rateLimitService } from '../services/RateLimitService';
import { logger } from '../utils/logger';

// XSS sanitizer implementation
const sanitizeXSS = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return obj
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/<img[^>]*src[^>]*>/gi, '')
      .replace(/<embed[^>]*>/gi, '')
      .replace(/<object[^>]*>/gi, '');
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeXSS);
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeXSS(value);
    }
    return sanitized;
  }

  return obj;
};

/**
 * Comprehensive security middleware with rate limiting, input validation, CORS, and security headers
 */
export const rateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get client IP address with fallbacks
    const ipAddress = req.ip ||
                     (req.socket && req.socket.remoteAddress) ||
                     (req.connection && req.connection.remoteAddress) ||
                     '127.0.0.1';

    const userAgent = req.get('User-Agent');
    const endpoint = `${req.method} ${req.originalUrl || req.url}`;

    // Check rate limits
    const rateLimitResult = rateLimitService.checkRateLimit(ipAddress, endpoint, userAgent);

    // Set rate limit headers
    res.set('X-RateLimit-Limit', '100');
    res.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    res.set('X-RateLimit-Reset', rateLimitResult.resetTime.toUTCString());

    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded', {
        ip: ipAddress,
        endpoint,
        userAgent,
        remaining: rateLimitResult.remaining
      });

      res.status(429).json({
        success: false,
        message: 'Too many requests',
        error: 'RATE_LIMIT_EXCEEDED',
        retryAfter: rateLimitResult.retryAfter
      });
      return;
    }

    // Set security headers
    setSecurityHeaders(req, res);

    // Handle CORS - allow localhost origins for development
    const origin = req.get('Origin');
    const allowedOrigins = [
      'https://trusted-domain.com',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8080',
      'http://localhost:5173',  // Frontend development server
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:8080',
      'http://127.0.0.1:5173'
    ];

    if (origin && !allowedOrigins.includes(origin)) {
      // In development, be more permissive
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`CORS: Allowing origin ${origin} in development mode`);
      } else {
        res.status(403).json({
          success: false,
          message: 'CORS policy violation',
          error: 'CORS_VIOLATION'
        });
        return;
      }
    }

    // Handle OPTIONS preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    // Input validation and sanitization
    const validationResult = await validateAndSanitizeRequest(req, res);
    if (!validationResult.valid) {
      return; // Response already sent by validateAndSanitizeRequest
    }

    // Log request for monitoring
    logger.info('Request processed', {
      ip: ipAddress,
      method: req.method,
      url: req.originalUrl || req.url,
      userAgent,
      contentLength: req.get('Content-Length'),
      remaining: rateLimitResult.remaining
    });

    next();
  } catch (error) {
    logger.error('Security middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Validate and sanitize request data
 * Returns { valid: boolean } to indicate if request should continue
 */
const validateAndSanitizeRequest = async (req: Request, res: Response): Promise<{ valid: boolean }> => {
  // Check request size
  const contentLength = parseInt(req.get('Content-Length') || '0', 10);
  const maxPayloadSize = 10 * 1024 * 1024; // 10MB

  if (contentLength > maxPayloadSize) {
    res.status(413).json({
      success: false,
      message: 'Request entity too large',
      error: 'PAYLOAD_TOO_LARGE'
    });
    return { valid: false };
  }

  // Check URL length
  const url = req.originalUrl || req.url;
  const maxUrlLength = 2048;
  if (url.length > maxUrlLength) {
    res.status(414).json({
      success: false,
      message: 'Request URI too long',
      error: 'URI_TOO_LONG'
    });
    return { valid: false };
  }

  // Sanitize request body if present
  if (req.body) {
    req.body = sanitizeXSS(req.body);
  }

  // Sanitize query parameters if present
  if (req.query) {
    req.query = sanitizeXSS(req.query);
  }

  // Sanitize URL parameters if present
  if (req.params) {
    req.params = sanitizeXSS(req.params);
  }

  return { valid: true };
};

/**
 * Set comprehensive security headers
 */
const setSecurityHeaders = (req: Request, res: Response): void => {
  // Basic security headers
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('X-XSS-Protection', '1; mode=block');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy
  res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'");

  // Permissions Policy
  res.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Strict Transport Security (only in production)
  if (process.env.NODE_ENV === 'production') {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Remove server information
  try {
    res.removeHeader('Server');
  } catch (e) {
    // Ignore if header doesn't exist
  }
};

/**
 * Handle CORS validation and headers
 */
const handleCORS = (req: Request, res: Response): { allowed: boolean } => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:8080',
    'http://localhost:5173',  // Frontend development server
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:5173',
    'https://trusted-domain.com'
  ];

  const origin = req.get('Origin');

  // Set CORS headers for allowed origins
  if (origin && allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Max-Age', '86400'); // 24 hours
    return { allowed: true };
  }

  // Allow requests without Origin header (same-origin or tools like curl)
  if (!origin) {
    return { allowed: true };
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    const requestedMethod = req.get('Access-Control-Request-Method');
    const requestedHeaders = req.get('Access-Control-Request-Headers');

    if (requestedMethod && requestedHeaders) {
      // Validate requested method and headers
      const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
      if (allowedMethods.includes(requestedMethod)) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Access-Control-Allow-Methods', requestedMethod);
        res.set('Access-Control-Allow-Headers', requestedHeaders);
        res.set('Access-Control-Allow-Credentials', 'true');
        res.set('Access-Control-Max-Age', '86400');
        return { allowed: true };
      }
    }
  }

  return { allowed: false };
};