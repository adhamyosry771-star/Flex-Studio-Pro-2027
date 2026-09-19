import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Download, 
  Settings, 
  Play, 
  Pause, 
  Film, 
  Layers, 
  Sparkles, 
  Trash2, 
  Plus, 
  CheckCircle2, 
  RotateCcw, 
  Sliders, 
  FileVideo, 
  Code2, 
  Copy, 
  Check, 
  FileArchive, 
  Eye, 
  AlertCircle,
  FolderArchive,
  Info,
  ChevronRight,
  Maximize2,
  Music,
  Volume2,
  VolumeX
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';

type LayoutMode = 'vap-compact-tr-bl' | 'vap-compact-right-top' | 'sbs-left-rgb' | 'sbs-left-alpha' | 'top-bottom-rgb';

interface FrameItem {
  id: string;
  name: string;
  url: string;
  img: HTMLImageElement;
  maskCanvas?: HTMLCanvasElement;
  width: number;
  height: number;
}

// Helper to pre-create or retrieve cached alpha mask canvas for high performance
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
      mData[i + 3] = 255; // Opaque mask
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

export const VAPCreator: React.FC = () => {
  // Navigation tabs inside tool
  const [activeTab, setActiveTab] = useState<'create' | 'preview'>('create');

  // Creator frames & parameters
  const [frames, setFrames] = useState<FrameItem[]>([]);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('vap-compact-right-top');
  const [fps, setFps] = useState<number>(30);
  const [qualityBitrate, setQualityBitrate] = useState<number>(5000000); // 5 Mbps
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentFrameIdx, setCurrentFrameIdx] = useState<number>(0);
  const [bgColor, setBgColor] = useState<string>('checker');
  const [customBgHex, setCustomBgHex] = useState<string>('#0f172a');

  // Audio track states
  const [audioInfo, setAudioInfo] = useState<AudioInfo | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [isViewerMuted, setIsViewerMuted] = useState<boolean>(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Generation & export states
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [renderProgress, setRenderProgress] = useState<number>(0);
  const [renderStatus, setRenderStatus] = useState<string>('');
  const [generatedVideoBlob, setGeneratedVideoBlob] = useState<Blob | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string>('');
  const [generatedJsonData, setGeneratedJsonData] = useState<string>('');
  const [copiedJson, setCopiedJson] = useState<boolean>(false);
  const [showJsonModal, setShowJsonModal] = useState<boolean>(false);

  // Viewer / Previewer playback states
  const [viewerPlaying, setViewerPlaying] = useState<boolean>(true);
  const [viewerCurrentTime, setViewerCurrentTime] = useState<number>(0);
  const [viewerDuration, setViewerDuration] = useState<number>(0);
  const [viewerScale, setViewerScale] = useState<number>(100);

  // References
  const splitCanvasRef = useRef<HTMLCanvasElement>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);
  const viewerCanvasRef = useRef<HTMLCanvasElement>(null);
  const viewerVideoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const viewerAnimFrameRef = useRef<number | null>(null);

  // Clean up resources on unmount
  useEffect(() => {
    return () => {
      frames.forEach(f => {
        if (f.url.startsWith('blob:')) URL.revokeObjectURL(f.url);
      });
      if (generatedVideoUrl && generatedVideoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(generatedVideoUrl);
      }
      if (audioInfo?.url && audioInfo.url.startsWith('blob:')) {
        URL.revokeObjectURL(audioInfo.url);
      }
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
      if (viewerAnimFrameRef.current) cancelAnimationFrame(viewerAnimFrameRef.current);
    };
  }, []);

  // Natural sorting for filenames
  const naturalSort = (a: string, b: string) => {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  };

  // Upload image sequence
  const processFiles = (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    const fileList: File[] = (Array.from(files) as File[]).filter(f => f.type.startsWith('image/'));
    fileList.sort((a, b) => naturalSort(a.name, b.name));

    if (fileList.length === 0) return;

    // Reset previous files
    frames.forEach(f => {
      if (f.url.startsWith('blob:')) URL.revokeObjectURL(f.url);
    });

    const loadedFrames: FrameItem[] = [];
    let loadedCount = 0;

    fileList.forEach((file) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        loadedFrames.push({
          id: Math.random().toString(36).substring(7),
          name: file.name,
          url,
          img,
          width: img.naturalWidth,
          height: img.naturalHeight
        });

        loadedCount++;
        if (loadedCount === fileList.length) {
          loadedFrames.sort((a, b) => naturalSort(a.name, b.name));
          setFrames(loadedFrames);
          setCurrentFrameIdx(0);
          setIsPlaying(true);
        }
      };
      img.src = url;
    });
  };

  const handleUploadImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
    // Reset input value to allow re-selection
    e.target.value = '';
  };

  // Generate Sample Demo Animation (Smooth pulsating glowing crystal gem)
  const handleGenerateSampleDemo = () => {
    const sampleWidth = 400;
    const sampleHeight = 400;
    const totalFramesCount = 45;
    const generatedList: FrameItem[] = [];

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sampleWidth;
    tempCanvas.height = sampleHeight;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    for (let i = 0; i < totalFramesCount; i++) {
      const progress = i / totalFramesCount;
      const angle = progress * Math.PI * 2;
      const bounce = Math.sin(angle) * 20;
      const scale = 0.85 + Math.sin(angle * 2) * 0.15;

      ctx.clearRect(0, 0, sampleWidth, sampleHeight);

      ctx.save();
      ctx.translate(sampleWidth / 2, sampleHeight / 2 + bounce);
      ctx.rotate(angle * 0.5);
      ctx.scale(scale, scale);

      // Outer glow
      const glowGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 120);
      glowGrad.addColorStop(0, 'rgba(99, 102, 241, 0.9)');
      glowGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.5)');
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 120, 0, Math.PI * 2);
      ctx.fill();

      // Octagon Gem
      ctx.beginPath();
      const sides = 8;
      const radius = 70;
      for (let s = 0; s < sides; s++) {
        const a = (s / sides) * Math.PI * 2;
        const x = Math.cos(a) * radius;
        const y = Math.sin(a) * radius;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      const gemGrad = ctx.createLinearGradient(-70, -70, 70, 70);
      gemGrad.addColorStop(0, '#38bdf8');
      gemGrad.addColorStop(0.5, '#6366f1');
      gemGrad.addColorStop(1, '#ec4899');
      ctx.fillStyle = gemGrad;
      ctx.fill();

      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Center sparkle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      const dataUrl = tempCanvas.toDataURL('image/png');
      const img = new Image();
      img.src = dataUrl;

      generatedList.push({
        id: `demo-frame-${i}`,
        name: `gem_frame_${String(i).padStart(3, '0')}.png`,
        url: dataUrl,
        img,
        width: sampleWidth,
        height: sampleHeight
      });
    }

    setFrames(generatedList);
    setCurrentFrameIdx(0);
    setIsPlaying(true);
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

    // If currently playing in creator tab, align audio position
    if (activeTab === 'create' && isPlaying && frames.length > 0) {
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

  // Pause creator audio if user switches to viewer tab
  useEffect(() => {
    if (activeTab !== 'create' && audioPreviewRef.current) {
      audioPreviewRef.current.pause();
    }
  }, [activeTab]);

  // Preview animation loop for loaded frames with exact audio sync
  useEffect(() => {
    const audio = audioPreviewRef.current;
    const exactDuration = frames.length > 0 ? frames.length / fps : 0;

    if (!isPlaying || frames.length === 0 || activeTab !== 'create') {
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

    const intervalTime = 1000 / fps;
    animIntervalRef.current = setInterval(() => {
      setCurrentFrameIdx(prev => {
        const next = (prev + 1) % frames.length;
        const currentAudio = audioPreviewRef.current;

        if (currentAudio && audioInfo) {
          if (next === 0) {
            // Loop back to start: reset audio strictly to 0 and restart
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
    }, intervalTime);

    return () => {
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    };
  }, [isPlaying, frames.length, fps, audioInfo, isAudioMuted, activeTab]);

  // Dimensions of single frame
  const frameWidth = frames.length > 0 ? frames[0].width : 500;
  const frameHeight = frames.length > 0 ? frames[0].height : 500;

  // Even dimensions for video encoding
  const cleanFw = frameWidth % 2 === 0 ? frameWidth : frameWidth - 1;
  const cleanFh = frameHeight % 2 === 0 ? frameHeight : frameHeight - 1;
  const cleanAlphaW = Math.floor(cleanFw / 2) % 2 === 0 ? Math.floor(cleanFw / 2) : Math.floor(cleanFw / 2) + 1;
  const cleanAlphaH = Math.floor(cleanFh / 2) % 2 === 0 ? Math.floor(cleanFh / 2) : Math.floor(cleanFh / 2) + 1;

  // Split video dimensions
  let videoWidth = cleanFw * 2;
  let videoHeight = cleanFh;

  if (layoutMode === 'vap-compact-tr-bl') {
    // Official Tencent VapTool Layout (like user image):
    // Width = cleanFw (left) + cleanAlphaW (right)
    // Height = cleanAlphaH (top) + cleanFh (bottom)
    // Top-Left: Black, Top-Right: White Alpha Mask, Bottom-Left: Color RGB, Bottom-Right: Black
    videoWidth = cleanFw + cleanAlphaW;
    videoHeight = cleanFh + cleanAlphaH;
  } else if (layoutMode === 'vap-compact-right-top') {
    videoWidth = cleanFw + cleanAlphaW;
    videoHeight = cleanFh;
  } else if (layoutMode === 'top-bottom-rgb') {
    videoWidth = cleanFw;
    videoHeight = cleanFh * 2;
  } else {
    videoWidth = cleanFw * 2;
    videoHeight = cleanFh;
  }

  // Draw current frame to split canvas and composite canvas
  useEffect(() => {
    if (frames.length === 0 || !frames[currentFrameIdx]) return;
    const currentFrame = frames[currentFrameIdx];
    const img = currentFrame.img;

    const fw = currentFrame.width;
    const fh = currentFrame.height;

    // 1. Draw Split Canvas (RGB + Alpha)
    const splitCanvas = splitCanvasRef.current;
    if (splitCanvas) {
      if (splitCanvas.width !== videoWidth || splitCanvas.height !== videoHeight) {
        splitCanvas.width = videoWidth;
        splitCanvas.height = videoHeight;
      }
      const sCtx = splitCanvas.getContext('2d');
      if (sCtx) {
        sCtx.clearRect(0, 0, videoWidth, videoHeight);

        const alphaCanvas = getOrCreateMaskCanvas(currentFrame);

        if (layoutMode === 'vap-compact-tr-bl') {
          // Tencent VapTool Layout:
          // Pure black background
          sCtx.fillStyle = '#000000';
          sCtx.fillRect(0, 0, videoWidth, videoHeight);
          // 1. RGB Colors on Bottom-Left: [0, cleanAlphaH, cleanFw, cleanFh]
          sCtx.drawImage(img, 0, 0, fw, fh, 0, cleanAlphaH, cleanFw, cleanFh);
          // 2. White Alpha Mask on Top-Right: [cleanFw, 0, cleanAlphaW, cleanAlphaH]
          sCtx.drawImage(alphaCanvas, 0, 0, fw, fh, cleanFw, 0, cleanAlphaW, cleanAlphaH);
        } else if (layoutMode === 'vap-compact-right-top') {
          sCtx.fillStyle = '#000000';
          sCtx.fillRect(0, 0, videoWidth, videoHeight);
          sCtx.drawImage(img, 0, 0, fw, fh, 0, 0, cleanFw, cleanFh);
          sCtx.drawImage(alphaCanvas, 0, 0, fw, fh, cleanFw, 0, cleanAlphaW, cleanAlphaH);
        } else if (layoutMode === 'sbs-left-rgb') {
          // RGB on Left (with black solid backing for clean compression)
          sCtx.fillStyle = '#000000';
          sCtx.fillRect(0, 0, cleanFw, cleanFh);
          sCtx.drawImage(img, 0, 0, fw, fh, 0, 0, cleanFw, cleanFh);
          // Alpha on Right
          sCtx.drawImage(alphaCanvas, 0, 0, fw, fh, cleanFw, 0, cleanFw, cleanFh);
        } else if (layoutMode === 'sbs-left-alpha') {
          // Alpha on Left
          sCtx.drawImage(alphaCanvas, 0, 0, fw, fh, 0, 0, cleanFw, cleanFh);
          // RGB on Right
          sCtx.fillStyle = '#000000';
          sCtx.fillRect(cleanFw, 0, cleanFw, cleanFh);
          sCtx.drawImage(img, 0, 0, fw, fh, cleanFw, 0, cleanFw, cleanFh);
        } else if (layoutMode === 'top-bottom-rgb') {
          // RGB on Top
          sCtx.fillStyle = '#000000';
          sCtx.fillRect(0, 0, cleanFw, cleanFh);
          sCtx.drawImage(img, 0, 0, fw, fh, 0, 0, cleanFw, cleanFh);
          // Alpha on Bottom
          sCtx.drawImage(alphaCanvas, 0, 0, fw, fh, 0, cleanFh, cleanFw, cleanFh);
        }
      }
    }

    // 2. Draw Composite Canvas (Pure transparent preview)
    const compCanvas = compositeCanvasRef.current;
    if (compCanvas) {
      if (compCanvas.width !== fw || compCanvas.height !== fh) {
        compCanvas.width = fw;
        compCanvas.height = fh;
      }
      const cCtx = compCanvas.getContext('2d');
      if (cCtx) {
        cCtx.clearRect(0, 0, fw, fh);
        cCtx.drawImage(img, 0, 0, fw, fh);
      }
    }
  }, [currentFrameIdx, frames, layoutMode, videoWidth, videoHeight]);

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

  // Construct official Tencent VAP JSON specification
  const generateVapJsonSpec = () => {
    let rgbX = 0, rgbY = 0, rgbW = cleanFw, rgbH = cleanFh;
    let alphaX = cleanFw, alphaY = 0, alphaW = cleanAlphaW, alphaH = cleanAlphaH;

    if (layoutMode === 'vap-compact-tr-bl') {
      alphaX = cleanFw;
      alphaY = 0;
      alphaW = cleanAlphaW;
      alphaH = cleanAlphaH;
      rgbX = 0;
      rgbY = cleanAlphaH;
      rgbW = cleanFw;
      rgbH = cleanFh;
    } else if (layoutMode === 'vap-compact-right-top') {
      alphaX = cleanFw;
      alphaY = 0;
      alphaW = cleanAlphaW;
      alphaH = cleanAlphaH;
      rgbX = 0;
      rgbY = 0;
      rgbW = cleanFw;
      rgbH = cleanFh;
    } else if (layoutMode === 'sbs-left-rgb') {
      rgbX = 0; rgbY = 0; rgbW = cleanFw; rgbH = cleanFh;
      alphaX = cleanFw; alphaY = 0; alphaW = cleanFw; alphaH = cleanFh;
    } else if (layoutMode === 'sbs-left-alpha') {
      alphaX = 0; alphaY = 0; alphaW = cleanFw; alphaH = cleanFh;
      rgbX = cleanFw; rgbY = 0; rgbW = cleanFw; rgbH = cleanFh;
    } else if (layoutMode === 'top-bottom-rgb') {
      rgbX = 0; rgbY = 0; rgbW = cleanFw; rgbH = cleanFh;
      alphaX = 0; alphaY = cleanFh; alphaW = cleanFw; alphaH = cleanFh;
    }

    const finalFrameCount = frames.length > 0 ? frames.length : 1;

    const vapObject: any = {
      info: {
        v: 2,
        f: finalFrameCount,
        w: cleanFw,
        h: cleanFh,
        videoW: videoWidth,
        videoH: videoHeight,
        orien: 0,
        fps: fps,
        isVapx: 0,
        rgbFrame: [rgbX, rgbY, rgbW, rgbH],
        alphaFrame: [alphaX, alphaY, alphaW, alphaH]
      }
    };

    return JSON.stringify(vapObject, null, 2);
  };

  // Update JSON string whenever settings or frames change
  useEffect(() => {
    if (frames.length > 0) {
      const jsonStr = generateVapJsonSpec();
      setGeneratedJsonData(jsonStr);
    }
  }, [frames.length, frameWidth, frameHeight, videoWidth, videoHeight, fps, layoutMode, audioInfo]);

  // Generate VAP MP4 Video using Canvas captureStream and MediaRecorder
  const handleGenerateVAP = async () => {
    if (frames.length === 0) return;

    setIsRendering(true);
    setRenderProgress(0);
    setRenderStatus('بدء تهيئة محرك ترميز VAP...');

    try {
      const renderCanvas = document.createElement('canvas');
      renderCanvas.width = videoWidth;
      renderCanvas.height = videoHeight;
      const rCtx = renderCanvas.getContext('2d');
      if (!rCtx) throw new Error('تعذر إنشاء سياق الرسم.');

      // Pre-compute all alpha masks first to eliminate CPU bottleneck during recording
      setRenderStatus('تجهيز وضبط أقنعة الألفا لجميع الفريمات...');
      for (let i = 0; i < frames.length; i++) {
        getOrCreateMaskCanvas(frames[i]);
      }

      // Capture stream from canvas
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
          console.warn('تعذر تجهيز مسار الصوت في VAP:', audioErr);
        }
      }

      // Preferred MIME types
      const candidateMimes = audioInfo ? [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=avc1.4d002a,mp4a.40.2',
        'video/mp4',
        'video/webm;codecs=h264,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
      ] : [
        'video/mp4;codecs=avc1.42E01E',
        'video/mp4;codecs=avc1.4d002a',
        'video/mp4',
        'video/webm;codecs=vp9',
        'video/webm'
      ];
      let mimeType = candidateMimes.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';

      const recorderOptions: MediaRecorderOptions = {
        mimeType,
        videoBitsPerSecond: qualityBitrate
      };
      if (audioInfo) {
        recorderOptions.audioBitsPerSecond = 128000;
      }

      const recorder = new MediaRecorder(stream, recorderOptions);

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const recordPromise = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          const finalBlob = new Blob(chunks, { type: mimeType.includes('mp4') ? 'video/mp4' : 'video/webm' });
          resolve(finalBlob);
        };
      });

      recorder.start();

      // Audio starts at 0 and stops strictly at exactDuration (with final frame)
      if (audioSource) {
        audioSource.start(0, 0, exactDuration);
      }

      const fw = frameWidth;
      const fh = frameHeight;
      const frameDurationMs = 1000 / fps;
      const startTime = performance.now();

      // Draw all frames in sequence at exact timestamp intervals
      for (let i = 0; i < totalSteps; i++) {
        const frame = frames[i];
        const alphaCanvas = getOrCreateMaskCanvas(frame);

        setRenderProgress(Math.round(((i + 1) / totalSteps) * 100));
        setRenderStatus(`جاري معالجة وتسجيل الإطار ${i + 1} من ${totalSteps} بسرعة ${fps} إطار/ثانية...`);

        rCtx.clearRect(0, 0, videoWidth, videoHeight);

        if (layoutMode === 'vap-compact-tr-bl') {
          // Tencent VapTool Layout (White mask top-right, colors bottom-left)
          rCtx.fillStyle = '#000000';
          rCtx.fillRect(0, 0, videoWidth, videoHeight);
          // 1. RGB on Bottom-Left: [0, cleanAlphaH, cleanFw, cleanFh]
          rCtx.drawImage(frame.img, 0, 0, fw, fh, 0, cleanAlphaH, cleanFw, cleanFh);
          // 2. White Alpha Mask on Top-Right: [cleanFw, 0, cleanAlphaW, cleanAlphaH]
          rCtx.drawImage(alphaCanvas, 0, 0, fw, fh, cleanFw, 0, cleanAlphaW, cleanAlphaH);
        } else if (layoutMode === 'vap-compact-right-top') {
          rCtx.fillStyle = '#000000';
          rCtx.fillRect(0, 0, videoWidth, videoHeight);
          rCtx.drawImage(frame.img, 0, 0, fw, fh, 0, 0, cleanFw, cleanFh);
          rCtx.drawImage(alphaCanvas, 0, 0, fw, fh, cleanFw, 0, cleanAlphaW, cleanAlphaH);
        } else if (layoutMode === 'sbs-left-rgb') {
          rCtx.fillStyle = '#000000';
          rCtx.fillRect(0, 0, cleanFw, cleanFh);
          rCtx.drawImage(frame.img, 0, 0, fw, fh, 0, 0, cleanFw, cleanFh);
          rCtx.drawImage(alphaCanvas, 0, 0, fw, fh, cleanFw, 0, cleanFw, cleanFh);
        } else if (layoutMode === 'sbs-left-alpha') {
          rCtx.drawImage(alphaCanvas, 0, 0, fw, fh, 0, 0, cleanFw, cleanFh);
          rCtx.fillStyle = '#000000';
          rCtx.fillRect(cleanFw, 0, cleanFw, cleanFh);
          rCtx.drawImage(frame.img, 0, 0, fw, fh, cleanFw, 0, cleanFw, cleanFh);
        } else if (layoutMode === 'top-bottom-rgb') {
          rCtx.fillStyle = '#000000';
          rCtx.fillRect(0, 0, cleanFw, cleanFh);
          rCtx.drawImage(frame.img, 0, 0, fw, fh, 0, 0, cleanFw, cleanFh);
          rCtx.drawImage(alphaCanvas, 0, 0, fw, fh, 0, cleanFh, cleanFw, cleanFh);
        }

        // High-precision delta timing to eliminate lag and stutter
        const targetNextTime = startTime + (i + 1) * frameDurationMs;
        const waitMs = targetNextTime - performance.now();
        if (waitMs > 0) {
          await new Promise(r => setTimeout(r, waitMs));
        }
      }

      setRenderStatus('اكتمل التسجيل! جاري تجميع وتغليف ملف VAP...');
      recorder.stop();
      if (audioSource) {
        try { audioSource.stop(); } catch {}
      }
      if (audioContext && audioContext.state !== 'closed') {
        try { audioContext.close(); } catch {}
      }

      const finishedBlob = await recordPromise;
      const videoUrl = URL.createObjectURL(finishedBlob);

      setGeneratedVideoBlob(finishedBlob);
      setGeneratedVideoUrl(videoUrl);

      // Also ensure JSON is updated
      const jsonStr = generateVapJsonSpec();
      setGeneratedJsonData(jsonStr);

      setIsRendering(false);
      setRenderStatus('تم توليد ملف VAP بنجاح!');
    } catch (err: any) {
      console.error('VAP Generation failed:', err);
      setIsRendering(false);
      alert(`حدث خطأ أثناء توليد VAP: ${err?.message || 'خطأ غير معروف'}`);
    }
  };

  // Download complete VAP Zip Package (MP4 + standalone .vap + vap.json)
  const handleDownloadFullZip = async () => {
    if (!generatedVideoBlob) return;
    const zip = new JSZip();

    // 1. Add MP4 video file
    zip.file('vap_animation.mp4', generatedVideoBlob);

    // 2. Add JSON configuration file
    const jsonStr = generatedJsonData || generateVapJsonSpec();
    zip.file('vap.json', jsonStr);

    // 3. Build and add standalone .vap container file (MP4 + JSON + Length + VAPc)
    try {
      const jsonEncoder = new TextEncoder();
      const jsonBytes = jsonEncoder.encode(jsonStr);
      const videoBuffer = await generatedVideoBlob.arrayBuffer();

      const totalLength = videoBuffer.byteLength + jsonBytes.byteLength + 4 + 4;
      const combinedBuffer = new Uint8Array(totalLength);

      combinedBuffer.set(new Uint8Array(videoBuffer), 0);
      let offset = videoBuffer.byteLength;

      combinedBuffer.set(jsonBytes, offset);
      offset += jsonBytes.byteLength;

      const view = new DataView(combinedBuffer.buffer);
      view.setUint32(offset, jsonBytes.byteLength, false); // Big endian
      offset += 4;

      const magic = new TextEncoder().encode('VAPc');
      combinedBuffer.set(magic, offset);

      zip.file('animation.vap', combinedBuffer);
    } catch (e) {
      console.warn('Could not generate binary .vap for zip:', e);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vap_package.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download standalone .vap file (Official Tencent VAP binary container)
  const handleDownloadVapFile = async () => {
    if (!generatedVideoBlob) return;
    const jsonStr = generatedJsonData || generateVapJsonSpec();
    const jsonEncoder = new TextEncoder();
    const jsonBytes = jsonEncoder.encode(jsonStr);

    const videoBuffer = await generatedVideoBlob.arrayBuffer();

    // VAP binary structure: [MP4 Data] + [JSON String] + [JSON Length 4 bytes big endian] + [Magic "VAPc"]
    const totalLength = videoBuffer.byteLength + jsonBytes.byteLength + 4 + 4;
    const combinedBuffer = new Uint8Array(totalLength);

    combinedBuffer.set(new Uint8Array(videoBuffer), 0);
    let offset = videoBuffer.byteLength;

    combinedBuffer.set(jsonBytes, offset);
    offset += jsonBytes.byteLength;

    // Write JSON length as 32-bit integer (4 bytes)
    const view = new DataView(combinedBuffer.buffer);
    view.setUint32(offset, jsonBytes.byteLength, false); // Big endian
    offset += 4;

    // Write magic tag "VAPc"
    const magic = new TextEncoder().encode('VAPc');
    combinedBuffer.set(magic, offset);

    const vapBlob = new Blob([combinedBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(vapBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'animation.vap';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download MP4 Video file formatted as VAP
  const handleDownloadMp4Only = () => {
    if (!generatedVideoBlob) return;
    const a = document.createElement('a');
    a.href = generatedVideoUrl;
    a.download = 'vap_animation.mp4';
    a.click();
  };

  // Download JSON spec only
  const handleDownloadJsonOnly = () => {
    const jsonStr = generatedJsonData || generateVapJsonSpec();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vap.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy JSON to clipboard
  const handleCopyJson = () => {
    const jsonStr = generatedJsonData || generateVapJsonSpec();
    navigator.clipboard.writeText(jsonStr);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  // Switch to preview mode and load generated video into preview canvas
  const handleTestInPreview = () => {
    if (!generatedVideoUrl) return;
    setActiveTab('preview');
  };

  // Real-time viewer loop for previewing generated video
  useEffect(() => {
    if (activeTab !== 'preview' || !generatedVideoUrl) return;

    let isActive = true;
    const workCanvas = document.createElement('canvas');
    const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });

    const viewerLoop = () => {
      if (!isActive) return;

      const video = viewerVideoRef.current;
      const canvas = viewerCanvasRef.current;

      if (video && canvas && video.readyState >= 1) {
        if (!video.paused && !video.ended) {
          setViewerCurrentTime(video.currentTime);
        }

        const vw = video.videoWidth;
        const vh = video.videoHeight;

        if (vw > 0 && vh > 0) {
          let outW = frameWidth;
          let outH = frameHeight;
          let rgbX = 0, rgbY = 0, rgbW = frameWidth, rgbH = frameHeight;
          let alphaX = frameWidth, alphaY = 0, alphaW = frameWidth, alphaH = frameHeight;

          if (layoutMode === 'vap-compact-tr-bl') {
            outW = cleanFw;
            outH = cleanFh;
            alphaX = cleanFw;
            alphaY = 0;
            alphaW = cleanAlphaW;
            alphaH = cleanAlphaH;
            rgbX = 0;
            rgbY = cleanAlphaH;
            rgbW = cleanFw;
            rgbH = cleanFh;
          } else if (layoutMode === 'vap-compact-right-top') {
            outW = cleanFw;
            outH = cleanFh;
            alphaX = cleanFw;
            alphaY = 0;
            alphaW = cleanAlphaW;
            alphaH = cleanAlphaH;
            rgbX = 0;
            rgbY = 0;
            rgbW = cleanFw;
            rgbH = cleanFh;
          } else if (layoutMode === 'sbs-left-rgb') {
            outW = Math.floor(vw / 2);
            outH = vh;
            rgbX = 0; rgbY = 0; rgbW = outW; rgbH = outH;
            alphaX = outW; alphaY = 0; alphaW = outW; alphaH = outH;
          } else if (layoutMode === 'sbs-left-alpha') {
            outW = Math.floor(vw / 2);
            outH = vh;
            alphaX = 0; alphaY = 0; alphaW = outW; alphaH = outH;
            rgbX = outW; rgbY = 0; rgbW = outW; rgbH = outH;
          } else if (layoutMode === 'top-bottom-rgb') {
            outW = vw;
            outH = Math.floor(vh / 2);
            rgbX = 0; rgbY = 0; rgbW = outW; rgbH = outH;
            alphaX = 0; alphaY = outH; alphaW = outW; alphaH = outH;
          }

          if (canvas.width !== outW || canvas.height !== outH) {
            canvas.width = outW;
            canvas.height = outH;
          }

          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx && workCtx) {
            if (workCanvas.width !== outW || workCanvas.height !== outH) {
              workCanvas.width = outW;
              workCanvas.height = outH;
            }

            ctx.clearRect(0, 0, outW, outH);
            ctx.drawImage(video, rgbX, rgbY, rgbW, rgbH, 0, 0, outW, outH);

            workCtx.clearRect(0, 0, outW, outH);
            workCtx.drawImage(video, alphaX, alphaY, alphaW, alphaH, 0, 0, outW, outH);

            const rgbImageData = ctx.getImageData(0, 0, outW, outH);
            const alphaImageData = workCtx.getImageData(0, 0, outW, outH);

            const rgbData = rgbImageData.data;
            const alphaData = alphaImageData.data;
            const len = rgbData.length;

            for (let i = 0; i < len; i += 4) {
              const a = (alphaData[i] * 77 + alphaData[i + 1] * 150 + alphaData[i + 2] * 29) >> 8;
              rgbData[i + 3] = a;
            }

            ctx.putImageData(rgbImageData, 0, 0);
          }
        }
      }

      viewerAnimFrameRef.current = requestAnimationFrame(viewerLoop);
    };

    viewerAnimFrameRef.current = requestAnimationFrame(viewerLoop);

    return () => {
      isActive = false;
      if (viewerAnimFrameRef.current) cancelAnimationFrame(viewerAnimFrameRef.current);
    };
  }, [activeTab, generatedVideoUrl, layoutMode, frameWidth, frameHeight]);

  const getBackgroundStyle = () => {
    if (bgColor === 'checker') {
      return {
        backgroundImage: `
          linear-gradient(45deg, #1e293b 25%, transparent 25%), 
          linear-gradient(-45deg, #1e293b 25%, transparent 25%), 
          linear-gradient(45deg, transparent 75%, #1e293b 75%), 
          linear-gradient(-45deg, transparent 75%, #1e293b 75%)
        `,
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
        backgroundColor: '#0f172a'
      };
    }
    if (bgColor === 'dark') return { backgroundColor: 'transparent' };
    if (bgColor === 'black') return { backgroundColor: 'transparent' };
    if (bgColor === 'white') return { backgroundColor: '#ffffff' };
    if (bgColor === 'chroma') return { backgroundColor: '#00ff00' };
    return { backgroundColor: customBgHex };
  };

  return (
    <div className="w-full flex flex-col gap-6" dir="rtl">
      {/* Hidden file input for uploading images */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/webp"
        className="hidden"
        onChange={handleUploadImages}
      />

      {/* Top Banner & Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="bg-cyan-600/10 text-cyan-400 p-2.5 rounded-2xl border border-cyan-500/20">
            <Layers size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">صانع ومولد ملفات VAP</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                Tencent VAP Creator & JSON Spec
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              توليد فيديوهات الشفافية بصيغة VAP مع كود التكوين JSON المخصص لتطبيقات البث والمطورين
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-slate-900/40 border border-slate-800/60 p-1 rounded-2xl backdrop-blur-sm">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'create' ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300' : 'text-slate-400 hover:text-white'}`}
          >
            <span>توليد VAP & JSON</span>
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            disabled={!generatedVideoUrl}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${activeTab === 'preview' ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300' : 'text-slate-400 hover:text-white'}`}
          >
            <span>مشغل ومعاينة VAP</span>
          </button>
        </div>
      </div>

      {activeTab === 'create' ? (
        /* =================== CREATOR TAB =================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Workspace (Left 8 Cols) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Upload Box if no frames */}
            {frames.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files) {
                    processFiles(e.dataTransfer.files);
                  }
                }}
                className="w-full min-h-[420px] rounded-3xl border-2 border-dashed border-slate-800 hover:border-cyan-500/50 bg-slate-900/40 hover:bg-slate-900/60 transition-all cursor-pointer flex flex-col items-center justify-center p-10 text-center group select-none"
              >
                <div className="w-20 h-20 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-3xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Upload size={32} />
                </div>
                <h3 className="text-lg font-black text-white mb-2 group-hover:text-cyan-300 transition-colors">
                  رفع إطارات أنيميشن PNG الشفافة
                </h3>
                <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
                  اختر تسلسل صور بتنسيق PNG شفاف (مثل frame_001.png, frame_002.png). سيقوم النظام بدمج الألوان وقناة الشفافية وتوليد كود الـ JSON التلقائي.
                </p>

                <div className="flex items-center gap-3 flex-wrap justify-center pointer-events-none">
                  <span className="flex items-center gap-2 px-6 py-3 bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 rounded-2xl text-xs font-black transition-all">
                    <Upload size={16} />
                    <span>اختيار مجلد أو صور من جهازك</span>
                  </span>
                </div>
              </div>
            ) : (
              /* Live Previewer of current sequence */
              <div className="flex flex-col gap-4">
                {/* Viewport Card */}
                <div 
                  className="relative w-full min-h-[440px] max-h-[70vh] rounded-3xl border border-slate-800 overflow-hidden flex items-center justify-center p-6 shadow-2xl transition-all"
                  style={getBackgroundStyle()}
                >
                  {/* Top info badge & Background selector */}
                  <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-slate-900/40 backdrop-blur-md p-1.5 rounded-xl border border-slate-800/60 text-xs font-bold text-slate-300">
                    <span className="font-mono text-cyan-400 font-black px-2 py-0.5 bg-cyan-500/10 rounded-lg">
                      {frameWidth} × {frameHeight} px
                    </span>
                    <span className="text-[11px] text-slate-400">
                      (إجمالي الفيديو: {videoWidth} × {videoHeight})
                    </span>
                  </div>

                  {/* Reset/Clear button & Background selector */}
                  <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
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
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${bgColor === bg.id ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'}`}
                        >
                          {bg.label}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => { setFrames([]); setGeneratedVideoBlob(null); setGeneratedVideoUrl(''); }}
                      className="p-2 bg-slate-900/40 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-800/60 transition-all"
                      title="مسح الإطارات واختيار أخرى"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Split Canvas (Real VAP frame: RGB + Alpha Mask) */}
                  <div className="m-auto flex items-center justify-center">
                    <canvas
                      ref={splitCanvasRef}
                      className="max-w-full max-h-[55vh] object-contain drop-shadow-2xl rounded-lg border border-slate-800/50"
                    />
                  </div>
                </div>

                {/* Timeline Controls */}
                <div className="w-full bg-slate-900/40 backdrop-blur-md p-4 rounded-2xl border border-slate-800/60 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="p-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl shadow-sm transition-all active:scale-95"
                      title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل المعاينة'}
                    >
                      {isPlaying ? <Pause size={18} /> : <Play size={18} className="translate-x-0.5" />}
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
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                            : 'bg-slate-800/40 text-slate-400 border-slate-700/50'
                        }`}
                        title={isAudioMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
                      >
                        {isAudioMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                      </button>
                    )}

                    <div className="flex items-center gap-2 text-xs font-mono text-slate-300 mr-1">
                      <span className="font-black text-cyan-400">{currentFrameIdx + 1}</span>
                      <span className="text-slate-500">/</span>
                      <span>{frames.length} إطار</span>
                    </div>
                  </div>

                  <div className="flex-1 max-w-md mx-4 min-w-[140px]">
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, frames.length - 1)}
                      value={currentFrameIdx}
                      onChange={(e) => {
                        setIsPlaying(false);
                        const newIdx = parseInt(e.target.value);
                        setCurrentFrameIdx(newIdx);
                        if (audioPreviewRef.current && frames.length > 0) {
                          audioPreviewRef.current.currentTime = (newIdx % frames.length) / fps;
                        }
                      }}
                      className="w-full h-1.5 bg-slate-800/50 rounded-full appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-slate-900/40 hover:bg-slate-800/50 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-800/60"
                    >
                      استبدال الصور
                    </button>
                  </div>
                </div>

                {/* Status / Generating Progress Bar */}
                {isRendering && (
                  <div className="bg-slate-900 border border-cyan-500/30 p-5 rounded-2xl flex flex-col gap-2 animate-pulse">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-cyan-400">{renderStatus}</span>
                      <span className="text-white font-mono">{renderProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-150"
                        style={{ width: `${renderProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Generated Result & Download Cards */}
                {generatedVideoBlob && !isRendering && (
                  <div className="bg-slate-900/40 border border-cyan-500/30 p-6 rounded-3xl shadow-xl flex flex-col gap-4 backdrop-blur-sm">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-cyan-400">
                        <CheckCircle2 size={20} />
                        <span className="text-sm font-black text-white">تم توليد ملف VAP بنجاح وجاهز للتصدير!</span>
                      </div>
                      <button
                        onClick={handleTestInPreview}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-xl text-xs font-black border border-cyan-500/40 transition-all"
                      >
                        <Eye size={14} />
                        <span>معاينة وتشغيل فوري</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {/* MP4 VAP video (Primary) */}
                      <button
                        onClick={handleDownloadMp4Only}
                        className="flex flex-col items-center justify-center p-5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border-2 border-cyan-500/50 rounded-2xl transition-all active:scale-95 group shadow-lg"
                      >
                        <Download size={28} className="mb-2 text-cyan-300 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-black">تحميل فيديو MP4 VAP</span>
                        <span className="text-[11px] text-cyan-200 mt-1">تنسيق Tencent VapTool (ألوان كاملة يساراً وقناع أبيض أعلى اليمين)</span>
                      </button>

                      {/* Full Zip Package */}
                      <button
                        onClick={handleDownloadFullZip}
                        className="flex flex-col items-center justify-center p-5 bg-slate-800/80 hover:bg-slate-800 text-slate-100 border border-slate-700/80 rounded-2xl transition-all active:scale-95 group shadow-md"
                      >
                        <FolderArchive size={28} className="mb-2 text-cyan-400 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-black">حزمة VAP كاملة (.zip)</span>
                        <span className="text-[11px] text-slate-300 mt-1">تشمل: فيديو MP4 + ملف VAP مدمج (.vap) + ملف vap.json</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Settings & JSON Inspector (Right 4 Cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* VAP Settings Box */}
            <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 flex flex-col gap-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                <Sliders size={18} className="text-cyan-400" />
                <h3 className="text-sm font-black text-white">إعدادات ملف VAP</h3>
              </div>

              {/* Layout Mode */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-300">طريقة توزيع الشفافية (VAP Layout)</label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => setLayoutMode('vap-compact-right-top')}
                    className={`p-3 rounded-xl text-xs font-bold text-right flex items-center justify-between transition-all ${layoutMode === 'vap-compact-right-top' ? 'bg-cyan-500/20 border-2 border-cyan-500/60 text-cyan-300 shadow-md shadow-cyan-500/10' : 'bg-slate-900/30 text-slate-400 border border-slate-800/50 hover:border-slate-700/60 hover:bg-slate-800/30'}`}
                  >
                    <span className="text-white font-bold">تنسيق Tencent VAP الرسمي</span>
                    <span className="text-[10px] text-cyan-400/80 font-mono font-bold">VAP Official</span>
                  </button>

                  <button
                    onClick={() => setLayoutMode('sbs-left-rgb')}
                    className={`p-3 rounded-xl text-xs font-bold text-right flex items-center justify-between transition-all ${layoutMode === 'sbs-left-rgb' ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300' : 'bg-slate-900/30 text-slate-400 border border-slate-800/50 hover:border-slate-700/60 hover:bg-slate-800/30'}`}
                  >
                    <span>جنباً إلى جنب 50/50 (الألوان يسار - الشفافية يمين)</span>
                    <span className="text-[10px] text-slate-500 font-mono">SBS 50%</span>
                  </button>
                </div>
              </div>

              {/* FPS selection */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">معدل الإطارات (FPS)</label>
                  <span className="text-xs font-mono text-cyan-400 font-black">{fps} FPS</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[15, 24, 30, 60].map(val => (
                    <button
                      key={val}
                      onClick={() => setFps(val)}
                      className={`py-2 rounded-xl text-xs font-mono font-bold transition-all ${fps === val ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm' : 'bg-slate-900/30 text-slate-400 hover:text-white border border-slate-800/50 hover:bg-slate-800/30'}`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Audio File (Under FPS) */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 font-bold">
                    <Music size={15} className="text-cyan-400" />
                    <span>إضافة ملف صوتي (اختياري)</span>
                  </div>
                  {audioInfo && (
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                      {audioInfo.duration ? `${audioInfo.duration.toFixed(1)} ثانية` : 'صوت مضاف'}
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
                    className="w-full py-2.5 px-3 rounded-2xl bg-slate-900/40 hover:bg-slate-800/40 border border-dashed border-slate-800/80 hover:border-cyan-500/40 text-slate-400 hover:text-cyan-300 text-xs font-bold transition-all flex items-center justify-center gap-2 group"
                  >
                    <Volume2 size={15} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                    <span>إضافة ملف صوتي (MP3 / WAV / M4A)</span>
                  </button>
                ) : (
                  <div className="p-3 bg-slate-900/40 backdrop-blur-sm border border-slate-800/60 rounded-2xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 shrink-0 border border-cyan-500/30">
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
                        className="p-1.5 text-slate-400 hover:text-cyan-300 rounded-lg hover:bg-slate-800/50 transition-all text-[11px] font-bold"
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

              {/* Video Bitrate */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">معدل البث وجودة الفيديو</label>
                  <span className="text-xs font-mono text-cyan-400 font-black">{qualityBitrate / 1000000} Mbps</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: '3M متوازن', val: 3000000 },
                    { label: '5M عالي', val: 5000000 },
                    { label: '8M فائق', val: 8000000 }
                  ].map(b => (
                    <button
                      key={b.val}
                      onClick={() => setQualityBitrate(b.val)}
                      className={`py-2 rounded-xl text-[11px] font-bold transition-all ${qualityBitrate === b.val ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm' : 'bg-slate-900/30 text-slate-400 hover:text-white border border-slate-800/50 hover:bg-slate-800/30'}`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Button: Start Generating */}
              <button
                onClick={handleGenerateVAP}
                disabled={frames.length === 0 || isRendering}
                className="w-full py-3.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-2xl text-xs font-black active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span>{isRendering ? 'جاري إنشاء ملف VAP...' : 'توليد ملفات VAP & JSON'}</span>
              </button>
            </div>

            {/* Live JSON Specification Box */}
            <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Code2 size={18} className="text-cyan-400" />
                  <h3 className="text-sm font-black text-white">كود ملف التكوين (vap.json)</h3>
                </div>
                <button
                  onClick={handleCopyJson}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-1 bg-slate-900/40 hover:bg-slate-800/40 border border-slate-800/60 rounded-lg transition-all"
                  title="نسخ كود JSON"
                >
                  {copiedJson ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiedJson ? 'تم النسخ' : 'نسخ'}</span>
                </button>
              </div>

              <div className="bg-slate-950/40 p-3 rounded-2xl border border-slate-800/60 font-mono text-[11px] text-cyan-300/90 overflow-x-auto max-h-[220px] leading-relaxed no-scrollbar backdrop-blur-sm" dir="ltr">
                <pre>{generatedJsonData || generateVapJsonSpec()}</pre>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                هذا الكود هو التنسيق الرسمي لشركة Tencent لمشغلات VAP على Android و iOS والويب.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* =================== PREVIEWER & PLAYER TAB =================== */
        <div className="flex flex-col gap-6">
          {/* Active Off-screen video element for real-time decoding */}
          {generatedVideoUrl && (
            <video
              ref={viewerVideoRef}
              src={generatedVideoUrl}
              playsInline
              autoPlay
              loop
              muted={isViewerMuted}
              style={{ position: 'fixed', top: -99999, left: -99999, width: 2, height: 2, opacity: 0, pointerEvents: 'none' }}
              onLoadedMetadata={() => {
                if (viewerVideoRef.current) {
                  setViewerDuration(viewerVideoRef.current.duration || 0);
                  viewerVideoRef.current.play().then(() => setViewerPlaying(true)).catch(() => {});
                }
              }}
              onPlay={() => setViewerPlaying(true)}
              onPause={() => setViewerPlaying(false)}
            />
          )}

          {/* Top Bar with Dimensions & Controls */}
          <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-900/40 backdrop-blur-sm p-4 rounded-2xl border border-slate-800/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-cyan-400 font-black px-3 py-1 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                {frameWidth} × {frameHeight} px
              </span>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                (معاينة حية للملف المُولّد مع تفريغ لحظي لقناة الشفافية)
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Background Color selector */}
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
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${bgColor === bg.id ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'}`}
                  >
                    {bg.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setActiveTab('create')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/40 hover:bg-slate-800/50 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-800/60"
              >
                <span>العودة للتعديل</span>
              </button>
            </div>
          </div>

          {/* Player Viewport (Centered 100% full view) */}
          <div 
            className="relative w-full min-h-[480px] max-h-[75vh] rounded-3xl border border-slate-800 overflow-auto flex items-center justify-center p-8 transition-all shadow-2xl"
            style={getBackgroundStyle()}
          >
            <div className="m-auto flex items-center justify-center">
              <canvas
                ref={viewerCanvasRef}
                className="drop-shadow-2xl rounded-xl transition-all duration-150"
                style={{
                  width: `${frameWidth}px`,
                  height: `${frameHeight}px`,
                  maxWidth: '100%',
                  maxHeight: '65vh',
                  objectFit: 'contain',
                  display: 'block',
                  margin: 'auto'
                }}
              />
            </div>
          </div>

          {/* Playback Controls Bar */}
          <div className="w-full bg-slate-900/40 backdrop-blur-md p-4 rounded-3xl border border-slate-800/60 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-cyan-400 w-16 text-left font-bold">
                {viewerCurrentTime.toFixed(2)}s
              </span>
              <input
                type="range"
                min={0}
                max={viewerDuration || 1}
                step="0.01"
                value={viewerCurrentTime}
                onChange={(e) => {
                  if (viewerVideoRef.current) {
                    viewerVideoRef.current.currentTime = parseFloat(e.target.value);
                    setViewerCurrentTime(parseFloat(e.target.value));
                  }
                }}
                className="flex-1 h-2 bg-slate-800/50 rounded-full appearance-none cursor-pointer accent-cyan-500"
              />
              <span className="text-xs font-mono text-slate-400 w-16 text-right font-medium">
                {viewerDuration.toFixed(2)}s
              </span>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-800/60">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (viewerVideoRef.current) {
                      if (viewerVideoRef.current.paused) {
                        viewerVideoRef.current.play();
                        setViewerPlaying(true);
                      } else {
                        viewerVideoRef.current.pause();
                        setViewerPlaying(false);
                      }
                    }
                  }}
                  className="p-3 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-2xl transition-all shadow-sm active:scale-95"
                >
                  {viewerPlaying ? <Pause size={18} /> : <Play size={18} className="translate-x-0.5" />}
                </button>

                <button
                  onClick={() => {
                    if (viewerVideoRef.current) {
                      viewerVideoRef.current.currentTime = 0;
                      setViewerCurrentTime(0);
                    }
                  }}
                  className="p-2.5 bg-slate-900/40 hover:bg-slate-800/50 text-slate-300 rounded-xl border border-slate-800/60 transition-all"
                  title="إعادة التشغيل من البداية"
                >
                  <RotateCcw size={16} />
                </button>

                {/* Audio toggle in preview */}
                <button
                  onClick={() => {
                    setIsViewerMuted(!isViewerMuted);
                    if (viewerVideoRef.current) {
                      viewerVideoRef.current.muted = !isViewerMuted;
                    }
                  }}
                  className={`p-2.5 rounded-xl border transition-all ${
                    !isViewerMuted
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                      : 'bg-slate-900/40 hover:bg-slate-800/50 text-slate-400 border-slate-800/60'
                  }`}
                  title={isViewerMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
                >
                  {isViewerMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
