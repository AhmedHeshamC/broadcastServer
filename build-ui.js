const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Path to the UI directory
const uiDir = path.join(__dirname, 'ui');

// Compile TypeScript files
console.log('Compiling TypeScript files...');
exec('npx tsc --project ui/tsconfig.json', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error compiling TypeScript: ${error.message}`);
    return;
  }

  if (stderr) {
    console.error(`TypeScript compilation stderr: ${stderr}`);
    return;
  }

  console.log('TypeScript compilation successful');

  // Now, let's create a browser-compatible bundle
  console.log('Creating browser-compatible bundle...');

  // Create a self-executing function wrapper for our code
  const bundleContent = `(function() {
    // Message model
    class Message {
      constructor(type, payload, sender) {
        this.id = generateId();
        this.type = type;
        this.sender = sender;
        this.payload = payload;
        this.timestamp = new Date();
      }
    }

    function generateId() {
      return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    function createMessage(type, payload, sender) {
      return new Message(type, payload, sender);
    }

    // User model
    class User {
      constructor(name, isCurrentUser = false) {
        this.id = generateId();
        this.name = name;
        this.isCurrentUser = isCurrentUser;
      }
    }

    function createUser(name, isCurrentUser = false) {
      return new User(name, isCurrentUser);
    }

    // WebSocketService
    class WebSocketService {
      constructor() {
        this.socket = null;
        this.messageHandlers = [];
        this.connectionHandlers = [];
        this.currentUser = null;
      }

      connect(host, port) {
        const url = \`ws://\${host}:\${port}\`;

        try {
          this.socket = new WebSocket(url);

          this.socket.onopen = () => {
            console.log(\`Connected to \${url}\`);
            this.notifyConnectionHandlers(true);
          };

          this.socket.onmessage = (event) => {
            try {
              const message = JSON.parse(event.data);

              // Handle user name assignment
              if (message.type === 'your_name') {
                this.currentUser = createUser(message.payload, true);
                console.log(\`Connected as: \${message.payload}\`);
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

      sendMessage(text) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(text);
          return true;
        }
        return false;
      }

      disconnect() {
        if (this.socket) {
          this.socket.close();
          this.socket = null;
        }
      }

      onMessage(handler) {
        this.messageHandlers.push(handler);
      }

      onConnectionChange(handler) {
        this.connectionHandlers.push(handler);
      }

      getCurrentUser() {
        return this.currentUser;
      }

      notifyMessageHandlers(message) {
        this.messageHandlers.forEach(handler => handler(message));
      }

      notifyConnectionHandlers(connected) {
        this.connectionHandlers.forEach(handler => handler(connected));
      }
    }

    // MessageListComponent
    class MessageListComponent {
      constructor(containerId) {
        const element = document.getElementById(containerId);
        if (!element) {
          throw new Error(\`Element with ID \${containerId} not found\`);
        }
        this.container = element;
        this.messages = [];
      }

      addMessage(message) {
        this.messages.push(message);
        this.render();
      }

      clearMessages() {
        this.messages = [];
        this.render();
      }

      render() {
        // Clear the container
        this.container.innerHTML = '';

        // Create a document fragment for better performance
        const fragment = document.createDocumentFragment();

        // Add each message to the fragment
        this.messages.forEach(message => {
          const messageElement = document.createElement('div');
          messageElement.className = \`message message-\${message.type}\`;

          // Format the message based on its type
          let content = '';
          if (message.type === 'system') {
            content = \`<div class="system-message">\${message.payload}</div>\`;
          } else if (message.type === 'message') {
            content = \`
              <div class="message-header">
                <span class="message-sender">\${message.sender || 'Unknown'}</span>
                <span class="message-time">\${this.formatTime(message.timestamp)}</span>
              </div>
              <div class="message-content">\${this.escapeHtml(message.payload)}</div>
            \`;
          }

          messageElement.innerHTML = content;
          fragment.appendChild(messageElement);
        });

        // Add the fragment to the container
        this.container.appendChild(fragment);

        // Scroll to the bottom
        this.container.scrollTop = this.container.scrollHeight;
      }

      formatTime(timestamp) {
        if (!timestamp) return '';

        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      escapeHtml(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
      }
    }

    // MessageInputComponent
    class MessageInputComponent {
      constructor(formId, inputId, buttonId) {
        // Get the form element
        const formElement = document.getElementById(formId);
        if (!formElement || !(formElement instanceof HTMLFormElement)) {
          throw new Error(\`Form with ID \${formId} not found\`);
        }
        this.form = formElement;

        // Get the input element
        const inputElement = document.getElementById(inputId);
        if (!inputElement || !(inputElement instanceof HTMLInputElement)) {
          throw new Error(\`Input with ID \${inputId} not found\`);
        }
        this.input = inputElement;

        // Get the button element
        const buttonElement = document.getElementById(buttonId);
        if (!buttonElement || !(buttonElement instanceof HTMLButtonElement)) {
          throw new Error(\`Button with ID \${buttonId} not found\`);
        }
        this.submitButton = buttonElement;

        this.sendHandlers = [];

        // Set up event listeners
        this.setupEventListeners();
      }

      setupEventListeners() {
        // Handle form submission
        this.form.addEventListener('submit', (event) => {
          event.preventDefault();
          this.sendMessage();
        });

        // Handle button click
        this.submitButton.addEventListener('click', () => {
          this.sendMessage();
        });

        // Handle Enter key
        this.input.addEventListener('keypress', (event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
          }
        });
      }

      sendMessage() {
        const message = this.input.value.trim();
        if (message) {
          this.notifySendHandlers(message);
          this.input.value = '';
        }

        // Focus the input field
        this.input.focus();
      }

      onSend(handler) {
        this.sendHandlers.push(handler);
      }

      notifySendHandlers(message) {
        this.sendHandlers.forEach(handler => handler(message));
      }

      setEnabled(enabled) {
        this.input.disabled = !enabled;
        this.submitButton.disabled = !enabled;
      }
    }

    // UserListComponent
    class UserListComponent {
      constructor(containerId) {
        const element = document.getElementById(containerId);
        if (!element) {
          throw new Error(\`Element with ID \${containerId} not found\`);
        }
        this.container = element;
        this.users = new Map();
      }

      addUser(user) {
        if (user.name) {
          this.users.set(user.name, user);
          this.render();
        }
      }

      removeUser(userName) {
        if (this.users.has(userName)) {
          this.users.delete(userName);
          this.render();
        }
      }

      clearUsers() {
        this.users.clear();
        this.render();
      }

      render() {
        // Clear the container
        this.container.innerHTML = '';

        // Create a document fragment for better performance
        const fragment = document.createDocumentFragment();

        // Create the header
        const header = document.createElement('div');
        header.className = 'user-list-header';
        header.textContent = 'Online Users';
        fragment.appendChild(header);

        // Create the list
        const list = document.createElement('ul');
        list.className = 'user-list';

        // Add each user to the list
        Array.from(this.users.values()).forEach(user => {
          const userElement = document.createElement('li');
          userElement.className = 'user-item';
          if (user.isCurrentUser) {
            userElement.classList.add('current-user');
          }

          userElement.textContent = user.name;
          list.appendChild(userElement);
        });

        fragment.appendChild(list);

        // Add the fragment to the container
        this.container.appendChild(fragment);
      }
    }

    // ChatComponent
    class ChatComponent {
      constructor(
        webSocketService,
        messageListId,
        messageFormId,
        messageInputId,
        sendButtonId,
        userListId,
        connectionStatusId,
        connectFormId,
        hostInputId,
        portInputId,
        connectButtonId,
        disconnectButtonId
      ) {
        // Initialize services and components
        this.webSocketService = webSocketService;
        this.messageList = new MessageListComponent(messageListId);
        this.messageInput = new MessageInputComponent(messageFormId, messageInputId, sendButtonId);
        this.userList = new UserListComponent(userListId);

        // Get connection elements
        const statusElement = document.getElementById(connectionStatusId);
        if (!statusElement) {
          throw new Error(\`Element with ID \${connectionStatusId} not found\`);
        }
        this.connectionStatus = statusElement;

        const connectFormElement = document.getElementById(connectFormId);
        if (!connectFormElement || !(connectFormElement instanceof HTMLFormElement)) {
          throw new Error(\`Form with ID \${connectFormId} not found\`);
        }
        this.connectForm = connectFormElement;

        const hostInputElement = document.getElementById(hostInputId);
        if (!hostInputElement || !(hostInputElement instanceof HTMLInputElement)) {
          throw new Error(\`Input with ID \${hostInputId} not found\`);
        }
        this.hostInput = hostInputElement;

        const portInputElement = document.getElementById(portInputId);
        if (!portInputElement || !(portInputElement instanceof HTMLInputElement)) {
          throw new Error(\`Input with ID \${portInputId} not found\`);
        }
        this.portInput = portInputElement;

        const connectButtonElement = document.getElementById(connectButtonId);
        if (!connectButtonElement || !(connectButtonElement instanceof HTMLButtonElement)) {
          throw new Error(\`Button with ID \${connectButtonId} not found\`);
        }
        this.connectButton = connectButtonElement;

        const disconnectButtonElement = document.getElementById(disconnectButtonId);
        if (!disconnectButtonElement || !(disconnectButtonElement instanceof HTMLButtonElement)) {
          throw new Error(\`Button with ID \${disconnectButtonId} not found\`);
        }
        this.disconnectButton = disconnectButtonElement;

        this.users = new Map();

        // Set up event handlers
        this.setupEventHandlers();
      }

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

      disconnect() {
        this.webSocketService.disconnect();
      }

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

      handleMessage(message) {
        // Add the message to the list
        this.messageList.addMessage(message);

        // Update the user list if it's a system message about a user joining or leaving
        if (message.type === 'system') {
          this.handleSystemMessage(message);
        } else if (message.type === 'your_name') {
          const currentUser = this.webSocketService.getCurrentUser();
          if (currentUser) {
            this.users.set(currentUser.name, currentUser);
            this.userList.addUser(currentUser);
          }
        } else if (message.type === 'message' && message.sender) {
          // Ensure the sender is in the user list
          if (!this.users.has(message.sender)) {
            const user = createUser(message.sender);
            this.users.set(message.sender, user);
            this.userList.addUser(user);
          }
        }
      }

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

      updateConnectionStatus(connected) {
        if (connected) {
          this.connectionStatus.textContent = 'Connected';
          this.connectionStatus.className = 'connection-status connected';
          this.messageInput.setEnabled(true);
          this.connectButton.disabled = true;
          this.disconnectButton.disabled = false;
        } else {
          this.connectionStatus.textContent = 'Disconnected';
          this.connectionStatus.className = 'connection-status disconnected';
          this.messageInput.setEnabled(false);
          this.connectButton.disabled = false;
          this.disconnectButton.disabled = true;
        }
      }
    }

    // Initialize the application when the DOM is loaded
    document.addEventListener('DOMContentLoaded', () => {
      // Create the WebSocket service
      const webSocketService = new WebSocketService();

      // Create the chat component
      const chatComponent = new ChatComponent(
        webSocketService,
        'message-list',
        'message-form',
        'message-input',
        'send-button',
        'user-list',
        'connection-status',
        'connect-form',
        'host-input',
        'port-input',
        'connect-button',
        'disconnect-button'
      );
    });
  })();`;

  // Write the bundle to a file
  const bundlePath = path.join(uiDir, 'js', 'bundle.js');
  fs.writeFileSync(bundlePath, bundleContent);

  console.log(`Bundle created at ${bundlePath}`);
  console.log('Build completed successfully');
});
