import { createUser } from '../models/User';
/**
 * WebSocketService - Handles all WebSocket communication
 * Following the Single Responsibility Principle, this service is only responsible
 * for WebSocket communication.
 */
export class WebSocketService {
    constructor() {
        this.socket = null;
        this.messageHandlers = [];
        this.connectionHandlers = [];
        this.currentUser = null;
    }
    /**
     * Connect to the WebSocket server
     */
    connect(host, port) {
        const url = `ws://${host}:${port}`;
        try {
            this.socket = new WebSocket(url);
            this.socket.onopen = () => {
                console.log(`Connected to ${url}`);
                this.notifyConnectionHandlers(true);
            };
            this.socket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    // Handle user name assignment
                    if (message.type === 'your_name') {
                        this.currentUser = createUser(message.payload, true);
                        console.log(`Connected as: ${message.payload}`);
                    }
                    this.notifyMessageHandlers(message);
                }
                catch (e) {
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
        }
        catch (error) {
            console.error('Failed to connect:', error);
            this.notifyConnectionHandlers(false);
        }
    }
    /**
     * Send a message to the server
     */
    sendMessage(text) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(text);
            return true;
        }
        return false;
    }
    /**
     * Disconnect from the server
     */
    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
    /**
     * Add a message handler
     */
    onMessage(handler) {
        this.messageHandlers.push(handler);
    }
    /**
     * Add a connection handler
     */
    onConnectionChange(handler) {
        this.connectionHandlers.push(handler);
    }
    /**
     * Get the current user
     */
    getCurrentUser() {
        return this.currentUser;
    }
    /**
     * Notify all message handlers
     */
    notifyMessageHandlers(message) {
        this.messageHandlers.forEach(handler => handler(message));
    }
    /**
     * Notify all connection handlers
     */
    notifyConnectionHandlers(connected) {
        this.connectionHandlers.forEach(handler => handler(connected));
    }
}
