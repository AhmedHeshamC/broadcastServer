# Production Deployment Guide

This comprehensive guide covers deploying the Broadcast Chat application to production environments.

## 🚀 Overview

The Broadcast Chat application is designed for enterprise-grade production deployments with:
- **Zero-downtime deployments**
- **Automated backups**
- **Health monitoring**
- **Rollback capabilities**
- **Security hardening**
- **Performance optimization**

## 📋 Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04+ / CentOS 8+ / RHEL 8+
- **RAM**: Minimum 4GB, Recommended 8GB+
- **Storage**: Minimum 50GB SSD
- **CPU**: Minimum 2 cores, Recommended 4+ cores
- **Network**: Stable internet connection

### Software Requirements
- Docker 20.10+
- Docker Compose 2.0+
- Git
- SSL certificate (Let's Encrypt recommended)
- Domain name pointing to server IP

### Security Requirements
- Firewall configured
- SSH access with key-based authentication
- Non-root user for SSH
- Regular security updates

## 🔧 Initial Server Setup

### 1. System Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git htop ufw certbot

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# Create application user
sudo useradd -m -s /bin/bash broadcast
sudo usermod -aG sudo broadcast
```

### 2. Docker Installation

```bash
# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Set up the repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker broadcast

# Configure Docker to start on boot
sudo systemctl enable docker
sudo systemctl start docker
```

### 3. Application Setup

```bash
# Switch to application user
sudo su - broadcast

# Clone repository
git clone <repository-url> broadcast-chat
cd broadcast-chat

# Setup Docker environment
./docker-setup.sh setup
```

## 🔐 Security Configuration

### 1. Environment Configuration

```bash
# Create production environment file
cp .env.example .env
nano .env
```

**Critical security settings to configure:**

```bash
# Change these immediately!
JWT_ACCESS_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
MONGO_ROOT_PASSWORD=$(openssl rand -base64 16)
REDIS_PASSWORD=$(openssl rand -base64 16)

# Set production values
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
```

### 2. SSL Certificate Setup

```bash
# Install Certbot for Let's Encrypt
sudo apt install certbot

# Generate SSL certificate (replace yourdomain.com)
sudo certbot certonly --standalone -d yourdomain.com

# Set up automatic renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 3. SSL Configuration

Create `nginx/nginx.prod.conf`:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Add your SSL configuration here
    # ... rest of nginx config
}
```

## 🚀 Deployment Process

### 1. Initial Deployment

```bash
# Deploy to production
sudo ./deploy.sh deploy

# Monitor deployment
./docker-setup.sh status
./docker-setup.sh logs
```

### 2. Zero-Downtime Updates

```bash
# Deploy with zero downtime
sudo ./deploy.sh deploy

# The script will:
# 1. Create backup
# 2. Build new images
# 3. Scale up services
# 4. Run health checks
# 5. Roll back if needed
# 6. Scale down to normal
```

### 3. Rollback

```bash
# If something goes wrong
sudo ./deploy.sh rollback

# This will restore from the last backup
```

## 📊 Monitoring and Logging

### 1. Health Monitoring

```bash
# Check application health
curl https://yourdomain.com/health

# Check service status
docker-compose ps

# Check resource usage
docker stats
```

### 2. Log Management

```bash
# View all logs
./docker-setup.sh logs

# View specific service logs
./docker-setup.sh logs api
./docker-setup.sh logs frontend

# Log files are stored in ./logs/
tail -f logs/app.log
```

### 3. Backup Management

```bash
# Create manual backup
sudo ./deploy.sh backup

# Backups are stored in ./backups/
ls -la backups/

# Backup schedule (add to crontab)
0 2 * * * /home/broadcast/broadcast-chat/deploy.sh backup
```

## 🔧 Performance Optimization

### 1. System Tuning

```bash
# Increase file limits
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# Optimize network settings
echo "net.core.somaxconn = 65536" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.tcp_max_syn_backlog = 65536" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### 2. Docker Optimization

```bash
# Configure Docker daemon
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "default-ulimits": {
    "nofile": {"Name": "nofile", "Hard": 64000, "Soft": 64000}
  }
}
EOF

sudo systemctl restart docker
```

### 3. Application Scaling

For high traffic, modify `docker-compose.yml`:

```yaml
services:
  api:
    deploy:
      replicas: 3
  frontend:
    deploy:
      replicas: 2
```

## 🛡️ Security Hardening

### 1. Container Security

All containers run with:
- Non-root users
- Read-only filesystems
- Minimal attack surface
- Security profiles enabled

### 2. Network Security

```bash
# Only expose necessary ports
# 80, 443 for web traffic
# 22 for SSH (if remote)

# Use internal network for database
# Database not exposed to internet
```

### 3. Application Security

- JWT secrets configured
- Rate limiting enabled
- Input validation active
- HTTPS enforced
- Security headers added

## 📈 High Availability

### 1. Database Replication

For production, consider:
- MongoDB replica set
- Redis cluster
- Load balancer

### 2. Monitoring Setup

Consider adding:
- Prometheus for metrics
- Grafana for dashboards
- AlertManager for alerts
- ELK stack for logs

### 3. Disaster Recovery

```bash
# Regular backups
0 2 * * * /home/broadcast/broadcast-chat/deploy.sh backup

# Off-site backup sync
0 4 * * * rsync -av /home/broadcast/broadcast-chat/backups/ user@backup-server:/backups/broadcast-chat/
```

## 🔍 Troubleshooting

### Common Issues

1. **Service won't start**:
   ```bash
   # Check logs
   docker-compose logs service-name

   # Check configuration
   docker-compose config
   ```

2. **Database connection issues**:
   ```bash
   # Check database status
   docker-compose exec mongo mongo --eval "db.adminCommand('ping')"

   # Check network
   docker-compose exec api ping mongo
   ```

3. **High memory usage**:
   ```bash
   # Check container stats
   docker stats

   # Restart services
   docker-compose restart
   ```

4. **SSL certificate issues**:
   ```bash
   # Check certificate status
   certbot certificates

   # Renew certificate
   certbot renew
   ```

## 📚 Maintenance Tasks

### Daily
- Monitor application health
- Check error logs
- Verify backup completion

### Weekly
- Update system packages
- Review security logs
- Clean up old logs

### Monthly
- Update Docker images
- Review resource usage
- Test disaster recovery

### Quarterly
- Security audit
- Performance review
- Backup restoration test

## 🆘 Support and Escalation

### Emergency Contacts
- System Administrator: [Contact Info]
- Development Team: [Contact Info]
- Security Team: [Contact Info]

### Emergency Procedures

1. **Service Outage**:
   ```bash
   # Check service status
   ./docker-setup.sh status

   # Restart if needed
   docker-compose restart

   # Rollback if recent deployment
   sudo ./deploy.sh rollback
   ```

2. **Security Incident**:
   ```bash
   # Isolate affected systems
   # Review logs
   # Contact security team
   # Follow incident response plan
   ```

3. **Data Loss**:
   ```bash
   # Stop application
   docker-compose down

   # Restore from backup
   sudo ./deploy.sh rollback

   # Restart services
   docker-compose up -d
   ```

## 📄 Documentation

- **API Documentation**: `/api/docs`
- **Admin Guide**: `/admin`
- **User Guide**: Available in application
- **Docker Guide**: `DOCKER.md`
- **Architecture**: `ARCHITECTURE.md`

---

**Last Updated**: $(date)
**Version**: 1.0.0

For additional support or questions, please refer to the project repository or contact the development team.