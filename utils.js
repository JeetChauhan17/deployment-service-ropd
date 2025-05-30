const crypto = require("crypto")

function generateRandomUrl(baseUrl) {
  const randomString = Math.random().toString(36).substring(2, 15)
  const timestamp = Date.now()
  return `${baseUrl}?v=${timestamp}&key=${randomString}`
}

function generateRandomSubdomain() {
  // Generate a random string of 6 characters
  const randomString = crypto.randomBytes(3).toString("hex")
  // Generate a random number between 100 and 999
  const randomNumber = Math.floor(Math.random() * 900) + 100
  return `${randomString}${randomNumber}`
}

module.exports = {
  generateRandomUrl,
  generateRandomSubdomain,
}
