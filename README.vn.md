# 🚀 Erion Ember

Bộ nhớ đệm ngữ nghĩa cho LLM với kiểm thử hiệu năng K6 - Giải pháp sẵn sàng cho production để lưu trữ phản hồi LLM với khả năng so khớp tương đồng ngữ nghĩa.

[English](README.md) | **Tiếng Việt**

## Tổng quan

Erion Ember cung cấp một lớp bộ nhớ đệm ngữ nghĩa hiệu năng cao cho các ứng dụng LLM, giúp giảm chi phí và độ trễ bằng cách phục vụ các phản hồi đã được lưu trữ cho các truy vấn có ngữ nghĩa tương tự.

## Tính năng

- ✅ **Bun Runtime**: JavaScript runtime nhẹ và nhanh
- ✅ **Fastify HTTP API**: Framework web hiệu năng cao
- ✅ **Bộ nhớ đệm ngữ nghĩa**: Cache thông minh với khả năng so khớp tương đồng
- ✅ **Kiểm thử K6**: Bộ công cụ kiểm thử tải chuyên nghiệp
- ✅ **Docker Ready**: Triển khai container với nhiều profiles
- ✅ **Giám sát**: Tích hợp Grafana + InfluxDB (tùy chọn)

## Cấu trúc dự án

```
erion-ember/
├── src/                            # Mã nguồn chính
│   ├── lib/                        # Thư viện core
│   │   ├── semantic-cache.js       # Bộ nhớ đệm ngữ nghĩa
│   │   ├── hnsw-index.js           # Tìm kiếm vector HNSW
│   │   ├── quantizer.js            # Lượng tử hóa INT8
│   │   ├── compressor.js           # Nén LZ4
│   │   └── metadata-store.js       # Lưu trữ metadata
│   ├── routes/                     # API endpoints
│   └── server.js                   # Fastify server
├── tests/                          # Unit tests
├── benchmark/                      # Bộ kiểm thử K6
│   ├── k6/                         # Các kịch bản test
│   └── grafana/                    # Dashboard config
├── services/                       # Dịch vụ phụ
├── docker-compose.yml              # Orchestration
└── package.json                    # Dependencies
```

## Bắt đầu nhanh

### Yêu cầu

- Bun runtime (v1.0+)
- Docker & Docker Compose v2.20+
- K6 CLI (tùy chọn, cho kiểm thử local)

### Cài đặt

```bash
# Clone repository
git clone https://github.com/EricNguyen1206/erion-ember.git
cd erion-ember

# Cài đặt dependencies
bun install

# Sao chép file cấu hình môi trường
cp .env.example .env
# Chỉnh sửa .env với API key của bạn
```

### Chạy dịch vụ

#### Cách 1: Chỉ Core + Redis

```bash
# Khởi động core service và Redis
docker compose up erion-ember redis

# Hoặc với npm script
npm run docker:core
```

#### Cách 2: Core + Benchmark

```bash
# Khởi động core, redis, và K6 benchmark
docker compose --profile benchmark up

# Hoặc với npm script
npm run benchmark
```

#### Cách 3: Full Stack (với Monitoring)

```bash
# Khởi động tất cả services bao gồm Grafana + InfluxDB
docker compose --profile benchmark --profile monitoring up
```

### Phát triển Local

```bash
# Chế độ development với hot reload
npm run dev

# Chạy tests
npm test

# Chạy test cụ thể
bun test tests/semantic-cache.test.js
```

## Tài liệu API

### POST /v1/chat

Chat với bộ nhớ đệm ngữ nghĩa.

**Request:**
```json
{
  "prompt": "Machine learning là gì?",
  "model": "llama3.2"
}
```

**Response (đã cache):**
```json
{
  "response": "Machine learning là một nhánh của AI...",
  "cached": true,
  "similarity": 1.0,
  "model": "llama3.2",
  "timestamp": "2026-01-31T22:00:00.000Z",
  "savings": {
    "tokens_saved": 150,
    "usd_saved": 0.0045
  }
}
```

**Response (chưa cache):**
```json
{
  "response": "Machine learning là một nhánh của AI...",
  "cached": false,
  "model": "llama3.2",
  "timestamp": "2026-01-31T22:00:00.000Z",
  "savings": {
    "tokens_saved": 0,
    "usd_saved": 0
  }
}
```

### GET /health

Endpoint kiểm tra sức khỏe.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-31T22:00:00.000Z"
}
```

### GET /v1/stats

Thống kê cache.

**Response:**
```json
{
  "totalEntries": 1500,
  "cacheHits": 12500,
  "cacheMisses": 3200,
  "hitRate": "0.7962",
  "savedTokens": 1250000,
  "savedUsd": 37.50
}
```

## Kiểm thử hiệu năng

### Chạy nhanh

```bash
# Chạy smoke test local
npm run benchmark:local

# Hoặc với K6 trực tiếp
cd benchmark
k6 run k6/smoke-test.js
```

### Các loại test

| Test | Virtual Users | Thời gian | Mục đích |
|------|--------------|-----------|----------|
| **smoke-test.js** | 10 VU | 30s | Kiểm tra nhanh |
| **load-test.js** | 200 VU | 16m | Kiểm thử tải bình thường |
| **stress-test.js** | 500 VU | 12m | Tìm điểm giới hạn |
| **soak-test.js** | 50 VU | 70m | Phát hiện rò rỉ bộ nhớ |

### Các chỉ số

- **Throughput**: Số request mỗi giây (RPS)
- **Latency**: Độ trễ p50, p95, p99
- **Cache Hit Rate**: Tỷ lệ cache hit
- **Token Savings**: Ước tính token tiết kiệm được
- **Error Rate**: Tỷ lệ lỗi

### Dashboard

Truy cập Grafana dashboard tại http://localhost:3001 (khi sử dụng --profile monitoring)

**Thông tin đăng nhập mặc định:**
- Username: `admin`
- Password: `admin`

## Biến môi trường

### Dịch vụ Core

| Biến | Mô tả | Mặc định |
|------|-------|----------|
| `PORT` | Port server | 3000 |
| `REDIS_URL` | URL kết nối Redis | redis://localhost:6379 |
| `GROQ_API_KEY` | API key Groq **(bắt buộc)** | - |
| `OLLAMA_URL` | URL Ollama API | http://localhost:11434 |
| `NODE_ENV` | Môi trường | development |
| `API_KEY` | API key xác thực (tùy chọn) | - |

### Benchmark

| Biến | Mô tả | Mặc định |
|------|-------|----------|
| `CORE_URL` | URL endpoint core | http://localhost:3000 |
| `K6_OUT` | Định dạng output | json |

## Docker Compose Profiles

```bash
# Chỉ core services
docker compose up erion-ember redis

# Với benchmark
docker compose --profile benchmark up

# Với monitoring
docker compose --profile monitoring up

# Full stack
docker compose --profile benchmark --profile monitoring up
```

## Bảo mật

- ✅ Xác thực input với Zod schemas
- ✅ Xác thực API key (tùy chọn, qua header `x-api-key`)
- ✅ Rate limiting (60 req/phút)
- ✅ Không log dữ liệu nhạy cảm
- ✅ Thông báo lỗi an toàn trong production

## Đóng góp

Chúng tôi hoan nghênh mọi đóng góp! Vui lòng đọc hướng dẫn đóng góp và gửi pull request.

## Giấy phép

Dự án này được cấp phép theo MIT License - xem file [LICENSE](LICENSE) để biết thêm chi tiết.

## Lời cảm ơn

- Xây dựng với [Bun](https://bun.sh/)
- Powered by [Fastify](https://fastify.io/)
- Benchmarked với [K6](https://k6.io/)
- Monitored với [Grafana](https://grafana.com/)
