import { WebSocketService } from './services/WebSocketService';
import { ChatComponent } from './components/ChatComponent';
/**
 * Initialize the application when the DOM is loaded
 */
document.addEventListener('DOMContentLoaded', () => {
    // Create the WebSocket service
    const webSocketService = new WebSocketService();
    // Create the chat component
    const chatComponent = new ChatComponent(webSocketService, 'message-list', 'message-form', 'message-input', 'send-button', 'user-list', 'connection-status', 'connect-form', 'host-input', 'port-input', 'connect-button', 'disconnect-button');
});
