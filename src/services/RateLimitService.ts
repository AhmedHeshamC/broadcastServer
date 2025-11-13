import { config } from '../config';
import { logger } from '../utils/logger';
import { AuditLog } from '../models/AuditLog';
import { AuditEventType } from '../types/types';

interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastActivity: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  blockDuration: number;
}

interface UserRateLimit {
  messages: RateLimitEntry;
  connections: RateLimitEntry;
  logins: RateLimitEntry;
}

export class RateLimitService {
  private static instance: RateLimitService;
  private rateLimits: Map<string, UserRateLimit> = new Map();
  private blockedIPs: Map<string, number> = new Map(); // IP -> unblock time

  // Rate limit configurations
  private readonly messageConfig: RateLimitConfig = {
    windowMs: 60000, // 1 minute
    maxRequests: 30,  // 30 messages per minute
    blockDuration: 300000, // 5 minutes block
  };

  private readonly connectionConfig: RateLimitConfig = {
    windowMs: 60000, // 1 minute
    maxRequests: 5,   // 5 connection attempts per minute
    blockDuration: 600000, // 10 minutes block
  };

  private readonly loginConfig: RateLimitConfig = {
    windowMs: 900000, // 15 minutes
    maxRequests: 5,   // 5 login attempts per 15 minutes
    blockDuration: 1800000, // 30 minutes block
  };

  private constructor() {
    // Clean up expired entries every minute
    setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  public static getInstance(): RateLimitService {
    if (!RateLimitService.instance) {
      RateLimitService.instance = new RateLimitService();
    }
    return RateLimitService.instance;
  }

  /**
   * Check if IP is blocked
   */
  public isIPBlocked(ipAddress: string): boolean {
    const unblockTime = this.blockedIPs.get(ipAddress);
    if (!unblockTime) return false;

    if (Date.now() > unblockTime) {
      this.blockedIPs.delete(ipAddress);
      return false;
    }

    return true;
  }

  /**
   * Block IP for specified duration
   */
  public blockIP(ipAddress: string, durationMs: number = this.messageConfig.blockDuration): void {
    const unblockTime = Date.now() + durationMs;
    this.blockedIPs.set(ipAddress, unblockTime);
    logger.warn(`IP ${ipAddress} blocked until ${new Date(unblockTime).toISOString()}`);
  }

  /**
   * Check message rate limit
   */
  public checkMessageRate(userId: string, ipAddress: string): { allowed: boolean; remaining: number; resetTime: number } {
    // First check if IP is blocked
    if (this.isIPBlocked(ipAddress)) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: this.blockedIPs.get(ipAddress)!,
      };
    }

    const now = Date.now();
    const userLimits = this.getUserLimits(userId);

    // Check if window has expired
    if (now > userLimits.messages.resetTime) {
      userLimits.messages = {
        count: 1,
        resetTime: now + this.messageConfig.windowMs,
        lastActivity: now,
      };
      return {
        allowed: true,
        remaining: this.messageConfig.maxRequests - 1,
        resetTime: userLimits.messages.resetTime,
      };
    }

    // Check if limit exceeded
    if (userLimits.messages.count >= this.messageConfig.maxRequests) {
      this.blockIP(ipAddress, this.messageConfig.blockDuration);

      // Log rate limit violation
      AuditLog.createLog(
        AuditEventType.MESSAGE_SENT,
        ipAddress,
        userId,
        { action: 'rate_limit_exceeded', count: userLimits.messages.count },
        false
      );

      return {
        allowed: false,
        remaining: 0,
        resetTime: userLimits.messages.resetTime,
      };
    }

    // Increment counter
    userLimits.messages.count++;
    userLimits.messages.lastActivity = now;

    return {
      allowed: true,
      remaining: this.messageConfig.maxRequests - userLimits.messages.count,
      resetTime: userLimits.messages.resetTime,
    };
  }

  /**
   * Check connection rate limit
   */
  public checkConnectionRate(ipAddress: string): { allowed: boolean; remaining: number; resetTime: number } {
    if (this.isIPBlocked(ipAddress)) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: this.blockedIPs.get(ipAddress)!,
      };
    }

    const now = Date.now();
    const key = `conn_${ipAddress}`;
    const entry = this.rateLimits.get(key)?.connections || {
      count: 0,
      resetTime: now + this.connectionConfig.windowMs,
      lastActivity: now,
    };

    // Check if window has expired
    if (now > entry.resetTime) {
      const newEntry = {
        count: 1,
        resetTime: now + this.connectionConfig.windowMs,
        lastActivity: now,
      };
      this.setConnectionLimit(ipAddress, newEntry);

      return {
        allowed: true,
        remaining: this.connectionConfig.maxRequests - 1,
        resetTime: newEntry.resetTime,
      };
    }

    // Check if limit exceeded
    if (entry.count >= this.connectionConfig.maxRequests) {
      this.blockIP(ipAddress, this.connectionConfig.blockDuration);

      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    // Increment counter
    entry.count++;
    entry.lastActivity = now;
    this.setConnectionLimit(ipAddress, entry);

    return {
      allowed: true,
      remaining: this.connectionConfig.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Check login rate limit
   */
  public checkLoginRate(email: string, ipAddress: string): { allowed: boolean; remaining: number; resetTime: number } {
    if (this.isIPBlocked(ipAddress)) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: this.blockedIPs.get(ipAddress)!,
      };
    }

    const now = Date.now();
    const key = `login_${email}`;
    const entry = this.rateLimits.get(key)?.logins || {
      count: 0,
      resetTime: now + this.loginConfig.windowMs,
      lastActivity: now,
    };

    // Check if window has expired
    if (now > entry.resetTime) {
      const newEntry = {
        count: 1,
        resetTime: now + this.loginConfig.windowMs,
        lastActivity: now,
      };
      this.setLoginLimit(email, newEntry);

      return {
        allowed: true,
        remaining: this.loginConfig.maxRequests - 1,
        resetTime: newEntry.resetTime,
      };
    }

    // Check if limit exceeded
    if (entry.count >= this.loginConfig.maxRequests) {
      this.blockIP(ipAddress, this.loginConfig.blockDuration);

      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    // Increment counter
    entry.count++;
    entry.lastActivity = now;
    this.setLoginLimit(email, entry);

    return {
      allowed: true,
      remaining: this.loginConfig.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Generic rate limit check for middleware
   */
  public checkRateLimit(ipAddress: string, endpoint: string, userAgent?: string): {
    allowed: boolean;
    remaining: number;
    resetTime: Date;
    retryAfter?: number;
  } {
    // First check if IP is blocked
    if (this.isIPBlocked(ipAddress)) {
      const unblockTime = this.blockedIPs.get(ipAddress)!;
      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(unblockTime),
        retryAfter: Math.ceil((unblockTime - Date.now()) / 1000)
      };
    }

    // Determine rate limit config based on endpoint
    let config: RateLimitConfig;
    if (endpoint.includes('/messages')) {
      config = this.messageConfig;
    } else if (endpoint.includes('/auth/login')) {
      config = this.loginConfig;
    } else {
      // Default to connection config for other endpoints
      config = this.connectionConfig;
    }

    // Use a generic rate limit for this IP
    const now = Date.now();
    const key = `generic_${ipAddress}`;
    const entry = this.rateLimits.get(key);

    if (!entry || now > entry.messages.resetTime) {
      // Create new entry or reset expired entry
      this.rateLimits.set(key, {
        messages: {
          count: 0,
          resetTime: now + config.windowMs,
          lastActivity: now
        },
        connections: {
          count: 0,
          resetTime: now + config.windowMs,
          lastActivity: now
        },
        logins: {
          count: 0,
          resetTime: now + config.windowMs,
          lastActivity: now
        }
      });
    }

    const limits = this.rateLimits.get(key)!;

    if (now > limits.messages.resetTime) {
      limits.messages.count = 0;
      limits.messages.resetTime = now + config.windowMs;
    }

    if (limits.messages.count >= config.maxRequests) {
      // Block IP if exceeded rate limit
      this.blockIP(ipAddress, config.blockDuration);
      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(now + config.blockDuration),
        retryAfter: Math.ceil(config.blockDuration / 1000)
      };
    }

    // Increment counter and return allowed response
    limits.messages.count++;
    limits.messages.lastActivity = now;

    return {
      allowed: true,
      remaining: config.maxRequests - limits.messages.count,
      resetTime: new Date(limits.messages.resetTime)
    };
  }

  /**
   * Get rate limit statistics
   */
  public getStats() {
    const now = Date.now();
    const activeUsers = this.rateLimits.size;
    const blockedIPsCount = this.blockedIPs.size;

    return {
      activeUsers,
      blockedIPs: blockedIPsCount,
      rateLimits: {
        messages: this.messageConfig,
        connections: this.connectionConfig,
        logins: this.loginConfig,
      },
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();

    // Clean up rate limits
    for (const [key, limits] of this.rateLimits.entries()) {
      const allExpired =
        now > limits.messages.resetTime &&
        now > limits.connections.resetTime &&
        now > limits.logins.resetTime &&
        now > limits.messages.lastActivity + 300000 && // 5 minutes inactive
        now > limits.connections.lastActivity + 300000 &&
        now > limits.logins.lastActivity + 300000;

      if (allExpired) {
        this.rateLimits.delete(key);
      }
    }

    // Clean up blocked IPs
    for (const [ip, unblockTime] of this.blockedIPs.entries()) {
      if (now > unblockTime) {
        this.blockedIPs.delete(ip);
      }
    }
  }

  private getUserLimits(userId: string): UserRateLimit {
    let limits = this.rateLimits.get(userId);
    if (!limits) {
      limits = {
        messages: { count: 0, resetTime: Date.now() + this.messageConfig.windowMs, lastActivity: Date.now() },
        connections: { count: 0, resetTime: Date.now() + this.connectionConfig.windowMs, lastActivity: Date.now() },
        logins: { count: 0, resetTime: Date.now() + this.loginConfig.windowMs, lastActivity: Date.now() },
      };
      this.rateLimits.set(userId, limits);
    }
    return limits;
  }

  private setConnectionLimit(ipAddress: string, entry: RateLimitEntry): void {
    const key = `conn_${ipAddress}`;
    let limits = this.rateLimits.get(key);
    if (!limits) {
      limits = {
        messages: { count: 0, resetTime: Date.now() + this.messageConfig.windowMs, lastActivity: Date.now() },
        connections: entry,
        logins: { count: 0, resetTime: Date.now() + this.loginConfig.windowMs, lastActivity: Date.now() },
      };
    } else {
      limits.connections = entry;
    }
    this.rateLimits.set(key, limits);
  }

  private setLoginLimit(email: string, entry: RateLimitEntry): void {
    const key = `login_${email}`;
    let limits = this.rateLimits.get(key);
    if (!limits) {
      limits = {
        messages: { count: 0, resetTime: Date.now() + this.messageConfig.windowMs, lastActivity: Date.now() },
        connections: { count: 0, resetTime: Date.now() + this.connectionConfig.windowMs, lastActivity: Date.now() },
        logins: entry,
      };
    } else {
      limits.logins = entry;
    }
    this.rateLimits.set(key, limits);
  }
}

export const rateLimitService = RateLimitService.getInstance();