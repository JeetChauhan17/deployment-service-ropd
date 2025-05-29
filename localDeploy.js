const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Local deployment configuration
const DEPLOY_DIR = path.join(__dirname, 'deployed');
const PORT = process.env.PORT || 3000;
const BASE_DOMAIN = 'web.net'; // Base domain for all deployments

function generateRandomSubdomain() {
    // Generate a random string of 6 characters
    const randomString = crypto.randomBytes(3).toString('hex');
    // Generate a random number between 100 and 999
    const randomNumber = Math.floor(Math.random() * 900) + 100;
    return `${randomString}${randomNumber}`;
}

async function deployLocally() {
    try {
        // Create deployment directory if it doesn't exist
        await fs.mkdir(DEPLOY_DIR, { recursive: true });

        // Get all files from repo directory
        const repoPath = path.join(__dirname, 'repo');
        const files = await getAllFiles(repoPath);

        if (files.length === 0) {
            throw new Error('No files found in the repo directory');
        }

        // Generate a unique deployment ID and subdomain
        const deploymentId = crypto.randomBytes(4).toString('hex');
        const subdomain = generateRandomSubdomain();
        const deploymentPath = path.join(DEPLOY_DIR, deploymentId);
        await fs.mkdir(deploymentPath, { recursive: true });

        // Copy each file to the deployment directory
        for (const file of files) {
            const relativePath = path.relative(repoPath, file);
            const targetPath = path.join(deploymentPath, relativePath);
            
            // Create target directory if it doesn't exist
            await fs.mkdir(path.dirname(targetPath), { recursive: true });
            
            // Copy the file
            await fs.copyFile(file, targetPath);
            console.log(`Deployed: ${relativePath}`);
        }

        // Store the subdomain mapping
        const mappingPath = path.join(DEPLOY_DIR, 'mappings.json');
        let mappings = {};
        try {
            const mappingData = await fs.readFile(mappingPath, 'utf8');
            mappings = JSON.parse(mappingData);
        } catch (error) {
            // File doesn't exist or is invalid, start with empty mappings
        }

        // Add new mapping
        mappings[subdomain] = deploymentId;
        await fs.writeFile(mappingPath, JSON.stringify(mappings, null, 2));

        // Return the local URL with random subdomain
        return `http://${subdomain}.${BASE_DOMAIN}:${PORT}`;
    } catch (error) {
        console.error('Local deployment error:', error);
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
    deployLocally
}; 