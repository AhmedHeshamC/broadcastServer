# Broadcast Chat - Enterprise Real-time Messaging Platform

A comprehensive, secure, and scalable real-time messaging application built with enterprise-grade security features and professional UI.

## 🌟 Features

### 🔐 Security & Authentication
- **JWT-based Authentication** with refresh tokens
- **OAuth Integration** (Google, GitHub)
- **Role-based Access Control** (User/Admin)
- **Input Validation & Sanitization**
- **Rate Limiting** (connections, messages, logins)
- **Comprehensive Audit Logging**
- **Password Security** (hashing, strength requirements)

### 💬 Real-time Communication
- **WebSocket-based Messaging** with Socket.io
- **Live User Presence** indicators
- **Typing Indicators**
- **Message History** with pagination
- **User Management** with online status
- **Cross-platform Compatibility**

### 🎨 Professional UI/UX
- **Modern Vue.js Frontend** with TypeScript
- **Responsive Design** (mobile-first approach)
- **Material Design** components (Vuetify)
- **Dark/Light Theme** switching
- **Real-time Updates** without page refresh
- **Intuitive Navigation** and user experience

### 🛠️ Technical Excellence
- **TypeScript Strict Mode** throughout
- **SOLID Principles** and KISS methodology
- **Microservice Architecture** ready
- **Containerized Deployment** with Docker
- **Production-ready** with health checks
- **Zero-downtime Deployments**

### 📊 Admin & Management
- **Admin Dashboard** with system statistics
- **User Management** (ban/unban, role changes)
- **Audit Log Viewing** with filtering
- **System Monitoring** and health checks
- **Message Moderation** capabilities

## 🏗️ Architecture

### Backend (Node.js/TypeScript)
- **Express.js** REST API
- **Socket.io** WebSocket server
- **MongoDB** with Mongoose ODM
- **Redis** for session management & caching
- **JWT** for authentication
- **Winston** for structured logging
- **Comprehensive middleware** for security

### Frontend (Vue.js/TypeScript)
- **Vue 3** with Composition API
- **Pinia** for state management
- **Vue Router** for navigation
- **Vuetify** for UI components
- **Socket.io-client** for real-time updates
- **Axios** for API communication
- **Vite** for development and building

### Infrastructure
- **Docker** multi-stage builds
- **Nginx** reverse proxy
- **MongoDB** replica set ready
- **Redis** cluster ready
- **Let's Encrypt** SSL support
- **Health monitoring** and alerting

## 🚀 Quick Start

### Using Docker (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd broadcastServer

# Initial setup
./docker-setup.sh setup

# Start development environment
./docker-setup.sh dev

# Or start production environment
./docker-setup.sh prod
```

### Manual Installation

#### Prerequisites
- Node.js 18+
- MongoDB 6.0+
- Redis 7.0+
- npm/yarn

#### Backend Setup
```bash
# Navigate to project directory
cd broadcastServer

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev

# Build for production
npm run build
npm start
```

#### Frontend Setup
```bash
# Navigate to client directory
cd client

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev

# Build for production
npm run build
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Application
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:5173

# Database
MONGODB_URI=mongodb://localhost:27017/broadcast-chat
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_ACCESS_SECRET=your-super-secret-access-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Security
MAX_CONNECTIONS_PER_USER=5
MAX_MESSAGE_LENGTH=1000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 📁 Project Structure

```
broadcastServer/
├── src/                          # Backend source code
│   ├── controllers/              # API controllers
│   ├── models/                   # Database models
│   ├── routes/                   # API routes
│   ├── services/                 # Business logic services
│   ├── middleware/               # Express middleware
│   ├── validators/               # Input validators
│   ├── types/                    # TypeScript types
│   ├── utils/                    # Utility functions
│   └── config/                   # Configuration files
├── client/                       # Frontend source code
│   ├── src/
│   │   ├── components/           # Vue components
│   │   ├── views/                # Page components
│   │   ├── stores/               # Pinia state management
│   │   ├── services/             # API services
│   │   ├── types/                # TypeScript types
│   │   ├── router/               # Vue Router
│   │   └── styles/               # Global styles
│   ├── public/                   # Static assets
│   └── dist/                     # Built frontend
├── docker-compose.yml            # Production Docker setup
├── docker-compose.dev.yml        # Development Docker setup
├── Dockerfile                    # Backend production image
├── client/Dockerfile             # Frontend production image
├── init-mongo.js                 # MongoDB initialization
├── redis.conf                    # Redis configuration
├── deploy.sh                     # Production deployment script
├── docker-setup.sh               # Docker management script
└── docs/                         # Documentation
    ├── DOCKER.md                 # Docker deployment guide
    ├── DEPLOYMENT.md             # Production deployment guide
    └── API.md                    # API documentation
```

## 🌐 Access Points

After starting the application:

- **Frontend**: http://localhost:5173 (development) or http://localhost (production)
- **API**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/health
- **Admin Dashboard**: http://localhost/admin (requires admin role)

## 🧪 Development

### Available Scripts

**Backend:**
```bash
npm run dev          # Start development server
npm run build        # Build TypeScript
npm start           # Start production server
npm test            # Run tests
npm lint            # Run linter
```

**Frontend:**
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run linter
```

### Docker Commands
```bash
./docker-setup.sh setup     # Initial Docker setup
./docker-setup.sh dev       # Start development environment
./docker-setup.sh prod      # Start production environment
./docker-setup.sh logs      # View logs
./docker-setup.sh status    # Show service status
```

## 🚀 Production Deployment

### Prerequisites
- Docker and Docker Compose
- SSL certificate
- Domain name
- Production server

### Quick Deployment
```bash
# On production server
git clone <repository-url>
cd broadcastServer

# Setup environment
./docker-setup.sh setup
nano .env  # Configure production settings

# Deploy to production
sudo ./deploy.sh deploy
```

### Monitoring
```bash
# Check service health
curl https://yourdomain.com/health

# View application logs
./docker-setup.sh logs

# Monitor resource usage
docker stats
```

## 📊 Features in Detail

### Authentication System
- **User Registration** with email verification
- **Login/Logout** with session management
- **OAuth Support** for Google and GitHub
- **Password Reset** functionality
- **Account Management** and profile updates
- **Secure Session** handling with Redis

### Chat System
- **Real-time Messaging** with instant delivery
- **Message History** with search and filtering
- **User Status** indicators (online, offline, away)
- **Typing Indicators** for better UX
- **Message Formatting** and emoji support
- **File Sharing** capabilities (future enhancement)

### Admin Features
- **User Management** with search and filtering
- **Role Management** (assign/remove admin roles)
- **System Statistics** and analytics
- **Audit Log Review** with advanced filtering
- **Message Moderation** and content control
- **System Health** monitoring and alerts

### Security Features
- **Input Sanitization** against XSS attacks
- **SQL Injection** prevention
- **CSRF Protection** with tokens
- **Rate Limiting** for API abuse prevention
- **Security Headers** (HSTS, X-Frame-Options, etc.)
- **Password Strength** requirements
- **Audit Logging** for compliance

## 🛠️ Technical Stack

### Backend
- **Node.js 18+** - JavaScript runtime
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **Socket.io** - WebSocket implementation
- **MongoDB** - NoSQL database
- **Redis** - In-memory cache
- **Mongoose** - MongoDB ODM
- **JWT** - Authentication tokens
- **Winston** - Logging
- **Joi** - Input validation
- **Helmet** - Security headers

### Frontend
- **Vue 3** - Progressive framework
- **TypeScript** - Type safety
- **Pinia** - State management
- **Vue Router** - Navigation
- **Vuetify** - Material Design components
- **Socket.io-client** - Real-time communication
- **Axios** - HTTP client
- **Vite** - Build tool
- **ESLint** - Code linting

### DevOps
- **Docker** - Containerization
- **Docker Compose** - Orchestration
- **Nginx** - Reverse proxy
- **Let's Encrypt** - SSL certificates
- **GitHub Actions** - CI/CD (future)

## 🔍 Testing

### Running Tests
```bash
# Backend tests
cd broadcastServer
npm test

# Frontend tests
cd client
npm test

# End-to-end tests
npm run test:e2e
```

### Test Coverage
- Unit tests for all services
- Integration tests for API endpoints
- Frontend component tests
- E2E tests for user workflows

## 📈 Performance

### Optimizations
- **Code Splitting** for faster initial load
- **Lazy Loading** for components
- **Image Optimization** and compression
- **Caching Strategies** (browser, CDN, Redis)
- **Database Indexing** for fast queries
- **Connection Pooling** for databases

### Monitoring
- **Application Performance Monitoring** (APM)
- **Error Tracking** and alerting
- **Resource Usage** monitoring
- **Health Checks** and status endpoints

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines
- Follow existing code style
- Write meaningful commit messages
- Add tests for new features
- Update documentation
- Ensure all tests pass

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Vue.js team** for the amazing framework
- **Vuetify team** for Material Design components
- **Socket.io team** for real-time communication
- **MongoDB team** for the database
- **Express.js team** for the web framework

## 📞 Support

- **Documentation**: [DOCS](./docs/)
- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)
- **Email**: support@yourdomain.com

---

**Built with ❤️ using modern web technologies**

---

*Version: 1.0.0*
*Last Updated: November 2024*