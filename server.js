require("dotenv").config()
const express = require("express")
const multer = require("multer")
const path = require("path")
const fs = require("fs").promises
const fsSync = require("fs")
const cors = require("cors")
const { deployToVercel } = require("./vercelDeploy")
const { startCronJob, stopCronJob } = require("./cronManager")
const { generateRandomUrl, generateRandomSubdomain } = require("./utils")

const app = express()
const port = process.env.PORT || 3000
const BASE_DOMAIN = "web.net"

// Middleware
app.use(cors())
app.use(express.json())

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "public")))

// Configure multer for folder upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const repoPath = path.join(__dirname, "repo")
    if (!fsSync.existsSync(repoPath)) {
      fsSync.mkdirSync(repoPath, { recursive: true })
    }
    cb(null, repoPath)
  },
  filename: (req, file, cb) => {
    // Skip node_modules, .git, and other unnecessary files
    if (shouldSkipFile(file.originalname)) {
      console.log(`Excluding file: ${file.originalname}`)
      return cb(null, false)
    }
    cb(null, file.originalname)
  },
})

// Function to determine if a file should be skipped
function shouldSkipFile(filename) {
  const skipPatterns = [
    /node_modules/,
    /\.git/,
    /dist\//,
    /build\//,
    /\.next\//,
    /package-lock\.json/,
    /yarn\.lock/,
    /\.DS_Store/,
  ]

  return skipPatterns.some((pattern) => pattern.test(filename))
}

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (shouldSkipFile(file.originalname)) {
      return cb(null, false)
    }
    cb(null, true)
  },
})

// Store deployment state
const deploymentState = {
  latestUrl: "",
  interval: null,
  cronJob: null,
  nextDeployTime: null,
}

// Subdomain middleware
app.use((req, res, next) => {
  const host = req.headers.host
  if (host && host.endsWith(`.${BASE_DOMAIN}:${port}`)) {
    const subdomain = host.split(".")[0]
    const mappingPath = path.join(__dirname, "deployed", "mappings.json")

    try {
      const mappings = JSON.parse(fsSync.readFileSync(mappingPath, "utf8"))
      if (mappings[subdomain]) {
        req.deploymentId = mappings[subdomain]
        req.subdomain = subdomain
      }
    } catch (error) {
      console.error("Error reading mappings:", error)
    }
  }
  next()
})

// Serve deployed files based on subdomain
app.use((req, res, next) => {
  if (req.deploymentId) {
    const deploymentPath = path.join(__dirname, "deployed", req.deploymentId)
    express.static(deploymentPath)(req, res, next)
  } else {
    next()
  }
})

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" })
})

// Deploy endpoint
app.post("/deploy", async (req, res) => {
  try {
    const deploymentUrl = await deployToVercel()
    res.json({
      success: true,
      url: deploymentUrl,
      message: "Deployment successful",
    })
  } catch (error) {
    console.error("Deployment failed:", error)
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Deployment failed",
    })
  }
})

// Serve the main page
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html")
})

// Clean up uploaded files and validate project structure
async function processUploadedFiles() {
  const repoPath = path.join(__dirname, "repo")
  console.log("Cleaning up uploaded files...")

  // Remove any node_modules, .git, etc. that might have been uploaded
  try {
    const entries = await fs.readdir(repoPath, { withFileTypes: true })
    for (const entry of entries) {
      if (shouldSkipFile(entry.name)) {
        const fullPath = path.join(repoPath, entry.name)
        if (entry.isDirectory()) {
          await fs.rm(fullPath, { recursive: true, force: true })
        } else {
          await fs.unlink(fullPath)
        }
        console.log(`Removed: ${entry.name}`)
      }
    }
    console.log("File cleanup completed")
  } catch (error) {
    console.error("Error cleaning up files:", error)
  }

  // Validate project structure
  try {
    const files = await fs.readdir(repoPath)
    console.log(`Validating project structure. Found ${files.length} files`)

    // Check for package.json
    if (files.includes("package.json")) {
      console.log("Valid project package.json found: hooks")

      // Filter out directories
      const validFiles = []
      for (const file of files) {
        const stats = await fs.stat(path.join(repoPath, file))
        if (stats.isFile()) {
          validFiles.push(file)
        }
      }

      console.log(`Found ${validFiles.length} valid project files:`, validFiles)
    }

    console.log("Project structure validation passed")
    return true
  } catch (error) {
    console.error("Project validation error:", error)
    return false
  }
}
// bruhhhhh-_-
app.post("/upload", upload.any(), async (req, res) => {
  try {
    console.log("Received upload request with files:", req.files?.length || 0)

    // Process and validate uploaded files
    await processUploadedFiles()

    const interval = Number.parseInt(req.body.interval)
    if (isNaN(interval) || interval < 1) {
      return res.status(400).json({ error: "Invalid interval" })
    }
    if (deploymentState.cronJob) stopCronJob(deploymentState.cronJob)

    console.log("Starting deployment process")
    const url = await deployToVercel()
    deploymentState.latestUrl = url
    deploymentState.interval = interval
    deploymentState.nextDeployTime = Date.now() + interval * 60 * 1000

    console.log(`Setting up cron job with ${interval} minute interval`)
    deploymentState.cronJob = startCronJob(interval, async () => {
      try {
        console.log("Running scheduled deployment")
        const newUrl = await deployToVercel()
        deploymentState.latestUrl = newUrl
        deploymentState.nextDeployTime = Date.now() + interval * 60 * 1000
        console.log("Scheduled deployment successful:", newUrl)
      } catch (error) {
        console.error("Scheduled deployment failed:", error)
      }
    })

    res.json({
      message: "Deployment successful",
      url: deploymentState.latestUrl,
      nextDeployment: deploymentState.nextDeployTime ? new Date(deploymentState.nextDeployTime).toISOString() : null,
    })
  } catch (error) {
    console.error("Upload endpoint error:", error)
    res.status(500).json({ error: error.message })
  }
})

app.post("/add-files", upload.any(), async (req, res) => {
  try {
    console.log("Received add-files request with files:", req.files?.length || 0)

    // Process and validate uploaded files
    await processUploadedFiles()

    const url = await deployToVercel()
    deploymentState.latestUrl = url
    deploymentState.nextDeployTime = deploymentState.interval ? Date.now() + deploymentState.interval * 60 * 1000 : null
    res.json({
      message: "Files added and deployed successfully",
      url: deploymentState.latestUrl,
      nextDeployment: deploymentState.nextDeployTime ? new Date(deploymentState.nextDeployTime).toISOString() : null,
    })
  } catch (error) {
    console.error("Add-files endpoint error:", error)
    res.status(500).json({ error: error.message })
  }
})

app.get("/latest-url", (req, res) => {
  res.json({ url: deploymentState.latestUrl })
})

app.get("/deployment-status", (req, res) => {
  res.json({
    latestUrl: deploymentState.latestUrl || null,
    interval: deploymentState.interval || null,
    nextDeployTime: deploymentState.nextDeployTime || null,
    cronJobActive: !!deploymentState.cronJob,
    serverTime: new Date().toISOString(),
  })
})

app.get("/next-deploy", (req, res) => {
  res.json({
    nextDeployTime: deploymentState.nextDeployTime,
    interval: deploymentState.interval,
  })
})

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
  console.log(`Example deployment URL: http://${generateRandomSubdomain()}.${BASE_DOMAIN}:${port}`)
  console.log("Ready to handle deployments")

  console.log(`
📁 IMPORTANT: When uploading projects, exclude these directories:
   - node_modules/
   - .git/
   - dist/ or build/
   - .next/

✅ Include only your source files:
   - src/
   - public/
   - package.json
   - index.html
   - vite.config.js (if using Vite)`)
})
