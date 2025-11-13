// Import WebSocket value and type separately
const WebSocket = require('ws');
import type { WebSocket as WsType } from 'ws'; // Use alias for type import
const readline = require('readline');
import type * as Readline from 'readline'; // Import readline types

// Enhanced client options interface
interface ClientOptions {
  host: string;
  port: number;
  enterpriseMode?: boolean;
  token?: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

// Message formats for different protocols
interface LegacyMessage {
  type: 'your_name' | 'message' | 'system';
  payload?: string;
  content?: string;
  sender?: string;
}

interface EnterpriseMessage {
  type: 'message' | 'system' | 'user_joined' | 'user_left' | 'typing' | 'stop_typing';
  content: string;
  senderId: string;
  senderName: string;
  timestamp: string | Date;
  messageId?: string;
  metadata?: Record<string, any>;
}

type Message = LegacyMessage | EnterpriseMessage;

// Enhanced CLI client with enterprise integration
class EnhancedCLIClient {
  private ws: WsType;
  private options: ClientOptions;
  private myName: string | null = null;
  private rl: Readline.Interface | null = null;
  private reconnectAttempts = 0;
  private isConnected = false;

  constructor(options: ClientOptions) {
    this.options = {
      enterpriseMode: false,
      reconnectAttempts: 3,
      reconnectDelay: 2000,
      ...options
    };

    const url = `ws://${this.options.host}:${this.options.port}`;
    this.ws = new WebSocket(url);
  }

  public async start(): Promise<void> {
    this.setupEventHandlers();
    await this.waitForConnection();
  }

  private setupEventHandlers(): void {
    this.ws.on('open', () => {
      this.handleConnection();
    });

    this.ws.on('message', (data: Buffer) => {
      this.handleMessage(data);
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.handleDisconnection(code, reason);
    });

    this.ws.on('error', (err: Error) => {
      this.handleError(err);
    });
  }

  private async waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.ws.once('open', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.ws.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private handleConnection(): void {
    this.isConnected = true;
    this.reconnectAttempts = 0;

    const url = `ws://${this.options.host}:${this.options.port}`;
    console.log(`🔗 Connected to ${url}`);

    if (this.options.enterpriseMode && this.options.token) {
      console.log('🔐 Authenticating with enterprise server...');
      this.authenticate();
    } else {
      console.log('📝 Connected in CLI mode');
    }

    this.setupReadlineInterface();
  }

  private setupReadlineInterface(): void {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> ',
    });

    this.rl?.on('line', (line: string) => {
      this.processInput(line.trim());
    });

    this.rl?.on('SIGINT', () => {
      console.log('\n👋 Goodbye!');
      this.disconnect();
    });

    // Start with initial prompt
    this.rl?.prompt();
  }

  private processInput(input: string): void {
    if (!input || !this.isConnected) {
      this.rl?.prompt();
      return;
    }

    // Handle special commands
    if (input.startsWith('/')) {
      this.handleCommand(input);
      return;
    }

    this.sendMessage(input);
    this.rl?.prompt();
  }

  private handleCommand(command: string): void {
    const [cmd, ...args] = command.split(' ');

    switch (cmd) {
      case '/help':
        this.showHelp();
        break;
      case '/quit':
      case '/exit':
        console.log('👋 Goodbye!');
        this.disconnect();
        break;
      case '/status':
        this.showStatus();
        break;
      case '/name':
        console.log(`📝 Current name: ${this.myName || 'Not assigned'}`);
        break;
      default:
        console.log(`❓ Unknown command: ${cmd}. Type /help for available commands.`);
    }

    this.rl?.prompt();
  }

  private showHelp(): void {
    console.log('\n📚 Available commands:');
    console.log('  /help     - Show this help message');
    console.log('  /status   - Show connection status');
    console.log('  /name     - Show your current name');
    console.log('  /quit     - Disconnect and exit');
    console.log('  /exit     - Disconnect and exit');
    console.log('  Any other text will be sent as a message\n');
  }

  private showStatus(): void {
    console.log(`\n📊 Connection Status:`);
    console.log(`  Server: ${this.options.host}:${this.options.port}`);
    console.log(`  Mode: ${this.options.enterpriseMode ? 'Enterprise' : 'CLI'}`);
    console.log(`  Connected: ${this.isConnected ? '✅ Yes' : '❌ No'}`);
    console.log(`  Name: ${this.myName || 'Not assigned'}`);
    console.log('');
  }

  private sendMessage(content: string): void {
    if (this.ws.readyState !== WebSocket.OPEN) {
      console.log('❌ Not connected to server');
      return;
    }

    let message: Message;

    if (this.options.enterpriseMode) {
      // Enterprise format
      message = {
        type: 'message',
        content,
        senderId: 'cli-client',
        senderName: this.myName || 'CLI User',
        timestamp: new Date(),
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
    } else {
      // Legacy format
      message = {
        type: 'message',
        content
      };
    }

    this.ws.send(JSON.stringify(message));
  }

  private authenticate(): void {
    if (this.options.token && this.options.enterpriseMode) {
      // For enterprise mode, you might send auth token
      // This is a simplified version - in real implementation you'd handle proper auth flow
      console.log('🔐 Enterprise authentication not implemented in this version');
    }
  }

  private handleMessage(data: Buffer): void {
    try {
      const message: Message = JSON.parse(data.toString());
      this.displayMessage(message);
    } catch (error) {
      // Handle non-JSON messages
      this.clearCurrentLine();
      console.log('📨', data.toString());
    }

    this.rl?.prompt();
  }

  private displayMessage(message: Message): void {
    this.clearCurrentLine();

    // Determine message format and display accordingly
    if (this.isLegacyMessage(message)) {
      this.displayLegacyMessage(message as LegacyMessage);
    } else {
      this.displayEnterpriseMessage(message as EnterpriseMessage);
    }
  }

  private isLegacyMessage(message: Message): boolean {
    return ['your_name', 'message', 'system'].includes(message.type);
  }

  private displayLegacyMessage(message: LegacyMessage): void {
    switch (message.type) {
      case 'your_name':
        this.myName = message.payload || null;
        console.log(`👋 Connected as: ${this.myName}`);
        if (this.rl && this.myName) {
          this.rl.setPrompt(`${this.myName}> `);
        }
        break;
      case 'message':
        console.log(`💬 [${message.sender || 'Unknown'}]: ${message.content || message.payload}`);
        break;
      case 'system':
        console.log(`📢 [System]: ${message.payload}`);
        break;
    }
  }

  private displayEnterpriseMessage(message: EnterpriseMessage): void {
    switch (message.type) {
      case 'message':
        console.log(`💬 [${message.senderName}]: ${message.content}`);
        break;
      case 'system':
        console.log(`📢 [System]: ${message.content}`);
        break;
      case 'user_joined':
        console.log(`👋 ${message.content}`);
        break;
      case 'user_left':
        console.log(`👋 ${message.content}`);
        break;
      default:
        console.log(`📨 ${JSON.stringify(message)}`);
    }
  }

  private clearCurrentLine(): void {
    if (this.rl && process.stdout.isTTY) {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
    }
  }

  private handleDisconnection(code: number, reason: Buffer): void {
    this.isConnected = false;
    const reasonString = reason.toString();
    console.log(`\n❌ Disconnected from server. Code: ${code}${reasonString ? `, Reason: ${reasonString}` : ''}`);

    this.rl?.close();

    // Attempt reconnection if it wasn't a clean close
    if (code !== 1000 && this.reconnectAttempts < this.options.reconnectAttempts!) {
      this.attemptReconnection();
    } else {
      process.exit(code === 1000 ? 0 : 1);
    }
  }

  private async attemptReconnection(): Promise<void> {
    this.reconnectAttempts++;
    console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.options.reconnectAttempts}...`);

    setTimeout(() => {
      const url = `ws://${this.options.host}:${this.options.port}`;
      this.ws = new WebSocket(url);
      this.setupEventHandlers();
    }, this.options.reconnectDelay);
  }

  private handleError(err: Error): void {
    if (!this.isConnected) {
      console.error('❌ Failed to connect:', err.message);
      process.exit(1);
    } else {
      console.error('❌ Connection error:', err.message);
    }
  }

  public disconnect(): void {
    this.isConnected = false;
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, 'Client disconnecting');
    }
    this.rl?.close();
    process.exit(0);
  }
}

// Legacy export for backward compatibility
exports.startClient = function(host: string, port: number) {
  const client = new EnhancedCLIClient({
    host,
    port,
    enterpriseMode: false
  });

  client.start().catch((error) => {
    console.error('❌ Failed to start client:', error.message);
    process.exit(1);
  });
};

// Enhanced export for enterprise mode
exports.startEnterpriseClient = function(host: string, port: number, token?: string) {
  const client = new EnhancedCLIClient({
    host,
    port,
    enterpriseMode: true,
    token
  });

  client.start().catch((error) => {
    console.error('❌ Failed to start enterprise client:', error.message);
    process.exit(1);
  });
};

// Export the class for direct usage
exports.EnhancedCLIClient = EnhancedCLIClient;
