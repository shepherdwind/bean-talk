# Bean Talk Development Guide

This document provides detailed instructions for setting up and testing the Bean Talk application, with a focus on Gmail integration.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Gmail Integration Setup](#gmail-integration-setup)
- [Local Development](#local-development)
- [Testing](#testing)
- [Debugging](#debugging)
- [Contributing Guidelines](#contributing-guidelines)

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v14 or higher)
- npm or yarn
- Git
- A Gmail account for testing
- Google Cloud Console access

## Gmail Integration Setup

### 1. Google Cloud Console Configuration

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"

### 2. OAuth 2.0 Credentials Setup

1. In Google Cloud Console, go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Configure the OAuth consent screen:
   - Choose "External" user type
   - Fill in the required application information
   - Add necessary scopes:
     ```
     https://www.googleapis.com/auth/gmail.readonly
     https://www.googleapis.com/auth/gmail.modify
     ```
4. Create OAuth client ID:
   - Application type: "Desktop application" (for development)
   - Name: "Bean Talk"
   - Download the client configuration file and save it as `credentials.json` in the project root

> **Note**: We use OAuth 2.0 because it's the secure way to access Gmail API. It allows users to explicitly grant permission to our application to access their Gmail data, and they can revoke access at any time.

### 3. Environment Configuration

Create a `.env` file in the project root with the following variables:

```env
# Gmail API Credentials
GMAIL_CREDENTIALS_PATH=./credentials.json
GMAIL_TOKENS_PATH=./token.json

# Application Settings
NODE_ENV=development
```

> **Important**: 
> 1. The `credentials.json` file contains your OAuth 2.0 client credentials
> 2. The `token.json` file will be automatically generated after the first successful OAuth authorization
> 3. Both files are listed in `.gitignore` to prevent accidental commits of sensitive information

## Local Development

### 1. Project Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/bean-talk.git
cd bean-talk

# Install dependencies
npm install

# Start the development server
npm run dev
```

### 2. Development Workflow

1. Create a new branch for your feature:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit them:
   ```bash
   git add .
   git commit -m "Description of your changes"
   ```

3. Push your changes:
   ```bash
   git push origin feature/your-feature-name
   ```

## Testing

### 1. Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --testPathPattern=gmail

# Run tests in watch mode
npm test -- --watch
```

### 2. Testing Gmail Integration

1. Start the development server
2. Navigate to the Gmail integration page
3. Click "Connect Gmail" to initiate OAuth flow
4. Test the following features:
   - Email fetching
   - Transaction parsing
   - Beancount file generation
   - Error handling

## Debugging

### 1. Frontend Debugging

- Use browser developer tools (F12)
- Check the console for errors
- Monitor network requests
- Use React Developer Tools extension

### 2. Backend Debugging

- Check server logs
- Use debug logging:
  ```javascript
  console.debug('Debug message:', data);
  ```
- Monitor API responses
- Check database queries

### 3. Gmail API Debugging

- Enable Gmail API debug mode
- Monitor OAuth token flow
- Check API quota usage
- Verify scopes and permissions

## Common Issues and Solutions

### 1. Gmail API Issues

- **Authorization Failed**
  - Verify OAuth credentials
  - Check redirect URI configuration
  - Ensure proper scopes are enabled

- **Rate Limiting**
  - Implement exponential backoff
  - Cache responses when possible
  - Monitor API quota usage

- **Email Fetching Issues**
  - Verify Gmail API scopes
  - Check email query parameters
  - Ensure proper error handling

### 2. Development Issues

- **Build Errors**
  - Clear node_modules and reinstall
  - Check for dependency conflicts
  - Verify Node.js version

- **Test Failures**
  - Check test environment setup
  - Verify mock implementations
  - Review test coverage

## Contributing Guidelines

1. **Code Style**
   - Follow ESLint configuration
   - Use Prettier for formatting
   - Write meaningful commit messages

2. **Pull Requests**
   - Create feature branches
   - Write clear PR descriptions
   - Include tests for new features
   - Update documentation

3. **Code Review**
   - Review code changes
   - Test functionality
   - Verify documentation updates
   - Check test coverage

## Additional Resources

- [Gmail API Documentation](https://developers.google.com/gmail/api/guides)
- [OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Beancount Documentation](https://beancount.github.io/docs/) 