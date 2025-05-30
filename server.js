require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { deployToVercel } = require('./vercelDeploy');
const { startCronJob, stopCronJob } = require('./cronManager');
const { generateRandomUrl, generateRandomSubdomain } = require('./utils');

const app = express();
const port = process.env.PORT || 3000;
const BASE_DOMAIN = 'web.net';

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer for folder upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const repoPath = path.join(__dirname, 'repo');
        if (!fs.existsSync(repoPath)) {
            fs.mkdirSync(repoPath, { recursive: true });
        }
        cb(null, repoPath);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

// Store deployment state
let deploymentState = {
    latestUrl: '',
    interval: null,
    cronJob: null,
    nextDeployTime: null
};

// Subdomain middleware
app.use((req, res, next) => {
    const host = req.headers.host;
    if (host && host.endsWith(`.${BASE_DOMAIN}:${port}`)) {
        const subdomain = host.split('.')[0];
        const mappingPath = path.join(__dirname, 'deployed', 'mappings.json');
        
        try {
            const mappings = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
            if (mappings[subdomain]) {
                req.deploymentId = mappings[subdomain];
                req.subdomain = subdomain;
            }
        } catch (error) {
            console.error('Error reading mappings:', error);
        }
    }
    next();
});

// Serve deployed files based on subdomain
app.use((req, res, next) => {
    if (req.deploymentId) {
        const deploymentPath = path.join(__dirname, 'deployed', req.deploymentId);
        express.static(deploymentPath)(req, res, next);
    } else {
        next();
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Deploy endpoint
app.post('/deploy', async (req, res) => {
    try {
        const deploymentUrl = await deployToVercel();
        res.json({ 
            success: true, 
            url: deploymentUrl,
            message: 'Deployment successful'
        });
    } catch (error) {
        console.error('Deployment failed:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            message: 'Deployment failed'
        });
    }
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.post('/upload', upload.any(), async (req, res) => {
    try {
        const interval = parseInt(req.body.interval);
        if (isNaN(interval) || interval < 1) {
            return res.status(400).json({ error: 'Invalid interval' });
        }
        if (deploymentState.cronJob) stopCronJob(deploymentState.cronJob);

        const url = await deployToVercel();
        deploymentState.latestUrl = url;
        deploymentState.interval = interval;
        deploymentState.nextDeployTime = Date.now() + interval * 60 * 1000;

        deploymentState.cronJob = startCronJob(interval, async () => {
            const newUrl = await deployToVercel();
            deploymentState.latestUrl = newUrl;
            deploymentState.nextDeployTime = Date.now() + interval * 60 * 1000;
        });

        res.json({ message: 'Deployment successful', url: deploymentState.latestUrl });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/add-files', upload.any(), async (req, res) => {
    try {
        const url = await deployToVercel();
        deploymentState.latestUrl = url;
        deploymentState.nextDeployTime = deploymentState.interval ? Date.now() + deploymentState.interval * 60 * 1000 : null;
        res.json({ message: 'Files added and deployed successfully', url: deploymentState.latestUrl });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/latest-url', (req, res) => {
    res.json({ url: deploymentState.latestUrl });
});

app.get('/next-deploy', (req, res) => {
    res.json({
        nextDeployTime: deploymentState.nextDeployTime,
        interval: deploymentState.interval
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Example deployment URL: http://${generateRandomSubdomain()}.${BASE_DOMAIN}:${port}`);
    console.log('Ready to handle deployments');
}); 