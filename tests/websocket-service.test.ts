const WebSocket = require('ws');
import * as http from 'http';
import { AddressInfo } from 'net';

// Import the server module
const { startServer } = require('../server');

// Create a simplified version of the WebSocketService for testing
class WebSocketService {
  private socket: WebSocket | null = null;
  private messageHandlers: ((message: any) => void)[] = [];
  private connectionHandlers: ((connected: boolean) => void)[] = [];
  private currentUser: any = null;

  public connect(host: string, port: number): void {
    const url = `ws://${host}:${port}`;

    try {
      this.socket = new WebSocket(url);

      if (this.socket) {
        this.socket.onopen = () => {
          this.notifyConnectionHandlers(true);
        };

        this.socket.onmessage = (event: any) => {
          try {
            const message = JSON.parse(event.data.toString());

            // Handle user name assignment
            if (message.type === 'your_name') {
              this.currentUser = { name: message.payload, isCurrentUser: true };
            }

            this.notifyMessageHandlers(message);
          } catch (e) {
            console.error('Error parsing message:', e);
          }
        };

        this.socket.onclose = () => {
          this.notifyConnectionHandlers(false);
        };

        this.socket.onerror = () => {
          this.notifyConnectionHandlers(false);
        };
      }
    } catch (error) {
      this.notifyConnectionHandlers(false);
    }
  }

  public sendMessage(text: string): boolean {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(text);
      return true;
    }
    return false;
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  public onMessage(handler: (message: any) => void): void {
    this.messageHandlers.push(handler);
  }

  public onConnectionChange(handler: (connected: boolean) => void): void {
    this.connectionHandlers.push(handler);
  }

  public getCurrentUser(): any {
    return this.currentUser;
  }

  private notifyMessageHandlers(message: any): void {
    this.messageHandlers.forEach(handler => handler(message));
  }

  private notifyConnectionHandlers(connected: boolean): void {
    this.connectionHandlers.forEach(handler => handler(connected));
  }
}

describe('WebSocketService Tests', () => {
  let server: http.Server;
  let port: number;
  let service: WebSocketService;

  // Start the server before all tests
  beforeAll((done) => {
    // Use a fixed port for testing
    port = 8081;

    // Start the server on the fixed port
    server = startServer(port);

    console.log(`Test server started on port ${port}`);

    // Wait a bit to ensure the server is fully started
    setTimeout(done, 1000);
  });

  // Clean up after all tests
  afterAll((done) => {
    // The server object returned by startServer is actually the HTTP server
    if (server && typeof server.close === 'function') {
      server.close(() => {
        console.log('Test server closed');
        done();
      });
    } else {
      console.log('Server was not properly initialized');
      done();
    }
  });

  // Set up before each test
  beforeEach(() => {
    service = new WebSocketService();
  });

  // Clean up after each test
  afterEach(() => {
    if (service && typeof service.disconnect === 'function') {
      service.disconnect();
    }
  });

  // Test connection
  test('WebSocketService can connect to the server', (done) => {
    // Set up connection handler
    service.onConnectionChange((connected) => {
      if (connected) {
        expect(connected).toBe(true);
        done();
      }
    });

    // Connect to the server
    service.connect('localhost', port);
  });

  // Test receiving messages
  test('WebSocketService receives messages from the server', (done) => {
    let messageCount = 0;

    // Set up message handler
    service.onMessage((message) => {
      messageCount++;

      // First message should be the name assignment
      if (messageCount === 1) {
        expect(message.type).toBe('your_name');
        expect(message.payload).toBeTruthy();

        // After receiving the name, check if the current user is set
        const currentUser = service.getCurrentUser();
        expect(currentUser).not.toBeNull();
        expect(currentUser.name).toBe(message.payload);
        expect(currentUser.isCurrentUser).toBe(true);

        done();
      }
    });

    // Connect to the server
    service.connect('localhost', port);
  });

  // Test sending messages
  test('WebSocketService can send messages', (done) => {
    // Create a second client to receive the message
    const receivingClient = new WebSocket(`ws://localhost:${port}`);

    receivingClient.on('open', () => {
      // Skip the first message (name assignment)
      receivingClient.once('message', () => {
        // Set up handler for the actual message
        receivingClient.once('message', (data: any) => {
          const message = JSON.parse(data.toString());

          expect(message.type).toBe('message');
          expect(message.payload).toBe('Test message');

          receivingClient.close();
          done();
        });

        // Connect the service and send a message
        service.onConnectionChange((connected) => {
          if (connected) {
            // Send a message after connecting
            service.sendMessage('Test message');
          }
        });

        service.connect('localhost', port);
      });
    });
  });

  // Test disconnection
  test('WebSocketService can disconnect', (done) => {
    // Set up connection handlers
    let wasConnected = false;

    service.onConnectionChange((connected) => {
      if (connected) {
        wasConnected = true;

        // Disconnect after connecting
        service.disconnect();
      } else if (wasConnected) {
        // This should be called after disconnecting
        expect(connected).toBe(false);
        done();
      }
    });

    // Connect to the server
    service.connect('localhost', port);
  });
});
