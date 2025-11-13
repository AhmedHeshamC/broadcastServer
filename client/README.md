# Broadcast Chat Client

A modern, responsive Vue.js frontend for the Broadcast Chat application.

## Features

- **Real-time Messaging**: WebSocket-based chat with instant message delivery
- **User Authentication**: Secure login, registration, and OAuth support (Google, GitHub)
- **Admin Dashboard**: User management and system administration
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Dark/Light Theme**: Professional UI with theme switching
- **TypeScript**: Full type safety throughout the application

## Technology Stack

- **Vue 3** with Composition API
- **TypeScript** for type safety
- **Vuetify** for Material Design components
- **Pinia** for state management
- **Vue Router** for navigation
- **Socket.io-client** for WebSocket communication
- **Axios** for HTTP API calls
- **Vite** for build tooling

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Backend server running on http://localhost:3000

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# API Configuration
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000

# App Configuration
VITE_APP_NAME=Broadcast Chat
VITE_APP_VERSION=1.0.0

# Development Settings
VITE_DEBUG=true
```

## Project Structure

```
src/
├── components/          # Vue components
│   ├── common/         # Shared components
│   └── layout/         # Layout components
├── views/              # Page components
│   ├── auth/           # Authentication pages
│   └── admin/          # Admin pages
├── stores/             # Pinia state management
├── services/           # API services
├── types/              # TypeScript type definitions
├── router/             # Vue Router configuration
├── plugins/            # Vue plugins (Vuetify)
└── styles/             # Global styles
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues

## Features Overview

### Authentication
- Email/password login and registration
- OAuth authentication (Google, GitHub)
- JWT token management with refresh tokens
- Protected routes and role-based access

### Chat Interface
- Real-time messaging via WebSocket
- User presence indicators
- Typing indicators
- Message history
- Responsive design

### Admin Dashboard
- User management
- System statistics
- Audit logs
- Message moderation

## Build Configuration

The project uses Vite for optimal development experience and production builds:

- **Code Splitting**: Automatic splitting of vendor chunks
- **Tree Shaking**: Eliminates unused code
- **Source Maps**: Generated for debugging
- **Asset Optimization**: Automatic optimization of images and fonts
- **Proxy Configuration**: API proxy for development

## TypeScript

This project is built with strict TypeScript mode enabled, providing:

- Full type safety
- Auto-completion
- Error detection at compile time
- Better IDE support

## Contributing

1. Follow the existing code style
2. Use TypeScript for all new code
3. Write meaningful commit messages
4. Test your changes

## License

This project is part of the Broadcast Chat application.
