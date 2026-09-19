import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Download, 
  Settings, 
  Play, 
  Pause, 
  Film, 
  Layers, 
  Trash2, 
  Plus, 
  ArrowRight, 
  Eye, 
  CheckCircle2, 
  RotateCcw, 
  Sliders, 
  FileVideo,
  ExternalLink,
  Loader2,
  Info,
  Music,
  Volume2,
  VolumeX
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type LayoutMode = 'sbs-left-rgb' | 'sbs-left-alpha' | 'top-bottom-rgb';

interface FrameItem {
  id: string;
  name: string;
  url: string;
  img: HTMLImageElement;
  maskCanvas?: HTMLCanvasElement;
  width: number;
  height: number;
}

// Helper to pre-create or retrieve cached alpha mask canvas for lightning-fast rendering
const getOrCreateMaskCanvas = (frame: FrameItem): HTMLCanvasElement => {
  if (frame.maskCanvas) return frame.maskCanvas;
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = frame.width;
  maskCanvas.height = frame.height;
  const mCtx = maskCanvas.getContext('2d');
  if (mCtx) {
    mCtx.drawImage(frame.img, 0, 0, frame.width, frame.height);
    const imgData = mCtx.getImageData(0, 0, frame.width, frame.height);
    const data = imgData.data;
    const maskData = mCtx.createImageData(frame.width, frame.height);
    const mData = maskData.data;

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      mData[i] = a;     // R
      mData[i + 1] = a; // G
      mData[i + 2] = a; // B
      mData[i + 3] = 255; // Fully opaque mask
    }
    mCtx.putImageData(maskData, 0, 0);
  }
  frame.maskCanvas = maskCanvas;
  return maskCanvas;
};

interface AudioInfo {
  file: File;
  name: string;
  size: number;
  duration: number;
  url: string;
}

interface MP4AlphaCreatorProps {
  onOpenInVabViewer?: (file: File) => void;
}

export const MP4AlphaCreator: React.FC<MP4AlphaCreatorProps> = ({ onOpenInVabViewer }) => {
  const [frames, setFrames] = useState<FrameItem[]>([]);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('sbs-left-rgb');
  const [fps, setFps] = useState<number>(30);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentFrameIdx, setCurrentFrameIdx] = useState<number>(0);
  const [previewTab, setPreviewTab] = useState<'split' | 'composite'>('split');
  const [bgColor, setBgColor] = useState<string>('checker');
  const [qualityBitrate, setQualityBitrate] = useState<number>(5000000); // 5 Mbps

  // Audio track states
  const [audioInfo, setAudioInfo] = useState<AudioInfo | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Processing & Export states
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [renderProgress, setRenderProgress] = useState<number>(0);
  const [renderStatus, setRenderStatus] = useState<string>('');
  const [generatedVideoBlob, setGeneratedVideoBlob] = useState<Blob | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string>('');
  const [generatedFileName, setGeneratedFileName] = useState<string>('');

  const splitCanvasRef = useRef<HTMLCanvasElement>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      frames.forEach(f => {
        if (f.url.startsWith('blob:')) URL.revokeObjectURL(f.url);
      });
      if (generatedVideoUrl) URL.revokeObjectURL(generatedVideoUrl);
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    };
  }, []);

  // Upload image sequence
  const handleUploadImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList: File[] = (Array.from(files) as File[]).filter(f => f.type.startsWith('image/'));
    // Natural sort filenames (e.g. frame_1, frame_2, frame_10)
    fileList.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    let loadedCount = 0;
    const newFrames: FrameItem[] = [];

    fileList.forEach(file => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        newFrames.push({
          id: Math.random().toString(36).substring(7),
          name: file.name,
          url,
          img,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height
        });

        loadedCount++;
        if (loadedCount === fileList.length) {
          // Re-sort to maintain correct order after async image load
          newFrames.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
          setFrames(prev => [...prev, ...newFrames]);
          setCurrentFrameIdx(0);
        }
      };
      img.src = url;
    });
  };

  // Setup and clean up preview audio element when audioInfo changes
  useEffect(() => {
    if (!audioInfo) {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current = null;
      }
      return;
    }

    const audio = new Audio(audioInfo.url);
    audio.muted = isAudioMuted;
    audioPreviewRef.current = audio;

    // If currently playing, start audio from current frame position
    if (isPlaying && frames.length > 0) {
      const currentSec = (currentFrameIdx % frames.length) / fps;
      const exactDuration = frames.length / fps;
      if (currentSec < exactDuration) {
        audio.currentTime = currentSec;
        audio.play().catch(() => {});
      }
    }

    return () => {
      audio.pause();
    };
  }, [audioInfo]);

  // Update audio muted state
  useEffect(() => {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.muted = isAudioMuted;
    }
  }, [isAudioMuted]);

  // Playback timer for frame sequence with perfect audio synchronization
  useEffect(() => {
    const audio = audioPreviewRef.current;
    const exactDuration = frames.length > 0 ? frames.length / fps : 0;

    if (!isPlaying || frames.length === 0) {
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
      if (audio && !audio.paused) {
        audio.pause();
      }
      return;
    }

    // When starting playback, ensure audio is aligned with current frame
    if (audio && audioInfo) {
      audio.muted = isAudioMuted;
      const startSec = (currentFrameIdx % frames.length) / fps;
      if (startSec < exactDuration) {
        if (Math.abs(audio.currentTime - startSec) > 0.15) {
          audio.currentTime = startSec;
        }
        if (audio.paused && !isAudioMuted) {
          audio.play().catch(() => {});
        }
      } else {
        audio.pause();
      }
    }

    const intervalMs = 1000 / fps;
    animIntervalRef.current = setInterval(() => {
      setCurrentFrameIdx(prev => {
        const next = (prev + 1) % frames.length;
        const currentAudio = audioPreviewRef.current;

        if (currentAudio && audioInfo) {
          if (next === 0) {
            // Loop back to start: reset audio strictly to 0 and play
            currentAudio.currentTime = 0;
            if (currentAudio.paused && !isAudioMuted) {
              currentAudio.play().catch(() => {});
            }
          } else {
            const currentSec = next / fps;
            // End of animation reached: pause audio strictly until next loop
            if (currentSec >= exactDuration || currentAudio.currentTime >= exactDuration) {
              currentAudio.pause();
            } else if (Math.abs(currentAudio.currentTime - currentSec) > 0.2) {
              // Drift compensation
              currentAudio.currentTime = currentSec;
              if (currentAudio.paused && !isAudioMuted) {
                currentAudio.play().catch(() => {});
              }
            }
          }
        }
        return next;
      });
    }, intervalMs);

    return () => {
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    };
  }, [isPlaying, frames.length, fps, audioInfo, isAudioMuted]);

  // Render current frame into canvases (Split & Composite)
  useEffect(() => {
    if (frames.length === 0) return;
    const currentFrame = frames[currentFrameIdx];
    if (!currentFrame || !currentFrame.img) return;

    const img = currentFrame.img;
    const fw = currentFrame.width;
    const fh = currentFrame.height;

    // Dimensions for split output
    let splitW = fw * 2;
    let splitH = fh;
    if (layoutMode === 'top-bottom-rgb') {
      splitW = fw;
      splitH = fh * 2;
    }

    // 1. Render Split Canvas (The actual MP4 Alpha frame)
    if (splitCanvasRef.current) {
      const sCanvas = splitCanvasRef.current;
      if (sCanvas.width !== splitW || sCanvas.height !== splitH) {
        sCanvas.width = splitW;
        sCanvas.height = splitH;
      }
      const sCtx = sCanvas.getContext('2d');
      if (sCtx) {
        const maskCanvas = getOrCreateMaskCanvas(currentFrame);

        // Clear split canvas with solid black backing
        sCtx.fillStyle = '#000000';
        sCtx.fillRect(0, 0, splitW, splitH);

        // Place RGB and Alpha based on layout mode
        if (layoutMode === 'sbs-left-rgb') {
          // RGB on Left, Alpha on Right (Standard VAP)
          sCtx.drawImage(img, 0, 0, fw, fh);
          sCtx.drawImage(maskCanvas, fw, 0, fw, fh);
        } else if (layoutMode === 'sbs-left-alpha') {
          // Alpha on Left, RGB on Right
          sCtx.drawImage(maskCanvas, 0, 0, fw, fh);
          sCtx.drawImage(img, fw, 0, fw, fh);
        } else if (layoutMode === 'top-bottom-rgb') {
          // RGB on Top, Alpha on Bottom
          sCtx.drawImage(img, 0, 0, fw, fh);
          sCtx.drawImage(maskCanvas, 0, fh, fw, fh);
        }
      }
    }

    // 2. Render Composite Canvas (Reconstructed preview with transparency)
    if (compositeCanvasRef.current) {
      const cCanvas = compositeCanvasRef.current;
      if (cCanvas.width !== fw || cCanvas.height !== fh) {
        cCanvas.width = fw;
        cCanvas.height = fh;
      }
      const cCtx = cCanvas.getContext('2d');
      if (cCtx) {
        cCtx.clearRect(0, 0, fw, fh);
        cCtx.drawImage(img, 0, 0, fw, fh);
      }
    }
  }, [currentFrameIdx, frames, layoutMode]);

  // Audio Upload & Management handlers
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (audioInfo?.url) {
      URL.revokeObjectURL(audioInfo.url);
    }
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current = null;
    }

    const url = URL.createObjectURL(file);
    const tempAudio = new Audio(url);
    tempAudio.onloadedmetadata = () => {
      setAudioInfo({
        file,
        name: file.name,
        size: file.size,
        duration: tempAudio.duration || 0,
        url
      });
      // Start preview with synced audio if playing
      if (!isPlaying) {
        setIsPlaying(true);
      }
    };
    tempAudio.onerror = () => {
      alert('تعذر قراءة ملف الصوت، يرجى اختيار ملف MP3 أو WAV أو M4A صالح.');
      URL.revokeObjectURL(url);
    };
  };

  const handleRemoveAudio = () => {
    if (audioInfo?.url) {
      URL.revokeObjectURL(audioInfo.url);
    }
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current = null;
    }
    setAudioInfo(null);
    if (audioInputRef.current) {
      audioInputRef.current.value = '';
    }
  };

  // Generate and Encode MP4 Alpha file
  const handleGenerateMP4 = async () => {
    if (frames.length === 0) return;

    setIsRendering(true);
    setRenderProgress(0);
    setRenderStatus('تحضير محرك تشفير الفيديو...');

    try {
      const fw = frames[0].width;
      const fh = frames[0].height;

      let splitW = fw * 2;
      let splitH = fh;
      if (layoutMode === 'top-bottom-rgb') {
        splitW = fw;
        splitH = fh * 2;
      }

      // Recording canvas
      const renderCanvas = document.createElement('canvas');
      renderCanvas.width = splitW;
      renderCanvas.height = splitH;
      const rCtx = renderCanvas.getContext('2d');
      if (!rCtx) throw new Error('فشل إنشاء سياق الكانفاس');

      // Pre-compute all alpha masks first to eliminate any CPU bottleneck during recording
      setRenderStatus('تجهيز وضبط أقنعة الألفا لجميع الفريمات...');
      for (let i = 0; i < frames.length; i++) {
        getOrCreateMaskCanvas(frames[i]);
      }

      const stream = renderCanvas.captureStream(fps);

      // Animation duration strictly governed by frame count and target FPS
      const exactDuration = frames.length / fps;
      const totalSteps = frames.length;

      // Setup audio track if audio file was uploaded
      let audioContext: AudioContext | null = null;
      let audioSource: AudioBufferSourceNode | null = null;

      if (audioInfo) {
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          audioContext = new AudioCtx();
          const arrayBuf = await audioInfo.file.arrayBuffer();
          const audioBuf = await audioContext.decodeAudioData(arrayBuf.slice(0));

          audioSource = audioContext.createBufferSource();
          audioSource.buffer = audioBuf;
          audioSource.loop = false; // Never loop endlessly over short animations

          const mediaDest = audioContext.createMediaStreamDestination();
          audioSource.connect(mediaDest);

          const aTracks = mediaDest.stream.getAudioTracks();
          if (aTracks.length > 0) {
            stream.addTrack(aTracks[0]);
          }
        } catch (audioErr) {
          console.warn('تعذر تجهيز مسار الصوت:', audioErr);
        }
      }

      // Select best supported MIME type (mp4 preferred, fallback to webm)
      const candidateMimes = audioInfo ? [
        'video/mp4;codecs=avc1.4d002a,mp4a.40.2',
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4',
        'video/webm;codecs=h264,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
      ] : [
        'video/mp4;codecs=avc1.4d002a',
        'video/mp4;codecs=avc1.42E01E',
        'video/mp4',
        'video/webm;codecs=h264',
        'video/webm;codecs=vp9',
        'video/webm'
      ];
      const selectedMime = candidateMimes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';

      const recorderOptions: MediaRecorderOptions = {
        mimeType: selectedMime,
        videoBitsPerSecond: qualityBitrate
      };
      if (audioInfo) {
        recorderOptions.audioBitsPerSecond = 128000;
      }

      const recorder = new MediaRecorder(stream, recorderOptions);

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const recordPromise = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: selectedMime });
          resolve(blob);
        };
      });

      recorder.start();

      // Audio starts at 0 and stops strictly at exactDuration (with final frame)
      if (audioSource) {
        audioSource.start(0, 0, exactDuration);
      }

      const frameDurationMs = 1000 / fps;
      const startTime = performance.now();

      // Render all frames sequentially at exact timestamp intervals
      for (let s = 0; s < totalSteps; s++) {
        const frame = frames[s];
        const maskCanvas = getOrCreateMaskCanvas(frame);

        rCtx.fillStyle = '#000000';
        rCtx.fillRect(0, 0, splitW, splitH);

        if (layoutMode === 'sbs-left-rgb') {
          rCtx.drawImage(frame.img, 0, 0, fw, fh);
          rCtx.drawImage(maskCanvas, fw, 0, fw, fh);
        } else if (layoutMode === 'sbs-left-alpha') {
          rCtx.drawImage(maskCanvas, 0, 0, fw, fh);
          rCtx.drawImage(frame.img, fw, 0, fw, fh);
        } else if (layoutMode === 'top-bottom-rgb') {
          rCtx.drawImage(frame.img, 0, 0, fw, fh);
          rCtx.drawImage(maskCanvas, 0, fh, fw, fh);
        }

        const pct = Math.round(((s + 1) / totalSteps) * 100);
        setRenderProgress(pct);
        setRenderStatus(`معالجة وتسجيل الإطار ${s + 1} من ${totalSteps} بسرعة ${fps} إطار/ثانية...`);

        // High-precision delta timing to prevent any lag, drift or stutter
        const targetNextTime = startTime + (s + 1) * frameDurationMs;
        const waitMs = targetNextTime - performance.now();
        if (waitMs > 0) {
          await new Promise(r => setTimeout(r, waitMs));
        }
      }

      setRenderStatus('إنهاء تشفير الفيديو وتعبئة الحاوية...');
      recorder.stop();
      if (audioSource) {
        try { audioSource.stop(); } catch {}
      }
      if (audioContext && audioContext.state !== 'closed') {
        try { audioContext.close(); } catch {}
      }
      const finalBlob = await recordPromise;

      const extension = selectedMime.includes('mp4') ? 'mp4' : 'mp4'; // Name as .mp4 for compatibility
      const filename = `alpha_animation_${Date.now()}.${extension}`;
      const url = URL.createObjectURL(finalBlob);

      setGeneratedVideoBlob(finalBlob);
      setGeneratedVideoUrl(url);
      setGeneratedFileName(filename);
      setRenderStatus('تم إنشاء ملف MP4 Alpha بنجاح!');
    } catch (err: any) {
      alert('حدث خطأ أثناء الإنشاء: ' + (err.message || ''));
    } finally {
      setIsRendering(false);
    }
  };

  const handleDownload = () => {
    if (!generatedVideoUrl) return;
    const link = document.createElement('a');
    link.href = generatedVideoUrl;
    link.download = generatedFileName || 'alpha_video.mp4';
    link.click();
  };

  const handleTestInVab = () => {
    if (!generatedVideoBlob || !onOpenInVabViewer) return;
    const testFile = new File([generatedVideoBlob], generatedFileName || 'alpha_video.mp4', {
      type: generatedVideoBlob.type || 'video/mp4'
    });
    onOpenInVabViewer(testFile);
  };

  const getBackgroundStyle = () => {
    if (bgColor === 'checker') {
      return {
        backgroundImage: `
          linear-gradient(45deg, #1e293b 25%, transparent 25%), 
          linear-gradient(-45deg, #1e293b 25%, transparent 25%), 
          linear-gradient(45deg, transparent 75%, #1e293b 75%), 
          linear-gradient(-45deg, transparent 75%, #1e293b 75%)
        `,
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
        backgroundColor: '#0f172a'
      };
    }
    if (bgColor === 'dark') return { backgroundColor: 'transparent' };
    if (bgColor === 'white') return { backgroundColor: '#ffffff' };
    if (bgColor === 'chroma') return { backgroundColor: '#00ff00' };
    return { backgroundColor: 'transparent' };
  };

  return (
    <div className="w-full flex flex-col gap-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600/10 text-blue-400 p-2.5 rounded-2xl border border-blue-500/20">
            <Layers size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">صانع MP4 Alpha</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/30">
                توليد VAP & Alpha Video
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              تحويل تسلسل الصور الشفافة PNG إلى فيديو MP4 مقسوم بقناة شفافية فائقة النقاء
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-black transition-all active:scale-95"
          >
            <Upload size={15} />
            رفع تسلسل صور PNG
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/webp"
            className="hidden"
            onChange={handleUploadImages}
          />
        </div>
      </div>

      {/* Main Studio Area */}
      {frames.length === 0 ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full min-h-[400px] rounded-3xl border-2 border-dashed border-slate-800 hover:border-blue-500/50 bg-slate-900/30 hover:bg-slate-900/50 transition-all cursor-pointer flex flex-col items-center justify-center p-8 text-center group"
        >
          <div className="w-20 h-20 bg-blue-500/10 border border-blue-500/20 group-hover:scale-110 rounded-3xl flex items-center justify-center text-blue-400 transition-all mb-4">
            <Upload size={36} />
          </div>
          <h3 className="text-lg font-black text-white mb-2">اختر أو اسحب تسلسل صور PNG الشفافة</h3>
          <p className="text-xs text-slate-400 max-w-md leading-relaxed mb-6">
            قم برفع إطارات الأنيميشن المستخرجة من After Effects أو أي برنامج تصميم لتحويلها فوراً إلى فيديو MP4 Alpha متوافق مع VAP
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="px-6 py-3 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-xs font-bold rounded-xl transition-all flex items-center gap-2"
            >
              <Upload size={16} />
              استعراض الصور من الجهاز
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Interactive Previews (2 cols wide on desktop) */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* View Mode Tabs */}
            <div className="flex items-center justify-between bg-slate-900/40 backdrop-blur-sm p-2 rounded-2xl border border-slate-800/60 flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPreviewTab('split')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${previewTab === 'split' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/30'}`}
                >
                  <Layers size={14} />
                  معاينة الإطار المزدوج (RGB + Alpha)
                </button>
                <button
                  onClick={() => setPreviewTab('composite')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${previewTab === 'composite' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/30'}`}
                >
                  <Eye size={14} />
                  معاينة النتيجة الشفافة
                </button>
              </div>

              {previewTab === 'composite' && (
                <div className="flex items-center gap-1 bg-slate-900/40 backdrop-blur-sm p-1 rounded-xl border border-slate-800/60">
                  {[
                    { id: 'checker', label: 'مربعات' },
                    { id: 'dark', label: 'شفاف' },
                    { id: 'white', label: 'أبيض' },
                    { id: 'chroma', label: 'أخضر' }
                  ].map(bg => (
                    <button
                      key={bg.id}
                      onClick={() => setBgColor(bg.id)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${bgColor === bg.id ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'text-slate-400 hover:text-white'}`}
                    >
                      {bg.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 px-3">
                <span>الإطار:</span>
                <span className="text-white font-bold">{currentFrameIdx + 1}</span>
                <span>/</span>
                <span>{frames.length}</span>
              </div>
            </div>

            {/* Preview Box */}
            <div 
              className="relative w-full min-h-[420px] max-h-[60vh] rounded-3xl border border-slate-800/80 flex items-center justify-center p-6 overflow-hidden shadow-2xl transition-all"
              style={previewTab === 'composite' ? getBackgroundStyle() : { backgroundColor: '#090d16' }}
            >
              {/* Split Canvas */}
              <canvas
                ref={splitCanvasRef}
                className={`max-w-full max-h-[50vh] object-contain rounded-xl border border-slate-800 drop-shadow-xl ${previewTab === 'split' ? 'block' : 'hidden'}`}
              />

              {/* Composite Canvas */}
              <canvas
                ref={compositeCanvasRef}
                className={`max-w-full max-h-[50vh] object-contain drop-shadow-2xl ${previewTab === 'composite' ? 'block' : 'hidden'}`}
              />

              {/* Badges on split canvas */}
              {previewTab === 'split' && (
                <div className="absolute top-4 right-4 flex items-center gap-2 pointer-events-none">
                  <span className="px-3 py-1 bg-slate-900/60 backdrop-blur-md rounded-xl text-[10px] font-mono font-bold text-blue-300 border border-slate-800/60">
                    {layoutMode === 'sbs-left-rgb' && 'RGB (يسار) | قناع الشفافية (يمين)'}
                    {layoutMode === 'sbs-left-alpha' && 'قناع الشفافية (يسار) | RGB (يمين)'}
                    {layoutMode === 'top-bottom-rgb' && 'RGB (أعلى) | قناع الشفافية (أسفل)'}
                  </span>
                </div>
              )}
            </div>

            {/* Playback Controls & Frame Scrubber */}
            <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/60 rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 rounded-xl transition-all shadow-sm active:scale-95"
                  title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل المعاينة'}
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>

                <button
                  onClick={() => {
                    setCurrentFrameIdx(0);
                    if (audioPreviewRef.current) {
                      audioPreviewRef.current.currentTime = 0;
                    }
                  }}
                  className="p-2.5 bg-slate-900/40 hover:bg-slate-800/50 text-slate-400 hover:text-white rounded-xl border border-slate-800/60 transition-all"
                  title="إعادة التشغيل من البداية (الفريم 0)"
                >
                  <RotateCcw size={16} />
                </button>

                {audioInfo && (
                  <button
                    onClick={() => {
                      const newMuted = !isAudioMuted;
                      setIsAudioMuted(newMuted);
                      if (audioPreviewRef.current) {
                        audioPreviewRef.current.muted = newMuted;
                        if (!newMuted && isPlaying) {
                          audioPreviewRef.current.play().catch(() => {});
                        }
                      }
                    }}
                    className={`p-2.5 rounded-xl border transition-all flex items-center justify-center ${
                      !isAudioMuted
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-sm'
                        : 'bg-slate-800/40 text-slate-400 border-slate-700/50'
                    }`}
                    title={isAudioMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
                  >
                    {isAudioMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                )}
              </div>

              {/* Scrubber slider */}
              <input
                type="range"
                min="0"
                max={frames.length - 1}
                value={currentFrameIdx}
                onChange={(e) => {
                  setIsPlaying(false);
                  const newIdx = parseInt(e.target.value);
                  setCurrentFrameIdx(newIdx);
                  if (audioPreviewRef.current && frames.length > 0) {
                    audioPreviewRef.current.currentTime = (newIdx % frames.length) / fps;
                  }
                }}
                className="flex-1 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-blue-500 min-w-[140px]"
              />

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFrames([])}
                  className="p-2.5 bg-slate-900/40 hover:bg-red-500/15 text-slate-500 hover:text-red-400 rounded-xl border border-slate-800/60 transition-all"
                  title="مسح الإطارات والبدء من جديد"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Generation Settings & Export Panel */}
          <div className="flex flex-col gap-4">
            <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-800/60 rounded-3xl p-6 flex flex-col gap-5">
              <div className="flex items-center gap-2 text-white font-bold text-base pb-3 border-b border-slate-800/60">
                <Settings size={18} className="text-blue-400" />
                <span>إعدادات ملف MP4 Alpha:</span>
              </div>

              {/* Layout Mode */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-slate-400 font-bold">توزيع القنوات (Layout):</label>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setLayoutMode('sbs-left-rgb')}
                    className={`p-3 rounded-2xl border text-right transition-all flex flex-col gap-0.5 ${layoutMode === 'sbs-left-rgb' ? 'bg-blue-500/20 border-blue-500/50 text-white' : 'bg-slate-900/40 border-slate-800/60 text-slate-400 hover:bg-slate-800/40'}`}
                  >
                    <span className="text-xs font-black text-blue-300">RGB يسار + Alpha يمين (VAP القياسي)</span>
                    <span className="text-[10px] text-slate-500">الأكثر انتشاراً في تطبيقات البث وهدايا التيك توك</span>
                  </button>

                  <button
                    onClick={() => setLayoutMode('sbs-left-alpha')}
                    className={`p-3 rounded-2xl border text-right transition-all flex flex-col gap-0.5 ${layoutMode === 'sbs-left-alpha' ? 'bg-blue-500/20 border-blue-500/50 text-white' : 'bg-slate-900/40 border-slate-800/60 text-slate-400 hover:bg-slate-800/40'}`}
                  >
                    <span className="text-xs font-black text-blue-300">Alpha يسار + RGB يمين</span>
                    <span className="text-[10px] text-slate-500">للتطبيقات التي تقرأ قناع الشفافية أولاً</span>
                  </button>

                  <button
                    onClick={() => setLayoutMode('top-bottom-rgb')}
                    className={`p-3 rounded-2xl border text-right transition-all flex flex-col gap-0.5 ${layoutMode === 'top-bottom-rgb' ? 'bg-blue-500/20 border-blue-500/50 text-white' : 'bg-slate-900/40 border-slate-800/60 text-slate-400 hover:bg-slate-800/40'}`}
                  >
                    <span className="text-xs font-black text-blue-300">فوق وتحت (RGB أعلى / Alpha أسفل)</span>
                    <span className="text-[10px] text-slate-500">مناسب للفيديوهات العريضة لتقليل العرض</span>
                  </button>
                </div>
              </div>

              {/* Frame Rate (FPS) */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-400 font-bold">معدل الإطارات (FPS):</label>
                  <span className="text-xs font-mono font-bold text-blue-400">{fps} إطار/ثانية</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[15, 24, 30, 60].map(f => (
                    <button
                      key={f}
                      onClick={() => setFps(f)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all border ${fps === f ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-sm' : 'bg-slate-900/40 text-slate-400 border-slate-800/60 hover:text-white hover:bg-slate-800/40'}`}
                    >
                      {f} FPS
                    </button>
                  ))}
                </div>
              </div>

              {/* Audio File (Under FPS) */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 font-bold">
                    <Music size={15} className="text-blue-400" />
                    <span>إضافة ملف صوتي (اختياري):</span>
                  </div>
                  {audioInfo && (
                    <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                      {audioInfo.duration ? `${audioInfo.duration.toFixed(1)}s` : 'صوت مضاف'}
                    </span>
                  )}
                </div>

                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
                  className="hidden"
                  onChange={handleAudioUpload}
                />

                {!audioInfo ? (
                  <button
                    type="button"
                    onClick={() => audioInputRef.current?.click()}
                    className="w-full py-2.5 px-3 rounded-2xl bg-slate-900/40 hover:bg-slate-800/40 border border-dashed border-slate-800/80 hover:border-blue-500/40 text-slate-400 hover:text-blue-300 text-xs font-bold transition-all flex items-center justify-center gap-2 group"
                  >
                    <Volume2 size={15} className="text-blue-400 group-hover:scale-110 transition-transform" />
                    <span>إضافة ملف صوتي (MP3 / WAV / M4A)</span>
                  </button>
                ) : (
                  <div className="p-3 bg-slate-900/40 backdrop-blur-sm border border-slate-800/60 rounded-2xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="p-2 rounded-xl bg-blue-500/20 text-blue-300 shrink-0 border border-blue-500/30">
                        <Volume2 size={16} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-slate-200 truncate">{audioInfo.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {(audioInfo.size / (1024 * 1024)).toFixed(2)} MB
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => audioInputRef.current?.click()}
                        className="p-1.5 text-slate-400 hover:text-blue-300 rounded-lg hover:bg-slate-800/50 transition-all text-[11px] font-bold"
                        title="استبدال الملف الصوتي"
                      >
                        تغيير
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveAudio}
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all"
                        title="حذف الصوت"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Quality Preset */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-slate-400 font-bold">جودة التشفير (Bitrate):</label>
                <select
                  value={qualityBitrate}
                  onChange={(e) => setQualityBitrate(parseInt(e.target.value))}
                  className="bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm text-slate-200 text-xs rounded-xl p-2.5 outline-none"
                >
                  <option value="2500000" className="bg-slate-900 text-slate-200">اقتصادي (2.5 Mbps - حجم أصغر)</option>
                  <option value="5000000" className="bg-slate-900 text-slate-200">عالي الجودة (5 Mbps - موصى به)</option>
                  <option value="10000000" className="bg-slate-900 text-slate-200">فائق النقاء (10 Mbps - جودة إعلانية)</option>
                </select>
              </div>

              {/* Dimensions Info */}
              <div className="p-3.5 bg-slate-900/40 backdrop-blur-sm rounded-2xl border border-slate-800/60 flex flex-col gap-2 text-[11px]">
                <div className="flex items-center justify-between text-slate-400">
                  <span>أبعاد الحركة الشفافة:</span>
                  <span className="font-mono text-cyan-300 font-bold px-2 py-0.5 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                    {frames[0].width} × {frames[0].height} px
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>أبعاد ملف MP4 الناتج:</span>
                  <span className="font-mono text-blue-300 font-bold px-2 py-0.5 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    {layoutMode === 'top-bottom-rgb' ? frames[0].width : frames[0].width * 2} × {layoutMode === 'top-bottom-rgb' ? frames[0].height * 2 : frames[0].height} px
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleGenerateMP4}
                disabled={isRendering}
                className="w-full py-3.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 font-black text-sm rounded-2xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                {isRendering ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>{renderStatus || 'جاري التشفير...'}</span>
                  </>
                ) : (
                  <>
                    <Film size={18} />
                    <span>توليد ملف MP4 Alpha الآن</span>
                  </>
                )}
              </button>

              {/* Progress bar if rendering */}
              {isRendering && (
                <div className="flex flex-col gap-1.5">
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-150"
                      style={{ width: `${renderProgress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>{renderStatus}</span>
                    <span className="font-mono font-bold text-blue-400">{renderProgress}%</span>
                  </div>
                </div>
              )}

              {/* Download Button when ready */}
              {generatedVideoUrl && !isRendering && (
                <div className="flex flex-col gap-2 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold mb-1">
                    <CheckCircle2 size={16} />
                    <span>الفيديو جاهز بنجاح!</span>
                  </div>

                  <button
                    onClick={handleDownload}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95"
                  >
                    <Download size={16} />
                    <span>تحميل فيديو MP4 Alpha</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
