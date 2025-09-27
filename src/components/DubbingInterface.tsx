import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, Zap } from 'lucide-react';
import initialPlayData from '../data/playData.json';

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

const DubbingInterface: React.FC = () => {
  const [playData] = useState<PlayData>(initialPlayData);

  // Flatten all dialogs from all scenes for unified playback and display
  type DialogWithScene = {
    dialog: Dialog;
    sceneNumber: string;
    sceneTitle: string;
    globalIndex: number;
    sceneDialogIndex: number;
  };
  const allDialogs: DialogWithScene[] = useMemo(() => {
    const dialogs: DialogWithScene[] = [];
    let globalIndex = 0;
    Object.entries(playData.scenes).forEach(([sceneNumber, scene]) => {
      const s = scene as Scene;
      s.dialogs.forEach((dialog: Dialog, i: number) => {
        dialogs.push({
          dialog,
          sceneNumber,
          sceneTitle: s.title,
          globalIndex,
          sceneDialogIndex: i,
        });
        globalIndex++;
      });
    });
    return dialogs;
  }, [playData]);

  const [currentCueIndex, setCurrentCueIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [autoPlay, setAutoPlay] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  // Ref for dialog scroll container (not used)

  const currentDialogObj = allDialogs[currentCueIndex];

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, isPlaying]);

  const playDialog = (dialogIndex: number) => {
    if (!allDialogs[dialogIndex]) {
      setIsPlaying(false);
      return;
    }
    setCurrentCueIndex(dialogIndex);
    const dialog = allDialogs[dialogIndex].dialog;
      if (audioRef.current && dialog.audioFile) {
        audioRef.current.src = dialog.audioFile;
        audioRef.current.currentTime = 0;
        audioRef.current.playbackRate = playbackSpeed;
        audioRef.current.play().then(() => {
          setIsPlaying(true);
          setDuration(audioRef.current?.duration || dialog.duration);
          audioRef.current.playbackRate = playbackSpeed;
        }).catch(() => {
          setIsPlaying(false);
        });
      } else {
        setIsPlaying(false);
    }
    // Write current dialog info to currentDialog.json for audience sync
    try {
      fetch('/api/update-current-dialog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene: allDialogs[dialogIndex].sceneNumber,
          cueIndex: allDialogs[dialogIndex].sceneDialogIndex
        })
      });
    } catch (err) {}
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (audioRef.current && audioRef.current.src) {
        audioRef.current.play();
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
      if (autoPlay && currentCueIndex < allDialogs.length - 1) {
        setTimeout(() => playDialog(currentCueIndex + 1), 500);
      }
    };
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioRef, autoPlay, currentCueIndex, allDialogs]);
  const nextDialog = () => {
    if (currentCueIndex < allDialogs.length - 1) {
      playDialog(currentCueIndex + 1);
    }
  };

  const prevDialog = () => {
    if (currentCueIndex > 0) {
      playDialog(currentCueIndex - 1);
    }
  };

  // (adjustSpeed is unused, removed)

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
  }, [currentCueIndex]);

  // Add this effect for real-time audience sync
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/current-dialog');
        if (!res.ok) return;
        const data = await res.json();
        // Find the global dialog index for the current scene/cueIndex
        const globalIdx = allDialogs.findIndex((d: DialogWithScene) => d.sceneNumber === data.scene && d.sceneDialogIndex === data.cueIndex);
        if (globalIdx !== -1 && globalIdx !== currentCueIndex) {
          setCurrentCueIndex(globalIdx);
          playDialog(globalIdx);
        }
      } catch {}
    }, 1000);
    return () => clearInterval(interval);
  }, [currentCueIndex, allDialogs]);

  // Global keydown listener for ArrowLeft/ArrowRight to adjust playback speed and Space for play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setPlaybackSpeed((prev: number) => Math.max(0.5, +(prev - 0.05).toFixed(2)));
        e.preventDefault();
      }
      if (e.key === 'ArrowRight') {
        setPlaybackSpeed((prev: number) => Math.min(2.5, +(prev + 0.05).toFixed(2)));
        e.preventDefault();
      }
      if (e.code === 'Space' || e.key === ' ') {
        togglePlayPause();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-2">
          <h1 className="text-3xl font-bold text-center mb-1">{playData.playTitle}</h1>
          <p className="text-gray-400 text-center">By Felicity Theatre</p>
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
                  disabled={currentCueIndex >= allDialogs.length - 1}
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
        {/* Dialog Display: All scenes and dialogs */}
        <div className="w-full" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="grid grid-cols-2 gap-6">
            {allDialogs.map((item, index) => (
              <React.Fragment key={item.dialog.cueId}>
                {/* Hindi Dialog */}
                <div
                  id={`dialog-row-hindi-${index}`}
                  onClick={() => playDialog(index)}
                  className={`dialog-row bg-amber-900/20 border border-amber-700/50 rounded-lg p-4 cursor-pointer hover:shadow-lg flex flex-col justify-between h-full ${index === currentCueIndex ? 'ring-2 ring-amber-400' : ''}`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium text-amber-200">{item.dialog.character}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{item.dialog.duration}s</span>
                        <span className="text-xs text-gray-400">{item.dialog.cueId}</span>
                        <span className="text-xs text-gray-400">Scene {item.sceneNumber}: {item.sceneTitle}</span>
                        {index === currentCueIndex && (
                          <span className="text-xs bg-amber-600 text-white px-2 py-1 rounded">CURRENT</span>
                        )}
                        {index === currentCueIndex - 1 && (
                          <span className="text-xs bg-amber-700 text-amber-200 px-2 py-1 rounded">PREVIOUS</span>
                        )}
                      </div>
                    </div>
                    <p className="text-amber-100 font-medium whitespace-pre-line">{item.dialog.hindi}</p>
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
                      <span className="text-sm font-medium text-blue-200">{item.dialog.character}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{item.dialog.duration}s</span>
                        <span className="text-xs text-gray-400">{item.dialog.cueId}</span>
                        <span className="text-xs text-gray-400">Scene {item.sceneNumber}: {item.sceneTitle}</span>
                        {index === currentCueIndex && (
                          <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">CURRENT</span>
                        )}
                        {index === currentCueIndex - 1 && (
                          <span className="text-xs bg-blue-700 text-blue-200 px-2 py-1 rounded">PREVIOUS</span>
                        )}
                      </div>
                    </div>
                    <p className="text-blue-100 font-medium whitespace-pre-line">{item.dialog.english}</p>
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