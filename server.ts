import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws'; // Use 'import type' for WebSocket to avoid value conflict
const express = require('express');
const path = require('path');
const http = require('http');

// Helper function to generate a simple random name
function generateRandomName(): string {
  return `User${Math.floor(Math.random() * 1000)}`;
}

// Use exports.functionName for CommonJS export
exports.startServer = function(port: number) {
  // Create Express app
  const app = express();

  // Serve static files from the 'ui' directory
  app.use(express.static(path.join(__dirname, 'ui')));

  // Create HTTP server
  const server = http.createServer(app);

  // Create WebSocket server using the HTTP server
  const wss = new WebSocketServer({ server });

  // Use a Map to store clients and their names
  const clients = new Map<WebSocket, string>();

  console.log(`Broadcast server started on http://localhost:${port}`);
  console.log(`WebSocket server available at ws://localhost:${port}`);

  // Helper function to broadcast messages to all clients (optionally excluding sender)
  function broadcast(message: object, sender?: WebSocket) {
    const messageString = JSON.stringify(message);
    for (const [client, name] of clients.entries()) {
      // Send to all clients *except* the sender if specified
      if (client !== sender && client.readyState === require('ws').OPEN) {
        client.send(messageString);
      }
    }
  }

  // Explicitly type 'ws' with the WebSocket type from 'ws'
  wss.on('connection', (ws: WebSocket) => {
    // Assign a name and store the client
    const clientName = generateRandomName();
    clients.set(ws, clientName);
    console.log(`${clientName} connected.`);

    // Send the assigned name back to the new client
    ws.send(JSON.stringify({ type: 'your_name', payload: clientName }));

    // Notify others about the new connection
    broadcast({ type: 'system', payload: `${clientName} has joined.` }, ws);

    // Type 'data' as Buffer (which is the default for ws)
    ws.on('message', (data: Buffer) => {
      const senderName = clients.get(ws) || 'Unknown User'; // Get sender's name
      const message = {
        type: 'message',
        sender: senderName,
        payload: data.toString(),
      };
      // Broadcast message with sender name to OTHERS
      broadcast(message, ws);
    });

    ws.on('close', () => {
      const clientName = clients.get(ws);
      clients.delete(ws);
      if (clientName) {
        console.log(`${clientName} disconnected.`);
        // Notify others about the disconnection
        broadcast({ type: 'system', payload: `${clientName} has left.` });
      }
    });

    // Add type 'Error' to the err parameter
    ws.on('error', (err: Error) => {
      const clientName = clients.get(ws);
      console.error(`Client error (${clientName || 'Unknown'}):`, err);
      clients.delete(ws); // Ensure removal on error
       if (clientName) {
         // Notify others about the disconnection due to error
         broadcast({ type: 'system', payload: `${clientName} has left due to an error.` });
       }
    });
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    // Iterate over map keys for closing
    for (const client of clients.keys()) {
      client.close(1000, 'Server shutting down'); // Send close frame
    }
    wss.close(() => {
      console.log('WebSocket server closed.');
      server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
      });
    });
    // Force exit if server doesn't close quickly
    setTimeout(() => {
      console.log('Forcing exit.');
      process.exit(1);
    }, 2000);
  });

  // Start the server
  server.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
  });
};
