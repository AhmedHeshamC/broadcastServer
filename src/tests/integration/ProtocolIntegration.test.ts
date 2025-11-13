import { LegacyProtocolAdapter, ILegacyMessage } from '../../adapters/LegacyProtocolAdapter';
import { IBroadcastMessage } from '../../services/WebSocketService';

describe('Protocol Integration Tests', () => {
  let adapter: LegacyProtocolAdapter;

  beforeAll(() => {
    adapter = new LegacyProtocolAdapter();
  });

  describe('Complete Message Lifecycle', () => {
    it('should handle full CLI to Enterprise to CLI message cycle', () => {
      // Step 1: Create legacy CLI message (what client sends)
      const cliMessage: ILegacyMessage = {
        type: 'message',
        content: 'Hello from CLI client!'
      };

      // Step 2: Convert to enterprise format (server processes)
      const enterpriseMessage: IBroadcastMessage = adapter.convertToEnterpriseMessage(
        cliMessage,
        'cli-user-456'
      );

      // Verify enterprise format
      expect(enterpriseMessage).toMatchObject({
        type: 'message',
        content: 'Hello from CLI client!',
        senderId: 'cli-user-456',
        senderName: 'CLI User'
      });
      expect(enterpriseMessage.messageId).toBeDefined();
      expect(enterpriseMessage.timestamp).toBeInstanceOf(Date);

      // Step 3: Convert back to legacy for CLI clients (server broadcasts)
      const broadcastMessage = adapter.convertToLegacyMessage(enterpriseMessage);

      // Verify legacy broadcast format
      expect(broadcastMessage).toMatchObject({
        type: 'message',
        content: 'Hello from CLI client!'
      });
    });

    it('should handle system notifications in both directions', () => {
      // CLI server sends system message
      const systemMessage: ILegacyMessage = {
        type: 'system',
        payload: 'User joined the chat room'
      };

      // Convert to enterprise
      const enterpriseSys = adapter.convertToEnterpriseMessage(systemMessage);
      expect(enterpriseSys.type).toBe('system');
      expect(enterpriseSys.content).toBe('User joined the chat room');

      // Convert back for broadcasting
      const backToLegacy = adapter.convertToLegacyMessage(enterpriseSys);
      expect(backToLegacy.type).toBe('system');
      expect(backToLegacy.payload).toBe('User joined the chat room');
    });

    it('should handle user join/leave events', () => {
      // User name assignment (first connection)
      const nameAssignment: ILegacyMessage = {
        type: 'your_name',
        payload: 'TestUser789'
      };

      const enterpriseJoin = adapter.convertToEnterpriseMessage(nameAssignment);
      expect(enterpriseJoin.type).toBe('user_joined');
      expect(enterpriseJoin.content).toBe('TestUser789 joined the chat');

      // Simulate enterprise broadcasting this back to CLI clients
      const cliBroadcast = adapter.convertToLegacyMessage(enterpriseJoin);
      expect(cliBroadcast.type).toBe('system');
      expect(cliBroadcast.payload).toBe('TestUser789 joined the chat');
    });
  });

  describe('Message Validation and Error Handling', () => {
    it('should validate all legacy message types', () => {
      const validMessages: ILegacyMessage[] = [
        { type: 'your_name', payload: 'User123' },
        { type: 'message', content: 'Hello world' },
        { type: 'system', payload: 'System notification' },
        { type: 'message', payload: 'Alternative content format' }
      ];

      validMessages.forEach((message) => {
        expect(adapter.validateLegacyMessage(message)).toBe(true);

        // Should also convert successfully
        expect(() => {
          adapter.convertToEnterpriseMessage(message);
        }).not.toThrow();
      });
    });

    it('should reject invalid legacy messages', () => {
      const invalidMessages = [
        null,
        undefined,
        'string',
        123,
        [],
        {},
        { type: 'invalid_type' },
        { content: 'missing type' }
      ];

      invalidMessages.forEach((message) => {
        expect(adapter.validateLegacyMessage(message)).toBe(false);
      });
    });

    it('should reject messages with empty content during conversion', () => {
      const emptyContentMessages = [
        { type: 'message' as const, content: '' },
        { type: 'message' as const, content: '   ' },
        { type: 'system' as const, payload: '' }
      ];

      emptyContentMessages.forEach((message) => {
        expect(() => {
          adapter.convertToEnterpriseMessage(message);
        }).toThrow();
      });
    });

    it('should handle edge cases in message content', () => {
      const edgeCases = [
        { type: 'message' as const, content: '🚀 Unicode emojis work!' },
        { type: 'message' as const, content: 'A'.repeat(1000) }, // long message
        { type: 'message' as const, content: 'Message with\nnewlines\tand\ttabs' },
        { type: 'system' as const, payload: 'System with "quotes" and \'apostrophes\'' }
      ];

      edgeCases.forEach((message) => {
        expect(adapter.validateLegacyMessage(message)).toBe(true);

        const enterprise = adapter.convertToEnterpriseMessage(message);
        expect(enterprise.content).toBe(message.content || message.payload);

        const legacy = adapter.convertToLegacyMessage(enterprise);
        expect(legacy.content || legacy.payload).toBe(message.content || message.payload);
      });
    });
  });

  describe('Enterprise Message Compatibility', () => {
    it('should handle all enterprise message types', () => {
      const enterpriseMessages: IBroadcastMessage[] = [
        {
          messageId: 'msg_123',
          type: 'message',
          content: 'User message',
          senderId: 'user-1',
          senderName: 'Alice',
          timestamp: new Date()
        },
        {
          messageId: 'msg_456',
          type: 'system',
          content: 'System notification',
          senderId: 'system',
          senderName: 'System',
          timestamp: new Date()
        },
        {
          messageId: 'msg_789',
          type: 'user_joined',
          content: 'Bob joined the chat',
          senderId: 'system',
          senderName: 'System',
          timestamp: new Date()
        },
        {
          messageId: 'msg_101',
          type: 'user_left',
          content: 'Charlie left the chat',
          senderId: 'system',
          senderName: 'System',
          timestamp: new Date()
        }
      ];

      enterpriseMessages.forEach((message) => {
        expect(() => {
          adapter.convertToLegacyMessage(message);
        }).not.toThrow();
      });
    });

    it('should reject unsupported enterprise message types', () => {
      const unsupportedMessage = {
        messageId: 'msg_error',
        type: 'unsupported_type' as any,
        content: 'test',
        senderId: 'system',
        senderName: 'System',
        timestamp: new Date()
      };

      expect(() => {
        adapter.convertToLegacyMessage(unsupportedMessage);
      }).toThrow('Cannot convert enterprise message type: unsupported_type');
    });
  });

  describe('Performance and Efficiency', () => {
    it('should handle high-frequency message conversions efficiently', () => {
      const messages = Array.from({ length: 100 }, (_, i) => ({
        type: 'message' as const,
        content: `High frequency message ${i}`
      }));

      const startTime = Date.now();

      // Convert all messages to enterprise and back
      messages.forEach((message) => {
        const enterprise = adapter.convertToEnterpriseMessage(message);
        const legacy = adapter.convertToLegacyMessage(enterprise);
        expect(legacy.content).toBe(message.content);
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete 100 conversions quickly (under 100ms)
      expect(duration).toBeLessThan(100);
      console.log(`Converted ${messages.length} messages in ${duration}ms`);
    });

    it('should maintain message integrity across multiple conversions', () => {
      const originalMessage: ILegacyMessage = {
        type: 'message',
        content: 'Integrity test message with special chars: !@#$%^&*()'
      };

      // Multiple conversion cycles
      let currentMessage = originalMessage;

      for (let i = 0; i < 10; i++) {
        const enterprise = adapter.convertToEnterpriseMessage(currentMessage, 'test-user');
        currentMessage = adapter.convertToLegacyMessage(enterprise);
      }

      // Final message should match original
      expect(currentMessage.content).toBe(originalMessage.content);
      expect(currentMessage.type).toBe(originalMessage.type);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should simulate complete chat session', () => {
      // Scenario: User joins, sends messages, receives notifications, leaves

      // 1. User connects and gets name
      const nameAssignment: ILegacyMessage = {
        type: 'your_name',
        payload: 'ChatUser2024'
      };
      const joinNotification = adapter.convertToEnterpriseMessage(nameAssignment);

      // 2. User sends chat message
      const userMessage: ILegacyMessage = {
        type: 'message',
        content: 'Hello everyone!'
      };
      const chatMessage = adapter.convertToEnterpriseMessage(userMessage, 'chat-user-123');

      // 3. System sends notification
      const systemNotification: ILegacyMessage = {
        type: 'system',
        payload: 'ChatUser2024 is now online'
      };
      const systemMsg = adapter.convertToEnterpriseMessage(systemNotification);

      // 4. Convert all to legacy for broadcasting to CLI clients
      const broadcastJoin = adapter.convertToLegacyMessage(joinNotification);
      const broadcastChat = adapter.convertToLegacyMessage(chatMessage);
      const broadcastSystem = adapter.convertToLegacyMessage(systemMsg);

      // Verify all messages are properly formatted for CLI clients
      expect(broadcastJoin.type).toBe('system');
      expect(broadcastChat.type).toBe('message');
      expect(broadcastSystem.type).toBe('system');

      expect(broadcastJoin.payload).toContain('ChatUser2024 joined the chat');
      expect(broadcastChat.content).toBe('Hello everyone!');
      expect(broadcastSystem.payload).toBe('ChatUser2024 is now online');
    });
  });
});