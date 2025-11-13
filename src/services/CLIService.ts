import WebSocket, { WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { webSocketService } from './WebSocketService';
import { logger } from '../utils/logger';
import { config } from '../config';

/**
 * CLI Service for managing CLI WebSocket server and client operations
 * SOLID: Single Responsibility - only handles CLI-specific operations
 * KISS: Simple, direct implementation without complex abstractions
 */
export class CLIService {
  private wsServer: WebSocketServer | null = null;
  private isRunning = false;
  private readonly port: number;
  private readonly host: string;

  constructor() {
    this.port = config.cli.port;
    this.host = config.cli.host;
  }

  /**
   * Start CLI WebSocket server
   */
  public startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isRunning) {
        reject(new Error('CLI server is already running'));
        return;
      }

      try {
        this.wsServer = new WebSocketServer({
          port: this.port,
          host: this.host,
          verifyClient: this.verifyClient.bind(this)
        });

        this.wsServer.on('connection', this.handleConnection.bind(this));
        this.wsServer.on('error', this.handleServerError.bind(this));
        this.wsServer.on('listening', () => {
          this.isRunning = true;
          logger.info(`CLI WebSocket server started on ws://${this.host}:${this.port}`);
          resolve();
        });

      } catch (error) {
        logger.error('Failed to start CLI WebSocket server:', error);
        reject(error);
      }
    });
  }

  /**
   * Stop CLI WebSocket server
   */
  public async stopServer(): Promise<void> {
    if (!this.isRunning || !this.wsServer) {
      return;
    }

    return new Promise((resolve) => {
      this.wsServer!.close((error) => {
        if (error) {
          logger.error('Error stopping CLI WebSocket server:', error);
        } else {
          logger.info('CLI WebSocket server stopped');
        }
        this.isRunning = false;
        this.wsServer = null;
        resolve();
      });
    });
  }

  /**
   * Start CLI client connection to a server
   */
  public static async startClient(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `ws://${host}:${port}`;
      logger.info(`Connecting CLI client to ${wsUrl}...`);

      const ws = new WebSocket(wsUrl);
      let isConnected = false;

      const timeout = setTimeout(() => {
        if (!isConnected) {
          ws.terminate();
          reject(new Error('Connection timeout'));
        }
      }, 10000);

      ws.on('open', () => {
        isConnected = true;
        clearTimeout(timeout);
        logger.info(`CLI client connected to ${wsUrl}`);

        // Start CLI interface
        const cliInterface = new CLIInterface(ws);
        cliInterface.start().catch(reject);
        resolve();
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        if (!isConnected) {
          logger.error('CLI client connection failed:', error);
          reject(error);
        }
      });

      ws.on('close', () => {
        if (isConnected) {
          logger.info('CLI client disconnected');
        }
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Get CLI server status
   */
  public getStatus(): { isRunning: boolean; port: number; host: string } {
    return {
      isRunning: this.isRunning,
      port: this.port,
      host: this.host
    };
  }

  /**
   * Get CLI connection statistics
   */
  public getStats() {
    return webSocketService.getCLIStats();
  }

  /**
   * Verify incoming client connections (basic rate limiting)
   */
  private verifyClient(info: { origin: string; secure: boolean; req: IncomingMessage }): boolean {
    const clientIP = info.req.socket.remoteAddress;

    // Basic IP-based rate limiting
    if (clientIP && this.isRateLimited(clientIP)) {
      logger.warn(`Connection rate limited for IP: ${clientIP}`);
      return false;
    }

    return true;
  }

  /**
   * Handle new WebSocket connections
   */
  private async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    const clientIP = req.socket.remoteAddress || 'unknown';
    logger.info(`New CLI connection from ${clientIP}`);

    try {
      // Add connection using enhanced WebSocket service
      const result = await webSocketService.addCLIConnection(ws, clientIP);

      if (!result.success) {
        logger.warn(`Failed to add CLI connection: ${result.error}`);
        ws.close(1008, result.error);
        return;
      }

      logger.info(`CLI connection established: ${result.clientId}`);
    } catch (error) {
      logger.error('Error handling CLI connection:', error);
      ws.close(1011, 'Internal server error');
    }
  }

  /**
   * Handle WebSocket server errors
   */
  private handleServerError(error: Error): void {
    logger.error('CLI WebSocket server error:', error);
    this.isRunning = false;
  }

  /**
   * Basic rate limiting check
   */
  private isRateLimited(clientIP: string): boolean {
    // Simple rate limiting - can be enhanced
    const connectionCount = this.getStats().activeConnections;
    const maxConnections = 100; // Can be configurable

    return connectionCount >= maxConnections;
  }
}

/**
 * CLI Interface for interactive client communication
 * Handles readline interface and message formatting
 */
class CLIInterface {
  private ws: WebSocket;
  private userName: string | null = null;
  private readlineInterface: any;

  constructor(ws: WebSocket) {
    this.ws = ws;
  }

  public async start(): Promise<void> {
    // Dynamic import for readline to avoid CommonJS/ESM issues
    const readline = await import('readline');
    const { createInterface } = readline;

    this.readlineInterface = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    });

    this.setupEventHandlers();
    this.readlineInterface.prompt();
  }

  private setupEventHandlers(): void {
    this.ws.on('message', (data: Buffer) => {
      this.handleMessage(data.toString());
    });

    this.ws.on('close', () => {
      console.log('\nConnection closed. Press Ctrl+C to exit.');
      if (this.readlineInterface) {
        this.readlineInterface.close();
      }
    });

    this.ws.on('error', (error: Error) => {
      console.error('\nConnection error:', error.message);
      if (this.readlineInterface) {
        this.readlineInterface.close();
      }
      process.exit(1);
    });

    this.readlineInterface.on('line', (line: string) => {
      this.sendMessage(line.trim());
      this.readlineInterface.prompt();
    });

    this.readlineInterface.on('SIGINT', () => {
      console.log('\nGoodbye!');
      this.ws.close();
      this.readlineInterface.close();
      process.exit(0);
    });
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Clear current line for clean output
      if (process.stdout.isTTY) {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
      }

      switch (message.type) {
        case 'your_name':
          this.userName = message.payload;
          console.log(`\n👋 Connected as: ${this.userName}`);
          this.readlineInterface.setPrompt(`${this.userName}> `);
          break;

        case 'message':
          console.log(`\n💬 [${message.sender || 'Unknown'}]: ${message.content}`);
          break;

        case 'system':
          console.log(`\n📢 ${message.payload}`);
          break;

        default:
          console.log(`\n${data}`);
      }

      this.readlineInterface.prompt();
    } catch (error) {
      console.error('\nError parsing message:', error);
      console.log('Raw message:', data);
      this.readlineInterface.prompt();
    }
  }

  private sendMessage(content: string): void {
    if (!content.trim() || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      type: 'message',
      content: content.trim()
    };

    this.ws.send(JSON.stringify(message));
  }
}