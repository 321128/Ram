import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, Zap } from 'lucide-react';
import initialPlayData from '../data/playData.json';

interface Dialog {
  cueId: string;
  hindi: string;
  english: string;
  audioFile: string;
  character: string;
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

  const [currentScene, setCurrentScene] = useState<string>("1");
  const [currentCueIndex, setCurrentCueIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [autoPlay, setAutoPlay] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  // Ref for dialog scroll container
  const dialogScrollRef = useRef<HTMLDivElement>(null);

  const currentSceneData = playData.scenes[currentScene];
  const currentDialog = currentSceneData?.dialogs[currentCueIndex];

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const playDialog = (dialogIndex: number) => {
    if (!currentSceneData?.dialogs || dialogIndex < 0 || dialogIndex >= currentSceneData.dialogs.length) {
      setIsPlaying(false);
      return;
    }

    setCurrentCueIndex(dialogIndex);
    const dialog = currentSceneData.dialogs[dialogIndex];

    if (audioRef.current) {
      audioRef.current.src = dialog.audioFile;
      audioRef.current.currentTime = 0;
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        setDuration(audioRef.current?.duration || dialog.duration);
      }).catch(() => {
        setIsPlaying(false);
      });
    }
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

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Fixed Header & Scene Selector */}
        <div className="sticky top-0 z-20 bg-gray-900 pb-2">
          <div className="mb-2">
            <h1 className="text-3xl font-bold text-center mb-1">{playData.playTitle}</h1>
            <p className="text-gray-400 text-center">By Felicity Theatres</p>
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
          {/* Freeze only playback controls */}
          <div className="sticky top-0 z-30 bg-gray-800 mb-2 rounded-lg">
            <div className="flex flex-wrap items-center gap-4 p-2">
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
                <span>Speed: {playbackSpeed.toFixed(2)}x</span>
                <button
                  onClick={() => adjustSpeed(-0.1)}
                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                >
                  -
                </button>
                <button
                  onClick={() => adjustSpeed(0.1)}
                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          {/* Headings for Dialogs */}
          <div className="grid grid-cols-2 gap-6 mb-2">
            <div className="text-lg font-bold text-amber-300 text-center py-2 bg-amber-900/30 rounded-t">Hindi (Original)</div>
            <div className="text-lg font-bold text-blue-300 text-center py-2 bg-blue-900/30 rounded-t">English (Dubbed)</div>
          </div>
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
                  className={`dialog-row bg-amber-900/20 border border-amber-700/50 rounded-lg p-4 cursor-pointer hover:shadow-lg flex flex-col justify-between h-full ${index === currentCueIndex ? 'ring-2 ring-amber-400' : ''}`}
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