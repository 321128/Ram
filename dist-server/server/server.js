import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import bodyParser from 'body-parser';
import fs from 'fs';
// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Resolve repo root relative to compiled file location so it works from ts-node and dist-server
const ROOT_DIR = path.resolve(__dirname, '..', '..');
// ----- Server State -----
const currentState = {
    scene: '1',
    cueIndex: 0,
    playbackRate: 1.0,
    isPaused: true,
    anchor: { serverTimeEpochMs: Date.now(), mediaTimeSec: 0 },
};
// Utility to update anchor when state changes related to time
function setAnchorFromNow(mediaTimeSec) {
    currentState.anchor = { serverTimeEpochMs: Date.now(), mediaTimeSec };
}
function setAnchorFromClient(anchor, trustClientTime = false) {
    if (anchor && typeof anchor.mediaTimeSec === 'number') {
        const serverTimeEpochMs = trustClientTime && typeof anchor.serverTimeEpochMs === 'number'
            ? anchor.serverTimeEpochMs
            : Date.now();
        currentState.anchor = {
            serverTimeEpochMs,
            mediaTimeSec: anchor.mediaTimeSec,
        };
    }
    else {
        currentState.anchor = {
            serverTimeEpochMs: Date.now(),
            mediaTimeSec: currentState.anchor.mediaTimeSec,
        };
    }
}
// ----- App Setup -----
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
app.use(bodyParser.json());
// CORS for local dev convenience
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS')
        return res.sendStatus(200);
    next();
});
// ----- Static -----
// Serve public assets (Audio) directly
const distDir = path.join(ROOT_DIR, 'dist');
const publicDir = path.join(ROOT_DIR, 'public');
console.log(`Serving public assets from: ${publicDir}`);
console.log(`Serving built SPAs from: ${distDir}`);
app.use('/public/Audio', express.static(path.join(ROOT_DIR, 'public/Audio'), {
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
    }
}));
app.use('/public', express.static(path.join(ROOT_DIR, 'public')));
app.use('/public', express.static(publicDir));
// 3a) Serve built assets at root (so /assets/*.js works everywhere)
app.use('/assets', express.static(path.join(distDir, 'assets'), { immutable: true, maxAge: '1y' }));
// Optional helpful statics at root:
app.use('/favicon.ico', express.static(path.join(distDir, 'favicon.ico')));
app.use('/sw.js', express.static(path.join(distDir, 'sw.js')));
app.use('/manifest.webmanifest', express.static(path.join(distDir, 'manifest.webmanifest')));
app.use('/robots.txt', express.static(path.join(distDir, 'robots.txt')));
// (optional) if you want to serve built Audio copied into dist
app.use('/Audio', express.static(path.join(distDir, 'Audio')));
// Serve SPA shell under both prefixes
app.use(['/frontx', '/fronty'], express.static(distDir));
// Fallback HTML for client-side routing (AFTER statics)
app.get(['/frontx/*', '/fronty/*'], (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
});
// 3d) Root redirect (choose your default)
app.get('/', (_req, res) => res.redirect('/fronty'));
// ----- REST: Manifest -----
// The repo has play data at src/data/playData.json with structure scenes -> dialogs[] with audioFile and duration.
// We'll map to expected shape: [{cueId, audioFileHi, audioFileEn, duration}]
// For now, we mirror audioFile to both languages if only one is available.
function loadPlayData() {
    const p = path.join(ROOT_DIR, 'src', 'data', 'playData.json');
    console.log("Attempting to read playData from:", p);
    try {
        const raw = fs.readFileSync(p, 'utf-8');
        return JSON.parse(raw);
    }
    catch (e) {
        console.error('Failed to load playData.json', e);
        return null;
    }
}
app.get('/manifest/:sceneId', (req, res) => {
    const { sceneId } = req.params;
    const data = loadPlayData();
    // Debug logging
    console.log("Requested scene:", sceneId);
    if (data && data.scenes) {
        console.log("Available scenes:", Object.keys(data.scenes));
    }
    else {
        console.log("No scenes found in playData.json");
    }
    if (!data || !data.scenes || !data.scenes[sceneId]) {
        return res.status(404).json({ error: 'Scene not found' });
    }
    const dialogs = data.scenes[sceneId].dialogs || [];
    const cues = dialogs.map((d) => ({
        cueId: String(d.cueId ?? ''),
        audioFileHi: d.audioFile ?? null,
        audioFileEn: d.audioFile ?? null,
        duration: typeof d.duration === 'number' ? d.duration : null,
    }));
    res.json(cues);
});
// ----- REST: Current State -----
app.get('/current', (_req, res) => {
    res.json(currentState);
});
// ----- REST: Update State -----
app.post('/update', (req, res) => {
    const { scene, cueIndex, playbackRate, isPaused, anchor } = req.body || {};
    if (scene !== undefined)
        currentState.scene = scene;
    if (typeof cueIndex === 'number')
        currentState.cueIndex = cueIndex;
    if (typeof playbackRate === 'number')
        currentState.playbackRate = playbackRate;
    if (typeof isPaused === 'boolean')
        currentState.isPaused = isPaused;
    if (anchor && typeof anchor.mediaTimeSec === 'number') {
        setAnchorFromNow(anchor.mediaTimeSec);
    }
    else {
        // If time-impacting fields changed and no anchor provided, keep anchor but refresh server time
        currentState.anchor.serverTimeEpochMs = Date.now();
    }
    broadcastStateEvents(req.body);
    res.json({ ok: true });
});
// ----- WebSocket -----
// Broadcast helper
function wsBroadcast(obj) {
    const payload = JSON.stringify(obj);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}
function nowWithStamp() {
    return Date.now();
}
function helloEvent() {
    return { type: 'HELLO', serverTimeEpochMs: nowWithStamp() };
}
function stateEvent() {
    return { type: 'STATE', serverTimeEpochMs: nowWithStamp(), state: currentState };
}
function sceneLoadEvent(scene) {
    return { type: 'SCENE_LOAD', serverTimeEpochMs: nowWithStamp(), scene };
}
function cueEvent(index) {
    return { type: 'CUE', serverTimeEpochMs: nowWithStamp(), cueIndex: index };
}
function pauseEvent() {
    return { type: 'PAUSE', serverTimeEpochMs: nowWithStamp() };
}
function resumeEvent() {
    return { type: 'RESUME', serverTimeEpochMs: nowWithStamp() };
}
function seekEvent(mediaTimeSec) {
    return { type: 'SEEK', serverTimeEpochMs: nowWithStamp(), mediaTimeSec };
}
function rateEvent(rate) {
    return { type: 'RATE', serverTimeEpochMs: nowWithStamp(), playbackRate: rate };
}
function heartbeatEvent() {
    return { type: 'HEARTBEAT', serverTimeEpochMs: nowWithStamp() };
}
function pongEvent() {
    return { type: 'PONG', serverTimeEpochMs: nowWithStamp() };
}
// When REST /update is called, emit granular events for FrontY listeners
function broadcastStateEvents(updateBody) {
    if (!updateBody || typeof updateBody !== 'object') {
        wsBroadcast(stateEvent());
        return;
    }
    // Always broadcast STATE after granular ones
    const granular = [];
    if (updateBody.scene !== undefined)
        granular.push(sceneLoadEvent(updateBody.scene));
    if (typeof updateBody.cueIndex === 'number')
        granular.push(cueEvent(updateBody.cueIndex));
    if (typeof updateBody.isPaused === 'boolean')
        granular.push(updateBody.isPaused ? pauseEvent() : resumeEvent());
    if (typeof updateBody.playbackRate === 'number')
        granular.push(rateEvent(updateBody.playbackRate));
    if (updateBody.anchor && typeof updateBody.anchor.mediaTimeSec === 'number')
        granular.push(seekEvent(updateBody.anchor.mediaTimeSec));
    granular.forEach(wsBroadcast);
    wsBroadcast(stateEvent());
}
wss.on('connection', (ws) => {
    // On connect: send HELLO and current STATE
    ws.send(JSON.stringify(helloEvent()));
    ws.send(JSON.stringify(stateEvent()));
    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(String(raw));
            switch (msg.type) {
                case 'PING':
                    ws.send(JSON.stringify(pongEvent()));
                    break;
                case 'HEARTBEAT':
                    ws.send(JSON.stringify(heartbeatEvent()));
                    break;
                case 'CUE': {
                    const sceneValue = msg.scene;
                    const hasScene = typeof sceneValue === 'string' || typeof sceneValue === 'number';
                    const hasAnchor = msg.anchor && typeof msg.anchor.mediaTimeSec === 'number';
                    if (typeof msg.cueIndex === 'number' && hasAnchor) {
                        const previousScene = currentState.scene;
                        if (hasScene)
                            currentState.scene = sceneValue;
                        currentState.cueIndex = msg.cueIndex;
                        if (typeof msg.playbackRate === 'number')
                            currentState.playbackRate = msg.playbackRate;
                        currentState.isPaused = false;
                        setAnchorFromClient(msg.anchor, true);
                        const sceneChanged = hasScene && String(previousScene) !== String(sceneValue);
                        if (sceneChanged) {
                            wsBroadcast(sceneLoadEvent(sceneValue));
                        }
                        wsBroadcast(cueEvent(currentState.cueIndex));
                        wsBroadcast(stateEvent());
                    }
                    break;
                }
                case 'SEEK':
                    {
                        const mediaTime = msg.anchor && typeof msg.anchor.mediaTimeSec === 'number'
                            ? msg.anchor.mediaTimeSec
                            : typeof msg.mediaTimeSec === 'number'
                                ? msg.mediaTimeSec
                                : null;
                        if (typeof mediaTime === 'number') {
                            const anchorPayload = msg.anchor && typeof msg.anchor.mediaTimeSec === 'number'
                                ? msg.anchor
                                : { mediaTimeSec: mediaTime };
                            setAnchorFromClient(anchorPayload);
                            wsBroadcast(seekEvent(mediaTime));
                            wsBroadcast(stateEvent());
                        }
                    }
                    break;
                case 'RATE':
                    if (typeof msg.playbackRate === 'number') {
                        currentState.playbackRate = msg.playbackRate;
                        const anchorPayload = msg.anchor && typeof msg.anchor.mediaTimeSec === 'number'
                            ? msg.anchor
                            : undefined;
                        setAnchorFromClient(anchorPayload);
                        wsBroadcast(rateEvent(msg.playbackRate));
                        wsBroadcast(stateEvent());
                    }
                    break;
                case 'PAUSE':
                    currentState.isPaused = true;
                    {
                        const anchorPayload = msg.anchor && typeof msg.anchor.mediaTimeSec === 'number'
                            ? msg.anchor
                            : typeof msg.mediaTimeSec === 'number'
                                ? { mediaTimeSec: msg.mediaTimeSec }
                                : undefined;
                        setAnchorFromClient(anchorPayload);
                    }
                    wsBroadcast(pauseEvent());
                    wsBroadcast(stateEvent());
                    break;
                case 'RESUME':
                    currentState.isPaused = false;
                    {
                        const anchorPayload = msg.anchor && typeof msg.anchor.mediaTimeSec === 'number'
                            ? msg.anchor
                            : typeof msg.mediaTimeSec === 'number'
                                ? { mediaTimeSec: msg.mediaTimeSec }
                                : undefined;
                        setAnchorFromClient(anchorPayload);
                    }
                    wsBroadcast(resumeEvent());
                    wsBroadcast(stateEvent());
                    break;
                default:
                    // Ignore unknown types
                    break;
            }
        }
        catch (e) {
            // Ignore malformed
        }
    });
});
// ----- Start -----
const PORT = Number(process.env.PORT || 5174);
server.listen(PORT, () => {
    console.log(`[backend] listening on http://localhost:${PORT}`);
    console.log('Static public on /public, SPAs on /frontx and /fronty, WS at /ws');
});
