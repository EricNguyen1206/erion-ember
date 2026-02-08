# Changelog

All notable changes to Erion Ember will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-02-08

### Added
- **Semantic Caching** - High-performance cache for LLM queries with vector similarity search
- **Groq API Integration** - Full integration with Groq API for LLM responses (#8)
- **Rate Limiting** - API rate limiting middleware (60 requests/minute) (#7)
- **API Key Security** - Optional API key authentication via `x-api-key` header (#7)
- **TTL Support** - Time-to-live configuration for cache entries (#5)
- **K6 Benchmarking Suite** - Professional load testing with smoke, load, stress, and soak tests
- **Docker Support** - Complete Docker and Docker Compose configuration with profiles
- **Monitoring Stack** - Optional Grafana + InfluxDB integration for metrics visualization
- **Cost Tracking** - Token savings and USD cost estimation for cache hits

### Core Components
- **HNSWIndex** - Fast approximate nearest neighbor search using HNSW algorithm
- **Quantizer** - INT8 vector quantization for memory efficiency
- **Compressor** - LZ4 compression for prompts and responses
- **Normalizer** - Text normalization and hashing for exact match lookup
- **MetadataStore** - In-memory metadata storage with TTL support

### Infrastructure
- **Fastify** - High-performance HTTP server
- **Bun Runtime** - Fast JavaScript runtime with native ESM support
- **Redis** - Optional distributed caching backend
- **Health Checks** - Docker health checks for all services
- **CI/CD** - GitHub Actions workflows for testing and benchmarking

### Changed
- Replaced lz4 with lz4js for better cross-platform compatibility (#4)
- Unified project structure with core components in `src/lib/` (#4)

### Fixed
- Updated Dockerfile to include python3 and build tools for native modules (#5)

### Security
- Input validation using Zod schemas
- Safe error messages in production mode
- Rate limiting to prevent abuse
- Optional API key authentication

## [0.1.0] - 2026-01-15

### Added
- Initial project structure
- Basic semantic cache implementation
- Mini-Redis compatible server (legacy)
- Basic Docker configuration

---

[Unreleased]: https://github.com/EricNguyen1206/erion-ember/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/EricNguyen1206/erion-ember/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/EricNguyen1206/erion-ember/releases/tag/v0.1.0
