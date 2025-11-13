import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface ISession {
  userId: string;
  socketId: string;
  username: string;
  ipAddress: string;
  userAgent?: string;
  connectedAt: string;
  lastActivity: string;
  role: string;
}

export interface ICacheData {
  [key: string]: any;
}

export class RedisService {
  private static instance: RedisService;
  private client: RedisClientType | null = null;
  private isConnected = false;

  private constructor() {}

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  /**
   * Initialize Redis connection
   */
  public async initialize(): Promise<void> {
    try {
      this.client = createClient({
        url: config.get('redisUrl'),
        socket: {
          connectTimeout: 5000,
        },
        // disableOfflineQueue: true, // Don't queue commands when disconnected
      });

      this.client.on('error', (error) => {
        logger.error('Redis client error:', error);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('Redis client ready');
      });

      this.client.on('end', () => {
        logger.warn('Redis client disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      logger.error('Failed to initialize Redis:', error);
      throw error;
    }
  }

  /**
   * Check if Redis is connected
   */
  public isRedisConnected(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Store user session
   */
  public async storeSession(sessionId: string, sessionData: ISession): Promise<void> {
    if (!this.client || !this.isConnected) {
      logger.warn('Redis not available for session storage');
      return;
    }

    try {
      const key = `session:${sessionId}`;
      await this.client.setEx(key, 86400, JSON.stringify(sessionData)); // 24 hours expiration
      logger.debug(`Session stored: ${sessionId}`);
    } catch (error) {
      logger.error('Failed to store session:', error);
    }
  }

  /**
   * Get user session
   */
  public async getSession(sessionId: string): Promise<ISession | null> {
    if (!this.client || !this.isConnected) {
      return null;
    }

    try {
      const key = `session:${sessionId}`;
      const sessionData = await this.client.get(key);

      if (sessionData) {
        return JSON.parse(sessionData) as ISession;
      }

      return null;
    } catch (error) {
      logger.error('Failed to get session:', error);
      return null;
    }
  }

  /**
   * Remove user session
   */
  public async removeSession(sessionId: string): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }

    try {
      const key = `session:${sessionId}`;
      await this.client.del(key);
      logger.debug(`Session removed: ${sessionId}`);
    } catch (error) {
      logger.error('Failed to remove session:', error);
    }
  }

  /**
   * Get all active sessions for a user
   */
  public async getUserSessions(userId: string): Promise<ISession[]> {
    if (!this.client || !this.isConnected) {
      return [];
    }

    try {
      const pattern = 'session:*';
      const sessions = await this.client.keys(pattern);
      const userSessions: ISession[] = [];

      for (const sessionKey of sessions) {
        const sessionData = await this.client.get(sessionKey);
        if (sessionData) {
          const session = JSON.parse(sessionData) as ISession;
          if (session.userId === userId) {
            userSessions.push(session);
          }
        }
      }

      return userSessions;
    } catch (error) {
      logger.error('Failed to get user sessions:', error);
      return [];
    }
  }

  /**
   * Update session activity
   */
  public async updateSessionActivity(sessionId: string): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }

    try {
      const key = `session:${sessionId}`;
      const sessionData = await this.client.get(key);

      if (sessionData) {
        const session = JSON.parse(sessionData) as ISession;
        session.lastActivity = new Date().toISOString();
        await this.client.setEx(key, 86400, JSON.stringify(session));
      }
    } catch (error) {
      logger.error('Failed to update session activity:', error);
    }
  }

  /**
   * Cache data
   */
  public async setCache(key: string, data: ICacheData, ttlSeconds = 300): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }

    try {
      const cacheKey = `cache:${key}`;
      await this.client.setEx(cacheKey, ttlSeconds, JSON.stringify(data));
      logger.debug(`Cache set: ${key}`);
    } catch (error) {
      logger.error('Failed to set cache:', error);
    }
  }

  /**
   * Get cached data
   */
  public async getCache<T = any>(key: string): Promise<T | null> {
    if (!this.client || !this.isConnected) {
      return null;
    }

    try {
      const cacheKey = `cache:${key}`;
      const data = await this.client.get(cacheKey);

      if (data) {
        return JSON.parse(data) as T;
      }

      return null;
    } catch (error) {
      logger.error('Failed to get cache:', error);
      return null;
    }
  }

  /**
   * Delete cached data
   */
  public async deleteCache(key: string): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }

    try {
      const cacheKey = `cache:${key}`;
      await this.client.del(cacheKey);
      logger.debug(`Cache deleted: ${key}`);
    } catch (error) {
      logger.error('Failed to delete cache:', error);
    }
  }

  /**
   * Increment counter
   */
  public async incrementCounter(key: string, amount = 1): Promise<number> {
    if (!this.client || !this.isConnected) {
      return 0;
    }

    try {
      const counterKey = `counter:${key}`;
      const result = await this.client.incrBy(counterKey, amount);
      await this.client.expire(counterKey, 86400); // 24 hours expiration
      return result;
    } catch (error) {
      logger.error('Failed to increment counter:', error);
      return 0;
    }
  }

  /**
   * Get counter value
   */
  public async getCounter(key: string): Promise<number> {
    if (!this.client || !this.isConnected) {
      return 0;
    }

    try {
      const counterKey = `counter:${key}`;
      const value = await this.client.get(counterKey);
      return value ? parseInt(value, 10) : 0;
    } catch (error) {
      logger.error('Failed to get counter:', error);
      return 0;
    }
  }

  /**
   * Set counter value
   */
  public async setCounter(key: string, value: number): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }

    try {
      const counterKey = `counter:${key}`;
      await this.client.setEx(counterKey, 86400, value.toString()); // 24 hours expiration
    } catch (error) {
      logger.error('Failed to set counter:', error);
    }
  }

  /**
   * Add item to sorted set (for leaderboards, etc.)
   */
  public async addToSortedSet(setKey: string, score: number, member: string): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }

    try {
      const key = `zset:${setKey}`;
      await this.client.zAdd(key, [{ score, value: member }]);
      await this.client.expire(key, 86400); // 24 hours expiration
    } catch (error) {
      logger.error('Failed to add to sorted set:', error);
    }
  }

  /**
   * Get top items from sorted set
   */
  public async getTopFromSortedSet(setKey: string, count = 10): Promise<Array<{member: string, score: number}>> {
    if (!this.client || !this.isConnected) {
      return [];
    }

    try {
      const key = `zset:${setKey}`;
      const results = await this.client.zRangeWithScores(key, 0, count - 1, {
      REV: true,
    });

      return results.map((item: any) => ({
        member: item.value,
        score: item.score,
      }));
    } catch (error) {
      logger.error('Failed to get top from sorted set:', error);
      return [];
    }
  }

  /**
   * Clean up expired data
   */
  public async cleanup(): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }

    try {
      // Clean up inactive sessions
      const pattern = 'session:*';
      const sessions = await this.client.keys(pattern);
      const now = Date.now();

      for (const sessionKey of sessions) {
        const sessionData = await this.client.get(sessionKey);
        if (sessionData) {
          const session = JSON.parse(sessionData) as ISession;
          const lastActivity = new Date(session.lastActivity).getTime();

          // Remove sessions inactive for more than 30 minutes
          if (now - lastActivity > 30 * 60 * 1000) {
            await this.client.del(sessionKey);
          }
        }
      }

      logger.debug('Redis cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup Redis:', error);
    }
  }

  /**
   * Get Redis statistics
   */
  public async getStats(): Promise<any> {
    if (!this.client || !this.isConnected) {
      return {
        connected: false,
      };
    }

    try {
      const info = await this.client.info();
      const keyspace = await this.client.info('keyspace');

      return {
        connected: true,
        info,
        keyspace,
      };
    } catch (error) {
      logger.error('Failed to get Redis stats:', error);
      return {
        connected: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis client disconnected');
    }
  }
}

export const redisService = RedisService.getInstance();