import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [files, setFiles] = useState([])
  const [interval, setInterval] = useState(5)
  const [latestUrl, setLatestUrl] = useState('')
  const [isDeploying, setIsDeploying] = useState(false)

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files))
  }

  const handleIntervalChange = (e) => {
    setInterval(parseInt(e.target.value))
  }

  const handleDeploy = async (e) => {
    e.preventDefault()
    setIsDeploying(true)

    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file)
    })
    formData.append('interval', interval)

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      const data = await response.json()
      setLatestUrl(data.url)
    } catch (error) {
      console.error('Deployment error:', error)
    } finally {
      setIsDeploying(false)
    }
  }

  const handleAddFiles = async (e) => {
    e.preventDefault()
    setIsDeploying(true)

    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file)
    })

    try {
      const response = await fetch('/api/add-files', {
        method: 'POST',
        body: formData
      })
      const data = await response.json()
      setLatestUrl(data.url)
    } catch (error) {
      console.error('Add files error:', error)
    } finally {
      setIsDeploying(false)
    }
  }

  useEffect(() => {
    const fetchLatestUrl = async () => {
      try {
        const response = await fetch('/api/latest-url')
        const data = await response.json()
        setLatestUrl(data.url)
      } catch (error) {
        console.error('Error fetching latest URL:', error)
      }
    }

    fetchLatestUrl()
  }, [])

  return (
    <div className="container mt-5">
      <h1 className="text-center mb-4">Control Panel Deployment System</h1>
      
      {latestUrl && (
        <div className="alert alert-success" role="alert">
          Latest Deployment URL: <a href={latestUrl} target="_blank" rel="noopener noreferrer">{latestUrl}</a>
        </div>
      )}

      <div className="row">
        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Upload Website Folder</h5>
              <form onSubmit={handleDeploy}>
                <div className="mb-3">
                  <label htmlFor="files" className="form-label">Select Files</label>
                  <input
                    type="file"
                    className="form-control"
                    id="files"
                    multiple
                    onChange={handleFileChange}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="interval" className="form-label">Redeployment Interval (minutes)</label>
                  <input
                    type="number"
                    className="form-control"
                    id="interval"
                    value={interval}
                    onChange={handleIntervalChange}
                    min="1"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isDeploying}
                >
                  {isDeploying ? 'Deploying...' : 'Deploy'}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Add More Files</h5>
              <form onSubmit={handleAddFiles}>
                <div className="mb-3">
                  <label htmlFor="addFiles" className="form-label">Select Additional Files</label>
                  <input
                    type="file"
                    className="form-control"
                    id="addFiles"
                    multiple
                    onChange={handleFileChange}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={isDeploying}
                >
                  {isDeploying ? 'Adding Files...' : 'Add Files'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App 