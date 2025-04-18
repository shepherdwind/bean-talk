# Bean Talk

A tool for managing and analyzing Beancount files.

## Description

Bean Talk is a project that helps users manage and analyze their Beancount files. It provides a convenient interface for working with Beancount, a powerful double-entry bookkeeping tool.

## Features

- Beancount file management
- Gmail integration for transaction processing
- User-friendly interface

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Gmail account (for email integration)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/bean-talk.git
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

## Usage

[Add usage instructions here]

## Development

### Gmail Integration Setup

1. **Gmail API Configuration**
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Gmail API for your project
   - Create OAuth 2.0 credentials:
     - Go to "APIs & Services" > "Credentials"
     - Click "Create Credentials" > "OAuth client ID"
     - Choose "Desktop application" as the application type
     - Download the client configuration file

2. **Environment Variables**
   Create a `.env` file in the root directory with the following variables:
   ```
   GMAIL_CLIENT_ID=your_client_id
   GMAIL_CLIENT_SECRET=your_client_secret
   GMAIL_REDIRECT_URI=http://localhost:3000/auth/gmail/callback
   ```

3. **Testing Gmail Integration**
   - Start the development server:
     ```bash
     npm run dev
     # or
     yarn dev
     ```
   - Navigate to the Gmail integration page
   - Click "Connect Gmail" to initiate the OAuth flow
   - After authorization, you'll be redirected back to the application
   - Test the following features:
     - Email fetching
     - Transaction parsing
     - Beancount file generation

4. **Debugging Tips**
   - Check the browser console for frontend errors
   - Monitor the server logs for backend issues
   - Use the Gmail API's debug mode for detailed API interaction logs
   - Verify OAuth token storage and refresh mechanisms

5. **Common Issues and Solutions**
   - If authorization fails, ensure your OAuth credentials are correctly configured
   - For rate limiting issues, implement proper error handling and retry mechanisms
   - If emails aren't being fetched, verify the Gmail API scopes are correctly set

### Local Development

1. **Setting up the Development Environment**
   ```bash
   # Install dependencies
   npm install
   
   # Start the development server
   npm run dev
   ```

2. **Running Tests**
   ```bash
   # Run all tests
   npm test
   
   # Run specific test suites
   npm test -- --testPathPattern=gmail
   ```

3. **Code Style**
   - Follow the project's ESLint configuration
   - Use Prettier for code formatting
   - Write meaningful commit messages

4. **Contributing**
   - Create a new branch for your feature
   - Write tests for new functionality
   - Submit a pull request with a clear description of changes

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