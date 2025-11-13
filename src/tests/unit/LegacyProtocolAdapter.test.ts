import { LegacyProtocolAdapter, ILegacyMessage } from '../../adapters/LegacyProtocolAdapter';
import { IBroadcastMessage } from '../../services/WebSocketService';

describe('LegacyProtocolAdapter', () => {
  let adapter: LegacyProtocolAdapter;

  beforeEach(() => {
    adapter = new LegacyProtocolAdapter();
  });

  describe('convertToEnterpriseMessage', () => {
    it('should convert legacy chat message to enterprise format', () => {
      const legacyMessage: ILegacyMessage = {
        type: 'message',
        content: 'Hello world'
      };

      const result = adapter.convertToEnterpriseMessage(legacyMessage, 'user123');

      expect(result.type).toBe('message');
      expect(result.content).toBe('Hello world');
      expect(result.senderId).toBe('user123');
      expect(result.senderName).toBe('CLI User');
      expect(result.messageId).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should convert legacy system message to enterprise format', () => {
      const legacyMessage: ILegacyMessage = {
        type: 'system',
        payload: 'User joined the chat'
      };

      const result = adapter.convertToEnterpriseMessage(legacyMessage);

      expect(result.type).toBe('system');
      expect(result.content).toBe('User joined the chat');
      expect(result.senderId).toBe('system');
      expect(result.senderName).toBe('System');
    });

    it('should convert name assignment message to enterprise format', () => {
      const legacyMessage: ILegacyMessage = {
        type: 'your_name',
        payload: 'User123'
      };

      const result = adapter.convertToEnterpriseMessage(legacyMessage);

      expect(result.type).toBe('user_joined');
      expect(result.content).toBe('User123 joined the chat');
      expect(result.senderId).toBe('system');
      expect(result.senderName).toBe('System');
    });

    it('should throw error for unknown message type', () => {
      const legacyMessage = {
        type: 'unknown' as any,
        content: 'test'
      };

      expect(() => {
        adapter.convertToEnterpriseMessage(legacyMessage);
      }).toThrow('Unknown legacy message type: unknown');
    });

    it('should throw error for empty message content', () => {
      const legacyMessage: ILegacyMessage = {
        type: 'message',
        content: ''
      };

      expect(() => {
        adapter.convertToEnterpriseMessage(legacyMessage);
      }).toThrow('Message content cannot be empty');
    });
  });

  describe('convertToLegacyMessage', () => {
    it('should convert enterprise user message to legacy format', () => {
      const enterpriseMessage: IBroadcastMessage = {
        messageId: 'msg_123',
        type: 'message',
        content: 'Hello from web',
        senderId: 'web-user',
        senderName: 'Web User',
        timestamp: new Date()
      };

      const result = adapter.convertToLegacyMessage(enterpriseMessage);

      expect(result.type).toBe('message');
      expect(result.content).toBe('Hello from web');
    });

    it('should convert enterprise system message to legacy format', () => {
      const enterpriseMessage: IBroadcastMessage = {
        messageId: 'msg_456',
        type: 'system',
        content: 'System notification',
        senderId: 'system',
        senderName: 'System',
        timestamp: new Date()
      };

      const result = adapter.convertToLegacyMessage(enterpriseMessage);

      expect(result.type).toBe('system');
      expect(result.payload).toBe('System notification');
    });

    it('should convert user joined message to legacy format', () => {
      const enterpriseMessage: IBroadcastMessage = {
        messageId: 'msg_789',
        type: 'user_joined',
        content: 'New user joined',
        senderId: 'system',
        senderName: 'System',
        timestamp: new Date()
      };

      const result = adapter.convertToLegacyMessage(enterpriseMessage);

      expect(result.type).toBe('system');
      expect(result.payload).toBe('New user joined');
    });

    it('should throw error for unsupported enterprise message type', () => {
      const enterpriseMessage = {
        id: 'msg_error',
        type: 'unsupported_type' as any,
        content: 'test',
        senderId: 'system',
        senderName: 'System',
        timestamp: new Date(),
        room: 'general'
      };

      expect(() => {
        adapter.convertToLegacyMessage(enterpriseMessage);
      }).toThrow('Cannot convert enterprise message type: unsupported_type');
    });
  });

  describe('Utility Messages', () => {
    it('should create welcome message', () => {
      const result = adapter.createWelcomeMessage('TestUser');

      expect(result.type).toBe('your_name');
      expect(result.payload).toBe('TestUser');
    });

    it('should create user joined message', () => {
      const result = adapter.createUserJoinedMessage('TestUser');

      expect(result.type).toBe('system');
      expect(result.payload).toBe('TestUser joined the chat');
    });

    it('should create user left message', () => {
      const result = adapter.createUserLeftMessage('TestUser');

      expect(result.type).toBe('system');
      expect(result.payload).toBe('TestUser left the chat');
    });
  });

  describe('validateLegacyMessage', () => {
    it('should validate correct legacy message', () => {
      const validMessage = {
        type: 'message',
        content: 'Hello'
      };

      expect(adapter.validateLegacyMessage(validMessage)).toBe(true);
    });

    it('should reject message with invalid type', () => {
      const invalidMessage = {
        type: 'invalid_type',
        content: 'Hello'
      };

      expect(adapter.validateLegacyMessage(invalidMessage)).toBe(false);
    });

    it('should reject non-object message', () => {
      expect(adapter.validateLegacyMessage(null)).toBe(false);
      expect(adapter.validateLegacyMessage('string')).toBe(false);
      expect(adapter.validateLegacyMessage(123)).toBe(false);
    });

    it('should reject message without type', () => {
      const messageWithoutType = {
        content: 'Hello'
      };

      expect(adapter.validateLegacyMessage(messageWithoutType)).toBe(false);
    });

    it('should accept all valid legacy message types', () => {
      const types = ['your_name', 'message', 'system'];

      types.forEach(type => {
        const message = { type };
        expect(adapter.validateLegacyMessage(message)).toBe(true);
      });
    });
  });
});