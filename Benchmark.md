# Test Result

## Performance Benchmarks

Mini-Redis has been tested using Redis Labs' official memtier_benchmark tool to evaluate performance under various load conditions. The benchmarks demonstrate the server's capability to handle high-throughput operations with consistent low latency.

### Test Environment

- **Platform**: ARM64 (Apple Silicon M-series)
- **Benchmark Tool**: Redis Labs memtier_benchmark (via x86_64 emulation)
- **Server**: Mini-Redis Core v1.0
- **Network**: Local Docker containers (localhost)
- **Test Date**: 2025-08-21

### Basic Performance Test (Node.js Baseline)

**Configuration:**

- 2 threads, 10 connections per thread
- 1,000 requests per client (20,000 total operations)
- 32-byte data size
- 1:1 SET/GET ratio

**Results:**

```
ALL STATS
============================================================================================================================================
Type         Ops/sec     Hits/sec   Misses/sec    Avg. Latency     p50 Latency     p90 Latency     p95 Latency     p99 Latency       KB/sec
--------------------------------------------------------------------------------------------------------------------------------------------
Sets         1508.06          ---          ---         6.60956         6.59100         7.51900         7.93500         9.47100       116.23
Gets         1508.06         0.00      1508.06         6.62919         6.59100         7.55100         7.96700        10.55900        58.73
Waits           0.00          ---          ---             ---             ---             ---             ---             ---          ---
Totals       3016.12         0.00      1508.06         6.61938         6.59100         7.55100         7.96700        10.11100       174.96
```

**Key Metrics:**

- **Throughput**: 3,016 operations/second
- **Average Latency**: 6.62ms
- **95th Percentile**: 7.97ms
- **99th Percentile**: 10.11ms

### High-Load Stress Test (Node.js Baseline)

**Configuration:**

- 4 threads, 50 connections per thread
- 10,000 requests per client (2,000,000 total operations)
- 1,024-byte data size
- 1:1 SET/GET ratio

**Results:**

```
ALL STATS
============================================================================================================================================================
Type         Ops/sec     Hits/sec   Misses/sec    Avg. Latency     p50 Latency     p90 Latency     p95 Latency     p99 Latency   p99.9 Latency       KB/sec
------------------------------------------------------------------------------------------------------------------------------------------------------------
Sets        14299.63          ---          ---         6.99618         6.94300         7.96700         8.51100        11.71100        36.86300     14982.29
Gets        14299.63        11.44     14288.19         7.00040         6.94300         7.96700         8.51100        11.71100        38.91100       568.51
Waits           0.00          ---          ---             ---             ---             ---             ---             ---             ---          ---
Totals      28599.26        11.44     14288.19         6.99829         6.94300         7.96700         8.51100        11.71100        38.14300     15550.80
```

**Key Metrics:**

- **Throughput**: 28,599 operations/second
- **Average Latency**: 7.00ms
- **95th Percentile**: 8.51ms
- **99th Percentile**: 11.71ms
- **99.9th Percentile**: 38.14ms

### Pipeline Performance Test (Node.js Baseline)

**Configuration:**

- 2 threads, 20 connections per thread
- 5,000 requests per client (200,000 total operations)
- 64-byte data size
- 1:1 SET/GET ratio
- Pipeline depth: 10 commands per pipeline

**Results:**

```
ALL STATS
============================================================================================================================================
Type         Ops/sec     Hits/sec   Misses/sec    Avg. Latency     p50 Latency     p90 Latency     p95 Latency     p99 Latency       KB/sec
--------------------------------------------------------------------------------------------------------------------------------------------
Sets        29139.47          ---          ---         6.85360         6.52700         7.71100         8.76700        14.91100      3155.67
Gets        29139.47        23.31     29116.16         6.86983         6.49500         7.71100         8.83100        15.16700      1147.34
Waits           0.00          ---          ---             ---             ---             ---             ---             ---          ---
Totals      58278.95        23.31     29116.16         6.86172         6.49500         7.71100         8.83100        14.97500      4303.01
```

**Key Metrics:**

- **Throughput**: 58,279 operations/second
- **Average Latency**: 6.86ms
- **95th Percentile**: 8.83ms
- **99th Percentile**: 14.98ms

### Performance Analysis

1. **Excellent Scalability**: Performance scales nearly linearly from basic to high-load scenarios
2. **Consistent Latency**: Low and stable latency across different load levels (6-7ms average)
3. **High Throughput**: Achieves 28K+ ops/sec under stress conditions, 58K+ ops/sec with pipelining
4. **Pipeline Efficiency**: Pipelining nearly doubles throughput while maintaining low latency
5. **Efficient Memory Usage**: Handles large data payloads (1KB) efficiently
6. **Stable Performance**: Consistent performance across different test scenarios and configurations

### Platform Considerations

**ARM64 (Apple Silicon):**

- Mini-Redis core runs natively with optimal performance
- Benchmark tool uses x86_64 emulation, which may slightly impact test results
- Actual performance on native x86_64 systems may be higher

**x86_64 (Intel/AMD):**

- All components run natively for maximum performance
- Expected to show improved benchmark results

### Running Your Own Benchmarks

To reproduce these benchmarks or test with different parameters:

```bash
# Start Mini-Redis
./docker-run.sh start

# Run basic benchmark
./docker-run.sh benchmark

# Run stress test
./docker-run.sh stress

# Run pipeline test
./docker-run.sh pipeline

# Run all benchmark scenarios
./docker-run.sh benchmark-all
```

For custom benchmark parameters, you can modify the configurations in `docker-compose.yml` or use the memtier_benchmark tool directly.

## Runtime Performance Comparison: Node.js vs Bun

This section compares the performance of Mini-Redis running on Node.js 18 versus Bun 1.2.20 runtime. Both tests were conducted on the same ARM64 (Apple Silicon) system using identical configurations and test parameters.

### Test Configuration

**Node.js Implementation:**

- Runtime: Node.js 18 (Alpine Linux)
- Base Image: `node:18-alpine`
- Test Date: Previous benchmarks

**Bun Implementation:**

- Runtime: Bun 1.2.20
- Base Image: `oven/bun:1`
- Test Date: 2025-08-21

### Performance Comparison Table

| Test Scenario     | Runtime | Throughput (ops/sec) | Avg Latency (ms) | 95th Percentile (ms) | 99th Percentile (ms) | Performance Gain |
| ----------------- | ------- | -------------------- | ---------------- | -------------------- | -------------------- | ---------------- |
| **Basic Test**    | Node.js | 3,016                | 6.62             | 7.97                 | 10.11                | -                |
| **Basic Test**    | Bun     | 2,512                | 6.96             | 8.83                 | 10.82                | **-16.7%**       |
| **Stress Test**   | Node.js | 28,599               | 7.00             | 8.51                 | 11.71                | -                |
| **Stress Test**   | Bun     | 27,981               | 7.14             | 8.83                 | 10.43                | **-2.2%**        |
| **Pipeline Test** | Node.js | 58,279               | 6.86             | 8.83                 | 14.98                | -                |
| **Pipeline Test** | Bun     | 55,980               | 7.13             | 8.51                 | 9.98                 | **-3.9%**        |

### Detailed Bun Runtime Results

#### Basic Performance Test (Bun)

**Configuration:**

- 2 threads, 10 connections per thread
- 1,000 requests per client (20,000 total operations)
- 32-byte data size
- 1:1 SET/GET ratio

**Results:**

```
ALL STATS
============================================================================================================================================
Type         Ops/sec     Hits/sec   Misses/sec    Avg. Latency     p50 Latency     p90 Latency     p95 Latency     p99 Latency       KB/sec
--------------------------------------------------------------------------------------------------------------------------------------------
Sets         1256.13          ---          ---         6.88020         6.81500         8.31900         8.83100        10.30300        96.81
Gets         1256.13         0.00      1256.13         7.02984         6.81500         8.38300         8.89500        10.94300        48.92
Waits           0.00          ---          ---             ---             ---             ---             ---             ---          ---
Totals       2512.27         0.00      1256.13         6.95502         6.81500         8.31900         8.83100        10.81500       145.73
```

#### High-Load Stress Test (Bun)

**Configuration:**

- 4 threads, 50 connections per thread
- 10,000 requests per client (2,000,000 total operations)
- 1,024-byte data size
- 1:1 SET/GET ratio

**Results:**

```
ALL STATS
============================================================================================================================================================
Type         Ops/sec     Hits/sec   Misses/sec    Avg. Latency     p50 Latency     p90 Latency     p95 Latency     p99 Latency   p99.9 Latency       KB/sec
------------------------------------------------------------------------------------------------------------------------------------------------------------
Sets        13990.54          ---          ---         7.14510         7.03900         8.31900         8.83100        10.55900        21.50300     14658.45
Gets        13990.54         8.39     13982.15         7.13140         7.03900         8.31900         8.76700        10.30300        21.50300       553.41
Waits           0.00          ---          ---             ---             ---             ---             ---             ---             ---          ---
Totals      27981.09         8.39     13982.15         7.13825         7.03900         8.31900         8.83100        10.43100        21.50300     15211.86
```

#### Pipeline Performance Test (Bun)

**Configuration:**

- 2 threads, 20 connections per thread
- 5,000 requests per client (200,000 total operations)
- 64-byte data size
- 1:1 SET/GET ratio
- Pipeline depth: 10 commands per pipeline

**Results:**

```
ALL STATS
============================================================================================================================================
Type         Ops/sec     Hits/sec   Misses/sec    Avg. Latency     p50 Latency     p90 Latency     p95 Latency     p99 Latency       KB/sec
--------------------------------------------------------------------------------------------------------------------------------------------
Sets        27989.83          ---          ---         7.13233         7.00700         8.19100         8.51100         9.98300      3031.17
Gets        27989.83        22.39     27967.44         7.13249         7.00700         8.19100         8.51100         9.98300      1102.08
Waits           0.00          ---          ---             ---             ---             ---             ---             ---          ---
Totals      55979.66        22.39     27967.44         7.13241         7.00700         8.19100         8.51100         9.98300      4133.25
```

### Performance Analysis: Node.js vs Bun

#### Key Findings

1. **Node.js Performance Advantage**: Node.js consistently outperforms Bun across all test scenarios

   - Basic test: Node.js is **16.7% faster** (3,016 vs 2,512 ops/sec)
   - Stress test: Node.js is **2.2% faster** (28,599 vs 27,981 ops/sec)
   - Pipeline test: Node.js is **3.9% faster** (58,279 vs 55,980 ops/sec)

2. **Latency Characteristics**:

   - **Node.js**: Slightly better average latency in basic and pipeline tests
   - **Bun**: Competitive latency, sometimes better 99th percentile performance
   - Both runtimes maintain sub-8ms average latency across all scenarios

3. **Scalability Patterns**:

   - **Node.js**: Better performance scaling from basic to high-load scenarios
   - **Bun**: More consistent performance across different load levels
   - Both runtimes handle high-throughput scenarios effectively

4. **Runtime-Specific Observations**:
   - **Node.js**: More mature V8 engine optimization for network I/O operations
   - **Bun**: Newer runtime with competitive but not superior performance for this workload
   - Both runtimes demonstrate excellent stability under load

#### Recommendations

**Choose Node.js when:**

- Maximum throughput is critical
- You need the most mature ecosystem and tooling
- Performance optimization is a primary concern

**Choose Bun when:**

- You want faster startup times and development experience
- Bundle size and memory usage are important factors
- You're building new applications and want modern JavaScript features

**Overall Conclusion:**
For Mini-Redis specifically, **Node.js 18 provides superior performance** across all tested scenarios. The performance difference is most pronounced in basic workloads (-16.7%) but narrows significantly under high-load conditions (-2.2% to -3.9%). Both runtimes are capable of handling production Redis workloads effectively.
