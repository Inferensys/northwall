# northwall-agent-control container image
# Headless control server for sandboxed agent sessions.
# Target image size: ~500MB
# iptables is included so the backend can apply network isolation rules.

FROM node:22-slim

# Install common dev tools Claude Code needs
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    jq \
    python3 \
    python3-pip \
    iptables \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally
# The SDK needs the CLI installed for query() to work
RUN npm install -g @anthropic-ai/claude-code@latest

# Create workspace directory
RUN mkdir -p /workspace

# Copy agent-control source and dependencies
WORKDIR /app

# Copy package files first for better layer caching
COPY package.json ./

# Install runtime deps (tsx for running TypeScript, ws, nanoid, sdk, etc.)
# Note: @northwall/shared is only needed at type-check time, not at runtime
# The control server inlines the minimal Zod validation it needs
RUN npm install --omit=dev && npm install tsx

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Default env vars (overridden by backend at container create)
ENV CONTROL_PORT=3001
ENV WORKSPACE_DIR=/workspace

EXPOSE 3001

# Run with tsx (TypeScript execution — no compilation step needed)
CMD ["npx", "tsx", "src/index.ts"]
