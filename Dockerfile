# Build stage
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Copy everything and let go mod tidy handle dependencies
# (runs go mod tidy first to fetch + verify, then builds)
COPY . .
RUN go mod tidy && \
    go build -ldflags="-s -w" -o /bin/erion-ember ./cmd/server/

# Runtime stage — minimal image
FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /bin/erion-ember /bin/erion-ember

EXPOSE 8080
ENTRYPOINT ["/bin/erion-ember"]
