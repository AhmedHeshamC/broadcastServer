import { Router, Request, Response, NextFunction } from 'express';
import { authController } from '../controllers/AuthController';
import { authenticateToken, extractRequestInfo } from '../middleware/auth';
import { IAuthenticatedRequest } from '../types/AuthenticatedRequest';
import {
  validate,
  validateRegistration,
  validateLogin,
  validateRefreshToken,
  validateToken,
} from '../validators/authValidators';

const router = Router();

/**
 * Apply extractRequestInfo middleware to all routes
 */
router.use(extractRequestInfo);

/**
 * Wrapper function to handle authenticated requests
 */
const withAuth = (handler: (req: IAuthenticatedRequest, res: Response, next?: NextFunction) => Promise<void>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req as IAuthenticatedRequest, res, next);
  };
};

/**
 * Register a new user
 * POST /api/auth/register
 */
router.post('/register', validate(validateRegistration), authController.register.bind(authController));

/**
 * Login user
 * POST /api/auth/login
 */
router.post('/login', validate(validateLogin), authController.login.bind(authController));

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
router.post('/refresh', validate(validateRefreshToken), authController.refreshToken.bind(authController));

/**
 * Logout user (requires authentication)
 * POST /api/auth/logout
 */
// router.post('/logout', authenticateToken, (req, res, next) => {
//   return authController.logout(req as any, res, next);
// });

/**
 * Get current user profile (requires authentication)
 * GET /api/auth/profile
 */
router.get('/profile', authenticateToken, withAuth(authController.getProfile.bind(authController)));

/**
 * Verify token validity
 * POST /api/auth/verify
 */
router.post('/verify', validate(validateToken), authController.verifyToken.bind(authController));

export default router;