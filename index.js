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
        return res.data.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED' || error.response?.status === 504) {
                 if (operationName === 'createLike' || operationName === 'createRepost' || operationName === 'createTweet') {
                     throw new Error(`GQL Gateway Timeout (504): Operation ${operationName}`);
                 }
                throw new Error(`GQL Timeout or Gateway Error (504): Operation ${operationName}`);

            } else if (error.response) {
                 
                if (operationName === 'updateAvatar' && error.response.status === 422) {
                     return { errorStatus: error.response.status, errorData: error.response.data };
                 }
                throw new Error(`GQL HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`);
            } else {
                throw new Error(`GQL Network Error: ${error.message}`);
            }
        }
        throw error;
    }
}

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
        return undefined.
    }
}
function makeClient(proxyStr) {
    const agent = proxyStr ? proxyToAgent(proxyStr) : undefined;
    const instance = axios.create({
        baseURL: BASE,
        timeout: 60000, 
        httpAgent: agent, httpsAgent: agent,
        validateStatus: (s) => s >= 200 && s < 505 
    });
    instance.interceptors.request.use((config) => {
        config.headers = config.headers || {};
        config.headers['accept'] = '*/*';
        config.headers['content-type'] = config.headers['content-type'] || 'application/json';
        config.headers['user-agent'] = randomUA();
        config.headers['sec-ch-ua'] = '"Brave";v="141", "Not?A_Brand";v="8", "Chromium";v="141"';
        config.headers['sec-ch-ua-platform'] = '"Windows"';
        config.headers['sec-ch-ua-mobile'] = '?0';
        config.headers['Referer'] = config.headers['Referer'] || BASE + '/';
        return config;
    });
    return instance;
}
async function gql(client, operationName, variables, query, opts = {}) {
    try {
        const res = await client.post('/gql/query', { operationName, variables, query }, opts);

        if (res.status >= 400) {
            if (operationName === 'updateAvatar' && res.status === 422) {
                return { errorStatus: res.status, errorData: res.data };
            }
             if ((operationName === 'createLike' || operationName === 'createRepost' || operationName === 'createTweet') && res.status === 504) {
                 throw new Error(`GQL Gateway Timeout (504): Operation ${operationName}`);
             }
            throw new Error(`GQL HTTP ${res.status}: ${JSON.stringify(res.data)}`);
        }

        if (res.data.errors) {
            throw new Error(`GQL ERR: ${JSON.stringify(res.data.errors)}`);
        }
function randomEmail() { const u = faker.internet.userName().replace(/[^\w]/g, '').slice(0, 12) + Math.floor(Math.random()*10000); return `${u}@${faker.internet.domainName()}`.toLowerCase(); }
function randomPassword() { return faker.internet.password(12, false, /[A-Za-z0-9]/) + '!' + Math.floor(Math.random()*1000); }
function randomHandle() { const base = faker.internet.userName().replace(/[^\w]/g, '').toLowerCase(); return (base + Math.floor(Math.random() * 10_000)).slice(0, 15); }
function randomBio() { const bios = [ 'building weird internet stuff', 'airdrop enjoyooor', 'onchain everyday, touch grass sometimes', 'ships > talks', 'gm gm', 'pixel vibes + coffee', 'learning, breaking, fixing', 'insiders' ]; return bios[Math.floor(Math.random()*bios.length)]; }
function randomComment() { const comments = [ 'clean take fr','facts 🔥','this goes crazy','nice thread, bookmarked', 'respect the grind','solid alpha tbh','haha this!','underrated point' ]; return comments[Math.floor(Math.random()*comments.length)]; }
function randomPostText() { const seeds = [ 'gm beemers ☀️ shipping mode on', 'testing beem waters… hello world 👋', 'builders build. back to it.', 'note to self: iterate > perfect', 'tiny win today, big steps tomorrow', 'random thought: distribution > discovery', 'vibes immaculate rn' ]; let text = seeds[Math.floor(Math.random()*seeds.length)]; if (Math.random() < 0.35) text += ' #' + faker.hacker.noun(); return text; }
const Q_SIGNUP = `mutation signup($input: SignupInput!) { signup(input: $input) { code __typename } }`;
const Q_LOGIN = `mutation login($email: String!, $password: String!) { login(email: $email, password: $password) { code token refreshToken __typename } }`;
const Q_ME = `query fetchMe { me { id sub name handle email bio photo_url posts_count is_suspended is_name_unchangeable is_profile_completed is_verified is_twitter_legacy has_community_invite is_under_review followings_count followers_count pid ph interests settings twitter_handle created_at distinct_replies_count invite { hashtag __typename } __typename } }`;
const Q_USER_BY_HANDLE = `query fetchUser($handle: String!) { user(handle: $handle) { id handle name bio location website photo_url is_followed created_at followers_count followings_count __typename } }`;
const M_UPDATE_USER = `mutation updateUser($input: UpdateUserInput!) { updateUser(input: $input) { name bio location website photo_url twitter_handle __typename } }`;
const M_CREATE_FOLLOW = `mutation createFollow($userId: Int!) { createFollow(userId: $userId) { followed { is_followed followers_count __typename } __typename } }`;
const TWEET_FRAGMENT = ` fragment tweetFragment on Tweet { id reply_to_id content photos { image alt __typename } is_reposted is_liked is_reported replies_count reposts_count favorites_count reports_count created_at is_edited deleted_at is_content_hidden is_image_hidden languages open_graph_metadata { title description url __typename } block_reason quoting { id content photos { image alt __typename } created_at deleted_at is_content_hidden is_image_hidden block_reason parent { user { handle block_reason __typename } __typename } user { id handle name photo_url is_verified is_twitter_legacy block_reason is_muted __typename } __typename } user { id handle name photo_url is_verified is_twitter_legacy block_reason is_muted __typename } __typename }`;
        
const Q_TWEETS = ` query fetchTweets($from: Int, $limit: Int){ tweets(from: $from, limit: $limit){ id content created_at is_reposted is_liked replies_count reposts_count favorites_count user { id handle name photo_url __typename } __typename } }`;
const M_CREATE_LIKE = `mutation createLike($tweetId: Int!) { createLike(tweetId: $tweetId) { tweet { is_liked favorites_count __typename } __typename } }`;
const M_CREATE_REPOST = `mutation createRepost($tweetId: Int!) { createRepost(tweetId: $tweetId) { ...tweetFragment reposting { ...tweetFragment __typename } __typename } } ${TWEET_FRAGMENT}`;
const M_CREATE_TWEET_REPLY = `mutation createTweet($input: CreateTweetInput!) { createTweet(input: $input) { ...tweetFragment __typename } } ${TWEET_FRAGMENT}`;
async function tryCreatePost(client, token, text) {
    const tries = [
        { qn: 'createTweet', vars: { content: text }, q: `mutation createTweet($content: String!) { createTweet(content: $content) { id __typename } }` },
        { qn: 'createTweet', vars: { input: { content: text } }, q: `mutation createTweet($input: CreateTweetInput!) { createTweet(input: $input) { id __typename } }` },
        { qn: 'createPost', vars: { content: text }, q: `mutation createPost($content: String!) { createPost(content: $content) { id __typename } }` },
        { qn: 'createStatus', vars: { text }, q: `mutation createStatus($text: String!) { createStatus(text: $text) { id __typename } }` },
    ];
    for (const t of tries) { try { const d = await gql(client, t.qn, t.vars, t.q, { headers: { authorization: `Bearer ${token}` } }); const id = d?.createTweet?.id || d?.createPost?.id || d?.createStatus?.id; if (id) return id; } catch { /* Ignore error, try next */ } }
    throw new Error('No compatible create post mutation worked');
}
function guessExtAndType(buf) {
    if (buf[0] === 0x89 && buf[1] === 0x50) return { ext: 'png', ctype: 'image/png' };
    if (buf[0] === 0xFF && buf[1] === 0xD8) return { ext: 'jpeg', ctype: 'image/jpeg' };
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[8] === 0x57 && buf[9] === 0x45) return { ext: 'webp', ctype: 'image/webp' };
    return { ext: 'jpeg', ctype: 'image/jpeg' };
}
async function uploadAvatarOnlineMultipart(client, token, userHandle) {
    const imageUrl = `https://picsum.photos/seed/${uuidv4()}/256/256.jpg`;
    let buf, ctype, ext, filename, uploadError = null;

    try {
        logger.loading(`Fetching avatar source from: ${imageUrl.slice(0, 30)}...`);
        const img = await client.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
        buf = Buffer.from(img.data);
        ({ ext, ctype } = guessExtAndType(buf));
        filename = `image_${uuidv4().substring(0, 8)}.${ext}`; 

        const form = new FormData();
        const operations = JSON.stringify({ operationName: "updateAvatar", variables: { file: null }, query: "mutation updateAvatar($file: Upload!) { updateAvatar(file: $file) }" });
        const map = JSON.stringify({ "1": ["variables.file"] });
        form.append('operations', operations); form.append('map', map); form.append('1', buf, { filename, contentType: ctype });

        logger.loading(`Uploading avatar ${filename} (${(buf.length / 1024).toFixed(1)} KB)...`);
        const res = await client.post('/gql/query', form, {
            headers: { ...form.getHeaders(), 'authorization': `Bearer ${token}`, 'accept': '*/*', 'Referer': `${BASE}/${userHandle}` },
            maxContentLength: Infinity, maxBodyLength: Infinity,
            validateStatus: (s) => s >= 200 && s < 505 
        });

    
