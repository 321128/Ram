import { useEffect, useMemo, useRef, useState } from 'react';
import { connectWS, nowMs, Anchor, InEvent, StatePayload } from './lib/ws';

type Lang = 'hi' | 'en';

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

async function preloadNext(src: string) {
  try {
    const a = new Audio();
    a.preload = 'auto';
    a.src = src;
    await a.load?.();
  } catch {}
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
  const ws = useMemo(() => ready ? connectWS(WS_URL, ()=>{}) : null, [ready]);
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

  // Apply state to audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !state) return;

    // Pick correct file from manifest mapping you already serve
    // Example path pattern; align with your backend manifest
    const manifestPath = state.scene.toString().padStart(2, '0');
    const cueFile = `${state.cueIndex.toString().padStart(3, '0')}-${lang}.mp3`;
    audio.src = `/public/Audio/${manifestPath}/${cueFile}`;

    // Preload next cue
    const nextCueIndex = state.cueIndex + 1;
    const nextCueFile = `${nextCueIndex.toString().padStart(3, '0')}-${lang}.mp3`;
    const nextSrc = `/public/Audio/${manifestPath}/${nextCueFile}`;
    preloadNext(nextSrc);

    if (state.isPaused) {
      audio.pause();
      audio.currentTime = state.anchor.mediaTimeSec;
    } else {
      scheduleFromAnchor(audio, state.anchor, state.playbackRate, offsetMs);
    }
  }, [state, lang, offsetMs]);

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