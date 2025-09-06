#!/bin/bash

# Docker Development Container Cleanup Script
# Safely removes containers, images, and optionally volumes

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Container and project name
CONTAINER_NAME="claude-dev"
PROJECT_NAME="claude-docker"

# Function to print header
print_header() {
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}${BOLD}  Docker Development Container Cleanup${NC}"
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Function to confirm action
confirm() {
    local prompt="$1"
    local default="${2:-n}"
    
    if [ "$default" = "y" ]; then
        prompt="$prompt [Y/n]: "
    else
        prompt="$prompt [y/N]: "
    fi
    
    read -p "$prompt" response
    response=${response:-$default}
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        return 0
    else
        return 1
    fi
}

# Function to check if container exists
container_exists() {
    docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"
}

# Function to check if container is running
container_running() {
    docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"
}

# Function to get size of Docker objects
get_size() {
    local size="$1"
    if [ -z "$size" ]; then
        echo "0B"
    else
        echo "$size"
    fi
}

# Main cleanup function
main() {
    print_header
    
    # Check Docker is running
    if ! docker info >/dev/null 2>&1; then
        echo -e "${RED}Error: Docker is not running${NC}"
        echo "Please start Docker Desktop and try again."
        exit 1
    fi
    
    # Change to project directory
    cd "$PROJECT_DIR"
    
    echo -e "${BOLD}Current Docker Status:${NC}"
    echo
    
    # Check container status
    if container_exists; then
        if container_running; then
            echo -e "  ${GREEN}● Container '$CONTAINER_NAME' is running${NC}"
        else
            echo -e "  ${YELLOW}○ Container '$CONTAINER_NAME' exists but is stopped${NC}"
        fi
    else
        echo -e "  ${BLUE}○ No container found${NC}"
    fi
    
    # List project volumes
    echo
    echo -e "${BOLD}Project Volumes:${NC}"
    volumes=$(docker volume ls -q | grep "^${PROJECT_NAME}_" || true)
    if [ -n "$volumes" ]; then
        for vol in $volumes; do
            size=$(docker volume inspect "$vol" --format '{{.Mountpoint}}' | xargs du -sh 2>/dev/null | cut -f1 || echo "?")
            echo -e "  ${CYAN}$vol${NC} (Size: $size)"
        done
    else
        echo -e "  ${BLUE}No volumes found${NC}"
    fi
    
    # List project images
    echo
    echo -e "${BOLD}Project Images:${NC}"
    images=$(docker images --filter "reference=${PROJECT_NAME}*" --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}" | tail -n +2)
    if [ -n "$images" ]; then
        echo "$images" | while IFS=$'\t' read -r name size; do
            echo -e "  ${CYAN}$name${NC} (Size: $size)"
        done
    else
        echo -e "  ${BLUE}No images found${NC}"
    fi
    
    echo
    echo -e "${BOLD}Cleanup Options:${NC}"
    echo
    echo "  1) Stop container only"
    echo "  2) Remove container (keep volumes & images)"
    echo "  3) Remove container and images (keep volumes)"
    echo "  4) Full cleanup (remove everything)"
    echo "  5) Docker system prune (clean all unused Docker objects)"
    echo "  6) Cancel"
    echo
    
    read -p "Select option [1-6]: " option
    
    case $option in
        1)
            echo
            echo -e "${YELLOW}Stopping container...${NC}"
            if container_running; then
                docker-compose stop
                echo -e "${GREEN}✓ Container stopped${NC}"
            else
                echo -e "${BLUE}Container is not running${NC}"
            fi
            ;;
            
        2)
            echo
            if confirm "Remove container '$CONTAINER_NAME'?" "y"; then
                echo -e "${YELLOW}Removing container...${NC}"
                docker-compose down
                echo -e "${GREEN}✓ Container removed${NC}"
                echo -e "${BLUE}Note: Volumes and images are preserved${NC}"
            else
                echo -e "${YELLOW}Cancelled${NC}"
            fi
            ;;
            
        3)
            echo
            if confirm "Remove container and images?" "y"; then
                echo -e "${YELLOW}Removing container and images...${NC}"
                docker-compose down --rmi all
                echo -e "${GREEN}✓ Container and images removed${NC}"
                echo -e "${BLUE}Note: Volumes are preserved${NC}"
            else
                echo -e "${YELLOW}Cancelled${NC}"
            fi
            ;;
            
        4)
            echo
            echo -e "${RED}${BOLD}⚠️  WARNING: Full Cleanup${NC}"
            echo -e "${RED}This will remove:${NC}"
            echo "  - The container"
            echo "  - All project images"
            echo "  - All project volumes (including VS Code extensions, npm cache, etc.)"
            echo
            if confirm "Are you sure you want to remove everything?" "n"; then
                if confirm "This action cannot be undone. Continue?" "n"; then
                    echo -e "${YELLOW}Performing full cleanup...${NC}"
                    
                    # Remove container and volumes
                    docker-compose down -v
                    
                    # Remove images
                    docker-compose down --rmi all
                    
                    # Remove any dangling volumes
                    volumes=$(docker volume ls -q | grep "^${PROJECT_NAME}_" || true)
                    if [ -n "$volumes" ]; then
                        echo "$volumes" | xargs docker volume rm
                    fi
                    
                    echo -e "${GREEN}✓ Full cleanup complete${NC}"
                    echo -e "${BLUE}To rebuild, run: ./setup-scripts/setup.sh${NC}"
                else
                    echo -e "${YELLOW}Cancelled${NC}"
                fi
            else
                echo -e "${YELLOW}Cancelled${NC}"
            fi
            ;;
            
        5)
            echo
            echo -e "${YELLOW}${BOLD}Docker System Prune${NC}"
            echo "This will remove:"
            echo "  - All stopped containers"
            echo "  - All networks not used by containers"
            echo "  - All dangling images"
            echo "  - All dangling build cache"
            echo
            if confirm "Run Docker system prune?" "y"; then
                echo -e "${YELLOW}Running Docker system prune...${NC}"
                docker system prune -f
                
                if confirm "Also prune volumes not used by containers?" "n"; then
                    docker volume prune -f
                fi
                
                echo -e "${GREEN}✓ Docker system prune complete${NC}"
            else
                echo -e "${YELLOW}Cancelled${NC}"
            fi
            ;;
            
        6)
            echo -e "${BLUE}Cleanup cancelled${NC}"
            ;;
            
        *)
            echo -e "${RED}Invalid option${NC}"
            exit 1
            ;;
    esac
    
    echo
    
    # Show final status
    if [ "$option" != "6" ]; then
        echo -e "${BOLD}Final Status:${NC}"
        
        # Check what remains
        if container_exists; then
            echo -e "  ${CYAN}Container still exists${NC}"
        fi
        
        volumes=$(docker volume ls -q | grep "^${PROJECT_NAME}_" || true)
        if [ -n "$volumes" ]; then
            echo -e "  ${CYAN}Volumes still exist${NC}"
        fi
        
        images=$(docker images -q --filter "reference=${PROJECT_NAME}*" || true)
        if [ -n "$images" ]; then
            echo -e "  ${CYAN}Images still exist${NC}"
        fi
        
        if [ -z "$volumes" ] && [ -z "$images" ] && ! container_exists; then
            echo -e "  ${GREEN}All project resources cleaned up${NC}"
        fi
    fi
}

# Run main function
main