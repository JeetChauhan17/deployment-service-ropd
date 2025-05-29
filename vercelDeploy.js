const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Vercel configuration
const VERCEL_TEAM = process.env.VERCEL_TEAM;
const VERCEL_PROJECT = process.env.VERCEL_PROJECT || 'control-panel-deployments';

function generateRandomSubdomain() {
    const randomString = crypto.randomBytes(3).toString('hex');
    const randomNumber = Math.floor(Math.random() * 900) + 100;
    return `${randomString}${randomNumber}`;
}

async function deployToVercel() {
    try {
        // Create a temporary directory for this deployment
        const deploymentId = crypto.randomBytes(4).toString('hex');
        const tempDir = path.join(__dirname, 'temp', deploymentId);
        await fs.mkdir(tempDir, { recursive: true });

        // Copy files from repo to temp directory
        const repoPath = path.join(__dirname, 'repo');
        const files = await getAllFiles(repoPath);

        if (files.length === 0) {
            throw new Error('No files found in the repo directory');
        }

        for (const file of files) {
            const relativePath = path.relative(repoPath, file);
            const targetPath = path.join(tempDir, relativePath);
            await fs.mkdir(path.dirname(targetPath), { recursive: true });
            await fs.copyFile(file, targetPath);
        }

        // Generate random subdomain
        const subdomain = generateRandomSubdomain();

        // Create vercel.json configuration
        const vercelConfig = {
            name: `${subdomain}-deployment`,
            version: 2,
            public: true,
            alias: [`${subdomain}.vercel.app`]
        };

        await fs.writeFile(
            path.join(tempDir, 'vercel.json'),
            JSON.stringify(vercelConfig, null, 2)
        );

        // Deploy to Vercel
        const deployCommand = VERCEL_TEAM 
            ? `vercel deploy --prod --token ${process.env.VERCEL_TOKEN} --scope ${VERCEL_TEAM}`
            : `vercel deploy --prod --token ${process.env.VERCEL_TOKEN}`;

        const { stdout } = await execAsync(deployCommand, { cwd: tempDir });
        
        // Extract deployment URL from Vercel output
        const deploymentUrl = stdout.match(/https:\/\/[^\s]+/)[0];

        // Clean up temp directory
        await fs.rm(tempDir, { recursive: true, force: true });

        return deploymentUrl;
    } catch (error) {
        console.error('Vercel deployment error:', error);
        throw error;
    }
}

async function getAllFiles(dirPath) {
    try {
        const files = [];
        const items = await fs.readdir(dirPath, { withFileTypes: true });

        for (const item of items) {
            const fullPath = path.join(dirPath, item.name);
            if (item.isDirectory()) {
                files.push(...await getAllFiles(fullPath));
            } else {
                files.push(fullPath);
            }
        }

        return files;
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('Repo directory not found, creating it...');
            await fs.mkdir(dirPath, { recursive: true });
            return [];
        }
        throw error;
    }
}

module.exports = {
    deployToVercel
}; 