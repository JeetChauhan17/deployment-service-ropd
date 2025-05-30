const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Vercel configuration
const VERCEL_PROJECT = process.env.VERCEL_PROJECT || 'control-panel-deployments';

function generateRandomSubdomain() {
    const randomString = crypto.randomBytes(3).toString('hex');
    const randomNumber = Math.floor(Math.random() * 900) + 100;
    return `${randomString}${randomNumber}`;
}

async function detectProjectType(dirPath) {
    const files = await fs.readdir(dirPath);
    
    if (files.includes('package.json')) {
        const packageJson = JSON.parse(await fs.readFile(path.join(dirPath, 'package.json'), 'utf8'));
        if (packageJson.dependencies?.vite) return 'vite';
        if (packageJson.dependencies?.next) return 'next';
        return 'node';
    }
    
    if (files.includes('index.html')) return 'static';
    
    return 'unknown';
}

async function cleanupTempDirectory(tempDir) {
    try {
        // Wait a bit to ensure all file handles are released
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Try to remove files first
        const files = await fs.readdir(tempDir, { withFileTypes: true });
        for (const file of files) {
            const fullPath = path.join(tempDir, file.name);
            if (file.isDirectory()) {
                await cleanupTempDirectory(fullPath);
            } else {
                try {
                    await fs.unlink(fullPath);
                } catch (err) {
                    console.warn(`Warning: Could not delete file ${fullPath}: ${err.message}`);
                }
            }
        }
        
        // Then try to remove the directory
        try {
            await fs.rmdir(tempDir);
        } catch (err) {
            console.warn(`Warning: Could not delete directory ${tempDir}: ${err.message}`);
        }
    } catch (error) {
        console.warn(`Warning: Cleanup error for ${tempDir}: ${error.message}`);
    }
}

async function validateDeployable(tempDir) {
    const files = await fs.readdir(tempDir);
    if (files.includes('index.html') || files.includes('package.json')) {
        return true;
    }
    throw new Error('Deployment folder must contain either index.html (for static sites) or package.json (for Node/Vite/Next projects).');
}

async function deployToVercel() {
    let tempDir;
    try {
        // Create a temporary directory for this deployment
        const deploymentId = crypto.randomBytes(4).toString('hex');
        tempDir = path.join(__dirname, 'temp', deploymentId);
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

        // Validate deployable
        await validateDeployable(tempDir);

        // Generate random subdomain
        const subdomain = generateRandomSubdomain();

        // Detect project type and create appropriate vercel.json
        const projectType = await detectProjectType(tempDir);
        const vercelConfig = {
            version: 2,
            public: true,
            alias: [`${subdomain}.vercel.app`],
            builds: [],
            routes: [
                {
                    src: "/(.*)",
                    dest: "/$1"
                }
            ]
        };

        // Add specific build configuration based on project type
        switch (projectType) {
            case 'vite':
                vercelConfig.builds.push({
                    src: "package.json",
                    use: "@vercel/static-build",
                    config: {
                        buildCommand: "npm run build",
                        outputDirectory: "dist"
                    }
                });
                break;
            case 'next':
                vercelConfig.builds.push({
                    src: "package.json",
                    use: "@vercel/next"
                });
                break;
            case 'static':
                vercelConfig.builds = [
                    { src: "index.html", use: "@vercel/static" }
                ];
                // No custom routes for static
                break;
            default:
                vercelConfig.builds.push({
                    src: "**/*",
                    use: "@vercel/static"
                });
        }

        await fs.writeFile(
            path.join(tempDir, 'vercel.json'),
            JSON.stringify(vercelConfig, null, 2)
        );

        // Deploy to Vercel with updated command
        const deployCommand = `vercel deploy --prod --yes --token ${process.env.VERCEL_TOKEN}`;

        let stdout = '';
        try {
            const result = await execAsync(deployCommand, { cwd: tempDir });
            stdout = result.stdout;
        } catch (err) {
            // Log and throw the full CLI output for debugging
            console.error('Vercel CLI error output:', err.stdout || err.stderr || err.message);
            throw new Error('Vercel deployment failed. CLI output:\n' + (err.stdout || err.stderr || err.message));
        }
        // Extract deployment URL from Vercel output
        const match = stdout.match(/https:\/\/[^\s]+/);
        if (!match) {
            throw new Error('Vercel deployment failed. No deployment URL found. CLI output:\n' + stdout);
        }
        const deploymentUrl = match[0];

        return deploymentUrl;
    } catch (error) {
        console.error('Vercel deployment error:', error);
        throw error;
    } finally {
        // Clean up temp directory in finally block to ensure it runs even if there's an error
        if (tempDir) {
            await cleanupTempDirectory(tempDir);
        }
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