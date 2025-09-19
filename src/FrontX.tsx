import { useEffect, useMemo, useRef, useState } from 'react';
import { connectWS, nowMs, Anchor, InEvent, StatePayload } from './lib/ws';

type Lang = 'hi' | 'en';

type ManifestCue = {
  cueId: string;
  audioFileHi: string | null;
  audioFileEn: string | null;
  duration: number | null;
};

function normalizeAudioPath(path: string | null) {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/public/')) return trimmed;
  if (trimmed.startsWith('/Audio/')) return `/public${trimmed}`;
  if (trimmed.startsWith('Audio/')) return `/public/${trimmed}`;
  return trimmed;
}

function fallbackCuePath(sceneId: string, cueIndex: number, lang: Lang) {
  const sceneSegment = sceneId.padStart(2, '0');
  const cueSegment = Math.max(0, cueIndex).toString().padStart(3, '0');
  return `/public/Audio/${sceneSegment}/${cueSegment}-${lang}.mp3`;
}

type ManifestLookupResult =
  | { status: 'ok'; src: string; usedAlternateLanguage: boolean }
  | { status: 'missing'; reason: 'index' | 'audio' };

function lookupManifestAudio(
  manifest: ManifestCue[],
  cueIndex: number,
  lang: Lang,
): ManifestLookupResult {
  if (cueIndex < 0 || cueIndex >= manifest.length) {
    return { status: 'missing', reason: 'index' };
  }
  const cue = manifest[cueIndex];
  const preferred = normalizeAudioPath(lang === 'hi' ? cue.audioFileHi : cue.audioFileEn);
  if (preferred) return { status: 'ok', src: preferred, usedAlternateLanguage: false };
  const alternate = normalizeAudioPath(lang === 'hi' ? cue.audioFileEn : cue.audioFileHi);
  if (alternate) return { status: 'ok', src: alternate, usedAlternateLanguage: true };
  return { status: 'missing', reason: 'audio' };
}

function toAbsoluteUrl(src: string) {
  try {
    return new URL(src, window.location.origin).toString();
  } catch {
    return src;
  }
}

function useClockOffset(ws: WebSocket | null) {
  const [offsetMs, setOffsetMs] = useState(0); // serverTime - clientTime
  useEffect(() => {
    if (!ws) return;
    let alive = true;
    const samples:number[] = [];
    const ping = () => {
      if (!alive || ws.readyState !== 1) return;
      const t0 = nowMs();
      ws.send(JSON.stringify({ type: 'PING', t0 }));
      // response will be {type:'PING', serverTimeEpochMs}
    };
    const onMsg = (e: MessageEvent) => {
      const data: InEvent = JSON.parse(e.data);
      if (data.type === 'PING') {
        const t2 = nowMs();
        const server = data.serverTimeEpochMs;
        const rtt = t2 - (server - (t2 - server)); // approximate
        const off = server - (t2 - rtt/2);
        samples.push(off);
        if (samples.length >= 10) {
          // rolling median
          const s = [...samples].sort((a,b)=>a-b);
          setOffsetMs(s[Math.floor(s.length/2)]);
          samples.length = 0;
        }
      }
    };
    ws.addEventListener('message', onMsg);
    const id = setInterval(ping, 1000);
    return () => { alive = false; clearInterval(id); ws.removeEventListener('message', onMsg); };
  }, [ws]);
  return offsetMs;
}

async function preloadNext(src: string | null) {
  if (!src) return;
  try {
    const a = new Audio();
    a.preload = 'auto';
    a.src = src;
    await a.load?.();
  } catch (err) {
    console.warn('Failed to preload audio', err);
  }
}

function scheduleFromAnchor(audio: HTMLAudioElement, anchor: Anchor, playbackRate: number, offsetMs: number) {
  audio.playbackRate = playbackRate;
  const serverNow = nowMs() + offsetMs;
  const elapsed = Math.max(0, (serverNow - anchor.serverTimeEpochMs) / 1000) * playbackRate;
  const targetTime = anchor.mediaTimeSec + elapsed;

  // If late by >150ms, jump; if early, delay start
  const clientStartDelayMs = anchor.serverTimeEpochMs - (nowMs() + offsetMs);
  audio.currentTime = Math.max(0, targetTime);
  const start = () => audio.play().catch(()=>{});
  if (clientStartDelayMs > 60) setTimeout(start, clientStartDelayMs);
  else start();
}

export default function FrontX() {
  const [lang, setLang] = useState<Lang>('hi');
  const [ready, setReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [state, setState] = useState<StatePayload | null>(null);
  const [sceneManifests, setSceneManifests] = useState<Record<string, ManifestCue[]>>({});
  const manifestFetchRef = useRef<Set<string>>(new Set());
  const isMountedRef = useRef(true);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/frontx/sw.js').then(reg => {
        console.log('Service Worker Registered', reg);
      }).catch(err => {
        console.error('Service Worker registration failed', err);
      });
    }
  }, []);

  const WS_URL = `ws://${window.location.hostname}:5174/ws`;  // Express backend WS
  const ws = useMemo(() => ready ? connectWS(WS_URL, ()=>{}) : null, [ready, WS_URL]);
  const offsetMs = useClockOffset(ws);

  // Fetch current state once unlocked
  useEffect(() => {
    if (!ready) return;
    fetch('/current').then(r=>r.json()).then((s:StatePayload)=>setState(s)).catch(()=>{});
  }, [ready]);

  // React to WS events
  useEffect(() => {
    if (!ws) return;
    const onMsg = (e: MessageEvent) => {
      const ev: InEvent = JSON.parse(e.data);
      if (ev.type === 'STATE') setState(ev.state);
    };
    ws.addEventListener('message', onMsg);
    return () => ws.removeEventListener('message', onMsg);
  }, [ws]);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  useEffect(() => {
    if (!state) return;
    const sceneId = String(state.scene);
    if (sceneManifests[sceneId] || manifestFetchRef.current.has(sceneId)) return;

    manifestFetchRef.current.add(sceneId);

    fetch(`/manifest/${encodeURIComponent(sceneId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ManifestCue[]>;
      })
      .then((manifest) => {
        if (!isMountedRef.current) return;
        setSceneManifests((prev) => ({ ...prev, [sceneId]: manifest }));
      })
      .catch((err) => {
        if (isMountedRef.current) console.warn(`Failed to load manifest for scene ${sceneId}`, err);
      })
      .finally(() => {
        manifestFetchRef.current.delete(sceneId);
      });
  }, [state, sceneManifests]);

  // Apply state to audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !state) return;

    const sceneId = String(state.scene);
    const manifest = sceneManifests[sceneId];
    if (!manifest) return;

    const currentLookup = lookupManifestAudio(manifest, state.cueIndex, lang);
    let currentSrc: string | null = null;
    if (currentLookup.status === 'ok') {
      currentSrc = currentLookup.src;
      if (currentLookup.usedAlternateLanguage) {
        console.warn(`Missing ${lang} audio for scene ${sceneId} cue ${state.cueIndex}; using alternate track.`);
      }
    } else {
      const fallback = fallbackCuePath(sceneId, state.cueIndex, lang);
      if (currentLookup.reason === 'index') {
        console.warn(`Manifest for scene ${sceneId} lacks cue index ${state.cueIndex}; falling back to ${fallback}.`);
      } else if (currentLookup.reason === 'audio') {
        console.warn(`Cue ${state.cueIndex} in scene ${sceneId} is missing audio info; falling back to ${fallback}.`);
      }
      currentSrc = fallback;
    }

    if (currentSrc) {
      const absoluteSrc = toAbsoluteUrl(currentSrc);
      if (audio.src !== absoluteSrc) {
        audio.src = currentSrc;
      }
    }

    const nextIndex = state.cueIndex + 1;
    const nextLookup = lookupManifestAudio(manifest, nextIndex, lang);
    let nextSrc: string | null = null;
    if (nextLookup.status === 'ok') {
      nextSrc = nextLookup.src;
      if (nextLookup.usedAlternateLanguage) {
        console.warn(`Missing ${lang} audio for upcoming cue ${nextIndex} in scene ${sceneId}; preloading alternate track.`);
      }
    } else if (nextLookup.reason === 'audio') {
      const fallback = fallbackCuePath(sceneId, nextIndex, lang);
      console.warn(`Cue ${nextIndex} in scene ${sceneId} is missing audio info; preloading fallback ${fallback}.`);
      nextSrc = fallback;
    }
    preloadNext(nextSrc);

    if (state.isPaused) {
      audio.pause();
      audio.currentTime = state.anchor.mediaTimeSec;
    } else {
      scheduleFromAnchor(audio, state.anchor, state.playbackRate, offsetMs);
    }
  }, [state, lang, offsetMs, sceneManifests]);

  return (
    <div className="min-h-screen grid place-items-center bg-black text-white">
      {!ready ? (
        <div className="flex flex-col items-center gap-4">
          <img src="/poster.jpg" className="w-64 rounded-2xl" />
          <select className="bg-gray-800 p-2 rounded" value={lang} onChange={e=>setLang(e.target.value as Lang)}>
            <option value="hi">Hindi</option>
            <option value="en">English</option>
          </select>
          <button onClick={()=>setReady(true)} className="px-6 py-3 rounded-2xl bg-white text-black">
            Tap to Start
          </button>
          <p className="text-xs opacity-70">Keep screen on for uninterrupted audio.</p>
        </div>
      ) : (
        <>
          <audio ref={audioRef} preload="auto" />
          <div className="fixed bottom-3 text-xs opacity-60">
            synced offset: {Math.round(offsetMs)} ms
          </div>
        </>
      )}
    </div>
  );
}