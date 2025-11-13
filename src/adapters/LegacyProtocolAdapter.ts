import { IBroadcastMessage } from '../services/WebSocketService';

/**
 * Legacy CLI protocol message formats
 */
export interface ILegacyMessage {
  type: 'your_name' | 'message' | 'system';
  payload?: string;
  sender?: string;
  content?: string;
}

/**
 * Adapter to bridge legacy CLI protocol with enterprise message format
 * Follows Adapter pattern for seamless integration
 * SOLID: Single Responsibility - only handles protocol conversion
 * KISS: Simple, direct conversion methods
 */
export class LegacyProtocolAdapter {
  /**
   * Convert legacy CLI message to enterprise broadcast message format
   */
  public convertToEnterpriseMessage(legacyMessage: ILegacyMessage, senderId?: string): IBroadcastMessage {
    switch (legacyMessage.type) {
      case 'message':
        return this.convertChatMessage(legacyMessage, senderId);
      case 'system':
        return this.convertSystemMessage(legacyMessage);
      case 'your_name':
        return this.convertNameMessage(legacyMessage);
      default:
        throw new Error(`Unknown legacy message type: ${(legacyMessage as any).type}`);
    }
  }

  /**
   * Convert enterprise message to legacy CLI format
   */
  public convertToLegacyMessage(enterpriseMessage: IBroadcastMessage): ILegacyMessage {
    switch (enterpriseMessage.type) {
      case 'message':
        return {
          type: 'message',
          content: enterpriseMessage.content
        };
      case 'system':
      case 'user_joined':
      case 'user_left':
        return {
          type: 'system',
          payload: enterpriseMessage.content
        };
      default:
        throw new Error(`Cannot convert enterprise message type: ${enterpriseMessage.type}`);
    }
  }

  /**
   * Create welcome message with assigned username
   */
  public createWelcomeMessage(userName: string): ILegacyMessage {
    return {
      type: 'your_name',
      payload: userName
    };
  }

  /**
   * Create user joined notification
   */
  public createUserJoinedMessage(userName: string): ILegacyMessage {
    return {
      type: 'system',
      payload: `${userName} joined the chat`
    };
  }

  /**
   * Create user left notification
   */
  public createUserLeftMessage(userName: string): ILegacyMessage {
    return {
      type: 'system',
      payload: `${userName} left the chat`
    };
  }

  /**
   * Validate legacy message format
   */
  public validateLegacyMessage(message: any): message is ILegacyMessage {
    return (
      message !== null &&
      message !== undefined &&
      typeof message === 'object' &&
      typeof message.type === 'string' &&
      ['your_name', 'message', 'system'].includes(message.type)
    );
  }

  private convertChatMessage(legacyMessage: ILegacyMessage, senderId?: string): IBroadcastMessage {
    const content = legacyMessage.content || legacyMessage.payload || '';
    if (!content.trim()) {
      throw new Error('Message content cannot be empty');
    }

    return {
      messageId: this.generateMessageId(),
      type: 'message',
      content: content.trim(),
      senderId: senderId || 'cli-user',
      senderName: 'CLI User',
      timestamp: new Date()
    };
  }

  private convertSystemMessage(legacyMessage: ILegacyMessage): IBroadcastMessage {
    const payload = legacyMessage.payload || '';
    if (!payload.trim()) {
      throw new Error('System message payload cannot be empty');
    }

    return {
      messageId: this.generateMessageId(),
      type: 'system',
      content: payload.trim(),
      senderId: 'system',
      senderName: 'System',
      timestamp: new Date()
    };
  }

  private convertNameMessage(legacyMessage: ILegacyMessage): IBroadcastMessage {
    const payload = legacyMessage.payload || '';
    if (!payload.trim()) {
      throw new Error('Name payload cannot be empty');
    }

    return {
      messageId: this.generateMessageId(),
      type: 'user_joined',
      content: `${payload} joined the chat`,
      senderId: 'system',
      senderName: 'System',
      timestamp: new Date()
    };
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}