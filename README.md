# Beem GraphQL Automation Script (Node.js)

## Overview
This repository contains a Node.js script (`index.js`) that shows how to interact with a GraphQL API from the command line, including:
- an Axios HTTP client with rotating User-Agent headers
- optional HTTP/HTTPS proxy support
- GraphQL queries/mutations via a small `gql()` wrapper
- multipart upload support (GraphQL `Upload`) using `form-data`
- randomized test data generation (for test/staging environments)
- basic pacing via sleep + jitter and defensive error handling

> **Responsible use only.** Use this script **only** on systems you own/control, or where you have **explicit written permission** to automate. Do not use it to violate Terms of Service, policies, or laws.

---

## Project Structure
```
.
├─ index.js
├─ code.txt          # required input (code used by the script)
├─ proxies.txt       # optional input (HTTP/HTTPS proxies, one per line)
├─ accounts.json     # output file (may contain sensitive data)
└─ README.txt
```

---

## Requirements
- Node.js (LTS recommended)
- npm (or yarn)

---

## Quick Start (Copy-Paste)
```bash
# 1) Install dependencies
npm init -y
npm i axios form-data uuid faker https-proxy-agent

# 2) Create required input file (put your code on ONE line)
# macOS/Linux:
echo "YOUR_CODE_HERE" > code.txt
# Windows PowerShell:
# "YOUR_CODE_HERE" | Out-File -Encoding ascii code.txt

# 3) (Optional) Add HTTP/HTTPS proxies (one per line)
# Example:
# echo "http://user:pass@host:port" > proxies.txt

# 4) Run
node index.js
```

---

## Configuration
- The base URL / endpoints are configured inside `index.js`.
- For safer reuse, consider refactoring to environment variables (e.g. `BASE_URL`, timeouts, file paths) instead of hardcoding.

---

## Local Files
### `code.txt` (required)
A single line containing the code used by the script.

### `proxies.txt` (optional)
HTTP/HTTPS proxies only, one per line. Example formats:
```
http://user:pass@host:port
http://host:port
https://host:port
```

### `accounts.json` (output)
The script appends results to this file. It may contain sensitive information (e.g., tokens/credentials depending on API behavior).

---

## Security Notes
- **Do not commit** `accounts.json`, `code.txt`, or `proxies.txt` to a public repository.
- Add this `.gitignore`:

```gitignore
accounts.json
code.txt
proxies.txt
.env
*.log
node_modules/
```

---

## Troubleshooting
- **Proxy not working:** only HTTP/HTTPS proxies are supported. Invalid entries may be skipped.
- **Timeouts / 5xx errors:** can happen due to rate limiting or server instability. Reduce request volume and ensure you have permission to test.
- **Upload failures:** multipart upload can fail depending on server configuration; check logs for response codes and error messages.

---

## Disclaimer
This repository is provided for educational/testing purposes. You are responsible for using it ethically and legally.

---

## License
Choose a license (e.g., MIT) or state “All rights reserved”.
