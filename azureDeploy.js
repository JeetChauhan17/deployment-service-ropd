const { BlobServiceClient } = require("@azure/storage-blob")
const path = require("path")
const fs = require("fs").promises

// Azure Storage configuration
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || "$web"

if (!connectionString) {
  throw new Error("AZURE_STORAGE_CONNECTION_STRING environment variable is not set")
}

async function deployToAzure() {
  try {
    // Create BlobServiceClient
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
    const containerClient = blobServiceClient.getContainerClient(containerName)

    // Get all files from repo directory
    const repoPath = path.join(__dirname, "repo")
    const files = await getAllFiles(repoPath)

    if (files.length === 0) {
      throw new Error("No files found in the repo directory")
    }

    // Upload each file
    for (const file of files) {
      const relativePath = path.relative(repoPath, file)
      const blobName = relativePath.replace(/\\/g, "/") // Convert Windows paths to URL format
      const blockBlobClient = containerClient.getBlockBlobClient(blobName)

      const fileContent = await fs.readFile(file)
      await blockBlobClient.upload(fileContent, fileContent.length)
      console.log(`Uploaded: ${blobName}`)
    }

    // Get the static website URL
    const accountName = connectionString.match(/AccountName=([^;]+)/)[1]
    if (!accountName) {
      throw new Error("Could not extract account name from connection string")
    }

    return `https://${accountName}.z13.web.core.windows.net`
  } catch (error) {
    console.error("Azure deployment error:", error)
    throw error
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
  deployToAzure,
}
