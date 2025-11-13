import { app } from './app';
import { logger } from './utils/logger';
import { config } from './config';

/**
 * Main server entry point
 * Starts the enterprise WebSocket broadcast server
 */
async function startServer(): Promise<void> {
  try {
    // Start the application
    await app.start();

    // Log startup information
    logger.info('🎯 Enterprise WebSocket Broadcast Server is running');
    logger.info('📋 Server Configuration:');
    logger.info(`   - Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`   - Port: ${config.server.port}`);
    logger.info(`   - Database: ${config.mongodb.uri.split('@')[1] || 'local'}`);
    logger.info(`   - CORS Origins: ${config.cors.allowedOrigins.join(', ')}`);
    logger.info('🚀 Ready to accept connections');

    // Handle server startup completion
    logger.info('✅ Server startup completed successfully');

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Fatal error during server startup:', error);
    process.exit(1);
  });
}

export { startServer };