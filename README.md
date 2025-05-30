# Control Panel

A web-based control panel for deploying static sites and web applications to Vercel.

## Features

- Upload and deploy static websites
- Support for Vite, Next.js, and static HTML projects
- Automatic periodic redeployment
- Real-time deployment status updates
- Custom subdomain generation

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Vercel account and API token

## Setup

1. Clone the repository:
```bash
git clone <your-repo-url>
cd control-panel
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your Vercel token:
```
VERCEL_TOKEN=your_vercel_token_here
PORT=3000
```

4. Start the server:
```bash
npm start
```

The server will start at `http://localhost:3000`

## Usage

1. Open the control panel in your browser
2. Upload your website files
3. Set deployment interval (optional)
4. Click deploy
5. Get your deployment URL

## Project Structure

- `server.js` - Main server file
- `vercelDeploy.js` - Vercel deployment logic
- `cronManager.js` - Periodic deployment management
- `public/` - Frontend static files
- `temp/` - Temporary deployment files
- `repo/` - Uploaded project files

## License

MIT 