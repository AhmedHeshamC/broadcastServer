import { MessageListComponent } from './MessageListComponent';
import { MessageInputComponent } from './MessageInputComponent';
import { UserListComponent } from './UserListComponent';
import { createMessage } from '../models/Message';
import { createUser } from '../models/User';
/**
 * ChatComponent - Main component that orchestrates the chat functionality
 * This component follows the Dependency Inversion Principle by depending on abstractions
 * rather than concrete implementations.
 */
export class ChatComponent {
    constructor(webSocketService, messageListId, messageFormId, messageInputId, sendButtonId, userListId, connectionStatusId, connectFormId, hostInputId, portInputId, connectButtonId, disconnectButtonId) {
        this.users = new Map();
        // Initialize services and components
        this.webSocketService = webSocketService;
        this.messageList = new MessageListComponent(messageListId);
        this.messageInput = new MessageInputComponent(messageFormId, messageInputId, sendButtonId);
        this.userList = new UserListComponent(userListId);
        // Get connection elements
        const statusElement = document.getElementById(connectionStatusId);
        if (!statusElement) {
            throw new Error(`Element with ID ${connectionStatusId} not found`);
        }
        this.connectionStatus = statusElement;
        const connectFormElement = document.getElementById(connectFormId);
        if (!connectFormElement || !(connectFormElement instanceof HTMLFormElement)) {
            throw new Error(`Form with ID ${connectFormId} not found`);
        }
        this.connectForm = connectFormElement;
        const hostInputElement = document.getElementById(hostInputId);
        if (!hostInputElement || !(hostInputElement instanceof HTMLInputElement)) {
            throw new Error(`Input with ID ${hostInputId} not found`);
        }
        this.hostInput = hostInputElement;
        const portInputElement = document.getElementById(portInputId);
        if (!portInputElement || !(portInputElement instanceof HTMLInputElement)) {
            throw new Error(`Input with ID ${portInputId} not found`);
        }
        this.portInput = portInputElement;
        const connectButtonElement = document.getElementById(connectButtonId);
        if (!connectButtonElement || !(connectButtonElement instanceof HTMLButtonElement)) {
            throw new Error(`Button with ID ${connectButtonId} not found`);
        }
        this.connectButton = connectButtonElement;
        const disconnectButtonElement = document.getElementById(disconnectButtonId);
        if (!disconnectButtonElement || !(disconnectButtonElement instanceof HTMLButtonElement)) {
            throw new Error(`Button with ID ${disconnectButtonId} not found`);
        }
        this.disconnectButton = disconnectButtonElement;
        // Set up event handlers
        this.setupEventHandlers();
    }
    /**
     * Set up event handlers
     */
    setupEventHandlers() {
        // Handle message sending
        this.messageInput.onSend((message) => {
            this.sendMessage(message);
        });
        // Handle WebSocket messages
        this.webSocketService.onMessage((message) => {
            this.handleMessage(message);
        });
        // Handle connection changes
        this.webSocketService.onConnectionChange((connected) => {
            this.updateConnectionStatus(connected);
        });
        // Handle connect form submission
        this.connectForm.addEventListener('submit', (event) => {
            event.preventDefault();
            this.connect();
        });
        // Handle connect button click
        this.connectButton.addEventListener('click', () => {
            this.connect();
        });
        // Handle disconnect button click
        this.disconnectButton.addEventListener('click', () => {
            this.disconnect();
        });
    }
    /**
     * Connect to the WebSocket server
     */
    connect() {
        const host = this.hostInput.value.trim() || 'localhost';
        const portStr = this.portInput.value.trim() || '8080';
        const port = parseInt(portStr, 10);
        if (isNaN(port)) {
            alert('Please enter a valid port number');
            return;
        }
        // Clear previous messages and users
        this.messageList.clearMessages();
        this.userList.clearUsers();
        this.users.clear();
        // Connect to the server
        this.webSocketService.connect(host, port);
    }
    /**
     * Disconnect from the WebSocket server
     */
    disconnect() {
        this.webSocketService.disconnect();
    }
    /**
     * Send a message
     */
    sendMessage(text) {
        if (this.webSocketService.sendMessage(text)) {
            // Add the message to the list (for the current user)
            const currentUser = this.webSocketService.getCurrentUser();
            if (currentUser) {
                const message = createMessage('message', text, currentUser.name);
                this.messageList.addMessage(message);
            }
        }
    }
    /**
     * Handle an incoming message
     */
    handleMessage(message) {
        // Add the message to the list
        this.messageList.addMessage(message);
        // Update the user list if it's a system message about a user joining or leaving
        if (message.type === 'system') {
            this.handleSystemMessage(message);
        }
        else if (message.type === 'your_name') {
            const currentUser = this.webSocketService.getCurrentUser();
            if (currentUser) {
                this.users.set(currentUser.name, currentUser);
                this.userList.addUser(currentUser);
            }
        }
        else if (message.type === 'message' && message.sender) {
            // Ensure the sender is in the user list
            if (!this.users.has(message.sender)) {
                const user = createUser(message.sender);
                this.users.set(message.sender, user);
                this.userList.addUser(user);
            }
        }
    }
    /**
     * Handle a system message
     */
    handleSystemMessage(message) {
        const joinRegex = /^(.+) has joined\.$/;
        const leaveRegex = /^(.+) has left(?: due to an error)?\.$/;
        const joinMatch = message.payload.match(joinRegex);
        if (joinMatch) {
            const userName = joinMatch[1];
            const user = createUser(userName);
            this.users.set(userName, user);
            this.userList.addUser(user);
            return;
        }
        const leaveMatch = message.payload.match(leaveRegex);
        if (leaveMatch) {
            const userName = leaveMatch[1];
            this.users.delete(userName);
            this.userList.removeUser(userName);
            return;
        }
    }
    /**
     * Update the connection status
     */
    updateConnectionStatus(connected) {
        if (connected) {
            this.connectionStatus.textContent = 'Connected';
            this.connectionStatus.className = 'connected';
            this.messageInput.setEnabled(true);
            this.connectButton.disabled = true;
            this.disconnectButton.disabled = false;
        }
        else {
            this.connectionStatus.textContent = 'Disconnected';
            this.connectionStatus.className = 'disconnected';
            this.messageInput.setEnabled(false);
            this.connectButton.disabled = false;
            this.disconnectButton.disabled = true;
        }
    }
}
