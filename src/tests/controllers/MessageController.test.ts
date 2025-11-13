import { Request, Response } from 'express';
import { MessageController } from '../../controllers/MessageController';
import { Message } from '../../models/Message';
import { User } from '../../models/User';
import { webSocketService } from '../../services/WebSocketService';
import { UserRole, IAuthenticatedRequest } from '../../types/types';

// Mock the services and models
jest.mock('../../models/Message');
jest.mock('../../models/User');
jest.mock('../../services/WebSocketService');
jest.mock('../../utils/logger');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 9))
}));

describe('MessageController', () => {
  let messageController: MessageController;
  let mockRequest: Partial<Request & IAuthenticatedRequest>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    messageController = new MessageController();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      params: {},
      body: {},
      query: {},
      user: {
        userId: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        role: UserRole.USER
      }
    };

    jest.clearAllMocks();
  });

  describe('POST /api/messages', () => {
    it('should create message successfully', async () => {
      const mockMessage = {
        _id: 'msg123',
        content: 'Hello, world!',
        senderId: '507f1f77bcf86cd799439011',
        type: 'message',
        createdAt: new Date(),
        metadata: {}
      };

      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        username: 'testuser',
        email: 'test@example.com',
        role: UserRole.USER
      };

      const mockPopulatedMessage = {
        ...mockMessage,
        senderId: mockUser
      };

      mockRequest.body = {
        content: 'Hello, world!',
        type: 'message'
      };

      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (Message.createMessage as jest.Mock).mockResolvedValue(mockMessage);
      (Message.findById as jest.Mock).mockResolvedValue(mockPopulatedMessage);

      await messageController.createMessage(mockRequest as IAuthenticatedRequest, mockResponse as Response);

      expect(User.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(Message.createMessage).toHaveBeenCalledWith({
        content: 'Hello, world!',
        senderId: '507f1f77bcf86cd799439011',
        type: 'message',
        metadata: {}
      });
      expect(webSocketService.broadcastMessage).toHaveBeenCalledWith({
        type: 'message',
        content: 'Hello, world!',
        senderId: '507f1f77bcf86cd799439011',
        senderName: 'testuser',
        timestamp: mockMessage.createdAt,
        messageId: 'msg123',
        metadata: {}
      });
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Message created successfully',
        data: {
          message: mockPopulatedMessage
        }
      });
    });

    it('should reject message creation without authentication', async () => {
      mockRequest.user = undefined;
      mockRequest.body = {
        content: 'Hello, world!'
      };

      await messageController.createMessage(mockRequest as IAuthenticatedRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not authenticated',
        error: 'NOT_AUTHENTICATED'
      });
    });

    it('should reject empty message content', async () => {
      mockRequest.body = {
        content: ''
      };

      await messageController.createMessage(mockRequest as IAuthenticatedRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Message content is required',
        error: 'MISSING_CONTENT'
      });
    });

    it('should reject message content too long', async () => {
      mockRequest.body = {
        content: 'a'.repeat(1001)
      };

      await messageController.createMessage(mockRequest as IAuthenticatedRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Message content too long (max 1000 characters)',
        error: 'CONTENT_TOO_LONG'
      });
    });

    it('should handle user not found', async () => {
      mockRequest.body = {
        content: 'Hello, world!'
      };
      (User.findById as jest.Mock).mockResolvedValue(null);

      await messageController.createMessage(mockRequest as IAuthenticatedRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND'
      });
    });
  });

  describe('GET /api/messages', () => {
    it('should get messages with pagination', async () => {
      const mockMessages = [
        { _id: 'msg1', content: 'Message 1' },
        { _id: 'msg2', content: 'Message 2' }
      ];

      mockRequest.query = {
        page: '1',
        limit: '10',
        sortBy: '-createdAt'
      };

      (Message.getMessagesPaginated as jest.Mock).mockResolvedValue(mockMessages);
      (Message.countDocuments as jest.Mock).mockResolvedValue(2);

      await messageController.getMessages(mockRequest as Request, mockResponse as Response);

      expect(Message.getMessagesPaginated).toHaveBeenCalledWith(
        {},
        { page: 1, limit: 10, sortBy: '-createdAt' }
      );
      expect(Message.countDocuments).toHaveBeenCalledWith({});
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Messages retrieved successfully',
        data: {
          messages: mockMessages,
          pagination: {
            page: 1,
            limit: 10,
            total: 2,
            pages: 1
          }
        }
      });
    });

    it('should handle invalid pagination parameters', async () => {
      mockRequest.query = {
        page: '0',
        limit: '101'
      };

      await messageController.getMessages(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid pagination parameters',
        error: 'INVALID_PAGINATION'
      });
    });

    it('should filter messages by sender', async () => {
      mockRequest.query = {
        page: '1',
        limit: '10',
        senderId: 'user123'
      };

      (Message.getMessagesPaginated as jest.Mock).mockResolvedValue([]);
      (Message.countDocuments as jest.Mock).mockResolvedValue(0);

      await messageController.getMessages(mockRequest as Request, mockResponse as Response);

      expect(Message.getMessagesPaginated).toHaveBeenCalledWith(
        { senderId: 'user123' },
        { page: 1, limit: 10, sortBy: '-createdAt' }
      );
    });

    it('should search messages by content', async () => {
      mockRequest.query = {
        page: '1',
        limit: '10',
        search: 'hello'
      };

      (Message.getMessagesPaginated as jest.Mock).mockResolvedValue([]);
      (Message.countDocuments as jest.Mock).mockResolvedValue(0);

      await messageController.getMessages(mockRequest as Request, mockResponse as Response);

      expect(Message.getMessagesPaginated).toHaveBeenCalledWith(
        { content: { $regex: 'hello', $options: 'i' } },
        { page: 1, limit: 10, sortBy: '-createdAt' }
      );
    });
  });

  describe('GET /api/messages/:id', () => {
    it('should get message by ID successfully', async () => {
      const mockMessage = {
        _id: 'msg123',
        content: 'Hello, world!',
        senderId: { username: 'testuser', email: 'test@example.com', avatar: null, role: UserRole.USER }
      };

      mockRequest.params = { id: 'msg123' };
      (Message.findById as jest.Mock).mockResolvedValue(mockMessage);

      await messageController.getMessageById(mockRequest as Request, mockResponse as Response);

      expect(Message.findById).toHaveBeenCalledWith('msg123');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Message retrieved successfully',
        data: {
          message: mockMessage
        }
      });
    });

    it('should handle missing message ID', async () => {
      mockRequest.params = {};

      await messageController.getMessageById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Message ID is required',
        error: 'MISSING_MESSAGE_ID'
      });
    });

    it('should handle message not found', async () => {
      mockRequest.params = { id: 'nonexistent' };
      (Message.findById as jest.Mock).mockResolvedValue(null);

      await messageController.getMessageById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Message not found',
        error: 'MESSAGE_NOT_FOUND'
      });
    });
  });

  describe('PUT /api/messages/:id', () => {
    it('should update message successfully as sender', async () => {
      const mockMessage = {
        _id: 'msg123',
        content: 'Original content',
        senderId: '507f1f77bcf86cd799439011'
      };

      mockRequest.params = { id: 'msg123' };
      mockRequest.body = {
        content: 'Updated content'
      };

      (Message.findById as jest.Mock).mockResolvedValue(mockMessage);

      const saveSpy = jest.fn().mockResolvedValue({
        ...mockMessage,
        content: 'Updated content',
        updatedAt: new Date()
      });
      (Message.findById as jest.Mock).mockImplementation(() => ({
        ...mockMessage,
        save: saveSpy
      }));

      await messageController.updateMessage(mockRequest as IAuthenticatedRequest, mockResponse as Response);

      expect(saveSpy).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Message updated successfully',
        data: {
          message: expect.objectContaining({ content: 'Updated content' })
        }
      });
    });

    it('should reject update without authentication', async () => {
      mockRequest.user = undefined;
      mockRequest.params = { id: 'msg123' };
      mockRequest.body = {
        content: 'Updated content'
      };

      await messageController.updateMessage(mockRequest as IAuthenticatedRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not authenticated',
        error: 'NOT_AUTHENTICATED'
      });
    });

    it('should reject update with insufficient permissions', async () => {
      const mockMessage = {
        _id: 'msg123',
        content: 'Original content',
        senderId: 'otheruser123'
      };

      mockRequest.params = { id: 'msg123' };
      mockRequest.body = {
        content: 'Updated content'
      };
      (Message.findById as jest.Mock).mockResolvedValue(mockMessage);

      await messageController.updateMessage(mockRequest as IAuthenticatedRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions to update this message',
        error: 'INSUFFICIENT_PERMISSIONS'
      });
    });

    it('should allow admin to update any message', async () => {
      const mockMessage = {
        _id: 'msg123',
        content: 'Original content',
        senderId: 'otheruser123'
      };

      mockRequest.user = {
        userId: 'admin123',
        email: 'admin@example.com',
        role: UserRole.ADMIN
      };
      mockRequest.params = { id: 'msg123' };
      mockRequest.body = {
        content: 'Admin updated content'
      };

      (Message.findById as jest.Mock).mockResolvedValue(mockMessage);

      const saveSpy = jest.fn().mockResolvedValue({
        ...mockMessage,
        content: 'Admin updated content',
        updatedAt: new Date()
      });
      (Message.findById as jest.Mock).mockImplementation(() => ({
        ...mockMessage,
        save: saveSpy
      }));

      await messageController.updateMessage(mockRequest as IAuthenticatedRequest, mockResponse as Response);

      expect(saveSpy).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });

  describe('DELETE /api/messages/:id', () => {
    it('should delete message successfully as sender', async () => {
      const mockMessage = {
        _id: 'msg123',
        content: 'Content to delete',
        senderId: '507f1f77bcf86cd799439011'
      };

      mockRequest.params = { id: 'msg123' };
      (Message.findById as jest.Mock).mockResolvedValue(mockMessage);
      (Message.findByIdAndDelete as jest.Mock).mockResolvedValue(mockMessage);

      await messageController.deleteMessage(mockRequest as IAuthenticatedRequest, mockResponse as Response);

      expect(Message.findByIdAndDelete).toHaveBeenCalledWith('msg123');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Message deleted successfully'
      });
    });

    it('should reject delete without authentication', async () => {
      mockRequest.user = undefined;
      mockRequest.params = { id: 'msg123' };

      await messageController.deleteMessage(mockRequest as IAuthenticatedRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not authenticated',
        error: 'NOT_AUTHENTICATED'
      });
    });

    it('should allow admin to delete any message', async () => {
      const mockMessage = {
        _id: 'msg123',
        content: 'Content to delete',
        senderId: 'otheruser123'
      };

      mockRequest.user = {
        userId: 'admin123',
        email: 'admin@example.com',
        role: UserRole.ADMIN
      };
      mockRequest.params = { id: 'msg123' };
      (Message.findById as jest.Mock).mockResolvedValue(mockMessage);
      (Message.findByIdAndDelete as jest.Mock).mockResolvedValue(mockMessage);

      await messageController.deleteMessage(mockRequest as IAuthenticatedRequest, mockResponse as Response);

      expect(Message.findByIdAndDelete).toHaveBeenCalledWith('msg123');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });

  describe('GET /api/messages/history', () => {
    it('should get message history successfully', async () => {
      const mockMessages = [
        { _id: 'msg1', content: 'Message 1' },
        { _id: 'msg2', content: 'Message 2' }
      ];

      const mockUserStats = [
        { _id: 'user1', username: 'user1', count: 5 },
        { _id: 'user2', username: 'user2', count: 3 }
      ];

      const mockTypeStats = [
        { _id: 'message', count: 7 },
        { _id: 'system', count: 1 }
      ];

      mockRequest.query = {
        page: '1',
        limit: '20',
        hours: '24'
      };

      (Message.getMessagesPaginated as jest.Mock).mockResolvedValue(mockMessages);
      (Message.aggregateByUser as jest.Mock).mockResolvedValue(mockUserStats);
      (Message.aggregateByType as jest.Mock).mockResolvedValue(mockTypeStats);

      await messageController.getMessageHistory(mockRequest as Request, mockResponse as Response);

      expect(Message.getMessagesPaginated).toHaveBeenCalledWith(
        {
          createdAt: { $gte: expect.any(Date) }
        },
        {
          page: 1,
          limit: 20,
          sortBy: '-createdAt'
        }
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Message history retrieved successfully',
        data: {
          messages: mockMessages,
          timeRange: {
            hours: '24',
            startDate: expect.any(Date),
            endDate: expect.any(Date)
          },
          statistics: {
            userStats: mockUserStats,
            typeStats: mockTypeStats
          }
        }
      });
    });

    it('should filter message history by userId', async () => {
      mockRequest.query = {
        userId: 'user123',
        page: '1',
        limit: '10',
        hours: '12'
      };

      (Message.getMessagesPaginated as jest.Mock).mockResolvedValue([]);
      (Message.aggregateByUser as jest.Mock).mockResolvedValue([]);
      (Message.aggregateByType as jest.Mock).mockResolvedValue([]);

      await messageController.getMessageHistory(mockRequest as Request, mockResponse as Response);

      expect(Message.getMessagesPaginated).toHaveBeenCalledWith(
        {
          createdAt: { $gte: expect.any(Date) },
          senderId: 'user123'
        },
        {
          page: 1,
          limit: 10,
          sortBy: '-createdAt'
        }
      );
    });

    it('should handle invalid parameters', async () => {
      mockRequest.query = {
        page: '0',
        limit: '101',
        hours: '169'
      };

      await messageController.getMessageHistory(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid parameters',
        error: 'INVALID_PARAMETERS'
      });
    });
  });

  describe('POST /api/messages/search', () => {
    it('should search messages successfully', async () => {
      const mockMessages = [
        { _id: 'msg1', content: 'Hello world' },
        { _id: 'msg2', content: 'Hello there' }
      ];

      mockRequest.body = {
        q: 'hello',
        page: 1,
        limit: 10
      };

      (Message.getMessagesPaginated as jest.Mock).mockResolvedValue(mockMessages);
      (Message.countDocuments as jest.Mock).mockResolvedValue(2);

      await messageController.searchMessages(mockRequest as Request, mockResponse as Response);

      expect(Message.getMessagesPaginated).toHaveBeenCalledWith(
        {
          content: { $regex: 'hello', $options: 'i' }
        },
        {
          page: 1,
          limit: 10,
          sortBy: '-createdAt'
        }
      );
      expect(Message.countDocuments).toHaveBeenCalledWith({
        content: { $regex: 'hello', $options: 'i' }
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Search completed successfully',
        data: {
          messages: mockMessages,
          searchQuery: 'hello',
          pagination: {
            page: 1,
            limit: 10,
            total: 2,
            pages: 1
          }
        }
      });
    });

    it('should reject search without query', async () => {
      mockRequest.body = {};

      await messageController.searchMessages(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Search query is required',
        error: 'MISSING_SEARCH_QUERY'
      });
    });

    it('should handle search with filters', async () => {
      mockRequest.body = {
        q: 'test',
        senderId: 'user123',
        type: 'message',
        page: '1',
        limit: '5'
      };

      (Message.getMessagesPaginated as jest.Mock).mockResolvedValue([]);
      (Message.countDocuments as jest.Mock).mockResolvedValue(0);

      await messageController.searchMessages(mockRequest as Request, mockResponse as Response);

      expect(Message.getMessagesPaginated).toHaveBeenCalledWith(
        {
          content: { $regex: 'test', $options: 'i' },
          senderId: 'user123',
          type: 'message'
        },
        {
          page: 1,
          limit: 5,
          sortBy: '-createdAt'
        }
      );
    });
  });
});