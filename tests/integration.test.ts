const WebSocket = require('ws');
import * as http from 'http';
import { AddressInfo } from 'net';

// Import the server module
const { startServer } = require('../server');

describe('Chat Application Integration Tests', () => {
  let server: http.Server;
  let port: number;
  let clients: WebSocket[] = [];

  // Start the server before all tests
  beforeAll((done) => {
    // Use a fixed port for testing
    port = 8083;

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

  // Test the full chat flow with multiple clients
  test('Full chat flow with multiple clients', async () => {
    // Create three clients
    const client1 = await createClient();
    const nameMessage1 = await waitForMessage(client1);
    const client1Name = nameMessage1.payload;
    expect(nameMessage1.type).toBe('your_name');

    const client2 = await createClient();
    const nameMessage2 = await waitForMessage(client2);
    const client2Name = nameMessage2.payload;
    expect(nameMessage2.type).toBe('your_name');

    // Client 2 should receive a system message about client 1 joining
    const systemMessage1 = await waitForMessage(client2);
    expect(systemMessage1.type).toBe('system');
    expect(systemMessage1.payload).toContain('has joined');

    const client3 = await createClient();
    const nameMessage3 = await waitForMessage(client3);
    const client3Name = nameMessage3.payload;
    expect(nameMessage3.type).toBe('your_name');

    // Client 3 should receive system messages about client 1 and 2 joining
    const systemMessage2 = await waitForMessage(client3);
    expect(systemMessage2.type).toBe('system');

    const systemMessage3 = await waitForMessage(client3);
    expect(systemMessage3.type).toBe('system');

    // Client 1 and 2 should receive a system message about client 3 joining
    const systemMessage4 = await waitForMessage(client1);
    expect(systemMessage4.type).toBe('system');
    expect(systemMessage4.payload).toContain('has joined');

    const systemMessage5 = await waitForMessage(client2);
    expect(systemMessage5.type).toBe('system');
    expect(systemMessage5.payload).toContain('has joined');

    // Send a message from client 1 to all
    const message1 = 'Hello from client 1';
    client1.send(message1);

    // Client 2 and 3 should receive the message
    const broadcastMessage1 = await waitForMessage(client2);
    expect(broadcastMessage1.type).toBe('message');
    expect(broadcastMessage1.sender).toBe(client1Name);
    expect(broadcastMessage1.payload).toBe(message1);

    const broadcastMessage2 = await waitForMessage(client3);
    expect(broadcastMessage2.type).toBe('message');
    expect(broadcastMessage2.sender).toBe(client1Name);
    expect(broadcastMessage2.payload).toBe(message1);

    // Send a message from client 2 to all
    const message2 = 'Hello from client 2';
    client2.send(message2);

    // Client 1 and 3 should receive the message
    const broadcastMessage3 = await waitForMessage(client1);
    expect(broadcastMessage3.type).toBe('message');
    expect(broadcastMessage3.sender).toBe(client2Name);
    expect(broadcastMessage3.payload).toBe(message2);

    const broadcastMessage4 = await waitForMessage(client3);
    expect(broadcastMessage4.type).toBe('message');
    expect(broadcastMessage4.sender).toBe(client2Name);
    expect(broadcastMessage4.payload).toBe(message2);

    // Send a message from client 3 to all
    const message3 = 'Hello from client 3';
    client3.send(message3);

    // Client 1 and 2 should receive the message
    const broadcastMessage5 = await waitForMessage(client1);
    expect(broadcastMessage5.type).toBe('message');
    expect(broadcastMessage5.sender).toBe(client3Name);
    expect(broadcastMessage5.payload).toBe(message3);

    const broadcastMessage6 = await waitForMessage(client2);
    expect(broadcastMessage6.type).toBe('message');
    expect(broadcastMessage6.sender).toBe(client3Name);
    expect(broadcastMessage6.payload).toBe(message3);

    // Disconnect client 1
    client1.close();

    // Client 2 and 3 should receive a system message about client 1 leaving
    const disconnectMessage1 = await waitForMessage(client2);
    expect(disconnectMessage1.type).toBe('system');
    expect(disconnectMessage1.payload).toBe(`${client1Name} has left.`);

    const disconnectMessage2 = await waitForMessage(client3);
    expect(disconnectMessage2.type).toBe('system');
    expect(disconnectMessage2.payload).toBe(`${client1Name} has left.`);

    // Disconnect client 2
    client2.close();

    // Client 3 should receive a system message about client 2 leaving
    const disconnectMessage3 = await waitForMessage(client3);
    expect(disconnectMessage3.type).toBe('system');
    expect(disconnectMessage3.payload).toBe(`${client2Name} has left.`);
  }, 30000); // Increase timeout for this test
});
