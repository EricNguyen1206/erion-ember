# ── Builder ────────────────────────────────────────────────────────────────
FROM golang:1.23 AS builder

# CGO is required by hugot (embeds ONNX Runtime)
ENV CGO_ENABLED=1

WORKDIR /app
COPY . .

RUN go mod tidy && \
    go build -ldflags="-s -w" -o /bin/erion-ember ./cmd/server/

# ── Runtime ────────────────────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /bin/erion-ember /bin/erion-ember

EXPOSE 8080
ENTRYPOINT ["/bin/erion-ember"]
