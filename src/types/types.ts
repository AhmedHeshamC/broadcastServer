import { Request } from 'express';

// User related types
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export enum AuthProvider {
  EMAIL = 'email',
  GOOGLE = 'google',
  GITHUB = 'github',
}

export interface IUserBase {
  email: string;
  username: string;
  password?: string;
  role: UserRole;
  authProvider: AuthProvider;
  avatar?: string;
  isActive: boolean;
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUser extends IUserBase {
  _id: string;
}

export interface IUserCreateInput {
  email: string;
  username: string;
  password?: string;
  role?: UserRole;
  authProvider: AuthProvider;
  avatar?: string;
}

export interface IUserLoginInput {
  email: string;
  password: string;
}

// Message related types
export enum MessageType {
  MESSAGE = 'message',
  SYSTEM = 'system',
  YOUR_NAME = 'your_name',
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  TYPING = 'typing',
  STOP_TYPING = 'stop_typing',
}

export interface IMessageBase {
  content: string;
  type: MessageType;
  senderId: string;
  senderName: string;
  roomId?: string;
  timestamp: Date;
  isEdited: boolean;
  editedAt?: Date;
  deletedAt?: Date;
  metadata?: Record<string, any>;
}

export interface IMessage extends IMessageBase {
  _id: string;
}

export interface IMessageCreateInput {
  content: string;
  senderId: string;
  senderName: string;
  type?: MessageType;
  roomId?: string;
  metadata?: Record<string, any>;
}

// WebSocket message types
export interface BaseWebSocketMessage {
  type: MessageType;
  timestamp: Date;
}

export interface MessageMessage extends BaseWebSocketMessage {
  type: MessageType.MESSAGE;
  content: string;
  senderId: string;
  senderName: string;
  messageId?: string;
}

export interface SystemMessage extends BaseWebSocketMessage {
  type: MessageType.SYSTEM;
  content: string;
}

export interface YourNameMessage extends BaseWebSocketMessage {
  type: MessageType.YOUR_NAME;
  username: string;
}

export interface UserJoinedMessage extends BaseWebSocketMessage {
  type: MessageType.USER_JOINED;
  username: string;
  userId: string;
}

export interface UserLeftMessage extends BaseWebSocketMessage {
  type: MessageType.USER_LEFT;
  username: string;
  userId: string;
}

export interface TypingMessage extends BaseWebSocketMessage {
  type: MessageType.TYPING;
  username: string;
}

export interface StopTypingMessage extends BaseWebSocketMessage {
  type: MessageType.STOP_TYPING;
  username: string;
}

export type WebSocketMessage =
  | MessageMessage
  | SystemMessage
  | YourNameMessage
  | UserJoinedMessage
  | UserLeftMessage
  | TypingMessage
  | StopTypingMessage;

// Authentication and JWT types
export interface IJwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
  jti?: string; // JWT ID for unique token identification
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface IAuthenticatedRequest extends Request {
  user?: IJwtPayload;
}

// Session types
export interface IUserSession {
  userId: string;
  socketId: string;
  username: string;
  connectedAt: Date;
  lastActivity: Date;
  ipAddress: string;
  userAgent?: string;
}

// Security and audit types
export enum AuditEventType {
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  REGISTER = 'register',
  MESSAGE_SENT = 'message_sent',
  MESSAGE_DELETED = 'message_deleted',
  USER_BANNED = 'user_banned',
  USER_UNBANNED = 'user_unbanned',
  ADMIN_ACTION = 'admin_action',
}

export interface IAuditLogBase {
  userId?: string;
  eventType: AuditEventType;
  details: Record<string, any>;
  ipAddress: string;
  userAgent?: string;
  timestamp: Date;
  success: boolean;
}

export interface IAuditLog extends IAuditLogBase {
  _id: string;
}

// Rate limiting types
export interface IRateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  standardHeaders: boolean;
  legacyHeaders: boolean;
}

// API Response types
export interface IApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
}

// Validation types
export interface IValidationError {
  field: string;
  message: string;
}

export interface IValidationResult {
  isValid: boolean;
  errors: IValidationError[];
}

// Configuration types
export interface IAppConfig {
  port: number;
  mongoUri: string;
  redisUrl: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  jwtExpirationTime: string;
  jwtRefreshExpirationTime: string;
  googleClientId?: string;
  googleClientSecret?: string;
  githubClientId?: string;
  githubClientSecret?: string;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  maxMessageLength: number;
  maxConnectionsPerUser: number;
  // Additional configuration for enterprise app
  server: {
    port: number;
    host: string;
  };
  mongodb: {
    uri: string;
    options: {
      maxPoolSize: number;
      serverSelectionTimeoutMS: number;
      socketTimeoutMS: number;
    };
  };
  cors: {
    allowedOrigins: string[];
  };
  cli: {
    enabled: boolean;
    port: number;
    host: string;
    maxConnections: number;
    enableLegacyProtocol: boolean;
  };
}
