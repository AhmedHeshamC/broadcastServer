import { Router, Request, Response, NextFunction } from 'express';
import { adminController } from '../controllers/adminController';
import { authenticateToken, requireAdmin, extractRequestInfo } from '../middleware/auth';

const router = Router();

/**
 * Apply extractRequestInfo middleware to all routes
 */
router.use(extractRequestInfo);

/**
 * Wrapper function to handle authenticated admin requests
 */
const withAdminAuth = (handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return [
    authenticateToken,
    requireAdmin,
    (req: Request, res: Response, next: NextFunction) => {
      handler(req, res, next);
    }
  ];
};

/**
 * Get all users with pagination
 * GET /api/admin/users
 */
router.get('/users', ...withAdminAuth(adminController.getAllUsers.bind(adminController)));

/**
 * Get user by ID
 * GET /api/admin/users/:userId
 */
router.get('/users/:userId', ...withAdminAuth(adminController.getUserById.bind(adminController)));

/**
 * Update user role
 * PUT /api/admin/users/:userId/role
 */
router.put('/users/:userId/role', ...withAdminAuth(adminController.updateUserRole.bind(adminController)));

/**
 * Ban/unban user
 * PUT /api/admin/users/:userId/ban
 */
router.put('/users/:userId/ban', ...withAdminAuth(adminController.toggleUserBan.bind(adminController)));

/**
 * Get system statistics
 * GET /api/admin/stats
 */
router.get('/stats', ...withAdminAuth(adminController.getSystemStats.bind(adminController)));

/**
 * Get audit logs with pagination and filtering
 * GET /api/admin/audit-logs
 */
router.get('/audit-logs', ...withAdminAuth(adminController.getAuditLogs.bind(adminController)));

/**
 * Delete message
 * DELETE /api/admin/messages/:messageId
 */
router.delete('/messages/:messageId', ...withAdminAuth(adminController.deleteMessage.bind(adminController)));

export default router;