#!/usr/bin/env node

// Use CommonJS require syntax
const { Command } = require('commander');
const { startServer } = require('./server');
const { startClient } = require('./client');

const program = new Command();

program
  .name('broadcast-server')
  .description('WebSocket broadcast server and client CLI')
  .version('1.0.0');

program
  .command('start')
  .description('Start the broadcast WebSocket server')
  .option('-p, --port <number>', 'Port to listen on', '8080')
  // Add explicit types for opts based on options defined
  .action((opts: { port: string }) => {
    const port = parseInt(opts.port, 10);
    if (isNaN(port)) {
      console.error('Error: Invalid port number.');
      process.exit(1);
    }
    startServer(port);
  });

program
  .command('connect')
  .description('Connect as a client to the broadcast server')
  .option('-h, --host <string>', 'Server host', 'localhost')
  .option('-p, --port <number>', 'Server port', '8080')
  // Add explicit types for opts based on options defined
  .action((opts: { host: string; port: string }) => {
    const port = parseInt(opts.port, 10);
     if (isNaN(port)) {
      console.error('Error: Invalid port number.');
      process.exit(1);
    }
    startClient(opts.host, port);
  });

program.parse(process.argv);
