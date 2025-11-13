/// <reference types="express" />

import { IJwtPayload } from './types';

/**
 * Extend the Express Request interface to include our authenticated user
 */
declare global {
  namespace Express {
    interface Request {
      user?: IJwtPayload;
    }
  }
}

export {};