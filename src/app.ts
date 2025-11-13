import express, { Application as ExpressApp, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import passport from 'passport';
import { v4 as uuidv4 } from 'uuid';

// Import our custom components
import { config } from './config';
import { logger } from './utils/logger';
import { rateLimitMiddleware } from './middleware/SecurityMiddleware';
import { authMiddleware, optionalAuth } from './middleware/AuthMiddleware';
import { oAuthService } from './services/OAuthService';
import { webSocketService } from './services/WebSocketService';
import { rateLimitService } from './services/RateLimitService';
import { IBroadcastMessage } from './services/WebSocketService';

// Import controllers
import { authController } from './controllers/AuthController';
import { messageController } from './controllers/MessageController';

// Import routes
import authRoutes from './routes/auth';
import oauthRoutes from './routes/oauth';
import adminRoutes from './routes/admin';

/**
 * Main Application Class
 * Integrates all components into a cohesive enterprise WebSocket broadcast server
 */
export class Application {
  public app: ExpressApp;
  public server: any;
  public io: SocketIOServer;
  private isShuttingDown = false;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: config.cors.allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.initializeDatabase();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeWebSocket();
    this.initializeErrorHandling();
  }

  /**
   * Initialize database connections
   */
  private async initializeDatabase(): Promise<void> {
    try {
      // Connect to MongoDB
      await mongoose.connect(config.mongodb.uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      logger.info('MongoDB connected successfully');

      // Set up database event listeners
      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error:', error);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
      });
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      process.exit(1);
    }
  }

  /**
   * Initialize Express middleware
   */
  private initializeMiddleware(): void {
    // Trust proxy for accurate IP addresses
    this.app.set('trust proxy', 1);

    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
        },
      },
      crossOriginEmbedderPolicy: false, // Needed for development
    }));

    // CORS configuration
    this.app.use(cors({
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        const allowedOrigins = config.get('corsOrigins');

        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) {
          return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn(`CORS violation: Origin ${origin} not allowed`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));

    // Compression middleware
    this.app.use(compression());

    // Request logging
    this.app.use(morgan('combined', {
      stream: {
        write: (message: string) => logger.info(message.trim())
      }
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Simple health check before security middleware
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        success: true,
        message: 'Server is healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
      });
    });

    // Custom security middleware (rate limiting, XSS protection, etc.)
    this.app.use(rateLimitMiddleware);

    // Passport initialization
    this.app.use(passport.initialize());
    logger.info('Passport initialized');

    // Initialize OAuth strategies
    oAuthService.initializeStrategies();

    // Health check endpoint (before auth middleware)
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        websocket: webSocketService.getConnectionStats()
      });
    });
  }

  /**
   * Initialize application routes
   */
  private initializeRoutes(): void {
    // API routes with authentication middleware
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/auth/oauth', oauthRoutes);
    this.app.use('/api/admin', adminRoutes);

    // Direct OAuth routes (for backward compatibility with API docs)
    this.app.get('/api/auth/google', passport.authenticate('google', {
      scope: ['profile', 'email'],
    }));

    this.app.get('/api/auth/google/callback',
      passport.authenticate('google', {
        session: false,
        failureRedirect: '/login?error=google_failed',
      }),
      async (req, res) => {
        try {
          const { ipAddress, userAgent } = req as any;
          const user = req.user as any;

          const result = await oAuthService.handleOAuthSuccess(user, ipAddress, userAgent);

          // Redirect to frontend with tokens
          const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
          const tokensParam = encodeURIComponent(JSON.stringify(result.tokens));

          res.redirect(`${redirectUrl}/auth/callback?success=true&user=${encodeURIComponent(JSON.stringify(result.user))}&tokens=${tokensParam}`);
        } catch (error) {
          console.error('Google OAuth callback error:', error);
          const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
          res.redirect(`${redirectUrl}/login?error=google_callback_failed`);
        }
      }
    );

    this.app.get('/api/auth/github', passport.authenticate('github', {
      scope: ['user:email'],
    }));

    this.app.get('/api/auth/github/callback',
      passport.authenticate('github', {
        session: false,
        failureRedirect: '/login?error=github_failed',
      }),
      async (req, res) => {
        try {
          const { ipAddress, userAgent } = req as any;
          const user = req.user as any;

          const result = await oAuthService.handleOAuthSuccess(user, ipAddress, userAgent);

          // Redirect to frontend with tokens
          const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
          const tokensParam = encodeURIComponent(JSON.stringify(result.tokens));

          res.redirect(`${redirectUrl}/auth/callback?success=true&user=${encodeURIComponent(JSON.stringify(result.user))}&tokens=${tokensParam}`);
        } catch (error) {
          console.error('GitHub OAuth callback error:', error);
          const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
          res.redirect(`${redirectUrl}/login?error=github_callback_failed`);
        }
      }
    );

    // API info endpoint
    this.app.get('/api', (req: Request, res: Response) => {
      res.status(200).json({
        name: 'Enterprise WebSocket Broadcast Server',
        version: '2.0.0',
        description: 'Real-time WebSocket server with authentication, rate limiting, and comprehensive security',
        endpoints: {
          auth: '/api/auth',
          oauth: '/api/auth/oauth',
          admin: '/api/admin',
          websocket: '/socket.io',
          health: '/health'
        },
        features: [
          'JWT Authentication with refresh tokens',
          'Real-time message broadcasting',
          'Rate limiting and DDoS protection',
          'XSS protection and input sanitization',
          'CORS and security headers',
          'Audit logging and monitoring',
          'MongoDB data persistence',
          'Scalable WebSocket connections'
        ]
      });
    });

    // Static file serving for client (if needed)
    this.app.use(express.static('public'));

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        error: 'NOT_FOUND',
        path: req.originalUrl
      });
    });
  }

  /**
   * Initialize WebSocket integration
   */
  private initializeWebSocket(): void {
    // Initialize WebSocket service with Socket.IO server
    webSocketService.initialize(this.io);

    // Set up authentication middleware for WebSocket connections
    this.io.use(async (socket, next) => {
      try {
        // Allow development mode without authentication
        if (process.env.NODE_ENV === 'development') {
          console.warn('Development mode: Skipping WebSocket authentication');
          socket.data.user = {
            id: 'dev-user',
            email: 'dev@example.com',
            name: 'Development User'
          };
          return next();
        }

        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Validate token through WebSocket service
        const user = await webSocketService.authenticateConnection(socket, token);
        if (!user) {
          return next(new Error('Invalid authentication token'));
        }

        socket.data.user = user;
        next();
      } catch (error) {
        logger.error('WebSocket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });

    // Handle WebSocket connections
    this.io.on('connection', (socket) => {
      logger.info('WebSocket client connected', {
        socketId: socket.id,
        userId: socket.data.user?.userId,
        ip: socket.handshake.address
      });

      // Handle client disconnection
      socket.on('disconnect', (reason) => {
        logger.info('WebSocket client disconnected', {
          socketId: socket.id,
          userId: socket.data.user?.userId,
          reason
        });
      });

      // Handle message events from enterprise clients
      socket.on('message', (data) => {
        try {
          const messageId = uuidv4();
          const timestamp = new Date().toISOString();

          // Log to console and file
          logger.info('Received message from enterprise client', {
            socketId: socket.id,
            userId: socket.data.user?.userId,
            messageId: messageId,
            content: data.content,
            timestamp: timestamp
          });

          // Log to message flow file
          console.log(`[${timestamp}] [APP_MESSAGE_HANDLER] MESSAGE_RECEIVED_FROM_CLIENT:`, {
            socketId: socket.id,
            userId: socket.data.user?.userId,
            messageId: messageId,
            originalData: data,
            content: data.content,
            type: data.type || 'message'
          });

          // Create broadcast message
          const broadcastMessage: IBroadcastMessage = {
            messageId: messageId,
            type: data.type || 'message',
            content: data.content,
            senderId: socket.data.user.userId,
            senderName: socket.data.user.name || socket.data.user.username || 'Enterprise User',
            timestamp: new Date()
          };

          console.log(`[${timestamp}] [APP_MESSAGE_HANDLER] BROADCAST_MESSAGE_CREATED:`, {
            messageId: broadcastMessage.messageId,
            type: broadcastMessage.type,
            content: broadcastMessage.content,
            senderId: broadcastMessage.senderId,
            senderName: broadcastMessage.senderName
          });

          // Broadcast to all connections
          webSocketService.broadcastMessage(broadcastMessage, socket.data.user.userId);

          console.log(`[${timestamp}] [APP_MESSAGE_HANDLER] BROADCAST_MESSAGE_SENT_TO_WEBSOCKET_SERVICE`);
        } catch (error) {
          logger.error('Error processing enterprise message:', error);
          console.log(`[${new Date().toISOString()}] [APP_MESSAGE_HANDLER] ERROR_PROCESSING_MESSAGE:`, error);
        }
      });

      // Handle custom events
      socket.on('join_room', (roomId: string) => {
        socket.join(roomId);
        logger.info('Client joined room', {
          socketId: socket.id,
          userId: socket.data.user?.userId,
          roomId
        });
      });

      socket.on('leave_room', (roomId: string) => {
        socket.leave(roomId);
        logger.info('Client left room', {
          socketId: socket.id,
          userId: socket.data.user?.userId,
          roomId
        });
      });
    });
  }

  /**
   * Initialize error handling
   */
  private initializeErrorHandling(): void {
    // Global error handler
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error('Unhandled application error:', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Don't leak error details in production
      const isDevelopment = process.env.NODE_ENV === 'development';

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: 'INTERNAL_ERROR',
        ...(isDevelopment && { details: error.message, stack: error.stack })
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('Unhandled Promise Rejection:', { reason, promise });
      this.gracefulShutdown('SIGTERM');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);
      this.gracefulShutdown('SIGTERM');
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
  }

  /**
   * Start the application server
   */
  public async start(port?: number): Promise<void> {
    const serverPort = port || config.server.port;

    return new Promise((resolve, reject) => {
      this.server.listen(serverPort, (error?: Error) => {
        if (error) {
          logger.error('Failed to start server:', error);
          reject(error);
        } else {
          logger.info(`🚀 Enterprise WebSocket Broadcast Server started on port ${serverPort}`);
          logger.info(`📊 Health check: http://localhost:${serverPort}/health`);
          logger.info(`🔌 WebSocket endpoint: ws://localhost:${serverPort}`);
          logger.info(`📖 API documentation: http://localhost:${serverPort}/api`);
          resolve();
        }
      });
    });
  }

  /**
   * Graceful shutdown
   */
  public async gracefulShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    // Stop accepting new connections
    this.server.close(async () => {
      logger.info('HTTP server closed');

      try {
        // Close all WebSocket connections
        await webSocketService.shutdown();
        logger.info('WebSocket service shut down');

        // Close database connections
        await mongoose.connection.close();
        logger.info('Database connections closed');

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    });

    // Force shutdown after timeout
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 30000); // 30 seconds timeout
  }

  /**
   * Get application statistics
   */
  public getStats(): any {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: {
        state: mongoose.connection.readyState,
        name: mongoose.connection.name
      },
      websocket: webSocketService.getConnectionStats(),
      rateLimit: rateLimitService.getStats()
    };
  }
}

// Create and export application instance
export const app = new Application();