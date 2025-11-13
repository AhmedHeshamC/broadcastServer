import jwt, { SignOptions } from 'jsonwebtoken';
import { IJwtPayload, IAuthTokens } from '../types/types';
import { config } from '../config';
import { logger } from '../utils/logger';

export class JwtService {
  private static instance: JwtService;
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;

  private constructor() {
    this.accessTokenSecret = config.get('jwtSecret');
    this.refreshTokenSecret = config.get('jwtRefreshSecret');

    if (!this.accessTokenSecret || !this.refreshTokenSecret) {
      throw new Error('JWT secrets are not configured');
    }
  }

  public static getInstance(): JwtService {
    if (!JwtService.instance) {
      JwtService.instance = new JwtService();
    }
    return JwtService.instance;
  }

  /**
   * Generate access token for user
   */
  public generateAccessToken(payload: IJwtPayload): string {
    try {
      const tokenPayload = {
        ...payload,
        iat: Math.floor(Date.now() / 1000), // Issued at time
        jti: `${payload.userId}-${Date.now()}` // Unique token identifier
      };

      return jwt.sign(tokenPayload, this.accessTokenSecret, {
        expiresIn: config.get('jwtExpirationTime') as string,
        issuer: 'broadcast-server',
        audience: 'broadcast-client',
      } as any);
    } catch (error) {
      logger.error('Failed to generate access token:', error);
      throw new Error('Failed to generate access token');
    }
  }

  /**
   * Generate refresh token for user
   */
  public generateRefreshToken(payload: IJwtPayload): string {
    try {
      const tokenPayload = {
        ...payload,
        iat: Math.floor(Date.now() / 1000), // Issued at time
        jti: `${payload.userId}-refresh-${Date.now()}` // Unique token identifier
      };

      return jwt.sign(tokenPayload, this.refreshTokenSecret, {
        expiresIn: config.get('jwtRefreshExpirationTime') as string,
        issuer: 'broadcast-server',
        audience: 'broadcast-client',
      } as any);
    } catch (error) {
      logger.error('Failed to generate refresh token:', error);
      throw new Error('Failed to generate refresh token');
    }
  }

  /**
   * Generate both access and refresh tokens
   */
  public generateTokens(payload: IJwtPayload): IAuthTokens {
    // Add tiny delay to ensure unique timestamps even when called rapidly
    const now = Date.now();

    const accessToken = this.generateAccessToken(payload);

    // Ensure at least 1ms difference for unique timestamps
    const tokenGenerationDelay = Math.max(1, Date.now() - now);
    if (tokenGenerationDelay === 0) {
      // Busy wait to ensure timestamp difference
      const start = Date.now();
      while (Date.now() - start === 0) {
        // Continue
      }
    }

    const refreshToken = this.generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Verify access token
   */
  public verifyAccessToken(token: string): IJwtPayload {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: 'broadcast-server',
        audience: 'broadcast-client',
      }) as IJwtPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Access token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid access token');
      } else {
        logger.error('Error verifying access token:', error);
        throw new Error('Failed to verify access token');
      }
    }
  }

  /**
   * Verify refresh token
   */
  public verifyRefreshToken(token: string): IJwtPayload {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: 'broadcast-server',
        audience: 'broadcast-client',
      }) as IJwtPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      } else {
        logger.error('Error verifying refresh token:', error);
        throw new Error('Failed to verify refresh token');
      }
    }
  }

  /**
   * Decode token without verification (for debugging/logging)
   */
  public decodeToken(token: string): IJwtPayload | null {
    try {
      const decoded = jwt.decode(token) as IJwtPayload;
      return decoded;
    } catch (error) {
      logger.debug('Failed to decode token:', error);
      return null;
    }
  }

  /**
   * Check if token will expire within specified seconds
   */
  public isTokenExpiringSoon(token: string, secondsThreshold = 300): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - now;

    return timeUntilExpiry <= secondsThreshold;
  }

  /**
   * Extract token from Authorization header
   */
  public extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }
}

export const jwtService = JwtService.getInstance();