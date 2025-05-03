const WebSocket = require('ws');
import * as http from 'http';
import { AddressInfo } from 'net';

// Import the server module
const { startServer } = require('../server');

describe('WebSocket Server Tests', () => {
  let server: http.Server;
  let port: number;
  let clients: WebSocket[] = [];

  // Start the server before all tests
  beforeAll((done) => {
    // Use a fixed port for testing
    port = 8082;

    // Start the server on the fixed port
    server = startServer(port);

    console.log(`Test server started on port ${port}`);

    // Wait a bit to ensure the server is fully started
    setTimeout(done, 1000);
  });

  // Clean up after all tests
  afterAll((done) => {
    // Close all clients
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });

    // Close the server
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

  // Clean up after each test
  afterEach(() => {
    // Close any clients created during the test
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });
    clients = [];
  });

  // Helper function to create a client
  const createClient = (): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}`);

      ws.on('open', () => {
        clients.push(ws);
        resolve(ws);
      });

      ws.on('error', (error: Error) => {
        reject(error);
      });

      // Set a timeout in case the connection hangs
      setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 5000);
    });
  };

  // Helper function to wait for a message
  const waitForMessage = (ws: any): Promise<any> => {
    return new Promise((resolve) => {
      const messageHandler = (data: any) => {
        ws.removeListener('message', messageHandler);
        const message = JSON.parse(data.toString());
        resolve(message);
      };

      ws.on('message', messageHandler);
    });
  };

  // Test that a client can connect to the server
  test('Client can connect to server', async () => {
    const client = await createClient();
    expect(client.readyState).toBe(WebSocket.OPEN);

    // Wait for the name assignment message
    const message = await waitForMessage(client);
    expect(message.type).toBe('your_name');
    expect(message.payload).toBeTruthy();
  });

  // Test that a message sent by one client is received by another
  test('Message broadcast works between clients', async () => {
    // Create two clients
    const client1 = await createClient();
    const nameMessage1 = await waitForMessage(client1);
    const client1Name = nameMessage1.payload;

    const client2 = await createClient();
    const nameMessage2 = await waitForMessage(client2);

    // Client 2 should receive a system message about client 1 joining
    const systemMessage = await waitForMessage(client2);
    expect(systemMessage.type).toBe('system');
    expect(systemMessage.payload).toContain('has joined');

    // Send a message from client 1
    const testMessage = 'Hello from client 1';
    client1.send(testMessage);

    // Client 2 should receive the message
    const broadcastMessage = await waitForMessage(client2);
    expect(broadcastMessage.type).toBe('message');
    expect(broadcastMessage.sender).toBe(client1Name);
    expect(broadcastMessage.payload).toBe(testMessage);
  });

  // Test that system messages are sent when clients disconnect
  test('System message is sent when a client disconnects', async () => {
    // Create two clients
    const client1 = await createClient();
    const nameMessage1 = await waitForMessage(client1);
    const client1Name = nameMessage1.payload;

    const client2 = await createClient();
    await waitForMessage(client2); // Name message
    await waitForMessage(client2); // System message about client 1 joining

    // Close client 1
    client1.close();

    // Client 2 should receive a system message about client 1 leaving
    const disconnectMessage = await waitForMessage(client2);
    expect(disconnectMessage.type).toBe('system');
    expect(disconnectMessage.payload).toBe(`${client1Name} has left.`);
  });
});
