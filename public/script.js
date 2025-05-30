// Frontend JavaScript for the Folder Deployment Control Panel

const dropArea = document.getElementById("drop-area")
const folderUploadInput = document.getElementById("folderupload")
const selectFolderBtn = document.getElementById("select-folder-btn")
const redeployIntervalInput = document.getElementById("redeploy-interval")
const deployButton = document.getElementById("deploy-button")
const addFilesInput = document.getElementById("add-files")
const addFilesButton = document.getElementById("add-files-button")
const errorMessageDiv = document.getElementById("error-message")
const currentUrlInput = document.getElementById("current-url")
const nextDeploymentInput = document.getElementById("next-deployment")
const deploymentLogsList = document.getElementById("deployment-logs")
const statusMessageDiv = document.getElementById("status-message")
const statusTextSpan = document.getElementById("status-text")

let currentDeploymentUrl = "No deployment yet"

// Helper function to display status messages
function displayStatus(message, type = "info") {
  statusMessageDiv.className = `alert alert-${type} text-center`
  statusTextSpan.textContent = message
}

// Helper function to display error messages
function displayError(message) {
  errorMessageDiv.textContent = message
  errorMessageDiv.style.display = "block"
}

// Helper function to hide error messages
function hideError() {
  errorMessageDiv.style.display = "none"
  errorMessageDiv.textContent = ""
}

// Helper function to add log entries
function addLog(message) {
  const li = document.createElement("li")
  li.className = "list-group-item"
  li.textContent = `[${new Date().toLocaleTimeString()}] ${message}`
  deploymentLogsList.prepend(li)
}

// Update URL display
function updateUrlDisplay(url) {
  currentDeploymentUrl = url
  currentUrlInput.value = url
}

// Handle folder selection via button
selectFolderBtn.addEventListener("click", () => {
  folderUploadInput.click()
})

folderUploadInput.addEventListener("change", (event) => {
  if (event.target.files.length > 0) {
    const folderName = event.target.files[0].webkitRelativePath.split("/")[0]
    displayStatus(`Folder selected: ${folderName}`)
    hideError()
  } else {
    displayStatus("No folder selected", "warning")
  }
})

// Handle drag and drop
;["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  dropArea.addEventListener(eventName, preventDefaults, false)
})
;["dragenter", "dragover"].forEach((eventName) => {
  dropArea.addEventListener(eventName, () => dropArea.classList.add("highlight"), false)
})
;["dragleave", "drop"].forEach((eventName) => {
  dropArea.addEventListener(eventName, () => dropArea.classList.remove("highlight"), false)
})

dropArea.addEventListener("drop", handleDrop, false)

function preventDefaults(e) {
  e.preventDefault()
  e.stopPropagation()
}

function handleDrop(e) {
  const dt = e.dataTransfer
  const files = dt.files
  folderUploadInput.files = files // Assign dropped files to the input
  if (files.length > 0) {
    const folderName = files[0].webkitRelativePath.split("/")[0]
    displayStatus(`Folder selected: ${folderName}`)
    hideError()
  } else {
    displayStatus("No folder selected", "warning")
  }
}

// Handle initial deployment
deployButton.addEventListener("click", async () => {
  const files = folderUploadInput.files
  const interval = redeployIntervalInput.value

  if (files.length === 0) {
    displayError("Please select a folder to deploy")
    return
  }

  if (isNaN(interval) || interval < 1) {
    displayError("Please enter a valid redeployment interval (minutes)")
    return
  }

  hideError()
  displayStatus("Preparing deployment...", "info")
  deployButton.disabled = true
  addFilesButton.disabled = true
  addLog("Initiating deployment...")

  const formData = new FormData()
  for (const file of files) {
    formData.append("files", file)
  }
  formData.append("interval", interval)

  try {
    const response = await fetch("/upload", {
      method: "POST",
      body: formData,
    })

    const data = await response.json()

    if (response.ok) {
      updateUrlDisplay(data.url)
      displayStatus("Deployment successful!", "success")
      addLog(`Deployment successful. URL: ${data.url}`)
      // Logic to display next deployment time can be added here if needed
    } else {
      displayError(data.error || "Deployment failed")
      displayStatus("Deployment failed", "danger")
      addLog(`Deployment failed: ${data.error || response.statusText}`)
    }
  } catch (error) {
    console.error("Deployment error:", error)
    displayError("An error occurred during deployment.")
    displayStatus("Deployment failed", "danger")
    addLog(`An error occurred: ${error.message}`)
  } finally {
    deployButton.disabled = false
    addFilesButton.disabled = false
  }
})

// Handle adding more files
addFilesButton.addEventListener("click", async () => {
  const files = addFilesInput.files

  if (files.length === 0) {
    displayError("Please select files to add")
    return
  }

  hideError()
  displayStatus("Adding files...", "info")
  deployButton.disabled = true
  addFilesButton.disabled = true
  addLog("Adding additional files...")

  const formData = new FormData()
  for (const file of files) {
    formData.append("files", file)
  }

  try {
    const response = await fetch("/add-files", {
      method: "POST",
      body: formData,
    })

    const data = await response.json()

    if (response.ok) {
      updateUrlDisplay(data.url)
      displayStatus("Files added and deployed successfully!", "success")
      addLog(`Files added and deployed. New URL: ${data.url}`)
    } else {
      displayError(data.error || "Failed to add files")
      displayStatus("Adding files failed", "danger")
      addLog(`Failed to add files: ${data.error || response.statusText}`)
    }
  } catch (error) {
    console.error("Add files error:", error)
    displayError("An error occurred while adding files.")
    displayStatus("Adding files failed", "danger")
    addLog(`An error occurred: ${error.message}`)
  } finally {
    deployButton.disabled = false
    addFilesButton.disabled = false
  }
})

// Fetch initial status and latest URL on page load
document.addEventListener("DOMContentLoaded", async () => {
  displayStatus("Fetching status...")
  try {
    const response = await fetch("/latest-url")
    const data = await response.json()
    if (response.ok && data.url) {
      updateUrlDisplay(data.url)
      displayStatus("Ready")
      addLog("Initial URL loaded.")
    } else {
      updateUrlDisplay("No deployment yet")
      displayStatus("No active deployment found", "warning")
      addLog("No active deployment found on startup.")
    }
  } catch (error) {
    console.error("Error fetching initial status:", error)
    displayStatus("Could not fetch initial status", "danger")
    addLog("Failed to fetch initial status.")
  }

  // Poll for latest URL updates (from scheduled deployments)
  setInterval(async () => {
    try {
      const response = await fetch("/latest-url")
      const data = await response.json()
      if (response.ok && data.url && data.url !== currentDeploymentUrl) {
        updateUrlDisplay(data.url)
        addLog("URL updated by scheduled deployment.")
      }
    } catch (error) {
      console.error("Error polling for latest URL:", error)
    }
  }, 10000) // Poll every 10 seconds
})
