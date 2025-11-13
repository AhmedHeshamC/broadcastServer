import { Router, Request, Response } from 'express';
import passport from 'passport';
import { oAuthService } from '../services/OAuthService';
import { IApiResponse } from '../types/types';
import { config } from '../config';

const router = Router();

/**
 * Available OAuth providers
 * GET /api/auth/oauth/providers
 */
router.get('/providers', (req, res) => {
  const providers = oAuthService.getAvailableProviders();

  const response: IApiResponse = {
    success: true,
    data: {
      providers,
      baseUrl: process.env.BASE_URL || `http://localhost:${config.get('port')}`,
    },
  };

  res.status(200).json(response);
});

/**
 * Google OAuth authentication
 * GET /api/auth/google
 */
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
}));

/**
 * Google OAuth callback
 * GET /api/auth/google/callback
 */
router.get('/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/login?error=google_failed',
  }),
  async (req: Request, res: Response) => {
    try {
      const { ipAddress, userAgent } = req as any;
      const user = req.user as any;

      const result = await oAuthService.handleOAuthSuccess(user, ipAddress, userAgent);

      // Redirect to frontend with tokens
      const redirectUrl = process.env.FRONTEND_URL || `http://localhost:3000`;
      const tokensParam = encodeURIComponent(JSON.stringify(result.tokens));

      res.redirect(`${redirectUrl}/auth/callback?success=true&user=${encodeURIComponent(JSON.stringify(result.user))}&tokens=${tokensParam}`);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      const redirectUrl = process.env.FRONTEND_URL || `http://localhost:3000`;
      res.redirect(`${redirectUrl}/login?error=google_callback_failed`);
    }
  }
);

/**
 * GitHub OAuth authentication
 * GET /api/auth/github
 */
router.get('/github', passport.authenticate('github', {
  scope: ['user:email'],
}));

/**
 * GitHub OAuth callback
 * GET /api/auth/github/callback
 */
router.get('/github/callback',
  passport.authenticate('github', {
    session: false,
    failureRedirect: '/login?error=github_failed',
  }),
  async (req: Request, res: Response) => {
    try {
      const { ipAddress, userAgent } = req as any;
      const user = req.user as any;

      const result = await oAuthService.handleOAuthSuccess(user, ipAddress, userAgent);

      // Redirect to frontend with tokens
      const redirectUrl = process.env.FRONTEND_URL || `http://localhost:3000`;
      const tokensParam = encodeURIComponent(JSON.stringify(result.tokens));

      res.redirect(`${redirectUrl}/auth/callback?success=true&user=${encodeURIComponent(JSON.stringify(result.user))}&tokens=${tokensParam}`);
    } catch (error) {
      console.error('GitHub OAuth callback error:', error);
      const redirectUrl = process.env.FRONTEND_URL || `http://localhost:3000`;
      res.redirect(`${redirectUrl}/login?error=github_callback_failed`);
    }
  }
);

/**
 * OAuth error handler
 */
router.use((error: any, req: Request, res: Response, next: any) => {
  console.error('OAuth error:', error);

  const response: IApiResponse = {
    success: false,
    error: 'OAuth authentication failed',
  };

  res.status(500).json(response);
});

export default router;