/**
 * Represents a user in the chat system
 */
export interface User {
  id?: string;
  name: string;
  isCurrentUser?: boolean;
}

/**
 * Factory function to create a new user
 */
export function createUser(name: string, isCurrentUser: boolean = false): User {
  return {
    id: generateId(),
    name,
    isCurrentUser
  };
}

/**
 * Generate a unique ID for users
 */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
