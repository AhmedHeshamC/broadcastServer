import dotenv from 'dotenv';
import { IAppConfig } from '../types/types';

// Load environment variables
dotenv.config();

class Config {
  private static instance: Config;
  private config: IAppConfig;

  private constructor() {
    this.config = this.validateAndLoadConfig();
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  private validateAndLoadConfig(): IAppConfig {
    const requiredEnvVars = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

    if (missingEnvVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    }

    const port = parseInt(process.env.PORT || '3000', 10);
    const corsOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:8080', 'http://localhost:5173'];

    return {
      // Legacy properties for backward compatibility
      port,
      mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/broadcast-server',
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      jwtSecret: process.env.JWT_ACCESS_SECRET!,
      jwtRefreshSecret: process.env.JWT_REFRESH_SECRET!,
      jwtExpirationTime: process.env.JWT_ACCESS_EXPIRES || '15m',
      jwtRefreshExpirationTime: process.env.JWT_REFRESH_EXPIRES || '7d',
      googleClientId: process.env.GOOGLE_CLIENT_ID,
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
      githubClientId: process.env.GITHUB_CLIENT_ID,
      githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
      corsOrigins,
      rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes in ms
      rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
      maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH || '1000', 10),
      maxConnectionsPerUser: parseInt(process.env.MAX_CONNECTIONS_PER_USER || '5', 10),

      // Structured configuration for enterprise app
      server: {
        port,
        host: process.env.HOST || 'localhost'
      },
      mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/broadcast-server',
        options: {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        }
      },
      cors: {
        allowedOrigins: corsOrigins
      },
      cli: {
        enabled: process.env.CLI_ENABLED !== 'false', // Default to true
        port: parseInt(process.env.CLI_PORT || '8080', 10),
        host: process.env.CLI_HOST || 'localhost',
        maxConnections: parseInt(process.env.CLI_MAX_CONNECTIONS || '100', 10),
        enableLegacyProtocol: process.env.CLI_ENABLE_LEGACY !== 'false' // Default to true
      }
    };
  }

  public get<K extends keyof IAppConfig>(key: K): IAppConfig[K] {
    return this.config[key];
  }

  // Convenience getters for nested properties
  public get server() {
    return this.config.server;
  }

  public get mongodb() {
    return this.config.mongodb;
  }

  public get cors() {
    return this.config.cors;
  }

  public get cli() {
    return this.config.cli;
  }

  public getAll(): IAppConfig {
    return { ...this.config };
  }

  public isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  public isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }
}

export const config = Config.getInstance();

// Export config type for external use
export type { IAppConfig };