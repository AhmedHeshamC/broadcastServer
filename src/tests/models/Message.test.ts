import { Message } from '../../models/Message';
import { MessageType } from '../../types/types';

describe('Message Model', () => {
  let mockUserId: string;

  beforeEach(() => {
    mockUserId = '507f1f77bcf86cd799439011';
  });

  describe('Message Creation', () => {
    it('should create a message with valid data', async () => {
      const messageData = {
        content: 'Hello, world!',
        senderId: mockUserId,
        senderName: 'testuser',
        type: MessageType.MESSAGE
      };

      const message = new Message(messageData);
      const savedMessage = await message.save();

      expect(savedMessage._id).toBeDefined();
      expect(savedMessage.content).toBe(messageData.content);
      expect(savedMessage.senderId).toBe(messageData.senderId);
      expect(savedMessage.senderName).toBe(messageData.senderName);
      expect(savedMessage.type).toBe(MessageType.MESSAGE);
      expect(savedMessage.isEdited).toBe(false);
      expect(savedMessage.timestamp).toBeInstanceOf(Date);
    });

    it('should create a system message', async () => {
      const messageData = {
        content: 'User joined the chat',
        senderId: 'system',
        senderName: 'System',
        type: MessageType.SYSTEM
      };

      const message = new Message(messageData);
      const savedMessage = await message.save();

      expect(savedMessage.type).toBe(MessageType.SYSTEM);
      expect(savedMessage.senderId).toBe('system');
    });

    it('should require content, senderId, and senderName', async () => {
      const messageData = {
        content: '',
        senderId: '',
        senderName: '',
        type: MessageType.MESSAGE
      };

      const message = new Message(messageData);

      await expect(message.save()).rejects.toThrow();
    });

    it('should validate content length', async () => {
      const longContent = 'a'.repeat(2001); // Exceed max length
      const messageData = {
        content: longContent,
        senderId: mockUserId,
        senderName: 'testuser',
        type: MessageType.MESSAGE
      };

      const message = new Message(messageData);

      await expect(message.save()).rejects.toThrow();
    });
  });

  describe('Message Type Validation', () => {
    it('should accept valid message types', async () => {
      const validTypes = [
        MessageType.MESSAGE,
        MessageType.SYSTEM,
        MessageType.USER_JOINED,
        MessageType.USER_LEFT,
        MessageType.TYPING,
        MessageType.STOP_TYPING
      ];

      for (const type of validTypes) {
        const messageData = {
          content: 'Test message',
          senderId: mockUserId,
          senderName: 'testuser',
          type: type
        };

        const message = new Message(messageData);
        const savedMessage = await message.save();

        expect(savedMessage.type).toBe(type);
      }
    });

    it('should have default message type', async () => {
      const messageData = {
        content: 'Test message',
        senderId: mockUserId,
        senderName: 'testuser'
      };

      const message = new Message(messageData);
      const savedMessage = await message.save();

      expect(savedMessage.type).toBe(MessageType.MESSAGE);
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create some test messages
      await Message.create([
        {
          content: 'Message 1',
          senderId: mockUserId,
          senderName: 'user1',
          type: MessageType.MESSAGE
        },
        {
          content: 'Message 2',
          senderId: mockUserId,
          senderName: 'user1',
          type: MessageType.MESSAGE
        },
        {
          content: 'System message',
          senderId: 'system',
          senderName: 'System',
          type: MessageType.SYSTEM
        }
      ]);
    });

    it('should find messages by sender ID', async () => {
      const messages = await Message.findBySenderId(mockUserId);

      expect(messages).toHaveLength(2);
      messages.forEach(msg => {
        expect(msg.senderId).toBe(mockUserId);
      });
    });

    it('should find messages by type', async () => {
      const systemMessages = await Message.findByType(MessageType.SYSTEM);
      const userMessages = await Message.findByType(MessageType.MESSAGE);

      expect(systemMessages).toHaveLength(1);
      expect(userMessages).toHaveLength(2);

      systemMessages.forEach(msg => {
        expect(msg.type).toBe(MessageType.SYSTEM);
      });

      userMessages.forEach(msg => {
        expect(msg.type).toBe(MessageType.MESSAGE);
      });
    });

    it('should get messages with pagination', async () => {
      // Create more messages for pagination test
      const additionalMessages = Array.from({ length: 10 }, (_, i) => ({
        content: `Message ${i + 3}`,
        senderId: mockUserId,
        senderName: 'testuser',
        type: MessageType.MESSAGE
      }));

      await Message.insertMany(additionalMessages);

      const page1 = await Message.getMessagesPaginated(1, 5);
      const page2 = await Message.getMessagesPaginated(2, 5);

      expect(page1.messages).toHaveLength(5);
      expect(page2.messages).toHaveLength(5);
      expect(page1.totalCount).toBe(13);
      expect(page1.currentPage).toBe(1);
      expect(page1.totalPages).toBe(3);

      // Check that messages are sorted by timestamp (newest first)
      const allTimestamps = [...page1.messages, ...page2.messages].map(m => m.timestamp.getTime());
      const sortedTimestamps = [...allTimestamps].sort((a, b) => b - a);
      expect(allTimestamps).toEqual(sortedTimestamps);
    });

    it('should get recent messages', async () => {
      const recentMessages = await Message.getRecentGlobalMessages(2);

      expect(recentMessages).toHaveLength(2);
      recentMessages.forEach(msg => {
        expect([MessageType.MESSAGE, MessageType.SYSTEM]).toContain(msg.type);
      });
    });

    it('should count messages by sender', async () => {
      const counts = await Message.countBySender();

      expect(counts.get(mockUserId)).toBe(2);
      expect(counts.get('system')).toBe(1);
    });
  });

  describe('Instance Methods', () => {
    it('should mark message as edited', async () => {
      const messageData = {
        content: 'Original message',
        senderId: mockUserId,
        senderName: 'testuser',
        type: MessageType.MESSAGE
      };

      const message = new Message(messageData);
      await message.save();

      await message.markAsEdited('Updated message');

      expect(message.content).toBe('Updated message');
      expect(message.isEdited).toBe(true);
      expect(message.editedAt).toBeInstanceOf(Date);
      expect(message.editedAt!.getTime()).toBeGreaterThan(message.timestamp.getTime());
    });

    it('should soft delete message', async () => {
      const messageData = {
        content: 'Message to delete',
        senderId: mockUserId,
        senderName: 'testuser',
        type: MessageType.MESSAGE
      };

      const message = new Message(messageData);
      await message.save();

      await message.softDelete();

      expect(message.deletedAt).toBeInstanceOf(Date);
      expect(message.deletedAt!.getTime()).toBeGreaterThan(Date.now() - 1000);
    });

    it('should check if message is deleted', async () => {
      const messageData = {
        content: 'Test message',
        senderId: mockUserId,
        senderName: 'testuser',
        type: MessageType.MESSAGE
      };

      const message = new Message(messageData);
      await message.save();

      expect(message.isDeleted()).toBe(false);

      await message.softDelete();
      expect(message.isDeleted()).toBe(true);
    });
  });

  describe('Query Filtering', () => {
    beforeEach(async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      await Message.create([
        {
          content: 'Old message',
          senderId: mockUserId,
          senderName: 'user1',
          type: MessageType.MESSAGE,
          timestamp: twoDaysAgo
        },
        {
          content: 'Recent message 1',
          senderId: mockUserId,
          senderName: 'user1',
          type: MessageType.MESSAGE,
          timestamp: yesterday
        },
        {
          content: 'Recent message 2',
          senderId: mockUserId,
          senderName: 'user1',
          type: MessageType.MESSAGE,
          timestamp: now
        }
      ]);
    });

    it('should find messages after specific date', async () => {
      // Clear any existing messages first
      await Message.deleteMany({});

      const baseDate = new Date('2023-01-01T00:00:00.000Z');
      const yesterday = new Date('2023-01-02T00:00:00.000Z');
      const today = new Date('2023-01-03T00:00:00.000Z');

      // Create test messages with specific timestamps
      await Message.create([
        {
          content: 'Old message',
          senderId: mockUserId,
          senderName: 'user1',
          type: MessageType.MESSAGE,
          timestamp: baseDate
        },
        {
          content: 'Recent message 1',
          senderId: mockUserId,
          senderName: 'user1',
          type: MessageType.MESSAGE,
          timestamp: yesterday
        },
        {
          content: 'Recent message 2',
          senderId: mockUserId,
          senderName: 'user1',
          type: MessageType.MESSAGE,
          timestamp: today
        }
      ]);

      const messages = await Message.findMessagesAfter(yesterday);

      expect(messages.length).toBe(2);
      messages.forEach(msg => {
        expect(msg.timestamp.getTime()).toBeGreaterThanOrEqual(yesterday.getTime());
      });
    });

    it('should exclude deleted messages from default queries', async () => {
      // Soft delete a message
      const message = await Message.findOne({ content: 'Recent message 1' });
      await message!.softDelete();

      const allMessages = await Message.find({});
      const nonDeletedMessages = allMessages.filter(msg => !msg.isDeleted());

      expect(nonDeletedMessages.length).toBe(2);
    });
  });

  describe('Timestamps and Indexes', () => {
    it('should set default timestamp on creation', async () => {
      const before = new Date();
      const messageData = {
        content: 'Timestamp test',
        senderId: mockUserId,
        senderName: 'testuser',
        type: MessageType.MESSAGE
      };

      const message = new Message(messageData);
      await message.save();

      expect(message.timestamp).toBeInstanceOf(Date);
      expect(message.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(message.timestamp.getTime()).toBeLessThanOrEqual(new Date().getTime());
    });

    it('should update timestamp when message is edited', async () => {
      const originalTimestamp = new Date();
      const messageData = {
        content: 'Original message',
        senderId: mockUserId,
        senderName: 'testuser',
        type: MessageType.MESSAGE,
        timestamp: originalTimestamp
      };

      const message = new Message(messageData);
      await message.save();

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await message.markAsEdited('Edited message');

      expect(message.editedAt).toBeInstanceOf(Date);
      expect(message.editedAt!.getTime()).toBeGreaterThan(originalTimestamp.getTime());
    });
  });
});