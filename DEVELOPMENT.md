# Development Guide

## Gmail Integration Setup

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

## Local Development

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

## Configuration

### Merchant Category Mapping

The application uses a JSON configuration file to map merchant names to account categories. By default, the configuration file is located at `config/merchant-category-mapping.json` in the project root directory.

You can customize the location of the configuration file by setting the `MERCHANT_CATEGORY_CONFIG_PATH` environment variable:

```bash
# Linux/macOS
export MERCHANT_CATEGORY_CONFIG_PATH=/path/to/your/merchant-category-mapping.json

# Windows (Command Prompt)
set MERCHANT_CATEGORY_CONFIG_PATH=C:\path\to\your\merchant-category-mapping.json

# Windows (PowerShell)
$env:MERCHANT_CATEGORY_CONFIG_PATH = "C:\path\to\your\merchant-category-mapping.json"
```

The application will automatically detect changes to the configuration file and reload it when needed. 