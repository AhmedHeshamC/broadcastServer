import WebSocket from 'ws';
import { User } from '../../models/User';
import { UserRole, AuthProvider } from '../../types/types';
import { createMockUserData, MockWebSocket } from '../utils/testHelpers';
import { jwtService } from '../../services/JwtService';

// Mock UUID module
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 9))
}));

// Import after mocking
import { WebSocketService, IConnection, IBroadcastMessage } from '../../services/WebSocketService';

describe('WebSocketService', () => {
  let webSocketService: WebSocketService;
  let mockUser: any;
  let mockSocket: MockWebSocket;
  let validToken: string;

  beforeEach(async () => {
    // Reset singleton instance
    (WebSocketService as any).instance = undefined;
    webSocketService = WebSocketService.getInstance();

    // Create mock user
    const userData = createMockUserData();
    const userDoc = await User.createUser(userData);
    mockUser = userDoc.toSafeObject();

    // Generate valid JWT token for the user
    validToken = jwtService.generateAccessToken({
      userId: mockUser._id,
      email: mockUser.email,
      role: mockUser.role
    });

    // Create mock WebSocket
    mockSocket = new MockWebSocket();
  });

  afterEach(() => {
    // Clear all connections
    webSocketService.clearAllConnections();
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const service1 = WebSocketService.getInstance();
      const service2 = WebSocketService.getInstance();
      expect(service1).toBe(service2);
    });
  });

  describe('Connection Management', () => {
    it('should add connection successfully', async () => {
      const result = await await webSocketService.addConnection(
        mockSocket as any,
        mockUser,
        validToken,
        '192.168.1.1',
        'Test Browser'
      );

      // Debug: log the result to see what's failing
      console.log('Connection result:', result);
      console.log('Mock user:', mockUser);
      console.log('Valid token payload:', jwtService.verifyAccessToken(validToken));

      expect(result.success).toBe(true);
      expect(result.clientId).toBeDefined();
      expect(webSocketService.getConnectionCount()).toBe(1);
    });

    it('should reject connection with invalid token', async () => {
      const result = await webSocketService.addConnection(
        mockSocket as any,
        mockUser,
        'invalid-token',
        '192.168.1.1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid authentication token');
      expect(webSocketService.getConnectionCount()).toBe(0);
    });

    it('should reject connection for inactive user', async () => {
      await User.findByIdAndUpdate(mockUser._id, { isActive: false });

      const result = await webSocketService.addConnection(
        mockSocket as any,
        mockUser,
        validToken,
        '192.168.1.1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('User account is inactive or not found');
    });

    it('should limit connections per user', async () => {
      const maxConnections = 5;
      const connections = [];

      // Add maximum connections
      for (let i = 0; i < maxConnections; i++) {
        const socket = new MockWebSocket();
        const result = await webSocketService.addConnection(
          socket as any,
          mockUser,
          validToken,
          '192.168.1.1'
        );
        connections.push(result);
      }

      expect(webSocketService.getConnectionCount()).toBe(maxConnections);

      // Try to add one more
      const extraSocket = new MockWebSocket();
      const result = await webSocketService.addConnection(
        extraSocket as any,
        mockUser,
        validToken,
        '192.168.1.1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum 5 connections per user allowed');
    });

    it('should remove connection successfully', () => {
      const addResult = await webSocketService.addConnection(
        mockSocket as any,
        mockUser,
        validToken,
        '192.168.1.1'
      );

      expect(webSocketService.getConnectionCount()).toBe(1);

      webSocketService.removeConnection(addResult.clientId!);
      expect(webSocketService.getConnectionCount()).toBe(0);
    });

    it('should handle removing non-existent connection', () => {
      expect(() => {
        webSocketService.removeConnection('non-existent-id');
      }).not.toThrow();
    });
  });

  describe('Message Broadcasting', () => {
    beforeEach(() => {
      // Add a connection for message testing
      await webSocketService.addConnection(
        mockSocket as any,
        mockUser,
        validToken,
        '192.168.1.1'
      );
    });

    it('should broadcast message to all clients', () => {
      const message: IBroadcastMessage = {
        type: 'message',
        content: 'Hello, World!',
        senderId: mockUser._id,
        senderName: mockUser.username,
        timestamp: new Date()
      };

      expect(() => {
        webSocketService.broadcastMessage(message);
      }).not.toThrow();
    });

    it('should broadcast system message', () => {
      expect(() => {
        webSocketService.broadcastSystemMessage('System announcement');
      }).not.toThrow();
    });

    it('should broadcast user join notification', () => {
      expect(() => {
        webSocketService.broadcastUserJoin(mockUser.username, mockUser._id);
      }).not.toThrow();
    });

    it('should broadcast user leave notification', () => {
      expect(() => {
        webSocketService.broadcastUserLeave(mockUser.username, mockUser._id);
      }).not.toThrow();
    });

    it('should exclude specific user from broadcast', async () => {
      // Add another user with different data to avoid duplicates
      const otherUserData = createMockUserData({
        email: 'other@example.com',
        username: 'otheruser'
      });
      const otherUser = await User.createUser(otherUserData);
      const otherSocket = new MockWebSocket();

      // Generate token for other user
      const otherToken = jwtService.generateAccessToken({
        userId: (otherUser._id as any).toString(),
        email: otherUser.email,
        role: otherUser.role
      });

      await webSocketService.addConnection(
        otherSocket as any,
        otherUser.toSafeObject(),
        otherToken,
        '192.168.1.2'
      );

      const message: IBroadcastMessage = {
        type: 'message',
        content: 'Private message',
        senderId: mockUser._id,
        senderName: mockUser.username,
        timestamp: new Date()
      };

      expect(() => {
        webSocketService.broadcastMessage(message, (otherUser._id as any).toString());
      }).not.toThrow();
    });

    it('should reject invalid message format', () => {
      const invalidMessage = {
        type: 'invalid_type',
        content: 'This should fail'
      } as any;

      expect(() => {
        webSocketService.broadcastMessage(invalidMessage);
      }).not.toThrow(); // Should handle gracefully, not throw
    });
  });

  describe('User Management', () => {
    it('should get connected users', () => {
      await webSocketService.addConnection(
        mockSocket as any,
        mockUser,
        validToken,
        '192.168.1.1'
      );

      const connectedUsers = webSocketService.getConnectedUsers();
      expect(connectedUsers).toHaveLength(1);
      expect(connectedUsers[0].userId).toBe(mockUser._id);
      expect(connectedUsers[0].username).toBe(mockUser.username);
      expect(connectedUsers[0].role).toBe(mockUser.role);
    });

    it('should get unique users only', () => {
      // Add multiple connections for same user
      const socket1 = new MockWebSocket();
      const socket2 = new MockWebSocket();

      await webSocketService.addConnection(socket1 as any, mockUser, validToken, '192.168.1.1');
      await webSocketService.addConnection(socket2 as any, mockUser, validToken, '192.168.1.2');

      const connectedUsers = webSocketService.getConnectedUsers();
      expect(connectedUsers).toHaveLength(1); // Should be unique users only
    });

    it('should get user connections', () => {
      const result = await webSocketService.addConnection(
        mockSocket as any,
        mockUser,
        validToken,
        '192.168.1.1'
      );

      const userConnections = webSocketService.getUserConnections(mockUser._id);
      expect(userConnections).toHaveLength(1);
      expect(userConnections[0].clientId).toBe(result.clientId);
    });

    it('should return empty array for user with no connections', () => {
      const userConnections = webSocketService.getUserConnections('507f1f77bcf86cd799439999');
      expect(userConnections).toHaveLength(0);
    });
  });

  describe('Statistics', () => {
    it('should get connection count', () => {
      expect(webSocketService.getConnectionCount()).toBe(0);

      await webSocketService.addConnection(
        mockSocket as any,
        mockUser,
        validToken,
        '192.168.1.1'
      );

      expect(webSocketService.getConnectionCount()).toBe(1);
    });

    it('should get connection statistics', () => {
      await webSocketService.addConnection(
        mockSocket as any,
        mockUser,
        validToken,
        '192.168.1.1'
      );

      const stats = webSocketService.getConnectionStats();
      expect(stats.activeConnections).toBe(1);
      expect(stats.uniqueUsers).toBe(1);
      expect(stats.connectionsByRole[mockUser.role]).toBe(1);
      expect(stats.totalConnections).toBeGreaterThan(0);
    });

    it('should get message statistics', () => {
      const stats = webSocketService.getMessageStats();
      expect(stats).toHaveProperty('messagesSent');
      expect(stats).toHaveProperty('messagesReceived');
      expect(stats).toHaveProperty('connectionsOpened');
      expect(stats).toHaveProperty('connectionsClosed');
      expect(typeof stats.messagesSent).toBe('number');
    });
  });

  describe('Message Validation and Sanitization', () => {
    beforeEach(() => {
      await webSocketService.addConnection(
        mockSocket as any,
        mockUser,
        validToken,
        '192.168.1.1'
      );
    });

    it('should sanitize message content', () => {
      const message: IBroadcastMessage = {
        type: 'message',
        content: '<script>alert("xss")</script>',
        senderId: mockUser._id,
        senderName: mockUser.username,
        timestamp: new Date()
      };

      // Mock socket send method to capture the message
      let sentMessage: string = '';
      (mockSocket.send as any) = (data: string) => {
        sentMessage = data;
      };

      webSocketService.broadcastMessage(message);

      const parsedMessage = JSON.parse(sentMessage);
      expect(parsedMessage.content).not.toContain('<script>');
      expect(parsedMessage.content).toContain('&lt;script&gt;');
    });

    it('should handle empty message content', () => {
      const message: IBroadcastMessage = {
        type: 'message',
        content: '',
        senderId: mockUser._id,
        senderName: mockUser.username,
        timestamp: new Date()
      };

      expect(() => {
        webSocketService.broadcastMessage(message);
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle socket send errors gracefully', () => {
      await webSocketService.addConnection(
        mockSocket as any,
        mockUser,
        validToken,
        '192.168.1.1'
      );

      // Make socket send method throw error
      (mockSocket.send as any) = () => {
        throw new Error('Socket error');
      };

      const message: IBroadcastMessage = {
        type: 'message',
        content: 'Test message',
        senderId: mockUser._id,
        senderName: mockUser.username,
        timestamp: new Date()
      };

      expect(() => {
        webSocketService.broadcastMessage(message);
      }).not.toThrow();

      // Connection should be removed due to error
      expect(webSocketService.getConnectionCount()).toBe(0);
    });

    it('should handle malformed incoming messages', () => {
      await webSocketService.addConnection(
        mockSocket as any,
        mockUser,
        validToken,
        '192.168.1.1'
      );

      // Simulate receiving malformed JSON
      expect(() => {
        mockSocket.emit('message', '{ invalid json }');
      }).not.toThrow();
    });

    it('should handle connection cleanup on errors', () => {
      const result = await webSocketService.addConnection(
        mockSocket as any,
        mockUser,
        validToken,
        '192.168.1.1'
      );

      expect(webSocketService.getConnectionCount()).toBe(1);

      // Simulate socket error
      mockSocket.emit('error', new Error('Connection error'));

      expect(webSocketService.getConnectionCount()).toBe(0);
    });
  });

  describe('Connection Cleanup', () => {
    it('should clear all connections', () => {
      // Add multiple connections
      const socket1 = new MockWebSocket();
      const socket2 = new MockWebSocket();

      await webSocketService.addConnection(socket1 as any, mockUser, validToken, '192.168.1.1');
      await webSocketService.addConnection(socket2 as any, mockUser, validToken, '192.168.1.2');

      expect(webSocketService.getConnectionCount()).toBe(2);

      webSocketService.clearAllConnections();
      expect(webSocketService.getConnectionCount()).toBe(0);
    });
  });
});