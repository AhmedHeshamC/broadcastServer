import WebSocket from 'ws';
import { LegacyProtocolAdapter } from '../../adapters/LegacyProtocolAdapter';
import { CLIService } from '../../services/CLIService';

describe('CLI-Enterprise Integration Tests', () => {
  let cliService: CLIService;
  let adapter: LegacyProtocolAdapter;
  const testPort = 8082; // Use a different port for testing

  beforeAll(() => {
    adapter = new LegacyProtocolAdapter();
  });

  afterAll(async () => {
    if (cliService) {
      await cliService.stopServer();
    }
  });

  describe('Legacy Protocol Adapter', () => {
    it('should handle complete message conversion cycle', () => {
      // Legacy message from CLI client
      const legacyMessage = {
        type: 'message' as const,
        content: 'Hello from CLI client'
      };

      // Convert to enterprise format
      const enterpriseMessage = adapter.convertToEnterpriseMessage(legacyMessage, 'cli-user-123');

      // Verify enterprise format
      expect(enterpriseMessage.type).toBe('message');
      expect(enterpriseMessage.content).toBe('Hello from CLI client');
      expect(enterpriseMessage.senderId).toBe('cli-user-123');
      expect(enterpriseMessage.senderName).toBe('CLI User');
      expect(enterpriseMessage.messageId).toBeDefined();
      expect(enterpriseMessage.timestamp).toBeInstanceOf(Date);

      // Convert back to legacy format
      const backToLegacy = adapter.convertToLegacyMessage(enterpriseMessage);

      // Verify round trip conversion
      expect(backToLegacy.type).toBe('message');
      expect(backToLegacy.content).toBe('Hello from CLI client');
    });

    it('should handle system messages correctly', () => {
      const systemMessage = adapter.createUserJoinedMessage('TestUser');

      expect(systemMessage.type).toBe('system');
      expect(systemMessage.payload).toBe('TestUser joined the chat');

      const enterpriseVersion = adapter.convertToEnterpriseMessage(systemMessage);
      expect(enterpriseVersion.type).toBe('user_joined');
      expect(enterpriseVersion.content).toBe('TestUser joined the chat');
    });
  });

  describe('CLI Service Integration', () => {
    it('should start and stop CLI server successfully', async () => {
      cliService = new CLIService();

      // Start the server
      await expect(cliService.startServer()).resolves.not.toThrow();

      // Check status
      const status = cliService.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.port).toBeDefined();

      // Stop the server
      await expect(cliService.stopServer()).resolves.not.toThrow();

      // Check status after stop
      const stoppedStatus = cliService.getStatus();
      expect(stoppedStatus.isRunning).toBe(false);
    }, 15000);

    it('should handle CLI client connection simulation', async () => {
      cliService = new CLIService();
      await cliService.startServer();

      const status = cliService.getStatus();
      const wsUrl = `ws://localhost:${status.port}`;

      // Simulate CLI client connection
      const ws = new WebSocket(wsUrl);

      const connectionResult = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.terminate();
          reject(new Error('Connection timeout'));
        }, 5000);

        ws.on('open', () => {
          clearTimeout(timeout);
          resolve('connected');
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      expect(connectionResult).toBe('connected');

      // Clean up
      ws.close();
      await cliService.stopServer();
    }, 15000);
  });

  describe('Message Flow Integration', () => {
    it('should handle complete message flow from CLI to enterprise format', async () => {
      // Simulate message from CLI client
      const cliMessage = {
        type: 'message' as const,
        content: 'Integration test message'
      };

      // Convert to enterprise format
      const enterpriseMessage = adapter.convertToEnterpriseMessage(cliMessage, 'test-cli-user');

      // Verify the enterprise message has all required fields
      expect(enterpriseMessage).toMatchObject({
        type: 'message',
        content: 'Integration test message',
        senderId: 'test-cli-user',
        senderName: 'CLI User'
      });

      expect(enterpriseMessage.messageId).toMatch(/^msg_\d+_[a-z0-9]+$/);
      expect(enterpriseMessage.timestamp).toBeInstanceOf(Date);

      // Test that enterprise message can be converted back for CLI clients
      const backToLegacy = adapter.convertToLegacyMessage(enterpriseMessage);
      expect(backToLegacy).toMatchObject({
        type: 'message',
        content: 'Integration test message'
      });
    });

    it('should handle different message types correctly', () => {
      const messageTypes = [
        { type: 'message' as const, content: 'Regular message' },
        { type: 'system' as const, payload: 'System notification' },
        { type: 'your_name' as const, payload: 'UserName123' }
      ];

      messageTypes.forEach((message) => {
        expect(adapter.validateLegacyMessage(message)).toBe(true);

        const enterprise = adapter.convertToEnterpriseMessage(message);
        expect(enterprise.type).toBeDefined();
        expect(enterprise.content).toBeDefined();
        expect(enterprise.timestamp).toBeInstanceOf(Date);

        const legacy = adapter.convertToLegacyMessage(enterprise);
        expect(legacy.type).toBeDefined();
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle invalid messages gracefully', () => {
      const invalidMessages = [
        null,
        undefined,
        {},
        { type: 'invalid_type' },
        { type: 'message' }, // missing content
        { content: 'test' } // missing type
      ];

      invalidMessages.forEach((message) => {
        expect(adapter.validateLegacyMessage(message)).toBe(false);
      });
    });

    it('should handle empty message content', () => {
      const emptyMessages = [
        { type: 'message' as const, content: '' },
        { type: 'message' as const, content: '   ' },
        { type: 'system' as const, payload: '' }
      ];

      emptyMessages.forEach((message) => {
        expect(() => {
          adapter.convertToEnterpriseMessage(message);
        }).toThrow();
      });
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle rapid message conversions', () => {
      const startTime = Date.now();
      const messageCount = 1000;

      for (let i = 0; i < messageCount; i++) {
        const legacyMessage = {
          type: 'message' as const,
          content: `Message ${i}`
        };

        const enterpriseMessage = adapter.convertToEnterpriseMessage(legacyMessage);
        const backToLegacy = adapter.convertToLegacyMessage(enterpriseMessage);

        expect(backToLegacy.content).toBe(`Message ${i}`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete 1000 conversions in under 1 second
      expect(duration).toBeLessThan(1000);
      console.log(`Converted ${messageCount} messages in ${duration}ms`);
    });
  });
});