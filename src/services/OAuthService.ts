import { Request } from 'express';
import { User, IUserDocument } from '../models';
import { AuthProvider, IUserCreateInput } from '../types/types';
import { jwtService } from './JwtService';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AuditLog } from '../models/AuditLog';
import { AuditEventType } from '../types/types';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import passport from 'passport';

export interface IOAuthProfile {
  id: string;
  email?: string;
  username?: string;
  displayName?: string;
  avatar?: string;
  provider: AuthProvider;
}

/**
 * OAuth Service for handling Google and GitHub authentication
 */
export class OAuthService {
  private static instance: OAuthService;

  private constructor() {
    this.initializeStrategies();
  }

  public static getInstance(): OAuthService {
    if (!OAuthService.instance) {
      OAuthService.instance = new OAuthService();
    }
    return OAuthService.instance;
  }

  /**
   * Initialize passport strategies
   */
  public initializeStrategies(): void {
    // Initialize Google Strategy
    if (config.get('googleClientId') && config.get('googleClientSecret')) {
      passport.use(new GoogleStrategy({
        clientID: config.get('googleClientId')!,
        clientSecret: config.get('googleClientSecret')!,
        callbackURL: '/api/auth/google/callback',
        scope: ['profile', 'email'],
      }, this.verifyGoogleCallback.bind(this)));
      logger.info('Google OAuth strategy initialized');
    } else {
      logger.warn('Google OAuth credentials not configured');
    }

    // Initialize GitHub Strategy
    if (config.get('githubClientId') && config.get('githubClientSecret')) {
      passport.use(new GitHubStrategy({
        clientID: config.get('githubClientId')!,
        clientSecret: config.get('githubClientSecret')!,
        callbackURL: '/api/auth/github/callback',
        scope: ['user:email'],
      }, this.verifyGitHubCallback.bind(this)));
      logger.info('GitHub OAuth strategy initialized');
    } else {
      logger.warn('GitHub OAuth credentials not configured');
    }
  }

  /**
   * Verify Google OAuth callback
   */
  private async verifyGoogleCallback(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: (error: any, user?: any) => void
  ): Promise<void> {
    try {
      const oauthProfile = this.parseGoogleProfile(profile);
      const user = await this.findOrCreateUser(oauthProfile);
      done(null, user);
    } catch (error) {
      logger.error('Google OAuth verification error:', error);
      done(error, null);
    }
  }

  /**
   * Verify GitHub OAuth callback
   */
  private async verifyGitHubCallback(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: (error: any, user?: any) => void
  ): Promise<void> {
    try {
      const oauthProfile = this.parseGitHubProfile(profile);
      const user = await this.findOrCreateUser(oauthProfile);
      done(null, user);
    } catch (error) {
      logger.error('GitHub OAuth verification error:', error);
      done(error, null);
    }
  }

  /**
   * Parse Google OAuth profile
   */
  private parseGoogleProfile(profile: any): IOAuthProfile {
    return {
      id: profile.id,
      email: profile.emails?.[0]?.value,
      username: profile.emails?.[0]?.value?.split('@')[0] || `google_user_${profile.id}`,
      displayName: profile.displayName,
      avatar: profile.photos?.[0]?.value,
      provider: AuthProvider.GOOGLE,
    };
  }

  /**
   * Parse GitHub OAuth profile
   */
  private parseGitHubProfile(profile: any): IOAuthProfile {
    return {
      id: profile.id,
      email: profile.emails?.[0]?.value,
      username: profile.username || `github_user_${profile.id}`,
      displayName: profile.displayName || profile.username,
      avatar: profile.photos?.[0]?.value,
      provider: AuthProvider.GITHUB,
    };
  }

  /**
   * Find or create user from OAuth profile
   */
  private async findOrCreateUser(oauthProfile: IOAuthProfile): Promise<IUserDocument> {
    try {
      // First, try to find user by OAuth provider and ID
      let user = await User.findOne({
        authProvider: oauthProfile.provider,
        $or: oauthProfile.email ? [
          { email: oauthProfile.email },
          { username: oauthProfile.username }
        ] : [
          { username: oauthProfile.username }
        ]
      });

      if (user) {
        // User exists, update last login
        user.lastSeen = new Date();
        await user.save();
        return user;
      }

      // Create new user
      const userData: IUserCreateInput = {
        email: oauthProfile.email || `${oauthProfile.username}@${oauthProfile.provider}.com`,
        username: await this.generateUniqueUsername(oauthProfile.username || oauthProfile.displayName || `user_${oauthProfile.id}`),
        authProvider: oauthProfile.provider,
        avatar: oauthProfile.avatar,
      };

      const newUser = await User.createUser(userData);
      logger.info(`New OAuth user created: ${newUser.email} via ${oauthProfile.provider}`);

      return newUser;
    } catch (error) {
      logger.error('Error finding or creating OAuth user:', error);
      throw error;
    }
  }

  /**
   * Generate unique username
   */
  private async generateUniqueUsername(baseUsername: string): Promise<string> {
    let username = baseUsername.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    let counter = 1;
    let originalUsername = username;

    while (await User.findByUsername(username)) {
      username = `${originalUsername}_${counter}`;
      counter++;
    }

    return username;
  }

  /**
   * Handle successful OAuth authentication
   */
  public async handleOAuthSuccess(
    user: IUserDocument,
    ipAddress: string,
    userAgent?: string
  ): Promise<{ user: IUserDocument; tokens: any }> {
    try {
      // Generate tokens
      const tokens = jwtService.generateTokens({
        userId: (user._id as any).toString(),
        email: user.email,
        role: user.role,
      });

      // Log successful OAuth login
      await AuditLog.createLog(
        AuditEventType.LOGIN_SUCCESS,
        ipAddress,
        (user._id as any).toString(),
        { userId: user._id, email: user.email, authProvider: user.authProvider },
        true,
        userAgent
      );

      // Update last seen
      user.lastSeen = new Date();
      await user.save();

      logger.info(`OAuth login successful: ${user.email} via ${user.authProvider}`);

      return { user: user.toSafeObject() as IUserDocument, tokens };
    } catch (error) {
      logger.error('OAuth success handling error:', error);
      throw error;
    }
  }

  /**
   * Get available OAuth providers
   */
  public getAvailableProviders(): Array<{ provider: AuthProvider; name: string; enabled: boolean }> {
    const providers = [
      {
        provider: AuthProvider.GOOGLE,
        name: 'Google',
        enabled: !!(config.get('googleClientId') && config.get('googleClientSecret')),
      },
      {
        provider: AuthProvider.GITHUB,
        name: 'GitHub',
        enabled: !!(config.get('githubClientId') && config.get('githubClientSecret')),
      },
    ];

    return providers;
  }

  /**
   * Get OAuth redirect URL
   */
  public getRedirectURL(provider: AuthProvider): string | null {
    const baseUrl = process.env.BASE_URL || `http://localhost:${config.get('port')}`;

    switch (provider) {
      case AuthProvider.GOOGLE:
        if (!config.get('googleClientId')) return null;
        return `${baseUrl}/api/auth/google`;
      case AuthProvider.GITHUB:
        if (!config.get('githubClientId')) return null;
        return `${baseUrl}/api/auth/github`;
      default:
        return null;
    }
  }

  /**
   * Get OAuth callback URL
   */
  public getCallbackURL(provider: AuthProvider): string | null {
    const baseUrl = process.env.BASE_URL || `http://localhost:${config.get('port')}`;

    switch (provider) {
      case AuthProvider.GOOGLE:
        if (!config.get('googleClientId')) return null;
        return `${baseUrl}/api/auth/google/callback`;
      case AuthProvider.GITHUB:
        if (!config.get('githubClientId')) return null;
        return `${baseUrl}/api/auth/github/callback`;
      default:
        return null;
    }
  }
}

export const oAuthService = OAuthService.getInstance();