import { IJwtPayload, IUserCreateInput, UserRole, AuthProvider } from '../../types/types';

/**
 * Create a mock JWT payload for testing
 */
export const createMockJwtPayload = (overrides: Partial<IJwtPayload> = {}): IJwtPayload => ({
  userId: '507f1f77bcf86cd799439011',
  email: 'test@example.com',
  role: UserRole.USER,
  ...overrides
});

/**
 * Create mock user data for testing
 */
export const createMockUserData = (overrides: Partial<IUserCreateInput> = {}): IUserCreateInput => ({
  email: 'test@example.com',
  username: 'testuser',
  password: 'Password123!',
  role: UserRole.USER,
  authProvider: AuthProvider.EMAIL,
  ...overrides
});

/**
 * Create mock admin user data for testing
 */
export const createMockAdminData = (overrides: Partial<IUserCreateInput> = {}): IUserCreateInput => ({
  email: 'admin@example.com',
  username: 'admin',
  password: 'Admin123!',
  role: UserRole.ADMIN,
  authProvider: AuthProvider.EMAIL,
  ...overrides
});

/**
 * Create a mock WebSocket message
 */
export const createMockWebSocketMessage = (content: string, senderName: string = 'testuser') => {
  return {
    type: 'message' as const,
    content,
    senderId: '507f1f77bcf86cd799439011',
    senderName,
    timestamp: new Date(),
    messageId: '507f1f77bcf86cd799439012'
  };
};

/**
 * Wait for a specified amount of time (useful for testing async operations)
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Mock Redis client
 */
export class MockRedisClient {
  private store = new Map<string, any>();
  private sortedSets = new Map<string, Array<{score: number, value: string}>>();
  public readyState = 1; // OPEN

  // Event handling for Redis client compatibility
  private eventListeners = new Map<string, Function[]>();

  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          // Ignore errors in test environment
        }
      });
    }
  }

  async connect(): Promise<void> {
    this.emit('connect');
    this.emit('ready');
  }

  async quit(): Promise<void> {
    this.emit('end');
  }

  // Basic Redis operations
  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async setEx(key: string, seconds: number, value: string): Promise<void> {
    this.store.set(key, value);
    if (seconds > 0) {
      setTimeout(() => {
        this.store.delete(key);
      }, seconds * 1000);
    }
  }

  async set(key: string, value: string, options?: { EX?: number }): Promise<void> {
    this.store.set(key, value);
    if (options?.EX) {
      setTimeout(() => {
        this.store.delete(key);
      }, options.EX * 1000);
    }
  }

  async del(key: string): Promise<number> {
    const existed = this.store.has(key);
    this.store.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    return this.store.has(key) ? 1 : 0;
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (this.store.has(key)) {
      setTimeout(() => {
        this.store.delete(key);
      }, seconds * 1000);
    }
  }

  async incrBy(key: string, amount: number): Promise<number> {
    const current = parseInt(this.store.get(key) || '0', 10);
    const newValue = current + amount;
    this.store.set(key, newValue.toString());
    return newValue;
  }

  // Sorted set operations
  async zAdd(key: string, items: Array<{score: number, value: string}>): Promise<number> {
    if (!this.sortedSets.has(key)) {
      this.sortedSets.set(key, []);
    }
    const set = this.sortedSets.get(key)!;

    let addedCount = 0;
    for (const item of items) {
      const existingIndex = set.findIndex(i => i.value === item.value);
      if (existingIndex >= 0) {
        set[existingIndex].score = item.score;
      } else {
        set.push(item);
        addedCount++;
      }
    }

    return addedCount;
  }

  async zRangeWithScores(key: string, start: number, stop: number, options?: {REV?: boolean}): Promise<Array<{value: string, score: number}>> {
    const set = this.sortedSets.get(key) || [];
    const sorted = [...set].sort((a, b) => options?.REV ? b.score - a.score : a.score - b.score);
    const end = stop === -1 ? sorted.length : stop + 1;
    return sorted.slice(start, end);
  }

  // Pattern matching
  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.store.keys()).filter(key => regex.test(key));
  }

  // Redis info
  async info(section?: string): Promise<string> {
    return 'mock_redis_info';
  }

  async flushdb(): Promise<void> {
    this.store.clear();
    this.sortedSets.clear();
  }
}

/**
 * Mock WebSocket connection
 */
export class MockWebSocket {
  public readyState = 1; // OPEN
  public sent: any[] = [];
  private eventListeners = new Map<string, Function[]>();

  on(event: string, callback: (data?: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: (data?: any) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          // Ignore errors in test environment
        }
      });
    }
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }

  close(): void {
    this.readyState = 3; // CLOSED
    this.emit('close');
  }

  simulateMessage(data: any): void {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }

  public onmessage: ((event: { data: string }) => void) | null = null;
}