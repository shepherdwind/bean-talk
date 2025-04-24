# Base image with beancount
FROM node:20-alpine AS beancount-base

WORKDIR /app

# Install Python3 and build dependencies
RUN apk add --no-cache python3 build-base libxml2-dev libxslt-dev git py3-pip python3-dev curl

# Set up Python virtual environment and install beancount
COPY .github/workflows/beancount-version.yml .
RUN BEANCOUNT_VERSION=$(grep -oP 'beancount_version: "\K[0-9.]+' beancount-version.yml) && \
    python3 -m venv /app/venv && \
    . /app/venv/bin/activate && \
    git clone https://github.com/beancount/beancount /tmp/beancount && \
    cd /tmp/beancount && \
    git checkout ${BEANCOUNT_VERSION} && \
    CFLAGS=-s pip install -U /tmp/beancount && \
    rm -rf /tmp/beancount

# Add virtual environment to PATH
ENV PATH="/app/venv/bin:$PATH"

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install Python3 and build dependencies
RUN apk add --no-cache python3 build-base libxml2-dev libxslt-dev git py3-pip python3-dev curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM beancount-base

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy requirements.txt
COPY requirements.txt .

# Install Python dependencies
RUN . /app/venv/bin/activate && pip install -r /app/requirements.txt

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]