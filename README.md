# Control Panel Deployment System

A web application that allows users to deploy their files with automatic updates and unique subdomains. The system supports both local deployment and Vercel deployment.

## Features

- File upload and deployment
- Automatic updates with configurable intervals
- Unique subdomains for each deployment
- Support for both local and Vercel deployment
- Modern Bootstrap-based UI
- Real-time deployment status updates

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Vercel CLI (for Vercel deployment)

## Installation

1. Clone the repository:
```bash
git clone <your-repository-url>
cd control-panel
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
PORT=3000
VERCEL_TOKEN=your_vercel_token
VERCEL_TEAM=your_team_id
VERCEL_PROJECT=your_project_id
```

## Usage

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to `http://localhost:3000`

3. Upload your files and configure the update interval

4. The system will generate a unique URL for your deployment

## Deployment

### Local Deployment
The system will automatically create unique subdomains for local deployment.

### Vercel Deployment
To use Vercel deployment:
1. Create a Vercel account
2. Install Vercel CLI: `npm i -g vercel`
3. Configure your Vercel credentials in the `.env` file
4. The system will automatically deploy to Vercel when files are uploaded

## License

MIT 