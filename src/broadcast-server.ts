#!/usr/bin/env node

// Use CommonJS require syntax
const { Command } = require('commander');
const { startClient, startEnterpriseClient } = require('./client');

// Import enterprise application and CLI service
const { Application } = require('./app');
const { CLIService } = require('./services/CLIService');

const program = new Command();

program
  .name('broadcast-server')
  .description('Enterprise WebSocket broadcast server with CLI support')
  .version('2.0.0');

// Legacy CLI server mode
program
  .command('start')
  .description('Start legacy CLI WebSocket server')
  .option('-p, --port <number>', 'Port to listen on', '8080')
  .action(async (opts: { port: string }) => {
    const port = parseInt(opts.port, 10);
    if (isNaN(port)) {
      console.error('❌ Error: Invalid port number.');
      process.exit(1);
    }
    console.log('🚀 Starting legacy CLI server...');
    try {
      const cliService = new CLIService();
      await cliService.startServer();
      console.log(`✅ Legacy CLI server started on port ${port}`);
    } catch (error) {
      console.error('❌ Failed to start legacy CLI server:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Enterprise server mode
program
  .command('enterprise')
  .description('Start enterprise WebSocket server with authentication')
  .option('-p, --port <number>', 'Port to listen on', '3000')
  .action(async (opts: { port: string }) => {
    const port = parseInt(opts.port, 10);
    if (isNaN(port)) {
      console.error('❌ Error: Invalid port number.');
      process.exit(1);
    }

    try {
      console.log('🚀 Starting enterprise server...');
      const app = new Application();
      await app.start(port);
      console.log(`✅ Enterprise server started on port ${port}`);
    } catch (error) {
      console.error('❌ Failed to start enterprise server:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// CLI server mode (using new CLIService)
program
  .command('cli-server')
  .description('Start dedicated CLI WebSocket server')
  .option('-p, --port <number>', 'Port to listen on', '8080')
  .option('-h, --host <string>', 'Host to bind to', 'localhost')
  .action(async (opts: { port: string; host: string }) => {
    const port = parseInt(opts.port, 10);
    if (isNaN(port)) {
      console.error('❌ Error: Invalid port number.');
      process.exit(1);
    }

    try {
      console.log('🚀 Starting CLI server...');
      const cliService = new CLIService();
      await cliService.startServer();
      console.log(`✅ CLI server started on ws://${opts.host}:${port}`);
    } catch (error) {
      console.error('❌ Failed to start CLI server:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Legacy CLI client
program
  .command('connect')
  .description('Connect as CLI client to server')
  .option('-h, --host <string>', 'Server host', 'localhost')
  .option('-p, --port <number>', 'Server port', '8080')
  .action((opts: { host: string; port: string }) => {
    const port = parseInt(opts.port, 10);
    if (isNaN(port)) {
      console.error('❌ Error: Invalid port number.');
      process.exit(1);
    }
    console.log('🔗 Connecting to server in legacy mode...');
    startClient(opts.host, port);
  });

// Enterprise CLI client
program
  .command('enterprise-client')
  .description('Connect as enterprise CLI client')
  .option('-h, --host <string>', 'Server host', 'localhost')
  .option('-p, --port <number>', 'Server port', '3000')
  .option('-t, --token <string>', 'Authentication token')
  .action((opts: { host: string; port: string; token?: string }) => {
    const port = parseInt(opts.port, 10);
    if (isNaN(port)) {
      console.error('❌ Error: Invalid port number.');
      process.exit(1);
    }
    console.log('🔗 Connecting to enterprise server...');
    startEnterpriseClient(opts.host, port, opts.token);
  });

// Unified server mode (both enterprise and CLI)
program
  .command('unified')
  .description('Start unified server with both enterprise and CLI support')
  .option('-e, --enterprise-port <number>', 'Enterprise server port', '3000')
  .option('-c, --cli-port <number>', 'CLI server port', '8080')
  .option('-h, --host <string>', 'Host to bind to', 'localhost')
  .action(async (opts: { enterprisePort: string; cliPort: string; host: string }) => {
    const enterprisePort = parseInt(opts.enterprisePort, 10);
    const cliPort = parseInt(opts.cliPort, 10);

    if (isNaN(enterprisePort) || isNaN(cliPort)) {
      console.error('❌ Error: Invalid port number.');
      process.exit(1);
    }

    try {
      console.log('🚀 Starting unified server...');

      // Start enterprise server
      console.log(`📡 Starting enterprise server on port ${enterprisePort}...`);
      const app = new Application();
      await app.start(enterprisePort);

      // Start CLI server
      console.log(`📝 Starting CLI server on port ${cliPort}...`);
      const cliService = new CLIService();
      await cliService.startServer();

      console.log('✅ Unified server started successfully!');
      console.log(`   Enterprise: ws://${opts.host}:${enterprisePort}`);
      console.log(`   CLI: ws://${opts.host}:${cliPort}`);
      console.log('\n💡 Use "broadcast-server connect" to connect CLI client');
      console.log('💡 Enterprise features available on enterprise port');

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down unified server...');
        try {
          await cliService.stopServer();
          // Note: Enterprise app shutdown would need to be implemented
          console.log('✅ Unified server stopped gracefully');
        } catch (error) {
          console.error('❌ Error during shutdown:', error instanceof Error ? error.message : String(error));
        }
        process.exit(0);
      });

    } catch (error) {
      console.error('❌ Failed to start unified server:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Development mode
program
  .command('dev')
  .description('Start development environment with both servers')
  .option('-e, --enterprise-port <number>', 'Enterprise server port', '3000')
  .option('-c, --cli-port <number>', 'CLI server port', '8080')
  .option('-h, --host <string>', 'Host to bind to', 'localhost')
  .action(async (opts: { enterprisePort: string; cliPort: string; host: string }) => {
    // Set development environment
    process.env.NODE_ENV = 'development';

    // Forward to unified command
    const unifiedCmd = program.commands.find((cmd: any) => cmd.name() === 'unified');
    if (unifiedCmd) {
      unifiedCmd.action(unifiedCmd._actionHandler)(opts);
    }
  });

// Status command
program
  .command('status')
  .description('Show system status and configuration')
  .action(() => {
    console.log('📊 Broadcast Server Status');
    console.log('=========================');
    console.log(`Version: 2.0.0`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Node.js: ${process.version}`);
    console.log('\n📝 Available Modes:');
    console.log('• Legacy CLI server: broadcast-server start');
    console.log('• Enterprise server: broadcast-server enterprise');
    console.log('• CLI server: broadcast-server cli-server');
    console.log('• Legacy client: broadcast-server connect');
    console.log('• Enterprise client: broadcast-server enterprise-client');
    console.log('• Unified server: broadcast-server unified');
    console.log('• Development mode: broadcast-server dev');
  });

// Handle invalid commands
program.on('command:*', (operands: string[]) => {
  console.error(`❌ Error: Unknown command '${operands[0]}'`);
  console.log('💡 Use --help to see available commands');
  process.exit(1);
});

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
