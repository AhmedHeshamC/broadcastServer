// Central type exports for the broadcast server application
// This file provides a single point of import for all TypeScript types

// Export all types from the main types file (includes all interfaces and enums)
export * from './types';

// Export Express-related types and extend global Request interface
export { Request, Response, NextFunction } from 'express';
export type { IAuthenticatedRequest } from './AuthenticatedRequest';

// Export WebSocket related types
export { WebSocket as WebSocketType } from 'ws';

// Export Node.js built-in types commonly used
export { URL } from 'url';

// Export model interfaces that are defined in models
export type { IUserDocument } from '../models/User';