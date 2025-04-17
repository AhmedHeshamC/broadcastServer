// Import WebSocket value and type separately
const WebSocket = require('ws');
import type { WebSocket as WsType } from 'ws'; // Use alias for type import
const readline = require('readline');
import type * as Readline from 'readline'; // Import readline types

// Use exports.functionName for CommonJS export
exports.startClient = function(host: string, port: number) {
  const url = `ws://${host}:${port}`;
  // Annotate ws with the imported WsType
  const ws: WsType = new WebSocket(url);
  let myName: string | null = null; // To store the name assigned by the server
  let rl: Readline.Interface | null = null; // Use the imported type alias

  ws.on('open', () => {
    console.log(`Connecting to ${url}...`); // Initial connection message
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> ',
    });

    // Don't prompt immediately, wait for name assignment

    rl?.on('line', (line: string) => {
      // Check readyState using the WebSocket constant from the ws library
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(line); // Send raw message, server will format it
      }
      rl?.prompt(); // Use optional chaining as rl might be null if closed early
    });

    // Type 'data' as Buffer
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        // Clear the current line and move cursor up if needed
        // Check if rl is initialized and stdout is a TTY before clearing/moving cursor
        if (rl && process.stdout.isTTY) {
          readline.clearLine(process.stdout, 0);
          readline.cursorTo(process.stdout, 0);
        }


        if (message.type === 'your_name') {
          myName = message.payload;
          console.log(`Connected as: ${myName}`);
          rl?.setPrompt(`${myName}> `); // Set prompt to include name
          // Don't prompt here, let the main loop handle it
        } else if (message.type === 'message') {
          console.log(`[${message.sender}] ${message.payload}`);
        } else if (message.type === 'system') {
          console.log(`[System] ${message.payload}`);
        } else {
          // Fallback for unknown message types
          console.log(data.toString());
        }
      } catch (e) {
        // Handle non-JSON messages if necessary, or log error
        // Also clear line before logging error
        if (rl && process.stdout.isTTY) {
            readline.clearLine(process.stdout, 0);
            readline.cursorTo(process.stdout, 0);
        }
        console.error('Received non-JSON message:', data.toString());
      }
      // Re-display prompt after showing message, only if rl is initialized
      rl?.prompt();
    });

    ws.on('close', (code: number, reason: Buffer) => {
      const reasonString = reason.toString();
      console.log(`\nDisconnected from server. Code: ${code}${reasonString ? `, Reason: ${reasonString}` : ''}`);
      rl?.close();
      process.exit(0);
    });

    // Add type 'Error' to the err parameter
    ws.on('error', (err: Error) => {
      console.error('\nConnection error:', err.message);
      rl?.close();
      process.exit(1);
    });
  });

  // Add type 'Error' to the err parameter for initial connection errors
  ws.on('error', (err: Error) => {
    // This handler catches errors *before* 'open' event fires
    if (ws.readyState !== WebSocket.OPEN) {
        console.error('Failed to connect:', err.message);
        process.exit(1);
    }
    // Errors after connection are handled by the 'error' handler inside 'open'
  });
};
