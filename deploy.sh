#!/bin/bash

# Broadcast Chat Production Deployment Script
# This script handles production deployment with zero-downtime

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="broadcast-chat"
BACKUP_DIR="./backups"
DEPLOY_LOG="./deploy.log"

# Functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Broadcast Chat Production Deployment${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    print_to_log "SUCCESS: $1"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    print_to_log "ERROR: $1"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
    print_to_log "WARNING: $1"
}

print_to_log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$DEPLOY_LOG"
}

check_prerequisites() {
    print_to_log "Starting deployment check"

    # Check if running as root for production deployment
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root for production deployment"
        exit 1
    fi

    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi

    # Check environment file
    if [ ! -f ".env" ]; then
        print_error "Environment file .env not found"
        exit 1
    fi

    # Check for production secrets
    if grep -q "change-in-production" .env; then
        print_error "Default passwords detected in .env. Please change them before deployment."
        exit 1
    fi

    print_success "Prerequisites check passed"
}

backup_data() {
    print_to_log "Starting backup process"

    # Create backup directory
    mkdir -p "$BACKUP_DIR"

    local backup_date=$(date +%Y%m%d_%H%M%S)
    local backup_path="$BACKUP_DIR/backup_$backup_date"

    mkdir -p "$backup_path"

    # Backup MongoDB
    if docker-compose ps mongo | grep -q "Up"; then
        print_warning "Creating MongoDB backup..."
        docker-compose exec -T mongo mongodump --out /tmp/backup
        docker cp $(docker-compose ps -q mongo):/tmp/backup "$backup_path/mongodb"
        print_success "MongoDB backup completed"
    fi

    # Backup Redis
    if docker-compose ps redis | grep -q "Up"; then
        print_warning "Creating Redis backup..."
        docker-compose exec -T redis redis-cli BGSAVE
        sleep 5
        docker cp $(docker-compose ps -q redis):/data/dump.rdb "$backup_path/redis_dump.rdb"
        print_success "Redis backup completed"
    fi

    # Backup configuration
    cp .env "$backup_path/"
    cp docker-compose.yml "$backup_path/"

    print_success "Backup completed: $backup_path"
    print_to_log "Backup created: $backup_path"
}

deploy_application() {
    print_to_log "Starting application deployment"

    # Pull latest changes (if in git repository)
    if [ -d ".git" ]; then
        print_warning "Pulling latest changes..."
        git pull origin main
    fi

    # Build new images
    print_warning "Building new Docker images..."
    docker-compose build --no-cache

    # Run database migrations if needed
    print_warning "Running database migrations..."
    # Add migration commands here if needed

    # Deploy with zero downtime
    print_warning "Deploying application..."

    # Scale up new services
    docker-compose up -d --scale api=2

    # Wait for health checks
    print_warning "Waiting for services to be healthy..."
    sleep 30

    # Check if new deployment is healthy
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        print_success "New deployment is healthy"

        # Scale down old services
        docker-compose up -d --scale api=1

    else
        print_error "Health check failed. Rolling back..."
        rollback_deployment
        exit 1
    fi

    print_success "Deployment completed successfully"
    print_to_log "Deployment completed successfully"
}

rollback_deployment() {
    print_to_log "Starting rollback process"

    print_warning "Rolling back to previous version..."

    # Restore from backup if available
    local latest_backup=$(ls -1t "$BACKUP_DIR" | head -n 1)

    if [ -n "$latest_backup" ]; then
        print_warning "Restoring from backup: $latest_backup"

        # Restore MongoDB
        if [ -d "$BACKUP_DIR/$latest_backup/mongodb" ]; then
            docker cp "$BACKUP_DIR/$latest_backup/mongodb" $(docker-compose ps -q mongo):/tmp/restore
            docker-compose exec mongo mongorestore --drop /tmp/restore
        fi

        # Restore Redis
        if [ -f "$BACKUP_DIR/$latest_backup/redis_dump.rdb" ]; then
            docker cp "$BACKUP_DIR/$latest_backup/redis_dump.rdb" $(docker-compose ps -q redis):/data/dump.rdb
            docker-compose restart redis
        fi

        print_success "Rollback completed"
    else
        print_error "No backup available for rollback"
    fi
}

cleanup() {
    print_to_log "Starting cleanup process"

    # Remove old Docker images
    print_warning "Removing old Docker images..."
    docker image prune -f

    # Remove old backups (keep last 7)
    print_warning "Cleaning up old backups..."
    find "$BACKUP_DIR" -type d -name "backup_*" -mtime +7 -exec rm -rf {} \; 2>/dev/null || true

    # Compress old logs
    find ./logs -name "*.log.*" -mtime +1 -exec gzip {} \; 2>/dev/null || true

    print_success "Cleanup completed"
}

health_check() {
    print_to_log "Starting health checks"

    local services=("api" "frontend" "mongo" "redis")
    local all_healthy=true

    for service in "${services[@]}"; do
        if docker-compose ps "$service" | grep -q "Up"; then
            print_success "$service is running"
        else
            print_error "$service is not running"
            all_healthy=false
        fi
    done

    # Check API health endpoint
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        print_success "API health check passed"
    else
        print_error "API health check failed"
        all_healthy=false
    fi

    # Check frontend
    if curl -f http://localhost/ > /dev/null 2>&1; then
        print_success "Frontend health check passed"
    else
        print_error "Frontend health check failed"
        all_healthy=false
    fi

    if [ "$all_healthy" = true ]; then
        print_success "All health checks passed"
        return 0
    else
        print_error "Some health checks failed"
        return 1
    fi
}

show_status() {
    echo -e "\n${BLUE}Deployment Status:${NC}"

    # Service status
    docker-compose ps

    # Resource usage
    echo -e "\n${BLUE}Resource Usage:${NC}"
    docker stats --no-stream

    # Disk usage
    echo -e "\n${BLUE}Disk Usage:${NC}"
    df -h

    # Recent logs
    echo -e "\n${BLUE}Recent Deployment Logs:${NC}"
    tail -20 "$DEPLOY_LOG"
}

show_help() {
    echo -e "\n${BLUE}Broadcast Chat Production Deployment${NC}"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  deploy      Deploy application to production"
    echo "  rollback    Rollback to previous version"
    echo "  backup      Create data backup"
    echo "  health      Run health checks"
    echo "  status      Show deployment status"
    echo "  cleanup     Clean up old resources"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 deploy    # Deploy to production"
    echo "  $0 backup    # Create backup"
    echo "  $0 health    # Check system health"
}

# Main script logic
print_header
mkdir -p "$(dirname "$DEPLOY_LOG")"

case "${1:-help}" in
    "deploy")
        check_prerequisites
        backup_data
        deploy_application
        cleanup
        ;;
    "rollback")
        check_prerequisites
        rollback_deployment
        ;;
    "backup")
        backup_data
        ;;
    "health")
        health_check
        ;;
    "status")
        show_status
        ;;
    "cleanup")
        cleanup
        ;;
    "help"|*)
        show_help
        ;;
esac

print_to_log "Deployment script completed"
echo -e "\n${GREEN}Deployment process completed!${NC}"