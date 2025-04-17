// Import WebSocket value and type separately
const WebSocket = require('ws');
import type { WebSocket as WsType } from 'ws'; // Use alias for type import
const readline = require('readline');

// Use exports.functionName for CommonJS export
exports.startClient = function(host: string, port: number) {
  const url = `ws://${host}:${port}`;
  // Annotate ws with the imported WsType
  const ws: WsType = new WebSocket(url);

  ws.on('open', () => {
    console.log(`Connected to ${url}`);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> ',
    });

    rl.prompt();

    rl.on('line', (line: string) => {
      // Check readyState using the WebSocket constant from the ws library
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(line);
      }
      rl.prompt();
    });

    // Type 'data' as Buffer
    ws.on('message', (data: Buffer) => {
      console.log(`\n[Broadcast] ${data.toString()}`);
      rl.prompt();
    });

    ws.on('close', () => {
      console.log('\nDisconnected from server.');
      rl.close();
      process.exit(0);
    });

    // Add type 'Error' to the err parameter
    ws.on('error', (err: Error) => {
      console.error('Connection error:', err);
      rl.close();
      process.exit(1);
    });
  });

  // Add type 'Error' to the err parameter
  ws.on('error', (err: Error) => {
    console.error('Failed to connect:', err);
    process.exit(1);
  });
};
