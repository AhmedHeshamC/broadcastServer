import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws'; // Use 'import type' for WebSocket to avoid value conflict

// Use exports.functionName for CommonJS export
exports.startServer = function(port: number) {
  const wss = new WebSocketServer({ port });
  // Use the imported WebSocket type from 'ws'
  const clients = new Set<WebSocket>();

  console.log(`Broadcast server started on ws://localhost:${port}`);

  // Explicitly type 'ws' with the WebSocket type from 'ws'
  wss.on('connection', (ws: WebSocket) => {
    clients.add(ws);

    // Type 'data' as Buffer (which is the default for ws)
    ws.on('message', (data: Buffer) => {
      // Broadcast to ALL connected clients (including sender)
      for (const client of clients) {
        // Check readyState using the WebSocket constant from the ws library
        if (client.readyState === require('ws').OPEN) { // Broadcast if client is open
          client.send(data);
        }
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    // Add type 'Error' to the err parameter
    ws.on('error', (err: Error) => {
      console.error('Client error:', err);
      clients.delete(ws);
    });
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    for (const client of clients) {
      client.close();
    }
    wss.close(() => {
      process.exit(0);
    });
  });
};
