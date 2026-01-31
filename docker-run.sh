#!/bin/bash

# Mini-Redis Microservices Docker Management Script
# Manages the Mini-Redis microservices architecture with three services:
# - mini-redis-core: High-performance Redis-compatible server
# - mini-redis-insight: Web UI and monitoring dashboard
# - mini-redis-benchmark: Performance testing tools

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${PURPLE}=== $1 ===${NC}"
}

print_service() {
    echo -e "${CYAN}[SERVICE]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Function to detect platform and show warnings if needed
check_platform() {
    local arch=$(uname -m)
    if [[ "$arch" == "arm64" ]]; then
        print_warning "⚠️  ARM64 (Apple Silicon) detected"
        print_status "📋 Platform compatibility:"
        print_status "  ✅ mini-redis-core: Native ARM64 support"
        print_status "  ✅ redisinsight: Native ARM64 support"
        print_status "  ⚡ memtier-benchmark: Uses x86_64 emulation (may be slower)"
        print_status "  ✅ redis-cli: Native ARM64 support"
        echo ""
    fi
}

# Function to build all images
build() {
    print_header "Building Mini-Redis Microservices"
    print_status "Building all service images..."
    docker compose build
    print_success "All services built successfully!"
}

# Function to start core service only (standalone Redis server)
start() {
    print_header "Starting Mini-Redis Core Service (Standalone)"
    print_service "Starting mini-redis-core..."
    docker compose up -d mini-redis-core

    print_status "Waiting for core service to be ready..."
    sleep 5

    # Check if core service is running
    if docker compose ps mini-redis-core | grep -q "Up"; then
        print_success "Mini-Redis core service is running!"
        print_status "🔌 Redis protocol: localhost:6380"
        print_status "📊 Mode: Standalone (no web interface)"
        print_status ""
        print_status "💡 To add web monitoring: ./docker-run.sh add-insight"
        print_status "💡 Connect with Redis CLI: ./docker-run.sh cli"
    else
        print_error "Failed to start Mini-Redis core service"
        docker compose logs mini-redis-core
        exit 1
    fi
}

# Function to start core + insight services (monitored deployment)
start-monitored() {
    print_header "Starting Mini-Redis with Web Monitoring"
    print_service "Starting mini-redis-core..."
    docker compose up -d mini-redis-core

    print_service "Starting mini-redis-insight..."
    docker compose --profile insight up -d mini-redis-insight

    print_status "Waiting for services to be ready..."
    sleep 8

    # Check if services are running
    if docker compose ps mini-redis-core | grep -q "Up"; then
        print_success "Mini-Redis services are running!"
        print_status "🔌 Redis protocol: localhost:6380"

        if docker compose ps mini-redis-insight | grep -q "Up"; then
            print_status "🌐 Web interface: http://localhost:8080"
            print_status "📊 Mode: Monitored (core + web dashboard)"
        else
            print_warning "⚠️  Web interface failed to start, but core is running"
            print_status "📊 Mode: Standalone (core only)"
        fi
    else
        print_error "Failed to start Mini-Redis core service"
        docker compose logs
        exit 1
    fi
}

# Function to add insight service to running core (plug-and-play)
add-insight() {
    print_header "Adding Web Monitoring to Running Core Service"

    # Check if core is running
    if ! docker compose ps mini-redis-core | grep -q "Up"; then
        print_error "Mini-Redis core service is not running!"
        print_status "Start the core service first: ./docker-run.sh start"
        exit 1
    fi

    print_service "Adding mini-redis-insight to running core..."
    docker compose --profile insight up -d mini-redis-insight

    print_status "Waiting for insight service to connect..."
    sleep 5

    if docker compose ps mini-redis-insight | grep -q "Up"; then
        print_success "Web monitoring added successfully!"
        print_status "🌐 Web interface: http://localhost:8080"
        print_status "📊 Mode: Monitored (core + web dashboard)"
    else
        print_error "Failed to start insight service"
        docker compose logs mini-redis-insight
        exit 1
    fi
}

# Function to remove insight service (keep core running)
remove-insight() {
    print_header "Removing Web Monitoring (Keep Core Running)"

    if docker compose ps mini-redis-insight | grep -q "Up"; then
        print_service "Stopping mini-redis-insight..."
        docker compose stop mini-redis-insight
        docker compose rm -f mini-redis-insight
        print_success "Web monitoring removed!"
        print_status "📊 Mode: Standalone (core only)"
        print_status "🔌 Redis protocol: localhost:6380"
    else
        print_warning "Insight service is not running"
    fi
}

# Function to run benchmark tests
benchmark() {
    print_header "Running Basic Benchmark Tests"

    # Check if core service is running
    if ! docker compose ps mini-redis-core | grep -q "Up"; then
        print_error "Mini-Redis core service is not running!"
        print_status "Start the core service first: ./docker-run.sh start"
        exit 1
    fi

    # Show platform warning for ARM64
    local arch=$(uname -m)
    if [[ "$arch" == "arm64" ]]; then
        print_warning "⚡ Running memtier-benchmark with x86_64 emulation on ARM64"
        print_status "Performance may be slower than native execution"
        echo ""
    fi

    print_status "Running basic performance tests..."
    docker compose --profile benchmark up --remove-orphans memtier-benchmark
    print_success "Basic benchmark completed!"
}

# Function to run stress tests
stress() {
    print_header "Running Stress Tests"

    # Check if core service is running
    if ! docker compose ps mini-redis-core | grep -q "Up"; then
        print_error "Mini-Redis core service is not running!"
        print_status "Start the core service first: ./docker-run.sh start"
        exit 1
    fi

    # Show platform warning for ARM64
    local arch=$(uname -m)
    if [[ "$arch" == "arm64" ]]; then
        print_warning "⚡ Running memtier-benchmark with x86_64 emulation on ARM64"
        print_status "Performance may be slower than native execution"
        echo ""
    fi

    print_status "Running high-load stress tests..."
    docker compose --profile stress up --remove-orphans memtier-benchmark-stress
    print_success "Stress tests completed!"
}

# Function to run pipeline tests
pipeline() {
    print_header "Running Pipeline Tests"

    # Check if core service is running
    if ! docker compose ps mini-redis-core | grep -q "Up"; then
        print_error "Mini-Redis core service is not running!"
        print_status "Start the core service first: ./docker-run.sh start"
        exit 1
    fi

    # Show platform warning for ARM64
    local arch=$(uname -m)
    if [[ "$arch" == "arm64" ]]; then
        print_warning "⚡ Running memtier-benchmark with x86_64 emulation on ARM64"
        print_status "Performance may be slower than native execution"
        echo ""
    fi

    print_status "Running pipeline performance tests..."
    docker compose --profile pipeline up --remove-orphans memtier-benchmark-pipeline
    print_success "Pipeline tests completed!"
}

# Function to run all benchmark tests
benchmark-all() {
    print_header "Running All Benchmark Tests"

    # Check if core service is running
    if ! docker compose ps mini-redis-core | grep -q "Up"; then
        print_error "Mini-Redis core service is not running!"
        print_status "Start the core service first: ./docker-run.sh start"
        exit 1
    fi

    # Show platform warning for ARM64
    local arch=$(uname -m)
    if [[ "$arch" == "arm64" ]]; then
        print_warning "⚡ Running memtier-benchmark with x86_64 emulation on ARM64"
        print_status "Performance may be slower than native execution"
        echo ""
    fi

    print_status "Running comprehensive benchmark suite..."
    print_status "1. Basic benchmark..."
    docker compose --profile benchmark up --remove-orphans memtier-benchmark
    print_status "2. Stress test..."
    docker compose --profile stress up --remove-orphans memtier-benchmark-stress
    print_status "3. Pipeline test..."
    docker compose --profile pipeline up --remove-orphans memtier-benchmark-pipeline
    print_success "All benchmarks completed!"
}

# Function to start interactive CLI
cli() {
    print_header "Redis CLI"
    print_status "Starting Redis CLI connected to Mini-Redis core..."
    print_warning "Type 'exit' or press Ctrl+C to quit"
    docker compose --profile cli run --rm redis-cli
}

# Function to stop all services
stop() {
    print_header "Stopping All Services"
    print_status "Stopping all Mini-Redis microservices..."
    docker compose down
    print_success "All services stopped!"
}

# Function to view logs
logs() {
    local service=${1:-""}
    if [ -z "$service" ]; then
        print_header "All Service Logs"
        print_status "Showing all service logs (press Ctrl+C to exit)..."
        docker compose logs -f
    else
        print_header "Service Logs: $service"
        print_status "Showing $service logs (press Ctrl+C to exit)..."
        docker compose logs -f "$service"
    fi
}

# Function to show status
status() {
    print_header "Service Status"
    print_status "Mini-Redis microservices status:"
    docker compose ps

    echo ""
    if docker compose ps mini-redis-core | grep -q "Up"; then
        print_success "✅ mini-redis-core: Running (port 6380)"
    else
        print_error "❌ mini-redis-core: Not running"
    fi

    if docker compose ps mini-redis-insight | grep -q "Up"; then
        print_success "✅ mini-redis-insight: Running (port 8080)"
    else
        print_warning "⚠️  mini-redis-insight: Not running"
    fi

    echo ""
    print_status "Access points:"
    print_status "🌐 Web Interface: http://localhost:8080"
    print_status "🔌 Redis Protocol: localhost:6380"
}

# Function to clean up
clean() {
    print_header "Cleaning Up"
    print_status "Cleaning up Docker resources..."
    docker compose down -v --remove-orphans
    docker system prune -f
    print_success "Cleanup completed!"
}

# Function to show help
show_help() {
    print_header "Mini-Redis Flexible Microservices Management"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "🏗️  Build Commands:"
    echo "  build              Build all service images"
    echo ""
    echo "🚀 Deployment Commands:"
    echo "  start              Start standalone Redis server (core only)"
    echo "  start-monitored    Start Redis server with web monitoring"
    echo "  add-insight        Add web monitoring to running core service"
    echo "  remove-insight     Remove web monitoring (keep core running)"
    echo "  stop               Stop all services"
    echo "  status             Show service status and health"
    echo ""
    echo "📊 Benchmark Commands:"
    echo "  benchmark          Run basic performance tests"
    echo "  stress             Run high-load stress tests"
    echo "  pipeline           Run pipeline performance tests"
    echo "  benchmark-all      Run all benchmark scenarios"
    echo ""
    echo "🔧 Utility Commands:"
    echo "  cli                Start interactive Redis CLI"
    echo "  logs [service]     Show logs (all services or specific)"
    echo "  clean              Clean up Docker resources"
    echo "  help               Show this help message"
    echo ""
    echo "🎯 Deployment Scenarios:"
    echo ""
    echo "  📦 Lightweight Redis Server:"
    echo "    $0 start                    # Standalone Redis (no web interface)"
    echo ""
    echo "  📊 Redis with Monitoring:"
    echo "    $0 start-monitored          # Redis + web dashboard"
    echo ""
    echo "  🔄 Add Monitoring Later:"
    echo "    $0 start                    # Start Redis only"
    echo "    $0 add-insight              # Add web monitoring"
    echo ""
    echo "  🧪 Performance Testing:"
    echo "    $0 start                    # Start Redis"
    echo "    $0 benchmark                # Run performance tests"
    echo ""
    echo "🏗️  Architecture:"
    echo "  mini-redis-core     - Standalone Redis server (port 6380)"
    echo "  mini-redis-insight  - Optional web dashboard (port 8080)"
    echo "  mini-redis-benchmark - Optional testing tools"
    echo ""
    echo "💡 Pro Tips:"
    echo "  • Core service runs independently - no dependencies"
    echo "  • Insight service is plug-and-play - add/remove anytime"
    echo "  • Connect with any Redis client: redis-cli -p 6380"
    echo ""
    echo "🏗️  Platform Compatibility:"
    echo "  • ARM64 (Apple Silicon): Native support for core, insight, and CLI"
    echo "  • ARM64 (Apple Silicon): Benchmark tools use x86_64 emulation"
    echo "  • x86_64 (Intel/AMD): Native support for all services"
}

# Main script logic
main() {
    check_docker
    check_platform

    case "${1:-help}" in
        build)
            build
            ;;
        start)
            build
            start
            ;;
        start-monitored)
            build
            start-monitored
            ;;
        add-insight)
            add-insight
            ;;
        remove-insight)
            remove-insight
            ;;
        benchmark)
            benchmark
            ;;
        stress)
            stress
            ;;
        pipeline)
            pipeline
            ;;
        benchmark-all)
            benchmark-all
            ;;
        cli)
            cli
            ;;
        stop)
            stop
            ;;
        logs)
            logs "$2"
            ;;
        status)
            status
            ;;
        clean)
            clean
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
