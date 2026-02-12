const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { v4: uuidv4 } = require('uuid');
const faker = require('faker');
const readline = require('readline');
const { HttpsProxyAgent } = require('https-proxy-agent');

const colors = {
  reset: '\x1b[0m', cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', white: '\x1b[37m', bold: '\x1b[1m',
};
const logger = {
  info: (msg) => console.log(`${colors.white}[➤] ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}[⚠] ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}[✗] ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}[✅] ${msg}${colors.reset}`),
  loading: (msg) => console.log(`${colors.cyan}[➤] ${msg}${colors.reset}`),
  step: (msg) => console.log(`\n${colors.cyan}${colors.bold}[➤] ${msg}${colors.reset}`),
  banner: () => {
    console.log(`${colors.cyan}${colors.bold}`);
    console.log(`---------------------------------------------`);
    console.log(`---------------------------------------------${colors.reset}\n`);
  },
};
const BASE = 'https://beem.me';
const ACCOUNTS_FILE = path.join(process.cwd(), 'accounts.json');
const INVITE_FILE = path.join(process.cwd(), 'code.txt');
const PROXIES_FILE = path.join(process.cwd(), 'proxies.txt');
const FALLBACK_AVATAR_URLS = [
    'https://d1yj5w0tyr8x9g.cloudfront.net/fc477051-af2a-11f0-8560-16ffcf7c6dc9/4455-Alexzy01-ppic.jpeg',
    'https://d1yj5w0tyr8x9g.cloudfront.net/115e64f4-af2a-11f0-8560-16ffcf7c6dc9/4422-seolyoona-ppic.jpeg',
];

function readJSONSafe(file, def) { if (!fs.existsSync(file)) return def; try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return def; } }
function writeJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); }
