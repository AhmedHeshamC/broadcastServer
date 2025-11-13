import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { User, IUserDocument } from '../models';
import { jwtService } from './JwtService';
import { rateLimitService } from './RateLimitService';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import { IJwtPayload, IUser } from '../types/types';
import { LegacyProtocolAdapter, ILegacyMessage } from '../adapters/LegacyProtocolAdapter';

export interface IConnection {
  clientId: string;
  userId: string;
  username: string;
  email: string;
  role: string;
  socket: WebSocket;
  connectedAt: Date;
  lastActivity: Date;
  ipAddress: string;
  userAgent?: string;
}

export interface ICLIConnection {
  clientId: string;
  userName: string;
  socket: WebSocket;
  connectedAt: Date;
  lastActivity: Date;
  ipAddress: string;
  connectionType: 'CLI';
}

export interface IConnectionResult {
  success: boolean;
  clientId?: string;
  error?: string;
}

export interface IMessageStats {
  messagesSent: number;
  messagesReceived: number;
  connectionsOpened: number;
  connectionsClosed: number;
}

export interface IConnectionStats {
  totalConnections: number;
  activeConnections: number;
  uniqueUsers: number;
  connectionsByRole: Record<string, number>;
}

export interface IBroadcastMessage {
  type: 'message' | 'system' | 'user_joined' | 'user_left' | 'typing' | 'stop_typing';
  content: string;
  senderId: string;
  senderName: string;
  timestamp: Date;
  messageId?: string;
  metadata?: Record<string, any>;
  source?: 'enterprise' | 'cli' | 'system'; // Track message origin
  originalSource?: string; // Track original source for cross-protocol messages
  hopCount?: number; // Prevent infinite loops
}

/**
 * Message deduplication utility to prevent duplicate message processing
 */
class MessageDeduplicator {
  private recentMessageIds = new Set<string>();
  private readonly cleanupInterval = 60000; // 1 minute

  shouldProcess(message: IBroadcastMessage): boolean {
    if (!message.messageId) {
      return true; // Process messages without ID
    }

    if (this.recentMessageIds.has(message.messageId)) {
      return false; // Skip duplicate
    }

    this.recentMessageIds.add(message.messageId);

    // Cleanup old message IDs
    setTimeout(() => {
      this.recentMessageIds.delete(message.messageId!);
    }, this.cleanupInterval);

    return true;
  }

  clear(): void {
    this.recentMessageIds.clear();
  }
}

/**
 * Message flow control to prevent cross-protocol echoing
 */
enum MessageFlowDirection {
  ENTERPRISE_TO_CLI = 'enterprise_to_cli',
  CLI_TO_ENTERPRISE = 'cli_to_enterprise',
  BIDIRECTIONAL = 'bidirectional',
  DISABLED = 'disabled'
}

class MessageBridge {
  private flowDirection: MessageFlowDirection = MessageFlowDirection.ENTERPRISE_TO_CLI;
  private readonly maxHopCount: number = 3;

  shouldBridge(message: IBroadcastMessage, fromSource: string, toTarget: string): boolean {
    // Check hop count limit
    if ((message.hopCount || 0) >= this.maxHopCount) {
      return false;
    }

    // Only allow enterprise → CLI flow (prevent CLI → enterprise echo)
    if (fromSource === 'enterprise' && toTarget === 'cli') {
      return true;
    }

    // Allow CLI → enterprise only for original CLI messages
    if (fromSource === 'cli' && toTarget === 'enterprise' && message.source === 'cli') {
      return true;
    }

    // System messages can flow both ways
    if (message.type === 'system' || message.type === 'user_joined' || message.type === 'user_left') {
      return true;
    }

    return false;
  }
}

export class WebSocketService {
  private static instance: WebSocketService;
  private connections = new Map<string, IConnection>();
  private userConnections = new Map<string, Set<string>>(); // userId -> Set of clientIds
  private cliConnections = new Map<string, ICLIConnection>(); // CLI-specific connections
  private messageLogFile = path.join(process.cwd(), 'message-flow.log');
  private messageStats: IMessageStats = {
    messagesSent: 0,
    messagesReceived: 0,
    connectionsOpened: 0,
    connectionsClosed: 0
  };
  private readonly maxConnectionsPerUser = 5;
  private readonly maxMessageSize = 10000; // 10KB
  private readonly rateLimitWindow = 60000; // 1 minute
  private readonly maxMessagesPerWindow = 30; // 30 messages per minute
  private readonly maxCLIConnections = 100; // Maximum CLI connections
  private legacyAdapter = new LegacyProtocolAdapter();
  private messageDeduplicator = new MessageDeduplicator();
  private messageBridge = new MessageBridge();

  private constructor() {
    // Initialize message log file
    this.initializeMessageLog();
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Initialize message flow logging
   */
  private initializeMessageLog(): void {
    try {
      const timestamp = new Date().toISOString();
      const header = `\n\n=== MESSAGE FLOW LOG STARTED AT ${timestamp} ===\n`;
      fs.appendFileSync(this.messageLogFile, header);
    } catch (error) {
      logger.error('Failed to initialize message log file:', error);
    }
  }

  /**
   * Log message flow to file for debugging
   */
  private logMessageFlow(event: string, data: any, source: string = 'server'): void {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] [${source.toUpperCase()}] ${event}: ${JSON.stringify(data)}\n`;
      fs.appendFileSync(this.messageLogFile, logEntry);
    } catch (error) {
      logger.error('Failed to write to message log file:', error);
    }
  }

  /**
   * Add a new WebSocket connection after authentication
   */
  public async addConnection(
    socket: WebSocket,
    user: Partial<IUser>,
    token: string,
    ipAddress: string,
    userAgent?: string
  ): Promise<IConnectionResult> {
    try {
      // Validate token
      let payload: IJwtPayload;
      try {
        payload = jwtService.verifyAccessToken(token);
      } catch (error) {
        return {
          success: false,
          error: 'Invalid authentication token'
        };
      }

      // Verify user matches token
      if (payload.userId !== (user._id as any).toString()) {
        return {
          success: false,
          error: 'User authentication mismatch'
        };
      }

      // Check if user is active
      const userRecord = await User.findById(user._id);
      if (!userRecord || !(userRecord as any).isActive) {
        return {
          success: false,
          error: 'User account is inactive or not found'
        };
      }

      // Check connection limits per user
      const userConnectionCount = this.userConnections.get(user._id!)?.size || 0;
      if (userConnectionCount >= this.maxConnectionsPerUser) {
        return {
          success: false,
          error: `Maximum ${this.maxConnectionsPerUser} connections per user allowed`
        };
      }

      // Generate unique client ID
      const clientId = uuidv4();

      // Create connection object
      const connection: IConnection = {
        clientId,
        userId: user._id!,
        username: user.username!,
        email: user.email!,
        role: user.role!,
        socket,
        connectedAt: new Date(),
        lastActivity: new Date(),
        ipAddress,
        userAgent
      };

      // Store connection
      this.connections.set(clientId, connection);

      // Track user connections
      if (!this.userConnections.has(user._id!)) {
        this.userConnections.set(user._id!, new Set());
      }
      this.userConnections.get(user._id!)!.add(clientId);

      // Update stats
      this.messageStats.connectionsOpened++;

      // Set up socket event handlers
      this.setupSocketHandlers(connection);

      logger.info(`WebSocket connection established: ${clientId} for user ${user.username} (${user.email})`);

      return {
        success: true,
        clientId
      };
    } catch (error) {
      logger.error('Error adding WebSocket connection:', error);
      return {
        success: false,
        error: 'Failed to establish connection'
      };
    }
  }

  /**
   * Remove a WebSocket connection
   */
  public removeConnection(clientId: string): void {
    const connection = this.connections.get(clientId);
    if (!connection) {
      return;
    }

    // Remove from user connections
    const userClientIds = this.userConnections.get(connection.userId);
    if (userClientIds) {
      userClientIds.delete(clientId);
      if (userClientIds.size === 0) {
        this.userConnections.delete(connection.userId);
      }
    }

    // Remove from main connections
    this.connections.delete(clientId);

    // Update stats
    this.messageStats.connectionsClosed++;

    // Close socket if still open
    if (connection.socket.readyState === WebSocket.OPEN) {
      connection.socket.close();
    }

    logger.info(`WebSocket connection removed: ${clientId} for user ${connection.username}`);
  }

  /**
   * Broadcast message to all connected clients
   */
  public broadcastMessage(message: IBroadcastMessage, excludeUserId?: string): void {
    try {
      // Log incoming message
      this.logMessageFlow('BROADCAST_MESSAGE_RECEIVED', {
        message: message,
        excludeUserId: excludeUserId,
        totalConnections: this.connections.size,
        totalCLIConnections: this.cliConnections.size
      }, 'broadcast-service');

      // Check for duplicates
      if (!this.messageDeduplicator.shouldProcess(message)) {
        this.logMessageFlow('DUPLICATE_MESSAGE_SKIPPED', {
          messageId: message.messageId,
          content: message.content
        }, 'broadcast-service');
        return;
      }

      // Validate message
      if (!this.validateMessage(message)) {
        logger.warn('Invalid message format, skipping broadcast');
        this.logMessageFlow('BROADCAST_MESSAGE_VALIDATION_FAILED', message, 'broadcast-service');
        return;
      }

      // Add timestamp if not present
      if (!message.timestamp) {
        message.timestamp = new Date();
      }

      // Add message ID if not present
      if (!message.messageId) {
        message.messageId = uuidv4();
      }

      // Set source if not already set (default to enterprise for Socket.IO messages)
      if (!message.source) {
        message.source = 'enterprise';
      }

      // Increment hop count
      message.hopCount = (message.hopCount || 0) + 1;

      // Prevent infinite loops
      if (message.hopCount > 3) {
        this.logMessageFlow('MESSAGE_HOP_LIMIT_EXCEEDED', {
          messageId: message.messageId,
          hopCount: message.hopCount,
          content: message.content
        }, 'broadcast-service');
        return;
      }

      this.logMessageFlow('BROADCAST_MESSAGE_START', {
        messageId: message.messageId,
        type: message.type,
        content: message.content,
        senderId: message.senderId,
        senderName: message.senderName,
        source: message.source,
        hopCount: message.hopCount
      }, 'broadcast-service');

      // Route based on source and flow rules
      let sentCount = 0;

      // Route to enterprise connections
      if (this.messageBridge.shouldBridge(message, message.source!, 'enterprise')) {
        this.logMessageFlow('ROUTING_TO_ENTERPRISE', {
          messageId: message.messageId,
          source: message.source,
          hopCount: message.hopCount
        }, 'broadcast-service');
        sentCount += this.broadcastToEnterpriseConnections(message, excludeUserId);
      } else {
        this.logMessageFlow('SKIPPING_ENTERPRISE_ROUTE', {
          messageId: message.messageId,
          source: message.source,
          reason: 'Bridge rules blocked routing'
        }, 'broadcast-service');
      }

      // Route to CLI connections
      if (this.messageBridge.shouldBridge(message, message.source!, 'cli')) {
        this.logMessageFlow('ROUTING_TO_CLI', {
          messageId: message.messageId,
          source: message.source,
          hopCount: message.hopCount
        }, 'broadcast-service');
        sentCount += this.sendToCLIConnections(message);
      } else {
        this.logMessageFlow('SKIPPING_CLI_ROUTE', {
          messageId: message.messageId,
          source: message.source,
          reason: 'Bridge rules blocked routing'
        }, 'broadcast-service');
      }

      this.messageStats.messagesSent += sentCount;
      logger.info(`Message broadcasted to ${sentCount} clients: ${message.type} - ${message.content.substring(0, 50)}`);
    } catch (error) {
      logger.error('Error broadcasting message:', error);
    }
  }

  /**
   * Send system message to all clients
   */
  public broadcastSystemMessage(content: string, metadata?: Record<string, any>): void {
    const systemMessage: IBroadcastMessage = {
      type: 'system',
      content,
      senderId: 'system',
      senderName: 'System',
      timestamp: new Date(),
      messageId: uuidv4(),
      metadata
    };

    this.broadcastMessage(systemMessage);
  }

  /**
   * Send user join notification
   */
  public broadcastUserJoin(username: string, userId: string): void {
    const joinMessage: IBroadcastMessage = {
      type: 'user_joined',
      content: `${username} joined the chat`,
      senderId: 'system',
      senderName: 'System',
      timestamp: new Date(),
      messageId: uuidv4(),
      metadata: { userId, username }
    };

    this.broadcastMessage(joinMessage);
  }

  /**
   * Send user leave notification
   */
  public broadcastUserLeave(username: string, userId: string): void {
    const leaveMessage: IBroadcastMessage = {
      type: 'user_left',
      content: `${username} left the chat`,
      senderId: 'system',
      senderName: 'System',
      timestamp: new Date(),
      messageId: uuidv4(),
      metadata: { userId, username }
    };

    this.broadcastMessage(leaveMessage);
  }

  /**
   * Get total number of active connections
   */
  public getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get all connected users
   */
  public getConnectedUsers(): Array<{ userId: string; username: string; role: string }> {
    const uniqueUsers = new Map<string, { username: string; role: string }>();

    for (const connection of this.connections.values()) {
      if (!uniqueUsers.has(connection.userId)) {
        uniqueUsers.set(connection.userId, {
          username: connection.username,
          role: connection.role
        });
      }
    }

    return Array.from(uniqueUsers.entries()).map(([userId, { username, role }]) => ({
      userId,
      username,
      role
    }));
  }

  /**
   * Get connections for specific user
   */
  public getUserConnections(userId: string): IConnection[] {
    const clientIds = this.userConnections.get(userId);
    if (!clientIds) {
      return [];
    }

    const connections: IConnection[] = [];
    for (const clientId of clientIds) {
      const connection = this.connections.get(clientId);
      if (connection) {
        connections.push(connection);
      }
    }

    return connections;
  }

  /**
   * Get connection statistics
   */
  public getConnectionStats(): IConnectionStats {
    const connectionsByRole: Record<string, number> = {};

    for (const connection of this.connections.values()) {
      connectionsByRole[connection.role] = (connectionsByRole[connection.role] || 0) + 1;
    }

    return {
      totalConnections: this.messageStats.connectionsOpened,
      activeConnections: this.connections.size,
      uniqueUsers: this.userConnections.size,
      connectionsByRole
    };
  }

  /**
   * Get message statistics
   */
  public getMessageStats(): IMessageStats {
    return { ...this.messageStats };
  }

  /**
   * Clear all connections (for testing or shutdown)
   */
  public clearAllConnections(): void {
    for (const clientId of Array.from(this.connections.keys())) {
      this.removeConnection(clientId);
    }
  }

  /**
   * Setup WebSocket event handlers for a connection
   */
  private setupSocketHandlers(connection: IConnection): void {
    const socket = connection.socket;

    // Handle incoming messages
    socket.on('message', (data: WebSocket.Data) => {
      try {
        this.handleIncomingMessage(connection, data.toString());
      } catch (error) {
        logger.error(`Error handling message from ${connection.clientId}:`, error);
      }
    });

    // Handle connection close
    socket.on('close', () => {
      logger.info(`WebSocket connection closed: ${connection.clientId}`);
      this.removeConnection(connection.clientId);
      this.broadcastUserLeave(connection.username, connection.userId);
    });

    // Handle connection errors
    socket.on('error', (error) => {
      logger.error(`WebSocket connection error for ${connection.clientId}:`, error);
      this.removeConnection(connection.clientId);
    });
  }

  /**
   * Handle incoming messages from clients
   */
  private handleIncomingMessage(connection: IConnection, messageString: string): void {
    try {
      // Rate limiting check
      const rateLimitResult = rateLimitService.checkMessageRate(
        connection.userId,
        connection.ipAddress
      );

      if (!rateLimitResult.allowed) {
        logger.warn(`Message rate limit exceeded for user ${connection.userId}`);
        return;
      }

      // Parse message
      let message: IBroadcastMessage;
      try {
        message = JSON.parse(messageString);
      } catch (error) {
        logger.warn(`Invalid JSON message from ${connection.clientId}: ${messageString}`);
        return;
      }

      // Validate message structure
      if (!this.validateMessage(message)) {
        logger.warn(`Invalid message structure from ${connection.clientId}`);
        return;
      }

      // Set sender info
      message.senderId = connection.userId;
      message.senderName = connection.username;
      message.timestamp = new Date();

      // Sanitize content
      if (message.content) {
        message.content = this.sanitizeContent(message.content);
      }

      // Update activity and stats
      connection.lastActivity = new Date();
      this.messageStats.messagesReceived++;

      // Broadcast message to all other clients
      this.broadcastMessage(message, connection.userId);
    } catch (error) {
      logger.error(`Error handling incoming message from ${connection.clientId}:`, error);
    }
  }

  /**
   * Validate message structure and content
   */
  private validateMessage(message: any): boolean {
    if (!message || typeof message !== 'object') {
      return false;
    }

    if (!message.type || typeof message.type !== 'string') {
      return false;
    }

    const validTypes = ['message', 'system', 'user_joined', 'user_left', 'typing', 'stop_typing'];
    if (!validTypes.includes(message.type)) {
      return false;
    }

    if (!message.content || typeof message.content !== 'string') {
      return false;
    }

    // Check message size
    if (message.content.length > this.maxMessageSize) {
      return false;
    }

    return true;
  }

  /**
   * Sanitize message content to prevent XSS and other attacks
   */
  private sanitizeContent(content: string): string {
    return content
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .trim();
  }

  /**
   * Initialize WebSocket service with Socket.IO server (for compatibility)
   */
  public initialize(io: any): void {
    logger.info('WebSocket service initialized with Socket.IO server');
    // Store the Socket.IO instance for future use if needed
    (this as any).io = io;
  }

  /**
   * Authenticate WebSocket connection (for compatibility with app.ts)
   */
  public async authenticateConnection(socket: any, token: string): Promise<any> {
    try {
      const payload = jwtService.verifyAccessToken(token);

      // Get user from database
      const user = await User.findById(payload.userId);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      return user;
    } catch (error) {
      logger.error('WebSocket authentication failed:', error);
      return null;
    }
  }

  /**
   * Add a CLI WebSocket connection (simplified authentication)
   */
  public async addCLIConnection(
    socket: WebSocket,
    ipAddress: string
  ): Promise<IConnectionResult> {
    try {
      // Check CLI connection limit
      if (this.cliConnections.size >= this.maxCLIConnections) {
        return {
          success: false,
          error: `Maximum ${this.maxCLIConnections} CLI connections allowed`
        };
      }

      // Generate unique client ID and username
      const clientId = uuidv4();
      const userName = `User${Math.floor(Math.random() * 10000)}`;

      // Create CLI connection object
      const connection: ICLIConnection = {
        clientId,
        userName,
        socket,
        connectedAt: new Date(),
        lastActivity: new Date(),
        ipAddress,
        connectionType: 'CLI'
      };

      // Store connection
      this.cliConnections.set(clientId, connection);

      // Update stats
      this.messageStats.connectionsOpened++;

      // Set up CLI-specific socket handlers
      this.setupCLISocketHandlers(connection);

      // Send welcome message to CLI client
      this.sendCLIWelcomeMessage(connection);

      // Broadcast join notification to all clients (both enterprise and CLI)
      this.broadcastUserJoin(userName, 'cli-user');

      logger.info(`CLI connection established: ${clientId} as ${userName} from ${ipAddress}`);

      return {
        success: true,
        clientId
      };
    } catch (error) {
      logger.error('Error adding CLI connection:', error);
      return {
        success: false,
        error: 'Failed to establish CLI connection'
      };
    }
  }

  /**
   * Remove a CLI connection
   */
  public removeCLIConnection(clientId: string): void {
    const connection = this.cliConnections.get(clientId);
    if (!connection) {
      return;
    }

    // Broadcast leave notification
    this.broadcastUserLeave(connection.userName, 'cli-user');

    // Remove from CLI connections
    this.cliConnections.delete(clientId);

    // Update stats
    this.messageStats.connectionsClosed++;

    // Close socket if still open
    if (connection.socket.readyState === WebSocket.OPEN) {
      connection.socket.close();
    }

    logger.info(`CLI connection removed: ${clientId} (${connection.userName})`);
  }

  /**
   * Send message to all CLI connections
   */
  public sendToCLIConnections(message: IBroadcastMessage): number {
    let sentCount = 0;

    try {
      const messageString = JSON.stringify(message);

      for (const connection of this.cliConnections.values()) {
        if (connection.socket.readyState === WebSocket.OPEN) {
          try {
            connection.socket.send(messageString);
            sentCount++;
            connection.lastActivity = new Date();
          } catch (error) {
            logger.error(`Error sending message to CLI client ${connection.clientId}:`, error);
            this.removeCLIConnection(connection.clientId);
          }
        }
      }

      this.messageStats.messagesSent += sentCount;
    } catch (error) {
      logger.error('Error sending message to CLI connections:', error);
    }

    return sentCount;
  }

  /**
   * Handle CLI-specific message processing
   */
  public handleCLIMessage(clientId: string, data: Buffer): void {
    const connection = this.cliConnections.get(clientId);
    if (!connection) {
      logger.warn(`CLI message from unknown connection: ${clientId}`);
      return;
    }

    try {
      const messageData = data.toString('utf8');
      const legacyMessage = JSON.parse(messageData);

      // Validate legacy message format
      if (!this.legacyAdapter.validateLegacyMessage(legacyMessage)) {
        logger.warn(`Invalid legacy message format from CLI client ${clientId}:`, legacyMessage);
        return;
      }

      // Convert to enterprise format
      const enterpriseMessage = this.legacyAdapter.convertToEnterpriseMessage(
        legacyMessage,
        `cli-${clientId}`
      );

      // Set the correct sender name and source
      enterpriseMessage.senderName = connection.userName;
      enterpriseMessage.source = 'cli'; // Mark as CLI-generated message

      // Update stats
      this.messageStats.messagesReceived++;
      connection.lastActivity = new Date();

      // Broadcast to all clients (both enterprise and CLI) - this will route based on bridge rules
      this.broadcastMessage(enterpriseMessage);

      logger.debug(`CLI message processed from ${connection.userName}: ${legacyMessage.type}`);
    } catch (error) {
      logger.error(`Error processing CLI message from ${clientId}:`, error);
    }
  }

  /**
   * Get CLI connection statistics
   */
  public getCLIStats(): { activeConnections: number; totalConnections: number } {
    return {
      activeConnections: this.cliConnections.size,
      totalConnections: this.messageStats.connectionsOpened
    };
  }

  /**
   * Setup CLI-specific socket event handlers
   */
  private setupCLISocketHandlers(connection: ICLIConnection): void {
    connection.socket.on('message', (data: Buffer) => {
      this.handleCLIMessage(connection.clientId, data);
    });

    connection.socket.on('close', () => {
      this.removeCLIConnection(connection.clientId);
    });

    connection.socket.on('error', (error: Error) => {
      logger.error(`CLI socket error for ${connection.clientId}:`, error);
      this.removeCLIConnection(connection.clientId);
    });

    // Send periodic ping to keep connection alive
    const pingInterval = setInterval(() => {
      if (connection.socket.readyState === WebSocket.OPEN) {
        connection.socket.ping();
      } else {
        clearInterval(pingInterval);
        this.removeCLIConnection(connection.clientId);
      }
    }, 30000); // 30 seconds
  }

  /**
   * Send welcome message to CLI client
   */
  private sendCLIWelcomeMessage(connection: ICLIConnection): void {
    try {
      const welcomeMessage = this.legacyAdapter.createWelcomeMessage(connection.userName);
      const messageString = JSON.stringify(welcomeMessage);

      if (connection.socket.readyState === WebSocket.OPEN) {
        connection.socket.send(messageString);
      }
    } catch (error) {
      logger.error(`Error sending welcome message to CLI client ${connection.clientId}:`, error);
    }
  }

  /**
   * Enhanced broadcast to include CLI connections
   */
  private broadcastToAllConnections(message: IBroadcastMessage, excludeUserId?: string): number {
    let sentCount = 0;
    const messageId = message.messageId || 'unknown';

    logger.debug(`[DEBUG] Starting broadcast for message ${messageId}: ${JSON.stringify(message)}`);

    // Send to enterprise connections
    logger.debug(`[DEBUG] Broadcasting to enterprise connections...`);
    const enterpriseCount = this.broadcastToEnterpriseConnections(message, excludeUserId);
    sentCount += enterpriseCount;
    logger.debug(`[DEBUG] Enterprise broadcast sent to ${enterpriseCount} clients`);

    // Send to CLI connections (convert to legacy format)
    logger.debug(`[DEBUG] Broadcasting to CLI connections...`);
    const legacyMessage = this.legacyAdapter.convertToLegacyMessage(message);
    try {
      const messageString = JSON.stringify(legacyMessage);

      for (const connection of this.cliConnections.values()) {
        if (connection.socket.readyState === WebSocket.OPEN) {
          try {
            connection.socket.send(messageString);
            sentCount++;
            connection.lastActivity = new Date();
            logger.debug(`[DEBUG] Sent to CLI client ${connection.clientId}`);
          } catch (error) {
            logger.error(`Error sending message to CLI client ${connection.clientId}:`, error);
            this.removeCLIConnection(connection.clientId);
          }
        }
      }
    } catch (error) {
      logger.error('Error sending legacy message to CLI connections:', error);
    }

    logger.debug(`[DEBUG] Total broadcast sent to ${sentCount} clients for message ${messageId}`);
    return sentCount;
  }

  /**
   * Broadcast to enterprise connections only
   */
  private broadcastToEnterpriseConnections(message: IBroadcastMessage, excludeUserId?: string): number {
    let sentCount = 0;

    try {
      this.logMessageFlow('ENTERPRISE_BROADCAST_START', {
        messageId: message.messageId,
        totalConnections: this.connections.size,
        excludeUserId: excludeUserId
      }, 'enterprise-broadcast');

      logger.debug(`[DEBUG] Enterprise connections available: ${this.connections.size}`);
      for (const connection of this.connections.values()) {
        if (excludeUserId && connection.userId === excludeUserId) {
          logger.debug(`[DEBUG] Excluding user ${excludeUserId} (connection ${connection.clientId})`);
          this.logMessageFlow('ENTERPRISE_EXCLUDED_USER', {
            connectionId: connection.clientId,
            userId: connection.userId,
            excludeUserId: excludeUserId
          }, 'enterprise-broadcast');
          continue;
        }

        // For Socket.IO connections, use emit instead of send
        if (connection.socket && connection.socket.emit) {
          try {
            // Emit message event with the message data
            this.logMessageFlow('ENTERPRISE_EMIT_BROADCAST', {
              connectionId: connection.clientId,
              userId: connection.userId,
              messageId: message.messageId,
              eventType: 'broadcast',
              messageContent: message.content
            }, 'enterprise-broadcast');

            connection.socket.emit('broadcast', message);
            sentCount++;
            connection.lastActivity = new Date();
            logger.debug(`[DEBUG] Sent broadcast to enterprise client ${connection.clientId}`);
          } catch (error) {
            logger.error(`Error sending message to ${connection.clientId}:`, error);
            this.removeConnection(connection.clientId);
          }
        } else {
          logger.debug(`[DEBUG] Connection ${connection.clientId} has no socket.emit method`);
        }
      }
    } catch (error) {
      logger.error('Error sending message to enterprise connections:', error);
    }

    logger.debug(`[DEBUG] Enterprise broadcast completed. Sent to ${sentCount} clients`);
    return sentCount;
  }

  /**
   * Graceful shutdown of WebSocket service
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down WebSocket service...');

    // Close all enterprise connections
    for (const [clientId, connection] of this.connections) {
      try {
        if (connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.close(1001, 'Server shutdown');
        }
      } catch (error) {
        logger.error(`Error closing connection ${clientId}:`, error);
      }
    }

    // Close all CLI connections
    for (const [clientId, connection] of this.cliConnections) {
      try {
        if (connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.close(1001, 'Server shutdown');
        }
      } catch (error) {
        logger.error(`Error closing CLI connection ${clientId}:`, error);
      }
    }

    // Clear all connections
    this.connections.clear();
    this.userConnections.clear();
    this.cliConnections.clear();

    logger.info('WebSocket service shutdown completed');
  }
}

export const webSocketService = WebSocketService.getInstance();