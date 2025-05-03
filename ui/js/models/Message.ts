/**
 * Represents a chat message in the system
 */
export interface Message {
  id?: string;
  type: 'message' | 'system' | 'your_name';
  sender?: string;
  payload: string;
  timestamp?: Date;
}

/**
 * Factory function to create a new message
 */
export function createMessage(
  type: 'message' | 'system' | 'your_name',
  payload: string,
  sender?: string
): Message {
  return {
    id: generateId(),
    type,
    sender,
    payload,
    timestamp: new Date()
  };
}

/**
 * Generate a unique ID for messages
 */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
