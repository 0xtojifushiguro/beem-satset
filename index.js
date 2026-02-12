const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { v4: uuidv4 } = require('uuid');
const faker = require('faker');
const readline = require('readline');
const { HttpsProxyAgent } = require('https-proxy-agent');

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

const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
];
const randomUA = () => UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
const sleep = (ms) => new Promise(res => setTimeout(res, ms));
const jitter = (ms, spread = 0.35) => { const d = Math.floor(ms * spread); const add = Math.floor(Math.random() * (2 * d + 1)) - d; return Math.max(0, ms + add); };

function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}
function readProxies() { if (!fs.existsSync(PROXIES_FILE)) return []; return fs.readFileSync(PROXIES_FILE, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean); }

function proxyToAgent(p) {
    try {
        const proxyRegex = /^([^:]+):([0-9]+)@([^:]+):(.+)$/;
        const match = p.match(proxyRegex);
        let proxyUrl = p;
        if (match) {
            const host = match[1]; const port = match[2]; const username = match[3]; const password = match[4];
            proxyUrl = `http://${username}:${password}@${host}:${port}`;
            logger.info(`Reformatting proxy to: http://****:****@${host}:${port}`);
        }
        if (proxyUrl.startsWith('socks4://') || proxyUrl.startsWith('socks5://')) {
            logger.warn(`Socks proxies are not supported. Skipping proxy: ${p}`);
            return undefined;
        }
        return new HttpsProxyAgent(proxyUrl);
    } catch (e) {
        logger.warn(`Bad proxy "${p}", skipping. (${e.message})`);
        return undefined;
    }
}
