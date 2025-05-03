import { Message } from '../models/Message';

/**
 * MessageListComponent - Responsible for displaying messages
 * Following the Single Responsibility Principle, this component is only responsible
 * for displaying messages.
 */
export class MessageListComponent {
  private container: HTMLElement;
  private messages: Message[] = [];
  
  constructor(containerId: string) {
    const element = document.getElementById(containerId);
    if (!element) {
      throw new Error(`Element with ID ${containerId} not found`);
    }
    this.container = element;
  }
  
  /**
   * Add a message to the list
   */
  public addMessage(message: Message): void {
    this.messages.push(message);
    this.render();
  }
  
  /**
   * Clear all messages
   */
  public clearMessages(): void {
    this.messages = [];
    this.render();
  }
  
  /**
   * Render the message list
   */
  private render(): void {
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
      } else if (message.type === 'message') {
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
  private formatTime(timestamp?: Date): string {
    if (!timestamp) return '';
    
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(html: string): string {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }
}
