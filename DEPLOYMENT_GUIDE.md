# Deployment Control Panel - Setup Guide

## Prerequisites

1. **Node.js** (version 16 or higher)
2. **Vercel CLI** (install globally): `npm install -g vercel`
3. **Vercel Account** with API token
4. **Azure Storage Account** (optional, for Azure deployments)

## Installation

1. **Clone the repository**:
   \`\`\`bash
   git clone https://github.com/JeetChauhan17/ropd-testing.git
   cd ropd-testing
   \`\`\`

2. **Install dependencies**:
   \`\`\`bash
   npm install
   \`\`\`

3. **Set up environment variables**:
   - Copy `.env.example` to `.env`
   - Fill in your actual values:
     \`\`\`env
     VERCEL_TOKEN=your_actual_vercel_token
     VERCEL_PROJECT=your_project_name
     AZURE_STORAGE_CONNECTION_STRING=your_azure_connection_string
     AZURE_STORAGE_CONTAINER_NAME=$web
     PORT=3000
     \`\`\`

## Getting Your Vercel Token

1. Go to [Vercel Dashboard](https://vercel.com/account/tokens)
2. Click "Create Token"
3. Give it a name (e.g., "Deployment Control Panel")
4. Copy the token and add it to your `.env` file

## Getting Azure Storage Connection String

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your Storage Account
3. Go to "Access keys" in the left sidebar
4. Copy the connection string from key1 or key2
5. Enable "Static website" hosting in your storage account

## Running the Application

1. **Development mode** (with auto-restart):
   \`\`\`bash
   npm run dev
   \`\`\`

2. **Production mode**:
   \`\`\`bash
   npm start
   \`\`\`

3. **Access the control panel**:
   Open your browser to `http://localhost:3000`

## How to Use

### 1. Upload a Website Folder
- Drag and drop a folder containing your website files
- Or click "Select Folder" to browse for a folder
- Set the redeployment interval (in minutes)
- Click "Deploy"

### 2. Add More Files
- Use the "Add More Files" section to upload additional files
- These will be added to your existing deployment

### 3. Monitor Deployments
- View real-time deployment logs
- See the current deployed URL
- Track the next scheduled deployment time

## Supported Project Types

The system automatically detects and handles:

- **Static HTML sites** (index.html)
- **React projects** (with package.json)
- **Vue projects** (with package.json)
- **Vite projects** (with vite dependencies)
- **Next.js projects** (with next dependencies)
- **Node.js servers** (with server dependencies)

## Deployment Platforms

### Primary: Vercel
- Automatic deployment with custom subdomains
- Supports all major frameworks
- Fast global CDN

### Fallback: Azure Storage
- Static website hosting
- Reliable backup option
- Custom domain support

## Troubleshooting

### Common Issues

1. **"Vercel CLI not found"**:
   \`\`\`bash
   npm install -g vercel
   \`\`\`

2. **"VERCEL_TOKEN not set"**:
   - Check your `.env` file
   - Ensure the token is valid and not expired

3. **"No files found in repo directory"**:
   - Make sure you've uploaded files through the web interface
   - Check that the `repo/` directory exists and contains files

4. **Azure deployment fails**:
   - Verify your connection string is correct
   - Ensure static website hosting is enabled
   - Check container permissions

### Debug Mode

Enable detailed logging by setting:
\`\`\`env
DEBUG=true
\`\`\`

## API Endpoints

- `POST /upload` - Upload and deploy files
- `POST /add-files` - Add files to existing deployment
- `GET /latest-url` - Get current deployment URL
- `GET /deployment-status` - Get deployment status
- `GET /health` - Health check

## Security Notes

- Never commit your `.env` file to version control
- Rotate your API tokens regularly
- Use environment-specific configurations for production
- Consider implementing authentication for production use

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details
