# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install Python and Beancount dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    python3-dev \
    build-base \
    libxml2-dev \
    libxslt-dev \
    zlib-dev

# Install pipx and Beancount
RUN pip install --no-cache-dir pipx && \
    pipx install beancount

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install Python and Beancount dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    python3-dev \
    build-base \
    libxml2-dev \
    libxslt-dev \
    zlib-dev

# Install pipx and Beancount
RUN pip install --no-cache-dir pipx && \
    pipx install beancount

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]