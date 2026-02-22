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

        if (res.status === 422) {
            uploadError = new Error(`Upload failed with 422: ${JSON.stringify(res.data)}`);
            logger.warn(`Avatar upload failed (422 Unprocessable). Trying fallback...`);
        } else if (res.status >= 400) {
            uploadError = new Error(`Upload HTTP ${res.status}: ${JSON.stringify(res.data)}`);
            logger.warn(`Avatar upload failed (${res.status}). Trying fallback...`);
        } else if (res.data.errors) {
            uploadError = new Error(`Upload GQL ERR: ${JSON.stringify(res.data.errors)}`);
            logger.warn(`Avatar upload failed (GQL Error). Trying fallback...`);
        } else {
            const avatarUrl = res.data?.data?.updateAvatar;
            if (!avatarUrl) {
                 uploadError = new Error('Upload succeeded but no URL was returned.');
                 logger.warn(`${uploadError.message} Trying fallback...`);
            } else {
                logger.success(`Avatar updated from Picsum (${ext}). URL: ${avatarUrl}`);
                return avatarUrl; 
            }
        }

    } catch (fetchOrBuildError) {
        uploadError = fetchOrBuildError; 
        logger.warn(`Avatar fetch/build failed: ${fetchOrBuildError.message}. Trying fallback...`);
    }

    if (uploadError && FALLBACK_AVATAR_URLS.length > 0) {
        const fallbackUrl = FALLBACK_AVATAR_URLS[Math.floor(Math.random() * FALLBACK_AVATAR_URLS.length)];
        try {
            logger.loading(`Attempting to set avatar to fallback URL: ${fallbackUrl.slice(0, 50)}...`);
            const fallbackInput = { photo_url: fallbackUrl };
            
            await gql(client, 'updateUser', { input: fallbackInput }, M_UPDATE_USER, {
                headers: { authorization: `Bearer ${token}` }
            });
            logger.success(`Avatar successfully set using fallback URL.`);
            return fallbackUrl; 
        } catch (fallbackGqlError) {
            logger.error(`Setting fallback avatar URL failed: ${fallbackGqlError.message}`);
            
            throw uploadError;
        }
    } else if (uploadError) {
        
        throw uploadError;
    } else {
         
         throw new Error('Unknown error during avatar processing.');
    }
}

async function tryGetTweets(client, token, pageFrom = null) {
    const vars = { limit: 10 };
    if (pageFrom != null) vars.from = pageFrom;
    try {
        const data = await gql(client, 'fetchTweets', vars, Q_TWEETS, { headers: { authorization: `Bearer ${token}` } });
        return Array.isArray(data?.tweets) ? data.tweets : [];
    } catch (e) {
        logger.warn(`Failed to fetch tweets: ${e.message}`);
        return [];
    }
}

async function interactOnTweets(client, token, tweets) {
    for (const t of tweets) {
        const tweetId = t.id;
        const tweetAuthorId = t.user?.id;
        const authorHandle = t.user?.handle || 'user';

        if (!tweetId) continue;

        try {
            await gql(client, 'createLike', { tweetId }, M_CREATE_LIKE, { headers: { authorization: `Bearer ${token}` } });
            logger.info(`Liked tweet #${tweetId}`);
            await sleep(jitter(900, 0.5));
        } catch (e) {
            logger.warn(`Like tweet #${tweetId} failed: ${e.message}`);
        }

        try {
            await gql(client, 'createRepost', { tweetId }, M_CREATE_REPOST, { headers: { authorization: `Bearer ${token}` } });
            logger.info(`Reposted tweet #${tweetId}`);
            await sleep(jitter(1100, 0.5));
        } catch (e) {
            logger.warn(`Repost tweet #${tweetId} failed: ${e.message}`);
        }

        if (tweetAuthorId) {
            try {
                const content = randomComment();
                const replyInput = { content, photos: [], reply_to_id: tweetId, reply_to_user_id: tweetAuthorId };
                await gql(client, 'createTweet', { input: replyInput }, M_CREATE_TWEET_REPLY, {
                    headers: { authorization: `Bearer ${token}`, Referer: `${BASE}/${authorHandle}/status/${tweetId}` }
                });
                logger.info(`Replied to tweet #${tweetId}: "${content}"`);
                await sleep(jitter(1300, 0.5));
            } catch (e) {
                logger.warn(`Reply to tweet #${tweetId} failed: ${e.message}`);
            }
        } else {
            logger.warn(`Skipping reply to tweet #${tweetId} because author ID is missing.`);
        }
    }
}

async function firebaseOptional(client, token) { try { const data = await gql(client, 'firebaseToken', {}, `mutation firebaseToken { firebaseToken }`, { headers: { authorization: `Bearer ${token}` } }); if (!data?.firebaseToken) return; const fk = 'AIzaSyA3sxBruo7eDdODPjUxJpLronSQ6jxB8pc'; const r1 = await client.post( `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${fk}`, { token: data.firebaseToken, returnSecureToken: true }, { headers: { 'content-type': 'application/json' } } ); if (r1.status >= 400) throw new Error(JSON.stringify(r1.data)); logger.info(`Firebase sign-in ok (isNewUser=${r1.data?.isNewUser})`); } catch (e) { logger.warn(`Firebase optional step skipped: ${e.message}`); } }

async function ensureFollow(client, token, includeHandle, wantedCount = 10) { const targetHandles = new Set([includeHandle, 'farcaster', 'patrikios']); try { const data = await gql(client, 'fetchFollowRecommendations', {}, ` query fetchFollowRecommendations { followRecommendations { handle } }`, { headers: { authorization: `Bearer ${token}` } }); for (const r of (data?.followRecommendations || [])) { if (r?.handle) targetHandles.add(r.handle); if (targetHandles.size >= wantedCount) break; } } catch { /* Ignore error */ } logger.loading(`Following ${targetHandles.size} target users...`); for (const h of Array.from(targetHandles).slice(0, wantedCount)) { try { const data = await gql(client, 'fetchUser', { handle: h }, Q_USER_BY_HANDLE, { headers: { authorization: `Bearer ${token}` } }); const id = data?.user?.id; if (!id) continue; await gql(client, 'createFollow', { userId: id }, M_CREATE_FOLLOW, { headers: { authorization: `Bearer ${token}` } }); logger.info(`Followed @${h}`); await sleep(jitter(700, 0.5)); } catch (e) { logger.warn(`Follow @${h} failed: ${e.message}`); } } logger.success('Follow task complete.'); }

async function createAndRunAccount(index, inviteCode, proxyStr) {
    const client = makeClient(proxyStr);
    const handle = randomHandle();
    const email = randomEmail();
    const password = randomPassword();
    let userHandle = handle;

    logger.step(`Account #${index + 1}`);
    logger.info(`Using proxy: ${proxyStr || '(none)'}`);
    logger.info(`Handle: ${handle} | Email: ${email}`);

    logger.loading('Signing up…');
    const signupInput = { handle, email, password, invite_key: inviteCode };
    try { await gql(client, 'signup', { input: signupInput }, Q_SIGNUP); logger.success('Signup submitted'); }
    catch (e) { logger.warn(`Signup error: ${e.message}. Will try login.`); }
    await sleep(jitter(900, 0.5));

    logger.loading('Logging in…');
    const l = await gql(client, 'login', { email, password }, Q_LOGIN);
    const token = l?.login?.token;
    if (!token) throw new Error('No token from login');
    logger.success('Login ok');

    try {
        const me = await gql(client, 'fetchMe', {}, Q_ME, { headers: { authorization: `Bearer ${token}` } });
        const my = me?.me || {};
        userHandle = my.handle || handle; 
        logger.info(`UID ${my.id || 'N/A'} | handle @${userHandle} | posts ${my.posts_count ?? 'N/A'}`);
    } catch (e) {
        logger.warn(`Failed to fetch user details after login: ${e.message}. Using generated handle @${userHandle}`);
    }

    await firebaseOptional(client, token);

    const safeName = (faker.name.findName() || userHandle).replace(/[^\p{L}\s'-]/gu, '').trim().slice(0, 24) || userHandle;
    const profileInput = { name: safeName, bio: randomBio().slice(0, 140), location: (faker.address.country() || 'earth').slice(0, 24), website: '' };
    try { await gql(client, 'updateUser', { input: profileInput }, M_UPDATE_USER, { headers: { authorization: `Bearer ${token}` } }); logger.success(`Profile updated`); }
    catch (e1) { logger.warn(`updateUser failed once: ${e1.message}. Retrying minimal...`); try { const minimal = { name: profileInput.name, bio: profileInput.bio }; await gql(client, 'updateUser', { input: minimal }, M_UPDATE_USER, { headers: { authorization: `Bearer ${token}` } }); logger.success(`Profile updated (minimal)`); } catch (e2) { logger.error(`Minimal profile update failed: ${e2.message}`); } }

    try {
        await uploadAvatarOnlineMultipart(client, token, userHandle);
    } catch (e) {
        logger.warn(`Continuing without avatar due to upload error: ${e.message}`);
    }

    await ensureFollow(client, token, 'vikitoshi', 10);

    logger.loading('Fetching feed to find one tweet for interaction...');
    let tweets = await tryGetTweets(client, token, null);
    if (tweets.length > 0) {
        
        const tweetToInteract = tweets[0];
        logger.loading(`Interacting with 1 tweet (ID: #${tweetToInteract.id})…`);
        
        await interactOnTweets(client, token, [tweetToInteract]); 
        logger.success('Single tweet interaction done');
    } else {
        logger.warn('No feed tweets found; skipping interaction.');
    }

    logger.loading('Creating one random post...');
    const content = randomPostText();
    try { 
        const id = await tryCreatePost(client, token, content); 
        logger.success(`Posted (#${id}): "${content.slice(0, 70)}"`); 
    }
    catch (e) { 
        logger.warn(`Post failed (will continue): ${e.message}`); 
    }

    return {
        id: (await gql(client, 'fetchMe', {}, Q_ME, { headers: { authorization: `Bearer ${token}` } }))?.me?.id || null,
        handle: userHandle, email, password, token,
        created_at: new Date().toISOString(), proxy: proxyStr || null
    };
}

(async function main() {
    try {
        logger.banner();

        if (!fs.existsSync(INVITE_FILE)) { logger.error(`Missing ${INVITE_FILE}. Put your invite code inside.`); process.exit(1); }
        const inviteCode = fs.readFileSync(INVITE_FILE, 'utf8').trim();
        if (!inviteCode) { logger.error(`Invite code is empty in ${INVITE_FILE}`); process.exit(1); }

        const countStr = await askQuestion('How many accounts to create? ');
        const count = Number(countStr);
        if (!Number.isInteger(count) || count <= 0) { logger.error('Please input a valid positive number.'); process.exit(1); }

        const proxies = readProxies();
        if (proxies.length) logger.info(`Loaded ${proxies.length} proxies`);
        else logger.warn('No proxies loaded; proceeding without proxies.');

        const existing = readJSONSafe(ACCOUNTS_FILE, []);
        const results = [];

        for (let i = 0; i < count; i++) {
            const proxyStr = proxies.length ? proxies[i % proxies.length] : undefined;
            try {
                const acct = await createAndRunAccount(i, inviteCode, proxyStr);
                results.push(acct);
                existing.push(acct);
                writeJSON(ACCOUNTS_FILE, existing);
                logger.success(`Saved account @${acct.handle} to accounts.json`);
            } catch (e) {
                logger.error(`Account #${i + 1} failed: ${e.message}`);
            }
            await sleep(jitter(2500, 0.5));
        }

        logger.step('Summary');
        results.forEach((r, idx) => { logger.info(`#${idx + 1} @${r.handle} | ${r.email} | uid=${r.id || 'N/A'}`); });
        logger.success(`All done. Stored ${existing.length} accounts in accounts.json`);
    } catch (e) {
        logger.error(e.stack || e.message);
        process.exit(1);
    }
})();
