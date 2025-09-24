import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, Zap } from 'lucide-react';
import initialPlayData from '../data/playData.json';
import { connectWS, makeAnchor, OutEvent } from '../lib/ws';
import type { Anchor } from '../lib/ws';

interface Dialog {
  cueId: string;
  hindi: string | null;
  english: string | null;
  audioFile: string | null;
  character: string | null;
  duration: number;
}

interface Scene {
  title: string;
  dialogs: Dialog[];
}

interface PlayData {
  playTitle: string;
  totalScenes: number;
  scenes: Record<string, Scene>;
}

function bustCache(url: string) {
  return `${url}?v=${Date.now()}`;
}

const DubbingInterface: React.FC = () => {
  const [playData] = useState<PlayData>(initialPlayData);

  const [currentScene, setCurrentScene] = useState<string>("1");
  const [currentCueIndex, setCurrentCueIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [autoPlay, setAutoPlay] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const rateRef = useRef<number>(playbackSpeed);

  const audioRef = useRef<HTMLAudioElement>(null);
  // Ref for dialog scroll container
  const dialogScrollRef = useRef<HTMLDivElement>(null);

  const currentSceneData = playData.scenes[currentScene];
  const currentDialog = currentSceneData?.dialogs[currentCueIndex];

  const WS_URL = `ws://${location.hostname}:5174/ws`; // Express backend WS

  const ws = useMemo(() => connectWS(WS_URL, () => {}), []);
  const send = (e: OutEvent) => ws.readyState === 1 && ws.send(JSON.stringify(e));

  useEffect(() => {
    rateRef.current = playbackSpeed;
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, isPlaying]);

  const onPlayCue = (scene: number, cueIndex: number, mediaTimeSec = 0, playbackRate = rateRef.current): Anchor => {
    const anchor = makeAnchor(mediaTimeSec, 250);
    // Update your local <audio> immediately to mirror what you broadcast:
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.currentTime = mediaTimeSec;
      audioRef.current.play().catch(() => { });
    }
    send({ type: 'CUE', scene, cueIndex, playbackRate, anchor });
    return anchor;
  }

  const onPause = () => {
    if (audioRef.current) {
      const anchor = makeAnchor(audioRef.current.currentTime, 200);
      audioRef.current.pause();
      send({ type: 'PAUSE', anchor });
    }
  }

  const onResume = () => {
    if (audioRef.current) {
      const anchor = makeAnchor(audioRef.current.currentTime, 250);
      audioRef.current.play().catch(() => { });
      send({ type: 'RESUME', anchor });
    }
  }

  const onSeek = (newTime: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      const anchor = makeAnchor(newTime, 250);
      send({ type: 'SEEK', anchor });
    }
  }

  const onRateChange = (newRate: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
      const anchor = makeAnchor(audioRef.current.currentTime, 250);
      send({ type: 'RATE', playbackRate: newRate, anchor });
    }
  }

  const playDialog = (dialogIndex: number) => {
    if (!currentSceneData?.dialogs || dialogIndex < 0 || dialogIndex >= currentSceneData.dialogs.length) {
      setIsPlaying(false);
      return;
    }

    setCurrentCueIndex(dialogIndex);
    const dialog = currentSceneData.dialogs[dialogIndex];

    let anchor: Anchor;
    if (audioRef.current && dialog.audioFile) {
      const src = dialog.audioFile;
      audioRef.current.src = bustCache(src.startsWith('/Audio') ? src : `/Audio/${src}`);
      anchor = onPlayCue(Number(currentScene), dialogIndex, 0, playbackSpeed);
      setIsPlaying(true);
      setDuration(audioRef.current?.duration || dialog.duration);
    } else {
      anchor = onPlayCue(Number(currentScene), dialogIndex, 0, playbackSpeed);
    }

    // Notify backend current state (Express /update)
    try {
      fetch('/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene: currentScene, cueIndex: dialogIndex, isPaused: false, anchor })
      });
    } catch (err) {
      // ignore
    }
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      onPause();
      setIsPlaying(false);
    } else {
      if (audioRef.current && audioRef.current.src) {
        onResume();
        setIsPlaying(true);
      } else {
        playDialog(currentCueIndex);
      }
    }
  };

  // Update playback rate if changed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Listen for audio events to update UI and handle auto-play
  useEffect(() => {
   const audio = audioRef.current;
   if (!audio) return;

   const handleTimeUpdate = () => {
     setCurrentTime(audio.currentTime);
     setDuration(audio.duration);
   };
   const handleEnded = () => {
     setIsPlaying(false);
     if (autoPlay && currentSceneData?.dialogs && currentCueIndex < currentSceneData.dialogs.length - 1) {
       setTimeout(() => playDialog(currentCueIndex + 1), 500);
     }
   };
   audio.addEventListener('timeupdate', handleTimeUpdate);
   audio.addEventListener('ended', handleEnded);
   return () => {
     audio.removeEventListener('timeupdate', handleTimeUpdate);
     audio.removeEventListener('ended', handleEnded);
   };
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [audioRef, autoPlay, currentCueIndex, currentSceneData]);
 const nextDialog = () => {
   if (currentSceneData?.dialogs && currentCueIndex < currentSceneData.dialogs.length - 1) {
     playDialog(currentCueIndex + 1);
   }
 };

 const prevDialog = () => {
   if (currentSceneData?.dialogs && currentCueIndex > 0) {
     playDialog(currentCueIndex - 1);
   }
 };

 const changeScene = (sceneNumber: string) => {
   setCurrentScene(sceneNumber);
   setCurrentCueIndex(0);
   setIsPlaying(false);
   setCurrentTime(0);
 };

 const adjustSpeed = (delta: number) => {
   const newSpeed = Math.max(0.25, Math.min(2.0, playbackSpeed + delta));
   setPlaybackSpeed(newSpeed);
   onRateChange(newSpeed);
 };

 const formatTime = (time: number) => {
   const minutes = Math.floor(time / 60);
   const seconds = Math.floor(time % 60);
   return `${minutes}:${seconds.toString().padStart(2, '0')}`;
 };

 // Auto-scroll to current dialog whenever dialog changes
 useEffect(() => {
   const el = document.getElementById(`dialog-row-hindi-${currentCueIndex}`);
   if (el) {
     el.scrollIntoView({ behavior: 'smooth', block: 'center' });
   }
 }, [currentCueIndex, currentSceneData]);

 // Add this effect for real-time audience sync
 useEffect(() => {
   const interval = setInterval(async () => {
     try {
       const res = await fetch('/current');
       if (!res.ok) return;
       const data = await res.json();
       // Only update if dialog changed
       if (String(data.scene) !== String(currentScene) || Number(data.cueIndex) !== Number(currentCueIndex)) {
         setCurrentScene(String(data.scene));
         setCurrentCueIndex(Number(data.cueIndex));
         playDialog(Number(data.cueIndex));
       }
     } catch {}
   }, 1000); // Poll every second
   return () => clearInterval(interval);
 }, [currentScene, currentCueIndex]);

 // Global keydown listener for ArrowLeft/ArrowRight to adjust playback speed
 useEffect(() => {
   const handleKeyDown = (e: KeyboardEvent) => {
     if (e.key === 'ArrowLeft') {
       setPlaybackSpeed(prev => {
         const newSpeed = Math.max(0.5, +(prev - 0.05).toFixed(2));
         onRateChange(newSpeed);
         return newSpeed;
       });
       e.preventDefault();
     }
     if (e.key === 'ArrowRight') {
       setPlaybackSpeed(prev => {
         const newSpeed = Math.min(2.5, +(prev + 0.05).toFixed(2));
         onRateChange(newSpeed);
         return newSpeed;
       });
       e.preventDefault();
     }
   };
   window.addEventListener('keydown', handleKeyDown);
   return () => window.removeEventListener('keydown', handleKeyDown);
 }, []);

 return (
   <div className="min-h-screen bg-gray-900 text-white p-4">
     <div className="max-w-7xl mx-auto">
       {/* Fixed Header & Scene Selector */}
       
         <div className="mb-2">
           <h1 className="text-3xl font-bold text-center mb-1">{playData.playTitle}</h1>
           <p className="text-gray-400 text-center">By Felicity Theatre</p>
         </div>
         <div className="mb-2">
           <h2 className="text-xl font-semibold mb-1">Scene Selection</h2>
           <div className="grid grid-cols-10 gap-2">
             {Array.from({ length: playData.totalScenes }, (_, i) => (
               <button
                 key={i + 1}
                 onClick={() => changeScene((i + 1).toString())}
                 className={`px-3 py-2 rounded-lg font-medium transition-all ${
                   currentScene === (i + 1).toString()
                     ? 'bg-blue-600 text-white'
                     : 'bg-gray-700 hover:bg-gray-600'
                 }`}
               >
                 {i + 1}
               </button>
             ))}
           </div>
           {currentSceneData && (
             <p className="text-gray-300 mt-1">Current: {currentSceneData.title}</p>
           )}
         </div>
       <div className="sticky top-0 z-20 bg-gray-900 pb-2">
         <div className="mb-2">
           <div className="flex flex-wrap items-center gap-4 bg-gray-800 p-2 rounded-lg">
             <div className="flex items-center gap-2">
               <button
                 onClick={prevDialog}
                 className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                 disabled={currentCueIndex === 0}
               >
                 <SkipBack className="w-5 h-5" />
               </button>
               <button
                 onClick={togglePlayPause}
                 className="p-3 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
               >
                 {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
               </button>
               <button
                 onClick={nextDialog}
                 className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                 disabled={!currentSceneData?.dialogs || currentCueIndex >= currentSceneData.dialogs.length - 1}
               >
                 <SkipForward className="w-5 h-5" />
               </button>
             </div>

             <div className="flex items-center gap-2">
               <Volume2 className="w-5 h-5" />
               <span>Speed:</span>
               <input
                 type="range"
                 min={0.5}
                 max={2.5}
                 step={0.05}
                 value={playbackSpeed}
                 onChange={e => setPlaybackSpeed(Number(e.target.value))}
                 className="w-32 h-2 accent-blue-600 bg-gray-700 rounded-full"
                 style={{ verticalAlign: 'middle' }}
               />
               <span className="ml-2 font-mono text-sm">{playbackSpeed.toFixed(2)}x</span>
             </div>

             <div className="flex items-center gap-2">
               <button
                 onClick={() => setAutoPlay(!autoPlay)}
                 className={`p-2 rounded-lg transition-colors ${
                   autoPlay ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-700 hover:bg-gray-600'
                 }`}
               >
                 <Zap className="w-5 h-5" />
               </button>
               <span className="text-sm">Auto-play</span>
             </div>

             <div className="flex-1 min-w-[200px]">
               <div className="flex items-center gap-2">
                 <span className="text-sm">{formatTime(currentTime)}</span>
                 <div className="flex-1 bg-gray-700 rounded-full h-2">
                   <div
                     className="bg-blue-600 h-2 rounded-full transition-all duration-100"
                     style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                   ></div>
                 </div>
                 <span className="text-sm">{formatTime(duration)}</span>
               </div>
             </div>
           </div>
         </div>
       </div>
         {/* Headings for Dialogs */}
         <div className="grid grid-cols-2 gap-6 mb-2">
           <div className="text-lg font-bold text-amber-300 text-center py-2 bg-amber-900/30 rounded-t">Hindi (Original)</div>
           <div className="text-lg font-bold text-blue-300 text-center py-2 bg-blue-900/30 rounded-t">English (Dubbed)</div>
         </div>
       
       {/* Dialog Display (no Go to Current Dialog button) */}
       <div className="w-full" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
         <div className="grid grid-cols-2 gap-6">
           {(currentSceneData?.dialogs || []).map((dialog, index) => (
             <React.Fragment key={dialog.cueId}>
               {/* Hindi Dialog */}
               <div
                 id={`dialog-row-hindi-${index}`}
                 onClick={() => playDialog(index)}
                 className={`p-2 rounded bg-gray-800/50 line-through opacity-50`}
               >
                 <div>
                   <div className="flex justify-between items-start mb-2">
                     <span className="text-sm font-medium text-amber-200">{dialog.character}</span>
                     <div className="flex items-center gap-2">
                       <span className="text-xs text-gray-400">{dialog.duration}s</span>
                       <span className="text-xs text-gray-400">{dialog.cueId}</span>
                       {index === currentCueIndex && (
                         <span className="text-xs bg-amber-600 text-white px-2 py-1 rounded">CURRENT</span>
                       )}
                       {index === currentCueIndex - 1 && (
                         <span className="text-xs bg-amber-700 text-amber-200 px-2 py-1 rounded">PREVIOUS</span>
                       )}
                     </div>
                   </div>
                   <p className="text-amber-100 font-medium whitespace-pre-line">{dialog.hindi}</p>
                 </div>
                 <div className="mt-2 flex items-center gap-1">
                   <Play className="w-3 h-3 text-amber-400" />
                   <span className="text-xs text-amber-400">Click to play</span>
                 </div>
               </div>
               {/* English Dialog */}
               <div
                 onClick={() => playDialog(index)}
                 className={`dialog-row bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 cursor-pointer hover:shadow-lg flex flex-col justify-between h-full ${index === currentCueIndex ? 'ring-2 ring-blue-400' : ''}`}
               >
                 <div>
                   <div className="flex justify-between items-start mb-2">
                     <span className="text-sm font-medium text-blue-200">{dialog.character}</span>
                     <div className="flex items-center gap-2">
                       <span className="text-xs text-gray-400">{dialog.duration}s</span>
                       <span className="text-xs text-gray-400">{dialog.cueId}</span>
                       {index === currentCueIndex && (
                         <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">CURRENT</span>
                       )}
                       {index === currentCueIndex - 1 && (
                         <span className="text-xs bg-blue-700 text-blue-200 px-2 py-1 rounded">PREVIOUS</span>
                       )}
                     </div>
                   </div>
                   <p className="text-blue-100 font-medium whitespace-pre-line">{dialog.english}</p>
                 </div>
                 <div className="mt-2 flex items-center gap-1">
                   <Play className="w-3 h-3 text-blue-400" />
                   <span className="text-xs text-blue-400">Click to play</span>
                 </div>
               </div>
             </React.Fragment>
           ))}
         </div>
       </div>

     </div>

     {/* Hidden audio element for future implementation */}
     <audio ref={audioRef} preload="metadata" />
   </div>
 );
};

export default DubbingInterface;
