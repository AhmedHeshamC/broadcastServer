# Docker Deployment Guide

This guide covers the Docker setup and deployment options for the Broadcast Chat application.

## 🐳 Overview

The application is containerized with the following services:
- **Backend API** - Node.js/Express server with WebSocket support
- **Frontend** - Vue.js SPA served by Nginx
- **MongoDB** - Database for user data and audit logs
- **Redis** - Session management and caching
- **Nginx** (optional) - Reverse proxy for production

## 🚀 Quick Start

### Prerequisites
- Docker 20.10+ and Docker Compose 2.0+
- Git

### Setup Commands

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

## 📋 Available Commands

```bash
# Setup and configuration
./docker-setup.sh setup     # Initial setup and environment creation
./docker-setup.sh build     # Build Docker images

# Environment management
./docker-setup.sh dev       # Start development environment
./docker-setup.sh prod      # Start production environment
./docker-setup.sh stop      # Stop all services
./docker-setup.sh restart   # Restart all services

# Monitoring and debugging
./docker-setup.sh status    # Show service status
./docker-setup.sh logs      # Show all logs
./docker-setup.sh logs api  # Show specific service logs

# Maintenance
./docker-setup.sh cleanup   # Clean up Docker resources
./docker-setup.sh help      # Show help
```

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Application
NODE_ENV=production
PORT=3000
CORS_ORIGIN=http://localhost:80

# Database
MONGODB_URI=mongodb://admin:password@mongo:27017/broadcast-chat?authSource=admin
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=your-secure-password

# Redis
REDIS_URL=redis://:password@redis:6379
REDIS_PASSWORD=your-secure-redis-password

# JWT
JWT_ACCESS_SECRET=your-super-secret-access-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### Security Considerations

1. **Change all default passwords** before production deployment
2. **Use strong, unique secrets** for JWT keys
3. **Enable HTTPS** in production (use Nginx proxy)
4. **Restrict database access** to internal network only
5. **Regular security updates** for base images

## 🌐 Development vs Production

### Development Environment
- Hot reload enabled
- Debug mode active
- Larger rate limits
- Development ports exposed
- Source code mounted

### Production Environment
- Optimized builds
- Security headers
- Rate limiting enabled
- Health checks
- Read-only containers
- Non-root users

## 🏗️ Architecture

```mermaid
graph TB
    subgraph "Docker Network"
        Frontend[Frontend/Nginx:80]
        API[Backend API:3000]
        MongoDB[MongoDB:27017]
        Redis[Redis:6379]
        Proxy[Nginx Proxy:8080]
    end

    User[User] --> Frontend
    User --> Proxy
    Proxy --> API
    Frontend --> API
    API --> MongoDB
    API --> Redis
```

## 📁 File Structure

```
broadcastServer/
├── docker-compose.yml          # Production configuration
├── docker-compose.dev.yml      # Development configuration
├── Dockerfile                   # Backend production image
├── Dockerfile.dev              # Backend development image
├── client/
│   ├── Dockerfile              # Frontend production image
│   ├── Dockerfile.dev          # Frontend development image
│   └── nginx.conf              # Nginx configuration
├── init-mongo.js               # MongoDB initialization script
├── redis.conf                  # Redis configuration
├── docker-setup.sh             # Management script
└── .env.example                # Environment template
```

## 🔍 Service Details

### Backend API
- **Image**: Custom Node.js Alpine
- **Port**: 3000
- **Health Check**: `/health`
- **Security**: Non-root user, read-only filesystem
- **Persistence**: Logs mounted to `./logs`

### Frontend
- **Image**: Multi-stage build (Node.js → Nginx)
- **Port**: 80
- **Health Check**: `/health`
- **Optimization**: Gzip compression, caching headers
- **SPA Support**: Route fallback to index.html

### MongoDB
- **Image**: mongo:7.0
- **Port**: 27017
- **Persistence**: Named volume for data
- **Security**: Authentication enabled
- **Initialization**: Creates collections, indexes, and default admin user

### Redis
- **Image**: redis:7.2-alpine
- **Port**: 6379
- **Persistence**: AOF and RDB enabled
- **Security**: Password authentication
- **Memory**: 256MB limit with LRU eviction

## 🐛 Troubleshooting

### Common Issues

1. **Port conflicts**:
   ```bash
   # Check what's using ports
   netstat -tulpn | grep :3000
   # Stop conflicting services
   ```

2. **Permission errors**:
   ```bash
   # Fix Docker permissions
   sudo usermod -aG docker $USER
   newgrp docker
   ```

3. **Container won't start**:
   ```bash
   # Check logs
   docker-compose logs service-name
   # Check configuration
   docker-compose config
   ```

4. **Database connection issues**:
   ```bash
   # Check MongoDB status
   docker-compose exec mongo mongo --eval "db.adminCommand('ping')"
   # Verify network connectivity
   docker-compose exec api ping mongo
   ```

5. **High memory usage**:
   ```bash
   # Monitor container resources
   docker stats
   # Clean up unused resources
   docker system prune
   ```

### Debug Commands

```bash
# Enter container shell
docker-compose exec api sh
docker-compose exec mongo mongo

# View real-time logs
docker-compose logs -f api

# Inspect container details
docker-compose exec api env | grep MONGO

# Check network connectivity
docker-compose exec frontend curl http://api:3000/health
```

## 📊 Monitoring

### Health Checks
All services include health checks:
```bash
# Check all service health
docker-compose ps

# Check specific service
docker-compose exec api curl http://localhost:3000/health
```

### Logs Management
```bash
# Rotate logs
docker-compose exec api logrotate /etc/logrotate.conf

# Monitor log size
docker-compose exec api du -sh logs/

# Archive old logs
docker-compose exec api tar -czf logs/archive-$(date +%Y%m%d).tar.gz logs/*.log.*
```

## 🔄 Updates and Maintenance

### Updating Images
```bash
# Pull latest base images
docker-compose pull

# Rebuild custom images
docker-compose build --no-cache

# Restart with new images
docker-compose up -d
```

### Backup and Restore
```bash
# Backup MongoDB
docker-compose exec mongo mongodump --out /backup/$(date +%Y%m%d)

# Backup Redis
docker-compose exec redis redis-cli BGSAVE
docker cp $(docker-compose ps -q redis):/data/dump.rdb ./redis-backup.rdb

# Restore MongoDB
docker-compose exec mongo mongorestore /backup/20240101
```

## 🌍 Production Deployment

### Environment Preparation
1. **Set up production server** with Docker and Docker Compose
2. **Configure firewall** to allow necessary ports
3. **Set up SSL certificates** (Let's Encrypt recommended)
4. **Configure monitoring** (Prometheus, Grafana)
5. **Set up log aggregation** (ELK stack)

### SSL/HTTPS Setup
```bash
# Generate SSL certificates
certbot certonly --standalone -d yourdomain.com

# Update nginx configuration for SSL
# Add SSL certificate paths to docker-compose.yml
```

### Performance Optimization
```bash
# Increase Docker limits
echo '{"default-ulimits": {"nofile": {"Name": "nofile", "Hard": 64000, "Soft": 64000}}}' | sudo tee /etc/docker/daemon.json

# Optimize system settings
echo 'vm.max_map_count=262144' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [MongoDB Docker Guide](https://hub.docker.com/_/mongo)
- [Redis Docker Guide](https://hub.docker.com/_/redis)
- [Nginx Configuration](https://nginx.org/en/docs/)

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review Docker logs: `./docker-setup.sh logs`
3. Verify configuration: `docker-compose config`
4. Check system resources: `docker stats`
5. Consult the project documentation

For additional support, create an issue in the project repository.