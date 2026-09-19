import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Download, 
  Upload, 
  FileVideo, 
  Layers, 
  Settings2, 
  Check, 
  Sliders, 
  Sparkles, 
  Film, 
  Eye, 
  EyeOff, 
  ZoomIn, 
  ZoomOut, 
  FileArchive, 
  RefreshCw,
  Camera,
  Info,
  AlertCircle
} from 'lucide-react';
import JSZip from 'jszip';
import { motion, AnimatePresence } from 'motion/react';

type AlphaLayout = 'vap-compact-right-top' | 'vap-compact-tr-bl' | 'sbs-left-rgb' | 'sbs-left-alpha' | 'top-bottom-rgb' | 'top-bottom-alpha' | 'none';

interface VABViewerProps {
  initialFile?: File | null;
  onSwitchToCreator?: () => void;
}

export const VABViewer: React.FC<VABViewerProps> = ({ initialFile, onSwitchToCreator }) => {
  const [videoFile, setVideoFile] = useState<File | null>(initialFile || null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isLoop, setIsLoop] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [alphaLayout, setAlphaLayout] = useState<AlphaLayout>('vap-compact-right-top');
  const [customVapInfo, setCustomVapInfo] = useState<{ w: number; h: number; rgbFrame: number[]; alphaFrame: number[] } | null>(null);
  const [bgColor, setBgColor] = useState<string>('checker');
  const [customBgHex, setCustomBgHex] = useState<string>('#0f172a');
  const [frameScale, setFrameScale] = useState<number>(100);
  const [viewSizing, setViewSizing] = useState<'actual' | 'fit'>('actual');
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [outputDimensions, setOutputDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportStatus, setExportStatus] = useState<string>('');
  const [showChannelInspect, setShowChannelInspect] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const inspectCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Load initial file if passed
  useEffect(() => {
    if (initialFile) {
      handleLoadFile(initialFile);
    }
  }, [initialFile]);

  // Clean up object URL when component unmounts or video changes
  useEffect(() => {
    return () => {
      if (videoUrl && videoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoUrl);
      }
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [videoUrl]);

  const handleLoadFile = (file: File) => {
    setVideoError(null);
    setCustomVapInfo(null);
    if (videoUrl && videoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(videoUrl);
    }

    // Standardize MIME type to video/mp4 for .vap or files missing MIME type
    let mediaBlob: Blob = file;
    const nameLower = file.name.toLowerCase();
    if (nameLower.endsWith('.vap') || !file.type || file.type === 'application/octet-stream') {
      mediaBlob = new Blob([file], { type: 'video/mp4' });
    }

    // Inspect if file has embedded Tencent VAPc container specification
    const reader = new FileReader();
    reader.onload = (e) => {
      const buf = e.target?.result as ArrayBuffer;
      if (buf && buf.byteLength > 8) {
        const u8 = new Uint8Array(buf);
        const len = u8.length;
        // Check magic bytes "VAPc": 0x56, 0x41, 0x50, 0x63
        if (u8[len - 4] === 0x56 && u8[len - 3] === 0x41 && u8[len - 2] === 0x50 && u8[len - 1] === 0x63) {
          const view = new DataView(buf);
          const jsonLen = view.getUint32(len - 8, false); // Big endian length
          if (jsonLen > 0 && jsonLen < len - 8) {
            try {
              const jsonBytes = u8.slice(len - 8 - jsonLen, len - 8);
              const jsonStr = new TextDecoder().decode(jsonBytes);
              const parsed = JSON.parse(jsonStr);
              if (parsed?.info) {
                setCustomVapInfo(parsed.info);
                // Strip trailing JSON bytes to ensure standard browser video decoding
                const pureMp4Blob = new Blob([u8.slice(0, len - 8 - jsonLen)], { type: 'video/mp4' });
                const pureUrl = URL.createObjectURL(pureMp4Blob);
                setVideoFile(file);
                setVideoUrl(pureUrl);
                setCurrentTime(0);
                setAlphaLayout('vap-compact-right-top');
                return;
              }
            } catch (err) {
              console.warn('Could not parse embedded VAP JSON:', err);
            }
          }
        }
      }

      // Default load
      const url = URL.createObjectURL(mediaBlob);
      setVideoFile(file);
      setVideoUrl(url);
      setCurrentTime(0);
    };
    reader.onerror = () => {
      const url = URL.createObjectURL(mediaBlob);
      setVideoFile(file);
      setVideoUrl(url);
      setCurrentTime(0);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleLoadFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleLoadFile(file);
    }
  };

  // Generate a live sample demonstration if the user wants to test right away
  const handleLoadDemoSample = () => {
    // Exact Tencent VapTool layout: 600x600 canvas
    // Bottom-Left (400x400): Animated glowing gem with colors
    // Top-Right (200x200): Alpha mask at 50% scale
    // Top-Left and Bottom-Right: solid black
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 600;
    sampleCanvas.height = 600;
    const ctx = sampleCanvas.getContext('2d');
    if (!ctx) return;

    // We can record a 2-second loop into an MP4/WebM blob
    const stream = sampleCanvas.captureStream(30);
    const mime = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mime });
      const demoFile = new File([blob], 'demo_vap_tool_animation.mp4', { type: mime });
      handleLoadFile(demoFile);
    };

    recorder.start();

    let frame = 0;
    const totalFrames = 60;
    const renderDemoInterval = setInterval(() => {
      frame++;
      const t = (frame % totalFrames) / totalFrames;
      const angle = t * Math.PI * 2;

      // Entire canvas is solid black like Tencent VapTool
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 600, 600);

      // --- Left side: RGB Colors full height (x: 0, y: 0, w: 400, h: 600) ---
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, 400, 600);
      ctx.clip();
      
      const cx = 200;
      const cy = 300 + Math.sin(angle) * 35;
      const radius = 85 + Math.sin(angle * 2) * 15;

      // Glow gradient
      const radGrad = ctx.createRadialGradient(cx, cy, 15, cx, cy, radius + 40);
      radGrad.addColorStop(0, '#38bdf8');
      radGrad.addColorStop(0.5, '#818cf8');
      radGrad.addColorStop(1, '#ec4899');

      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner star / sparkles
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Text label inside RGB
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VAP TOOL', cx, cy + radius + 45);
      ctx.restore();

      // --- Top-Right: Alpha Mask at 50% scale (x: 400, y: 0, w: 200, h: 300) ---
      // Bottom-Right (x: 400, y: 300, w: 200, h: 300) remains pitch black
      ctx.save();
      ctx.beginPath();
      ctx.rect(400, 0, 200, 300);
      ctx.clip();

      const alphaCx = 400 + (cx * 0.5); // 400 + 100 = 500
      const alphaCy = cy * 0.5; // (300 + sin*35) * 0.5 = 150
      const alphaRadius = radius * 0.5;

      // White/Gray alpha mask matching the object exactly
      const alphaGrad = ctx.createRadialGradient(alphaCx, alphaCy, 15 * 0.5, alphaCx, alphaCy, (radius + 40) * 0.5);
      alphaGrad.addColorStop(0, '#ffffff');
      alphaGrad.addColorStop(0.7, '#eeeeee');
      alphaGrad.addColorStop(1, '#000000');

      ctx.fillStyle = alphaGrad;
      ctx.beginPath();
      ctx.arc(alphaCx, alphaCy, alphaRadius, 0, Math.PI * 2);
      ctx.fill();

      // Mask for text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VAP TOOL', alphaCx, alphaCy + alphaRadius + 22);
      ctx.restore();

      if (frame >= totalFrames) {
        clearInterval(renderDemoInterval);
        recorder.stop();
      }
    }, 1000 / 30);
  };

  // Video metadata loaded
  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const vw = videoRef.current.videoWidth;
    const vh = videoRef.current.videoHeight;
    setVideoDimensions({ width: vw, height: vh });
    setDuration(videoRef.current.duration || 0);

    // Auto-detect layout
    if (customVapInfo) {
      setOutputDimensions({ width: customVapInfo.w, height: customVapInfo.h });
    } else {
      // Default to official Tencent VAP layout (RGB Left full height, Alpha Top-Right 50%)
      setAlphaLayout('vap-compact-right-top');
      const outW = Math.round((vw * 2) / 3);
      const cleanW = outW % 2 === 0 ? outW : outW + 1;
      setOutputDimensions({ width: cleanW, height: vh });
    }
  };

  // Update output dimensions when layout changes
  useEffect(() => {
    const { width: vw, height: vh } = videoDimensions;
    if (vw === 0 || vh === 0) return;

    if (customVapInfo) {
      setOutputDimensions({ width: customVapInfo.w, height: customVapInfo.h });
    } else if (alphaLayout === 'vap-compact-right-top') {
      const outW = Math.round((vw * 2) / 3);
      const cleanW = outW % 2 === 0 ? outW : outW + 1;
      setOutputDimensions({ width: cleanW, height: vh });
    } else if (alphaLayout === 'vap-compact-tr-bl') {
      const outW = Math.round((vw * 2) / 3);
      const outH = Math.round((vh * 2) / 3);
      setOutputDimensions({ width: outW % 2 === 0 ? outW : outW + 1, height: outH % 2 === 0 ? outH : outH + 1 });
    } else if (alphaLayout === 'sbs-left-rgb' || alphaLayout === 'sbs-left-alpha') {
      setOutputDimensions({ width: Math.floor(vw / 2), height: vh });
    } else if (alphaLayout === 'top-bottom-rgb' || alphaLayout === 'top-bottom-alpha') {
      setOutputDimensions({ width: vw, height: Math.floor(vh / 2) });
    } else {
      setOutputDimensions({ width: vw, height: vh });
    }
  }, [alphaLayout, videoDimensions, customVapInfo]);

  // Main rendering loop for alpha blending
  useEffect(() => {
    let isActive = true;

    // Temporary working canvas
    const workCanvas = document.createElement('canvas');
    const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });

    const renderLoop = () => {
      if (!isActive) return;

      const video = videoRef.current;
      const displayCanvas = displayCanvasRef.current;

      if (video && displayCanvas && video.readyState >= 1) {
        if (!video.paused && !video.ended) {
          setCurrentTime(video.currentTime);
        }

        const vw = video.videoWidth;
        const vh = video.videoHeight;

        if (vw > 0 && vh > 0) {
          let outW = vw;
          let outH = vh;
          let rgbX = 0, rgbY = 0, rgbW = vw, rgbH = vh;
          let alphaX = 0, alphaY = 0, alphaW = vw, alphaH = vh;

          if (customVapInfo && customVapInfo.rgbFrame && customVapInfo.alphaFrame) {
            // Direct metadata coordinates from official Tencent VAP header
            outW = customVapInfo.w;
            outH = customVapInfo.h;
            rgbX = customVapInfo.rgbFrame[0];
            rgbY = customVapInfo.rgbFrame[1];
            rgbW = customVapInfo.rgbFrame[2];
            rgbH = customVapInfo.rgbFrame[3];
            alphaX = customVapInfo.alphaFrame[0];
            alphaY = customVapInfo.alphaFrame[1];
            alphaW = customVapInfo.alphaFrame[2];
            alphaH = customVapInfo.alphaFrame[3];
          } else if (alphaLayout === 'vap-compact-right-top') {
            // Official Tencent VapTool Layout (Matching user image):
            // Colors on Left (full height): [0, 0, outW, vh]
            // Alpha mask at Top-Right (50% scale): [outW, 0, alphaW, alphaH]
            // Bottom-Right is black [outW, alphaH, alphaW, vh - alphaH]
            outW = Math.round((vw * 2) / 3);
            outW = outW % 2 === 0 ? outW : outW + 1;
            outH = vh;
            const cleanAW = vw - outW;
            const cleanAH = Math.round(vh / 2);
            alphaX = outW;
            alphaY = 0;
            alphaW = cleanAW;
            alphaH = cleanAH % 2 === 0 ? cleanAH : cleanAH + 1;
            rgbX = 0;
            rgbY = 0;
            rgbW = outW;
            rgbH = outH;
          } else if (alphaLayout === 'vap-compact-tr-bl') {
            // Official Tencent VapTool Layout (Alpha top-right, RGB colors bottom-left)
            outW = Math.round((vw * 2) / 3);
            outH = Math.round((vh * 2) / 3);
            outW = outW % 2 === 0 ? outW : outW + 1;
            outH = outH % 2 === 0 ? outH : outH + 1;
            const cleanAW = vw - outW;
            const cleanAH = vh - outH;
            alphaX = outW;
            alphaY = 0;
            alphaW = cleanAW;
            alphaH = cleanAH;
            rgbX = 0;
            rgbY = cleanAH;
            rgbW = outW;
            rgbH = outH;
          } else if (alphaLayout === 'sbs-left-rgb') {
            outW = Math.floor(vw / 2);
            outH = vh;
            rgbX = 0; rgbY = 0; rgbW = outW; rgbH = outH;
            alphaX = outW; alphaY = 0; alphaW = outW; alphaH = outH;
          } else if (alphaLayout === 'sbs-left-alpha') {
            outW = Math.floor(vw / 2);
            outH = vh;
            alphaX = 0; alphaY = 0; alphaW = outW; alphaH = outH;
            rgbX = outW; rgbY = 0; rgbW = outW; rgbH = outH;
          } else if (alphaLayout === 'top-bottom-rgb') {
            outW = vw;
            outH = Math.floor(vh / 2);
            rgbX = 0; rgbY = 0; rgbW = outW; rgbH = outH;
            alphaX = 0; alphaY = outH; alphaW = outW; alphaH = outH;
          } else if (alphaLayout === 'top-bottom-alpha') {
            outW = vw;
            outH = Math.floor(vh / 2);
            alphaX = 0; alphaY = 0; alphaW = outW; alphaH = outH;
            rgbX = 0; rgbY = outH; rgbW = outW; rgbH = outH;
          }

          if (displayCanvas.width !== outW || displayCanvas.height !== outH) {
            displayCanvas.width = outW;
            displayCanvas.height = outH;
          }

          const dispCtx = displayCanvas.getContext('2d', { willReadFrequently: true });
          if (dispCtx) {
            if (alphaLayout === 'none') {
              dispCtx.clearRect(0, 0, outW, outH);
              dispCtx.drawImage(video, 0, 0, outW, outH);
            } else {
              // High performance Alpha composition
              if (workCanvas.width !== outW || workCanvas.height !== outH) {
                workCanvas.width = outW;
                workCanvas.height = outH;
              }

              if (workCtx) {
                // Read frame pixel data or composite via luminance
                // 1. Draw RGB part
                dispCtx.clearRect(0, 0, outW, outH);
                dispCtx.drawImage(video, rgbX, rgbY, rgbW, rgbH, 0, 0, outW, outH);

                // 2. Draw Alpha part into workCanvas
                workCtx.clearRect(0, 0, outW, outH);
                workCtx.drawImage(video, alphaX, alphaY, alphaW, alphaH, 0, 0, outW, outH);

                // 3. Extract alpha channel and apply to main canvas
                const rgbImageData = dispCtx.getImageData(0, 0, outW, outH);
                const alphaImageData = workCtx.getImageData(0, 0, outW, outH);

                const rgbData = rgbImageData.data;
                const alphaData = alphaImageData.data;
                const len = rgbData.length;

                // High speed loop: luminance of alpha mask defines the alpha
                for (let i = 0; i < len; i += 4) {
                  // Standard luminance: 0.299 R + 0.587 G + 0.114 B
                  const a = (alphaData[i] * 77 + alphaData[i + 1] * 150 + alphaData[i + 2] * 29) >> 8;
                  rgbData[i + 3] = a;
                }

                dispCtx.putImageData(rgbImageData, 0, 0);
              }
            }
          }

          // Optional channel inspect canvas (shows original split frame)
          if (showChannelInspect && inspectCanvasRef.current) {
            const insp = inspectCanvasRef.current;
            if (insp.width !== vw || insp.height !== vh) {
              insp.width = vw;
              insp.height = vh;
            }
            const inspCtx = insp.getContext('2d');
            if (inspCtx) {
              inspCtx.drawImage(video, 0, 0, vw, vh);
            }
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      isActive = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [alphaLayout, showChannelInspect, customVapInfo]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      const p = videoRef.current.play();
      if (p !== undefined) {
        p.then(() => setIsPlaying(true)).catch((err) => {
          console.warn('Play error:', err);
        });
      }
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleStepFrame = (frames: number) => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);
    const stepTime = (1 / 30) * frames;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + stepTime));
  };

  // Export current frame snapshot as transparent PNG
  const handleCaptureSnapshot = () => {
    if (!displayCanvasRef.current) return;
    const link = document.createElement('a');
    link.download = `${videoFile?.name.replace(/\.[^/.]+$/, '') || 'vab_frame'}_snapshot.png`;
    link.href = displayCanvasRef.current.toDataURL('image/png');
    link.click();
  };

  // Export entire animation sequence as transparent PNG ZIP
  const handleExportPNGSequence = async () => {
    if (!videoRef.current || !videoDimensions.width) return;
    const video = videoRef.current;
    
    setIsExporting(true);
    setExportProgress(0);
    setExportStatus('بدء استخراج الإطارات الشفافة...');

    const wasPlaying = !video.paused;
    video.pause();
    setIsPlaying(false);

    try {
      const zip = new JSZip();
      const fps = 30;
      const totalSteps = Math.floor(video.duration * fps) || 30;
      const stepDuration = video.duration / totalSteps;

      const outW = outputDimensions.width;
      const outH = outputDimensions.height;
      const vw = videoDimensions.width;
      const vh = videoDimensions.height;

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = outW;
      exportCanvas.height = outH;
      const expCtx = exportCanvas.getContext('2d');

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = outW;
      maskCanvas.height = outH;
      const maskCtx = maskCanvas.getContext('2d');

      let rgbX = 0, rgbY = 0, rgbW = outW, rgbH = outH;
      let alphaX = 0, alphaY = 0, alphaW = outW, alphaH = outH;

      if (alphaLayout === 'sbs-left-rgb') {
        alphaX = outW;
      } else if (alphaLayout === 'sbs-left-alpha') {
        rgbX = outW;
      } else if (alphaLayout === 'top-bottom-rgb') {
        alphaY = outH;
      } else if (alphaLayout === 'top-bottom-alpha') {
        rgbY = outH;
      }

      for (let i = 0; i < totalSteps; i++) {
        const targetTime = i * stepDuration;
        video.currentTime = targetTime;

        // Wait for video seek to complete
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            resolve();
          };
          video.addEventListener('seeked', onSeeked);
        });

        if (expCtx && maskCtx) {
          expCtx.clearRect(0, 0, outW, outH);
          maskCtx.clearRect(0, 0, outW, outH);

          expCtx.drawImage(video, rgbX, rgbY, rgbW, rgbH, 0, 0, outW, outH);
          maskCtx.drawImage(video, alphaX, alphaY, alphaW, alphaH, 0, 0, outW, outH);

          const rgbImageData = expCtx.getImageData(0, 0, outW, outH);
          const alphaImageData = maskCtx.getImageData(0, 0, outW, outH);

          const rgb = rgbImageData.data;
          const alpha = alphaImageData.data;
          const len = rgb.length;

          for (let p = 0; p < len; p += 4) {
            rgb[p + 3] = (alpha[p] * 77 + alpha[p + 1] * 150 + alpha[p + 2] * 29) >> 8;
          }

          expCtx.putImageData(rgbImageData, 0, 0);

          const dataUrl = exportCanvas.toDataURL('image/png');
          const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
          zip.file(`frame_${i.toString().padStart(4, '0')}.png`, base64Data, { base64: true });
        }

        setExportProgress(Math.round(((i + 1) / totalSteps) * 100));
        setExportStatus(`تم استخراج ${i + 1} من ${totalSteps} إطار...`);
      }

      setExportStatus('جاري ضغط ملف الـ ZIP وتجهيز التحميل...');
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${videoFile?.name.replace(/\.[^/.]+$/, '') || 'vab'}_sequence.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('حدث خطأ أثناء التصدير: ' + (err.message || ''));
    } finally {
      setIsExporting(false);
      if (wasPlaying) {
        video.play();
        setIsPlaying(true);
      }
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}.${ms}`;
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
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
        backgroundColor: '#0f172a'
      };
    }
    if (bgColor === 'dark') return { backgroundColor: '#090d16' };
    if (bgColor === 'black') return { backgroundColor: '#000000' };
    if (bgColor === 'white') return { backgroundColor: '#ffffff' };
    if (bgColor === 'chroma') return { backgroundColor: '#00ff00' };
    return { backgroundColor: customBgHex };
  };

  return (
    <div className="w-full flex flex-col gap-6" dir="rtl">
      {/* Active off-screen video element (never display:none so decoding stays active) */}
      {videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          autoPlay
          loop={isLoop}
          muted={isMuted}
          style={{ position: 'fixed', top: -99999, left: -99999, width: 2, height: 2, opacity: 0, pointerEvents: 'none' }}
          onLoadedMetadata={handleLoadedMetadata}
          onLoadedData={() => {
            if (videoRef.current) {
              videoRef.current.playbackRate = playbackRate;
              const p = videoRef.current.play();
              if (p !== undefined) {
                p.then(() => setIsPlaying(true)).catch((err) => {
                  console.log('Autoplay deferred:', err);
                  setIsPlaying(false);
                });
              }
            }
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onError={(e) => {
            console.error('Video decoding error:', e);
            setVideoError('تعذر تشغيل هذا الملف كفيديو MP4. يرجى التأكد من أن الملف سليم بصيغة MP4/H.264.');
          }}
        />
      )}

      {/* Video Decode Error Banner */}
      {videoError && (
        <div className="flex items-center justify-between p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs font-bold">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-rose-400 shrink-0" />
            <span>{videoError}</span>
          </div>
          <button 
            onClick={() => { setVideoError(null); setVideoUrl(''); setVideoFile(null); }}
            className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-lg text-xs font-bold"
          >
            إلغاء واختيار ملف آخر
          </button>
        </div>
      )}

      {/* Top Header & Fast Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600/10 text-indigo-400 p-2.5 rounded-2xl border border-indigo-500/20">
            <Film size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">عارض Vab & MP4 Alpha</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                مشغل WebGL & Alpha
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              عرض وتشغيل فيديوهات VAP و MP4 ذات قنوات الشفافية مع تفريغ لحظي فائق السرعة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
          <button
            onClick={handleLoadDemoSample}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-700"
            title="تجربة أنيميشن VAP فوري"
          >
            <Sparkles size={15} className="text-indigo-400" />
            أنيميشن تجريبي
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-black transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] active:scale-95"
          >
            <Upload size={15} />
            رفع ملف VAP / MP4
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,.vap,.mp4"
            className="hidden"
            onChange={handleFileChange}
          />

          {onSwitchToCreator && (
            <button
              onClick={onSwitchToCreator}
              className="flex items-center gap-2 px-3.5 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-xl text-xs font-bold transition-all border border-blue-500/30"
              title="الانتقال إلى صانع MP4 Alpha"
            >
              <Layers size={15} />
              صانع MP4 Alpha
            </button>
          )}
        </div>
      </div>

      {/* Main Player Display or Dropzone */}
      {!videoUrl ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="w-full min-h-[420px] rounded-3xl border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-900/30 hover:bg-slate-900/50 transition-all cursor-pointer flex flex-col items-center justify-center p-8 text-center group"
        >
          <div className="w-20 h-20 bg-indigo-500/10 border border-indigo-500/20 group-hover:scale-110 rounded-3xl flex items-center justify-center text-indigo-400 transition-all mb-4">
            <Upload size={36} />
          </div>
          <h3 className="text-lg font-black text-white mb-2">اسحب وأفلت ملف VAP أو MP4 هنا</h3>
          <p className="text-xs text-slate-400 max-w-md leading-relaxed mb-6">
            يدعم فيديوهات MP4 المقسمة بقنوات الشفافية (Side-by-Side أو Top-Bottom) الخاصة بـ Tencent VAP وتطبيقات البث المباشر
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/20"
            >
              اختيار ملف من الجهاز
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleLoadDemoSample();
              }}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-2"
            >
              <Sparkles size={14} className="text-indigo-400" />
              تشغيل نموذج تجريبي
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Top Bar with Dimension Badge, Sizing Mode & Zoom */}
          <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-900/60 p-3 sm:px-5 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-indigo-300 font-black px-2.5 py-1 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                {outputDimensions.width} × {outputDimensions.height} px
              </span>
              <span className="text-[11px] text-slate-400 hidden sm:inline font-mono">
                (الأصل: {videoDimensions.width} × {videoDimensions.height})
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Sizing Mode: Full Natural Size vs Fit */}
              <div className="flex items-center bg-slate-950 border border-slate-800/80 rounded-xl p-0.5">
                <button
                  onClick={() => { setViewSizing('actual'); setFrameScale(100); }}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${viewSizing === 'actual' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                  title="عرض بالحجم الطبيعي الكامل 100%"
                >
                  الحجم الكامل 1:1
                </button>
                <button
                  onClick={() => setViewSizing('fit')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${viewSizing === 'fit' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                  title="ملاءمة تلقائية داخل الشاشة"
                >
                  ملاءمة الشاشة
                </button>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800/80 rounded-xl p-0.5">
                <button
                  onClick={() => setFrameScale(prev => Math.max(25, prev - 25))}
                  className="p-1.5 hover:bg-slate-800 text-slate-300 rounded-lg transition-all"
                  title="تصغير (-25%)"
                >
                  <ZoomOut size={14} />
                </button>
                <span className="text-xs font-mono text-white px-1.5 min-w-[42px] text-center">{frameScale}%</span>
                <button
                  onClick={() => setFrameScale(prev => Math.min(300, prev + 25))}
                  className="p-1.5 hover:bg-slate-800 text-slate-300 rounded-lg transition-all"
                  title="تكبير (+25%)"
                >
                  <ZoomIn size={14} />
                </button>
                {frameScale !== 100 && (
                  <button
                    onClick={() => setFrameScale(100)}
                    className="px-2 py-0.5 text-[10px] text-indigo-400 hover:text-indigo-300 font-bold border-r border-slate-800 pr-2"
                  >
                    100%
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Viewport Canvas Container: Perfectly Centered, Unobstructed, Displays Full Size */}
          <div 
            className="relative w-full min-h-[480px] max-h-[78vh] rounded-3xl border border-slate-800/80 overflow-auto flex items-center justify-center p-6 sm:p-10 transition-all duration-300 shadow-2xl"
            style={getBackgroundStyle()}
          >
            <div className="m-auto flex items-center justify-center">
              <canvas
                ref={displayCanvasRef}
                className="drop-shadow-2xl rounded-xl transition-all duration-150"
                style={{
                  width: viewSizing === 'actual' && outputDimensions.width > 0 
                    ? `${Math.round(outputDimensions.width * (frameScale / 100))}px` 
                    : undefined,
                  height: viewSizing === 'actual' && outputDimensions.height > 0 
                    ? `${Math.round(outputDimensions.height * (frameScale / 100))}px` 
                    : undefined,
                  maxWidth: viewSizing === 'fit' ? '100%' : 'none',
                  maxHeight: viewSizing === 'fit' ? '70vh' : 'none',
                  objectFit: 'contain',
                  display: 'block',
                  margin: 'auto'
                }}
              />
            </div>
          </div>

          {/* Dedicated Playback & Timeline Controls Bar (Below Viewport - Zero Obstruction) */}
          <div className="w-full bg-slate-900/80 backdrop-blur-xl p-4 sm:p-5 rounded-3xl border border-slate-800 shadow-xl flex flex-col gap-3">
            {/* Scrubber Range */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-300 w-16 text-left font-bold">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min="0"
                max={duration || 1}
                step="0.01"
                value={currentTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
              />
              <span className="text-xs font-mono text-slate-400 w-16 text-right">
                {formatTime(duration)}
              </span>
            </div>

            {/* Main Playback Controls Bar */}
            <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-slate-800/60">
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlay}
                  className="p-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center"
                  title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} className="translate-x-0.5" />}
                </button>

                <button
                  onClick={() => handleSeek(0)}
                  className="p-2.5 hover:bg-slate-800 text-slate-300 rounded-xl transition-all border border-transparent hover:border-slate-700"
                  title="إعادة التشغيل من البداية"
                >
                  <RotateCcw size={16} />
                </button>

                <button
                  onClick={() => handleStepFrame(-1)}
                  className="px-2.5 py-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-mono border border-slate-800 hover:border-slate-700"
                  title="إطار سابق"
                >
                  -1F
                </button>
                <button
                  onClick={() => handleStepFrame(1)}
                  className="px-2.5 py-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-mono border border-slate-800 hover:border-slate-700"
                  title="إطار تالٍ"
                >
                  +1F
                </button>

                <div className="w-px h-6 bg-slate-800 mx-1 hidden sm:block"></div>

                <button
                  onClick={() => setIsLoop(!isLoop)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${isLoop ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}
                  title="تكرار الفيديو"
                >
                  تكرار {isLoop ? '✓' : ''}
                </button>

                {/* Playback speed */}
                <select
                  value={playbackRate}
                  onChange={(e) => {
                    const rate = parseFloat(e.target.value);
                    setPlaybackRate(rate);
                    if (videoRef.current) videoRef.current.playbackRate = rate;
                  }}
                  className="bg-slate-950 border border-slate-800 text-slate-300 text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none cursor-pointer hover:border-slate-700"
                >
                  <option value="0.25">0.25x</option>
                  <option value="0.5">0.5x</option>
                  <option value="1">1.0x عادي</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2.0x</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCaptureSnapshot}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-700/80 shadow-sm active:scale-95"
                  title="حفظ الإطار الحالي كصورة PNG شفافة"
                >
                  <Camera size={14} className="text-indigo-400" />
                  <span className="hidden sm:inline">لقطة شفافة</span>
                </button>

                <button
                  onClick={handleExportPNGSequence}
                  disabled={isExporting}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-xl text-xs font-bold transition-all border border-indigo-500/40 disabled:opacity-50 active:scale-95"
                  title="تصدير جميع الإطارات كصور PNG شفافة مضغوطة"
                >
                  <FileArchive size={14} />
                  <span>تصدير PNG</span>
                </button>

                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2 rounded-xl transition-all border ${showSettings ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'}`}
                  title="خيارات توزيع القنوات والخلفية"
                >
                  <Settings2 size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Settings & Alpha Mode Selector Drawer */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 overflow-hidden flex flex-col gap-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Channel Layout Selector */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                      <Layers size={16} />
                      <span>توزيع قنوات الشفافية (Alpha Mask Layout):</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        onClick={() => { setCustomVapInfo(null); setAlphaLayout('vap-compact-right-top'); }}
                        className={`p-3 rounded-2xl border text-right transition-all flex items-center justify-between sm:col-span-2 ${alphaLayout === 'vap-compact-right-top' ? 'bg-cyan-500/20 border-cyan-500 text-white shadow-md shadow-cyan-500/10' : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:bg-slate-800'}`}
                      >
                        <span className="text-xs font-black text-cyan-300">تنسيق Tencent VAP الرسمي</span>
                      </button>

                      <button
                        onClick={() => { setCustomVapInfo(null); setAlphaLayout('sbs-left-rgb'); }}
                        className={`p-3 rounded-2xl border text-right transition-all flex flex-col gap-1 ${alphaLayout === 'sbs-left-rgb' ? 'bg-indigo-500/20 border-indigo-500 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:bg-slate-800'}`}
                      >
                        <span className="text-xs font-black text-indigo-300">جنباً إلى جنب 50/50</span>
                        <span className="text-[10px] text-slate-400">RGB يسار | Alpha يمين</span>
                      </button>

                      <button
                        onClick={() => { setCustomVapInfo(null); setAlphaLayout('sbs-left-alpha'); }}
                        className={`p-3 rounded-2xl border text-right transition-all flex flex-col gap-1 ${alphaLayout === 'sbs-left-alpha' ? 'bg-indigo-500/20 border-indigo-500 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:bg-slate-800'}`}
                      >
                        <span className="text-xs font-black text-indigo-300">جنباً إلى جنب (معكوس)</span>
                        <span className="text-[10px] text-slate-400">Alpha يسار | RGB يمين</span>
                      </button>

                      <button
                        onClick={() => { setCustomVapInfo(null); setAlphaLayout('top-bottom-rgb'); }}
                        className={`p-3 rounded-2xl border text-right transition-all flex flex-col gap-1 ${alphaLayout === 'top-bottom-rgb' ? 'bg-indigo-500/20 border-indigo-500 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:bg-slate-800'}`}
                      >
                        <span className="text-xs font-black text-indigo-300">فوق وتحت (رأسي)</span>
                        <span className="text-[10px] text-slate-400">RGB أعلى | Alpha أسفل</span>
                      </button>

                      <button
                        onClick={() => { setCustomVapInfo(null); setAlphaLayout('none'); }}
                        className={`p-3 rounded-2xl border text-right transition-all flex flex-col gap-1 ${alphaLayout === 'none' ? 'bg-indigo-500/20 border-indigo-500 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:bg-slate-800'}`}
                      >
                        <span className="text-xs font-black text-indigo-300">بدون تقسيم (فيديو عادي)</span>
                        <span className="text-[10px] text-slate-400">عرض الفيديو كما هو بدون معالجة</span>
                      </button>
                    </div>
                  </div>

                  {/* Background Presets */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                      <Sliders size={16} />
                      <span>لون خلفية المعاينة:</span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setBgColor('checker')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${bgColor === 'checker' ? 'bg-indigo-500/20 border-indigo-500 text-white' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white'}`}
                      >
                        مربعات الشفافية 🏁
                      </button>
                      <button
                        onClick={() => setBgColor('dark')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${bgColor === 'dark' ? 'bg-indigo-500/20 border-indigo-500 text-white' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white'}`}
                      >
                        داكن كحلي
                      </button>
                      <button
                        onClick={() => setBgColor('black')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${bgColor === 'black' ? 'bg-indigo-500/20 border-indigo-500 text-white' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white'}`}
                      >
                        أسود كامل
                      </button>
                      <button
                        onClick={() => setBgColor('white')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${bgColor === 'white' ? 'bg-indigo-500/20 border-indigo-500 text-white' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white'}`}
                      >
                        أبيض ناصع
                      </button>
                      <button
                        onClick={() => setBgColor('chroma')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${bgColor === 'chroma' ? 'bg-indigo-500/20 border-indigo-500 text-white' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white'}`}
                      >
                        كروما خضراء 🟩
                      </button>
                    </div>

                    <div className="mt-2 flex items-center justify-between p-3 bg-slate-950/40 rounded-2xl border border-slate-800">
                      <span className="text-xs text-slate-400">معاينة الإطار الخام المنقسم (Raw Inspect):</span>
                      <button
                        onClick={() => setShowChannelInspect(!showChannelInspect)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${showChannelInspect ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                      >
                        {showChannelInspect ? <Eye size={14} /> : <EyeOff size={14} />}
                        {showChannelInspect ? 'إخفاء الإطار الخام' : 'إظهار الإطار الخام'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Optional Raw Split Inspect Canvas */}
                {showChannelInspect && (
                  <div className="flex flex-col gap-2 p-4 bg-slate-950 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">الإطار الخام المباشر من الفيديو (RGB + Alpha Matte):</span>
                      <span className="text-[10px] text-slate-500 font-mono">{videoDimensions.width} × {videoDimensions.height} px</span>
                    </div>
                    <div className="w-full overflow-auto flex items-center justify-center p-2 bg-slate-900/50 rounded-xl">
                      <canvas ref={inspectCanvasRef} className="max-h-48 object-contain rounded-lg border border-slate-800" />
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Exporting Progress Modal */}
          {isExporting && (
            <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 text-center">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-sm w-full flex flex-col items-center gap-4 shadow-2xl">
                <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin flex items-center justify-center">
                  <FileArchive size={24} className="text-indigo-400" />
                </div>
                <h4 className="text-lg font-black text-white">تصدير إطارات PNG شفافة</h4>
                <p className="text-xs text-slate-400">{exportStatus}</p>

                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-blue-500 h-full transition-all duration-200"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
                <span className="text-sm font-mono font-black text-indigo-400">{exportProgress}%</span>
              </div>
            </div>
          )}

          {/* Info Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">اسم الملف</span>
              <span className="text-xs font-bold text-white truncate block" title={videoFile?.name}>
                {videoFile?.name || 'فيديو VAP'}
              </span>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">الدقة الشفافة</span>
              <span className="text-xs font-bold text-indigo-400 font-mono block">
                {outputDimensions.width} × {outputDimensions.height} px
              </span>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">المدة الإجمالية</span>
              <span className="text-xs font-bold text-white font-mono block">
                {formatTime(duration)}
              </span>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">الحجم على القرص</span>
              <span className="text-xs font-bold text-white font-mono block">
                {videoFile ? `${(videoFile.size / (1024 * 1024)).toFixed(2)} MB` : '--'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
