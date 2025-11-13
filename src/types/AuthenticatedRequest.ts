import { Request } from 'express';
import { IJwtPayload } from './types';

/**
 * Authenticated request interface that extends Express Request
 */
export interface IAuthenticatedRequest extends Request {
  user?: IJwtPayload;
}