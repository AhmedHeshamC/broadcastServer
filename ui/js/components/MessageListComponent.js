/**
 * MessageListComponent - Responsible for displaying messages
 * Following the Single Responsibility Principle, this component is only responsible
 * for displaying messages.
 */
export class MessageListComponent {
    constructor(containerId) {
        this.messages = [];
        const element = document.getElementById(containerId);
        if (!element) {
            throw new Error(`Element with ID ${containerId} not found`);
        }
        this.container = element;
    }
    /**
     * Add a message to the list
     */
    addMessage(message) {
        this.messages.push(message);
        this.render();
    }
    /**
     * Clear all messages
     */
    clearMessages() {
        this.messages = [];
        this.render();
    }
    /**
     * Render the message list
     */
    render() {
        // Clear the container
        this.container.innerHTML = '';
        // Create a document fragment for better performance
        const fragment = document.createDocumentFragment();
        // Add each message to the fragment
        this.messages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.className = `message message-${message.type}`;
            // Format the message based on its type
            let content = '';
            if (message.type === 'system') {
                content = `<div class="system-message">${message.payload}</div>`;
            }
            else if (message.type === 'message') {
                content = `
          <div class="message-header">
            <span class="message-sender">${message.sender || 'Unknown'}</span>
            <span class="message-time">${this.formatTime(message.timestamp)}</span>
          </div>
          <div class="message-content">${this.escapeHtml(message.payload)}</div>
        `;
            }
            messageElement.innerHTML = content;
            fragment.appendChild(messageElement);
        });
        // Add the fragment to the container
        this.container.appendChild(fragment);
        // Scroll to the bottom
        this.container.scrollTop = this.container.scrollHeight;
    }
    /**
     * Format a timestamp
     */
    formatTime(timestamp) {
        if (!timestamp)
            return '';
        return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }
}
