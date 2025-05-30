
const { exec } = require("child_process")
const path = require("path")
const fs = require("fs").promises
const crypto = require("crypto")
const { promisify } = require("util")
const execAsync = promisify(exec)

// Vercel configuration
const VERCEL_PROJECT = process.env.VERCEL_PROJECT || "control-panel-deployments"

function generateRandomSubdomain() {
  const randomString = crypto.randomBytes(3).toString("hex")
  const randomNumber = Math.floor(Math.random() * 900) + 100
  return `${randomString}${randomNumber}`
}

async function detectProjectType(dirPath) {
  const files = await fs.readdir(dirPath)

  if (files.includes("package.json")) {
    const packageJson = JSON.parse(await fs.readFile(path.join(dirPath, "package.json"), "utf8"))
    console.log("Found root package.json, analyzing dependencies...")

    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }

    if (dependencies?.vite || files.includes("vite.config.js") || files.includes("vite.config.ts")) {
      console.log("Detected Vite project")
      return "vite"
    }
    if (dependencies?.next) {
      console.log("Detected Next.js project")
      return "next"
    }
    if (dependencies?.express || dependencies?.koa || dependencies?.fastify || dependencies["@nestjs/core"]) {
      console.log("Detected Node.js server project")
      return "node"
    }

    // Check for React without Vite or Next
    if (dependencies?.react) {
      console.log("Detected React project")
      return "react"
    }

    // If it has package.json but we couldn't determine specific type
    console.log("Detected generic Node.js project")
    return "node"
  }

  // Check for common static site indicators
  if (files.includes("index.html")) {
    // Look for indicators of specific static frameworks
    if (files.includes("angular.json")) {
      console.log("Detected Angular project")
      return "static"
    }

    if (files.some((file) => file.includes(".vue"))) {
      console.log("Detected Vue project")
      return "static"
    }

    console.log("Detected static HTML project")
    return "static"
  }

  console.log("Could not determine project type, defaulting to static")
  return "static"
}

async function cleanupTempDirectory(tempDir) {
  try {
    // Wait a bit to ensure all file handles are released
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Try to remove files first
    const files = await fs.readdir(tempDir, { withFileTypes: true })
    for (const file of files) {
      const fullPath = path.join(tempDir, file.name)
      if (file.isDirectory()) {
        await cleanupTempDirectory(fullPath)
      } else {
        try {
          await fs.unlink(fullPath)
        } catch (err) {
          console.warn(`Warning: Could not delete file ${fullPath}: ${err.message}`)
        }
      }
    }

    // Then try to remove the directory
    try {
      await fs.rmdir(tempDir)
    } catch (err) {
      console.warn(`Warning: Could not delete directory ${tempDir}: ${err.message}`)
    }
  } catch (error) {
    console.warn(`Warning: Cleanup error for ${tempDir}: ${error.message}`)
  }
}

async function validateDeployable(tempDir) {
  const files = await fs.readdir(tempDir)
  if (files.includes("index.html") || files.includes("package.json")) {
    return true
  }
  throw new Error(
    "Deployment folder must contain either index.html (for static sites) or package.json (for Node/Vite/Next projects).",
  )
}

// Function to fix import statements in JavaScript/JSX files
function fixImportStatements(content) {
  // Fix asset imports - handle various patterns
  content = content.replace(/import\s+(\w+)\s+from\s+['"]\.\/assets\/([^'"]+)['"]?/g, (match, varName, assetPath) => {
    // Ensure the import statement is properly closed
    return `import ${varName} from './assets/${assetPath}'`
  })

  // Fix any malformed import statements with missing quotes
  //it took me 55 minutes to find this on stack overflow -_-

  content = content.replace(/import\s+(\w+)\s+from\s+['"]([^'"]*?)['"]?$/gm, (match, varName, importPath) => {
    // Ensure the import statement has proper quotes
    return `import ${varName} from '${importPath}'`
  })

  // Fix specific patterns that might be broken
  content = content.replace(/from\s+['"]([^'"]*?)['"]?$/gm, (match, importPath) => {
    return `from '${importPath}'`
  })

  return content
}

// New function to prepare Vite project structure
async function prepareViteProject(tempDir) {
  console.log("Preparing Vite project structure...")
  const files = await fs.readdir(tempDir)

  // Create src directory if it doesn't exist
  if (!files.includes("src")) {
    console.log("Creating src directory for Vite project")
    await fs.mkdir(path.join(tempDir, "src"), { recursive: true })
  }

  // Create src/assets directory
  console.log("Creating src/assets directory")
  await fs.mkdir(path.join(tempDir, "src", "assets"), { recursive: true })

  // Move SVG files to src/assets
  const svgFiles = files.filter((file) => file.endsWith(".svg"))
  for (const svgFile of svgFiles) {
    console.log(`Moving ${svgFile} to src/assets`)
    await fs.copyFile(path.join(tempDir, svgFile), path.join(tempDir, "src", "assets", svgFile))
    await fs.unlink(path.join(tempDir, svgFile))
  }

  // Move key files to src directory
  const filesToMove = ["main.jsx", "main.tsx", "App.jsx", "App.tsx", "App.css", "index.css"]
  for (const file of filesToMove) {
    if (files.includes(file)) {
      console.log(`Moving ${file} to src directory`)

      // Read the file content first
      let content = await fs.readFile(path.join(tempDir, file), "utf8")

      // Fix import statements if it's a JS/JSX file
      if (file.endsWith(".jsx") || file.endsWith(".js") || file.endsWith(".tsx") || file.endsWith(".ts")) {
        console.log(`Fixing import statements in ${file}`)
        content = fixImportStatements(content)

        // Special handling for App.jsx to fix asset imports
        if (file === "App.jsx" || file === "App.tsx") {
          // Fix import paths for SVG files
          content = content.replace(/from ['"]\.\/assets\/([^'"]+)['"]/, "from './assets/$1'")
          content = content.replace(/from ['"]\/([^'"]+\.svg)['"]/, "from './assets/$1'")

          // Fix specific import for react.svg and vite.svg
          content = content.replace(/from ['"]\.\/react\.svg['"]/, "from './assets/react.svg'")
          content = content.replace(/from ['"]\.\/vite\.svg['"]/, "from './assets/vite.svg'")
          content = content.replace(/from ['"]\/vite\.svg['"]/, "from './assets/vite.svg'")
          content = content.replace(/from ['"]\/react\.svg['"]/, "from './assets/react.svg'")
        }
      }

      // Write the fixed content to the new location
      await fs.writeFile(path.join(tempDir, "src", file), content)

      // Remove the original file
      await fs.unlink(path.join(tempDir, file))
    }
  }

  // Handle assets directory if it exists in root
  if (files.includes("assets")) {
    console.log("Moving assets directory content to src/assets")
    const assetFiles = await fs.readdir(path.join(tempDir, "assets"))
    for (const assetFile of assetFiles) {
      await fs.copyFile(path.join(tempDir, "assets", assetFile), path.join(tempDir, "src", "assets", assetFile))
    }
    await fs.rm(path.join(tempDir, "assets"), { recursive: true, force: true })
  }

  // Check if we need to update index.html
  if (files.includes("index.html")) {
    let indexContent = await fs.readFile(path.join(tempDir, "index.html"), "utf8")

    // Update script src if needed
    if (indexContent.includes('src="main.jsx"') || indexContent.includes('src="./main.jsx"')) {
      console.log("Updating index.html to reference src/main.jsx")
      indexContent = indexContent.replace(/src="\.?\/main\.jsx"/g, 'src="/src/main.jsx"')
      await fs.writeFile(path.join(tempDir, "index.html"), indexContent)
    }

    if (indexContent.includes('src="main.tsx"') || indexContent.includes('src="./main.tsx"')) {
      console.log("Updating index.html to reference src/main.tsx")
      indexContent = indexContent.replace(/src="\.?\/main\.tsx"/g, 'src="/src/main.tsx"')
      await fs.writeFile(path.join(tempDir, "index.html"), indexContent)
    }
  }

  // Create a minimal vite.config.js if it doesn't exist
  if (!files.includes("vite.config.js") && !files.includes("vite.config.ts")) {
    console.log("Creating minimal vite.config.js")
    const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
`
    await fs.writeFile(path.join(tempDir, "vite.config.js"), viteConfig)
  }

  // Ensure package.json has the right scripts and dependencies
  if (files.includes("package.json")) {
    const packageJsonPath = path.join(tempDir, "package.json")
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"))

    // Ensure build script exists
    if (!packageJson.scripts || !packageJson.scripts.build) {
      console.log("Adding build script to package.json")
      packageJson.scripts = packageJson.scripts || {}
      packageJson.scripts.build = "vite build"
      packageJson.scripts.preview = "vite preview"
    }

    // Ensure required dependencies exist
    packageJson.devDependencies = packageJson.devDependencies || {}

    if (!packageJson.dependencies?.vite && !packageJson.devDependencies?.vite) {
      console.log("Adding vite to devDependencies")
      packageJson.devDependencies.vite = "^5.0.0"
    }

    if (!packageJson.dependencies?.["@vitejs/plugin-react"] && !packageJson.devDependencies?.["@vitejs/plugin-react"]) {
      console.log("Adding @vitejs/plugin-react to devDependencies")
      packageJson.devDependencies["@vitejs/plugin-react"] = "^4.0.0"
    }

    // Ensure React dependencies exist
    if (!packageJson.dependencies?.react) {
      console.log("Adding React dependencies")
      packageJson.dependencies = packageJson.dependencies || {}
      packageJson.dependencies.react = "^18.2.0"
      packageJson.dependencies["react-dom"] = "^18.2.0"
    }

    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))
  }

  // Final check for App.jsx to ensure asset imports are correct
  const appJsxPath = path.join(tempDir, "src", "App.jsx")
  if (
    await fs
      .access(appJsxPath)
      .then(() => true)
      .catch(() => false)
  ) {
    const appContent = await fs.readFile(appJsxPath, "utf8")
    console.log("Performing final check on App.jsx imports")

    // Create a debug file to see what's in App.jsx
    await fs.writeFile(path.join(tempDir, "app-debug.txt"), appContent)

    // Ensure all SVG imports point to the correct location
    if (appContent.includes("./assets/react.svg") || appContent.includes("/react.svg")) {
      // Check if the file exists in src/assets
      const reactSvgExists = await fs
        .access(path.join(tempDir, "src", "assets", "react.svg"))
        .then(() => true)
        .catch(() => false)

      if (!reactSvgExists) {
        console.log("Creating placeholder react.svg")
        const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="blue" />
</svg>`
        await fs.writeFile(path.join(tempDir, "src", "assets", "react.svg"), placeholderSvg)
      }
    }

    if (appContent.includes("./assets/vite.svg") || appContent.includes("/vite.svg")) {
      // Check if the file exists in src/assets
      const viteSvgExists = await fs
        .access(path.join(tempDir, "src", "assets", "vite.svg"))
        .then(() => true)
        .catch(() => false)

      if (!viteSvgExists) {
        console.log("Creating placeholder vite.svg")
        const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <polygon points="50,10 90,90 10,90" stroke="black" stroke-width="3" fill="yellow" />
</svg>`
        await fs.writeFile(path.join(tempDir, "src", "assets", "vite.svg"), placeholderSvg)
      }
    }
  }

  console.log("Vite project preparation complete")
}

async function deployToVercel() {
  let tempDir
  try {
    // Create a temporary directory for this deployment
    const deploymentId = crypto.randomBytes(4).toString("hex")
    tempDir = path.join(__dirname, "temp", deploymentId)
    await fs.mkdir(tempDir, { recursive: true })

    // Copy files from repo to temp directory
    const repoPath = path.join(__dirname, "repo")
    const files = await getAllFiles(repoPath)

    if (files.length === 0) {
      throw new Error("No files found in the repo directory")
    }

    for (const file of files) {
      const relativePath = path.relative(repoPath, file)
      const targetPath = path.join(tempDir, relativePath)
      await fs.mkdir(path.dirname(targetPath), { recursive: true })
      await fs.copyFile(file, targetPath)
    }

    // Validate deployable
    await validateDeployable(tempDir)

    // Generate random subdomain
    const subdomain = generateRandomSubdomain()

    // Detect project type and create appropriate vercel.json
    const projectType = await detectProjectType(tempDir)
    console.log(`Detected project type: ${projectType}`)

    // Prepare Vite project if needed
    if (projectType === "vite") {
      await prepareViteProject(tempDir)
    }

    const vercelConfig = {
      version: 2,
      public: true,
      alias: [`${subdomain}.vercel.app`],
      builds: [],
      routes: [
        {
          src: "/(.*)",
          dest: "/$1",
        },
      ],
    }

    // Add specific build configuration based on project type
    switch (projectType) {
      case "vite":
        vercelConfig.builds.push({
          src: "package.json",
          use: "@vercel/static-build",
          config: {
            buildCommand: "npm install && npm run build",
            outputDirectory: "dist",
          },
        })
        break
      case "react":
        vercelConfig.builds.push({
          src: "package.json",
          use: "@vercel/static-build",
          config: {
            buildCommand: "npm install && npm run build",
            outputDirectory: "build",
          },
        })
        break
      case "next":
        vercelConfig.builds.push({
          src: "package.json",
          use: "@vercel/next",
        })
        break
      case "node":
        vercelConfig.builds.push({
          src: "package.json",
          use: "@vercel/node",
        })
        break
      case "static":
        vercelConfig.builds = [{ src: "**/*", use: "@vercel/static" }]
        break
      default:
        vercelConfig.builds.push({
          src: "**/*",
          use: "@vercel/static",
        })
    }

    await fs.writeFile(path.join(tempDir, "vercel.json"), JSON.stringify(vercelConfig, null, 2))
    console.log("Created vercel.json configuration")

    // Deploy to Vercel with updated command
    const deployCommand = `vercel deploy --prod --yes --token ${process.env.VERCEL_TOKEN}`
    console.log("Executing Vercel deployment command...")

    let stdout = ""
    try {
      const result = await execAsync(deployCommand, { cwd: tempDir })
      stdout = result.stdout
      console.log("Vercel CLI output:", stdout)
    } catch (err) {
      // Check if we can extract a URL from the error output
      const errorOutput = err.stdout || err.stderr || err.message
      const urlMatch = errorOutput.match(/https:\/\/[^\s]+/)

      if (urlMatch) {
        console.log("Found deployment URL in error output:", urlMatch[0])
        return urlMatch[0]
      }

      // Log and throw the full CLI output for debugging
      console.error("Vercel CLI error output:", errorOutput)
      throw new Error("Vercel deployment failed. CLI output:\n" + errorOutput)
    }

    // Extract deployment URL from Vercel output
    const match = stdout.match(/https:\/\/[^\s]+/)
    if (!match) {
      throw new Error("Vercel deployment failed. No deployment URL found. CLI output:\n" + stdout)
    }
    const deploymentUrl = match[0]
    console.log(`Deployment successful: ${deploymentUrl}`)

    return deploymentUrl
  } catch (error) {
    console.error("Vercel deployment error:", error)
    throw error
  } finally {
    // Clean up temp directory in finally block to ensure it runs even if there's an error
    if (tempDir) {
      await cleanupTempDirectory(tempDir)
    }
  }
}

async function getAllFiles(dirPath) {
  try {
    const files = []
    const items = await fs.readdir(dirPath, { withFileTypes: true })

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name)
      if (item.isDirectory()) {
        files.push(...(await getAllFiles(fullPath)))
      } else {
        files.push(fullPath)
      }
    }

    return files
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log("Repo directory not found, creating it...")
      await fs.mkdir(dirPath, { recursive: true })
      return []
    }
    throw error
  }
}

module.exports = {
  deployToVercel,
}
