#!/bin/bash

# Broadcast Chat Docker Setup Script
# This script helps set up and manage the Docker environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="broadcast-chat"
COMPOSE_FILE="docker-compose.yml"
COMPOSE_DEV_FILE="docker-compose.dev.yml"
ENV_FILE=".env"

# Functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Broadcast Chat Docker Setup${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    print_success "Docker and Docker Compose are installed"
}

setup_environment() {
    if [ ! -f "$ENV_FILE" ]; then
        print_warning "Environment file not found. Creating from template..."
        cp .env.example .env
        print_success "Environment file created. Please edit .env with your configuration."
    else
        print_success "Environment file exists"
    fi
}

build_images() {
    echo -e "\n${BLUE}Building Docker images...${NC}"
    docker-compose build --no-cache
    print_success "Docker images built successfully"
}

start_production() {
    echo -e "\n${BLUE}Starting production environment...${NC}"

    # Create logs directory
    mkdir -p logs

    # Start services
    docker-compose up -d

    print_success "Production environment started"
    echo -e "${GREEN}Frontend: http://localhost${NC}"
    echo -e "${GREEN}API: http://localhost:3000${NC}"
    echo -e "${GREEN}MongoDB: localhost:27017${NC}"
    echo -e "${GREEN}Redis: localhost:6379${NC}"
}

start_development() {
    echo -e "\n${BLUE}Starting development environment...${NC}"

    # Use development compose file
    docker-compose -f docker-compose.dev.yml up -d

    print_success "Development environment started"
    echo -e "${GREEN}Frontend: http://localhost:5173${NC}"
    echo -e "${GREEN}API: http://localhost:3000${NC}"
    echo -e "${GREEN}MongoDB: localhost:27017${NC}"
    echo -e "${GREEN}Redis: localhost:6379${NC}"
    echo -e "${GREEN}Redis Commander: http://localhost:8081 (optional)${NC}"
}

stop_services() {
    echo -e "\n${BLUE}Stopping services...${NC}"
    docker-compose down
    docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
    print_success "All services stopped"
}

show_logs() {
    local service=$1
    if [ -z "$service" ]; then
        docker-compose logs -f
    else
        docker-compose logs -f "$service"
    fi
}

cleanup() {
    echo -e "\n${BLUE}Cleaning up Docker resources...${NC}"
    docker-compose down -v --remove-orphans
    docker-compose -f docker-compose.dev.yml down -v --remove-orphans 2>/dev/null || true
    docker system prune -f
    print_success "Cleanup completed"
}

show_status() {
    echo -e "\n${BLUE}Service Status:${NC}"
    docker-compose ps
}

show_help() {
    echo -e "\n${BLUE}Broadcast Chat Docker Setup Script${NC}"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  prod         Start production environment"
    echo "  dev          Start development environment"
    echo "  build        Build Docker images"
    echo "  stop         Stop all services"
    echo "  restart      Restart all services"
    echo "  logs [service] Show logs (all services or specific service)"
    echo "  status       Show service status"
    echo "  cleanup      Clean up Docker resources"
    echo "  setup        Initial setup"
    echo "  help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 setup     # Initial setup"
    echo "  $0 dev       # Start development environment"
    echo "  $0 logs api  # Show API logs"
    echo "  $0 stop      # Stop all services"
}

# Main script logic
print_header

case "${1:-help}" in
    "setup")
        check_docker
        setup_environment
        build_images
        ;;
    "prod")
        check_docker
        setup_environment
        build_images
        start_production
        ;;
    "dev")
        check_docker
        setup_environment
        build_images
        start_development
        ;;
    "build")
        check_docker
        build_images
        ;;
    "stop")
        stop_services
        ;;
    "restart")
        stop_services
        sleep 2
        if [ -f "$COMPOSE_FILE" ]; then
            start_production
        else
            start_development
        fi
        ;;
    "logs")
        show_logs "$2"
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

echo -e "\n${GREEN}Done!${NC}"