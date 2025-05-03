import { Message } from '../models/Message';
import { User, createUser } from '../models/User';

/**
 * WebSocketService - Handles all WebSocket communication
 * Following the Single Responsibility Principle, this service is only responsible
 * for WebSocket communication.
 */
export class WebSocketService {
  private socket: WebSocket | null = null;
  private messageHandlers: ((message: Message) => void)[] = [];
  private connectionHandlers: ((connected: boolean) => void)[] = [];
  private currentUser: User | null = null;
  
  /**
   * Connect to the WebSocket server
   */
  public connect(host: string, port: number): void {
    const url = `ws://${host}:${port}`;
    
    try {
      this.socket = new WebSocket(url);
      
      this.socket.onopen = () => {
        console.log(`Connected to ${url}`);
        this.notifyConnectionHandlers(true);
      };
      
      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as Message;
          
          // Handle user name assignment
          if (message.type === 'your_name') {
            this.currentUser = createUser(message.payload, true);
            console.log(`Connected as: ${message.payload}`);
          }
          
          this.notifyMessageHandlers(message);
        } catch (e) {
          console.error('Error parsing message:', e);
        }
      };
      
      this.socket.onclose = () => {
        console.log('Disconnected from server');
        this.notifyConnectionHandlers(false);
      };
      
      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.notifyConnectionHandlers(false);
      };
    } catch (error) {
      console.error('Failed to connect:', error);
      this.notifyConnectionHandlers(false);
    }
  }
  
  /**
   * Send a message to the server
   */
  public sendMessage(text: string): boolean {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(text);
      return true;
    }
    return false;
  }
  
  /**
   * Disconnect from the server
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
  
  /**
   * Add a message handler
   */
  public onMessage(handler: (message: Message) => void): void {
    this.messageHandlers.push(handler);
  }
  
  /**
   * Add a connection handler
   */
  public onConnectionChange(handler: (connected: boolean) => void): void {
    this.connectionHandlers.push(handler);
  }
  
  /**
   * Get the current user
   */
  public getCurrentUser(): User | null {
    return this.currentUser;
  }
  
  /**
   * Notify all message handlers
   */
  private notifyMessageHandlers(message: Message): void {
    this.messageHandlers.forEach(handler => handler(message));
  }
  
  /**
   * Notify all connection handlers
   */
  private notifyConnectionHandlers(connected: boolean): void {
    this.connectionHandlers.forEach(handler => handler(connected));
  }
}
