# Bean Talk

A tool for managing and analyzing Beancount files.

## Description

Bean Talk is a project that helps users manage and analyze their Beancount files. It provides a convenient interface for working with Beancount, a powerful double-entry bookkeeping tool.

## Features

- Beancount file management
- Gmail integration for transaction processing
- User-friendly interface
- Docker support for easy deployment

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Gmail account (for email integration)
- Docker and Docker Compose (optional, for containerized deployment)

## Installation

### Option 1: Traditional Installation

1. Clone the repository:
```bash
git clone https://github.com/shepherdwind/bean-talk.git
cd bean-talk
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Set up environment variables:
Create a `.env` file in the root directory and add necessary environment variables.

### Option 2: Docker Installation

1. Clone the repository:
```bash
git clone https://github.com/shepherdwind/bean-talk.git
cd bean-talk
```

2. Create a data directory for persistent storage:
```bash
mkdir data
```

3. Set up environment variables:
Create a `.env` file in the root directory with your configuration.

4. Start the application using Docker Compose:
```bash
docker-compose up -d
```

The application will be available at http://localhost:3000

## Docker Support

### Using Docker Compose (Recommended)

The easiest way to run Bean Talk is using Docker Compose:

```bash
# Start the application
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down
```

### Manual Docker Usage

You can also run the Docker container directly:

```bash
# Pull the latest image
docker pull ghcr.io/shepherdwind/bean-talk:latest

# Run the container
docker run -d \
  -v $(pwd)/data:/app/data \
  --user "1000:1000" \
  --name bean-talk \
  ghcr.io/shepherdwind/bean-talk:latest
```

## Beancount Version Management

The beancount version is managed in `.github/workflows/beancount-version.yml`. To update beancount:

1. Edit `.github/workflows/beancount-version.yml` and update the version number
2. Commit and push the changes
3. GitHub Actions will automatically rebuild the base image with the new version

The base image will only be rebuilt when the beancount version changes, which helps to speed up the build process.

## License

MIT License

Copyright (c) 2024 Bean Talk

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE. 