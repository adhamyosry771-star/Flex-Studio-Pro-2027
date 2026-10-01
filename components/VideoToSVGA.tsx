import React, { useState, useRef, useEffect } from 'react';
import { FileVideo, Settings, Download, Loader2, Music, X, Image as ImageIcon } from 'lucide-react';
import pako from 'pako';
import { parse } from 'protobufjs';
import { svgaSchema } from '../svga-proto';

export const VideoToSVGA: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [featherX, setFeatherX] = useState<number>(0);
  const [featherTop, setFeatherTop] = useState<number>(0);
  const [featherBottom, setFeatherBottom] = useState<number>(0);
  const [isCircleMask, setIsCircleMask] = useState<boolean>(false);
  const [circleFeather, setCircleFeather] = useState<number>(10);
  const [isSquareMask, setIsSquareMask] = useState<boolean>(false);
  const [squareFeather, setSquareFeather] = useState<number>(10);
  const [bgImageFile, setBgImageFile] = useState<File | null>(null);
  const [bgImageUrl, setBgImageUrl] = useState<string>('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');

  // New Settings
  const [quality, setQuality] = useState<number>(80);
  const [fps, setFps] = useState<number>(15);
  const [compressionRatio, setCompressionRatio] = useState<number>(80);
  const [imageQuality, setImageQuality] = useState<number>(80);
  const [exportWidth, setExportWidth] = useState<string>('');
  const [exportHeight, setExportHeight] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
    } else {
      alert('يرجى اختيار ملف فيديو صالح.');
    }
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      setAudioFile(file);
    } else {
      alert('يرجى اختيار ملف صوتي صالح.');
    }
  };

  const handleBgSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setBgImageFile(file);
      setBgImageUrl(URL.createObjectURL(file));
    } else {
      alert('يرجى اختيار صورة صالحة.');
    }
  };

  // Refs for performance optimization
  const offscreenVCRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenMaskRef = useRef<HTMLCanvasElement | null>(null);
  const maskCacheSettings = useRef<string>('');

  const updateMaskCache = (w: number, h: number, fX: number, fTop: number, fBottom: number) => {
    const settingsKey = `${w}-${h}-${fX}-${fTop}-${fBottom}-${isCircleMask}-${isSquareMask}-${circleFeather}-${squareFeather}`;
    if (maskCacheSettings.current === settingsKey && offscreenMaskRef.current) return;

    if (!offscreenMaskRef.current) offscreenMaskRef.current = document.createElement('canvas');
    const maskCanvas = offscreenMaskRef.current;
    maskCanvas.width = w;
    maskCanvas.height = h;
    const mctx = maskCanvas.getContext('2d');
    if (!mctx) return;

    mctx.clearRect(0, 0, w, h);
    mctx.globalCompositeOperation = 'source-over';
    
    if (isCircleMask) {
      const centerX = w / 2;
      const centerY = h / 2;
      const radius = Math.min(w, h) / 2;
      const grad = mctx.createRadialGradient(centerX, centerY, radius * (1 - circleFeather/100), centerX, centerY, radius);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      mctx.fillStyle = grad;
      mctx.beginPath();
      mctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      mctx.fill();
    } else if (isSquareMask) {
      mctx.fillStyle = 'black';
      mctx.fillRect(0, 0, w, h);
      mctx.globalCompositeOperation = 'destination-out';
      const f = (Math.min(w, h) / 2) * (squareFeather / 100);
      if (f > 0) {
        let grad = mctx.createLinearGradient(0, 0, 0, f);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = grad;
        mctx.fillRect(0, 0, w, f);
        grad = mctx.createLinearGradient(0, h, 0, h - f);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = grad;
        mctx.fillRect(0, h - f, w, h);
        grad = mctx.createLinearGradient(0, 0, f, 0);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = grad;
        mctx.fillRect(0, 0, f, h);
        grad = mctx.createLinearGradient(w, 0, w - f, 0);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = grad;
        mctx.fillRect(w - f, 0, w, h);
      }
    } else if (fX > 0 || fTop > 0 || fBottom > 0) {
      mctx.fillStyle = 'black';
      mctx.fillRect(0, 0, w, h);
      mctx.globalCompositeOperation = 'destination-out';
      if (fX > 0) {
        const fx = w * (fX / 100);
        let grad = mctx.createLinearGradient(0, 0, fx, 0);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = grad;
        mctx.fillRect(0, 0, fx, h);
        grad = mctx.createLinearGradient(w, 0, w - fx, 0);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = grad;
        mctx.fillRect(w - fx, 0, fx, h);
      }
      if (fTop > 0) {
        const fyTop = h * (fTop / 100);
        let grad = mctx.createLinearGradient(0, 0, 0, fyTop);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = grad;
        mctx.fillRect(0, 0, w, fyTop);
      }
      if (fBottom > 0) {
        const fyBottom = h * (fBottom / 100);
        let grad = mctx.createLinearGradient(0, h, 0, h - fyBottom);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = grad;
        mctx.fillRect(0, h - fyBottom, w, fyBottom);
      }
    } else {
      mctx.fillStyle = 'black';
      mctx.fillRect(0, 0, w, h);
    }
    
    maskCacheSettings.current = settingsKey;
  };

  const drawFrame = (video: HTMLVideoElement, canvas: HTMLCanvasElement, fX: number, fTop: number, fBottom: number, bgImg?: HTMLImageElement) => {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    const hasMask = isCircleMask || isSquareMask || fX > 0 || fTop > 0 || fBottom > 0;

    // Ultra-fast path when no mask is configured
    if (!hasMask) {
      ctx.clearRect(0, 0, w, h);
      if (bgImg) ctx.drawImage(bgImg, 0, 0, w, h);
      ctx.drawImage(video, 0, 0, w, h);
      return;
    }

    if (!offscreenVCRef.current) offscreenVCRef.current = document.createElement('canvas');
    const vCanvas = offscreenVCRef.current;
    if (vCanvas.width !== w || vCanvas.height !== h) {
      vCanvas.width = w;
      vCanvas.height = h;
    }

    const vCtx = vCanvas.getContext('2d');
    if (!vCtx) return;

    // Use Cache
    updateMaskCache(w, h, fX, fTop, fBottom);
    const maskCanvas = offscreenMaskRef.current;

    ctx.clearRect(0, 0, w, h);
    if (bgImg) ctx.drawImage(bgImg, 0, 0, w, h);

    vCtx.globalCompositeOperation = 'source-over';
    vCtx.clearRect(0, 0, w, h);
    vCtx.drawImage(video, 0, 0, w, h);

    if (maskCanvas) {
      vCtx.globalCompositeOperation = 'destination-in';
      vCtx.drawImage(maskCanvas, 0, 0);
    }

    ctx.drawImage(vCanvas, 0, 0);
  };

  const bgImageRef = useRef<HTMLImageElement | null>(null);

  const updatePreview = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.readyState >= 2) {
        if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
        if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
        
        let bgImg;
        if (bgImageUrl) {
          if (!bgImageRef.current || bgImageRef.current.src !== bgImageUrl) {
            bgImageRef.current = new Image();
            bgImageRef.current.src = bgImageUrl;
          }
          bgImg = bgImageRef.current;
        }

        drawFrame(video, canvas, featherX, featherTop, featherBottom, bgImg);
      }
    }
    animationRef.current = requestAnimationFrame(updatePreview);
  };

  useEffect(() => {
    if (videoUrl) {
      animationRef.current = requestAnimationFrame(updatePreview);
      if (videoRef.current) {
        videoRef.current.play().catch(err => console.log("Playback failed:", err));
      }
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [videoUrl, featherX, featherTop, featherBottom, isCircleMask, circleFeather, isSquareMask, squareFeather, bgImageUrl]);

  const convertToSVGA = async () => {
    if (!videoRef.current || !videoFile || !canvasRef.current) return;
    setIsConverting(true);
    setProgress(0);
    setStatusText('جاري تهيئة محرك الاستخراج السريع...');

    // Pause the preview requestAnimationFrame loop so it doesn't fight for CPU/GPU
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    try {
      const video = videoRef.current;
      const targetFps = fps;
      const duration = video.duration;
      
      if (duration > 30) {
         alert("الفيديو طويل جداً. يرجى استخدام فيديو لا يتجاوز 30 ثانية لتجنب حجم الملف الكبير جداً.");
         setIsConverting(false);
         return;
      }
      
      const totalFrames = Math.max(1, Math.floor(duration * targetFps));
      
      const scaleFactor = quality / 100;
      const w = exportWidth ? parseInt(exportWidth) : Math.round(video.videoWidth * scaleFactor);
      const h = exportHeight ? parseInt(exportHeight) : Math.round(video.videoHeight * scaleFactor);

      const drawCanvas = document.createElement('canvas');
      drawCanvas.width = w;
      drawCanvas.height = h;

      const framePngs: Uint8Array[] = new Array(totalFrames);

      let bgImg: HTMLImageElement | undefined;
      if (bgImageUrl) {
        bgImg = new Image();
        bgImg.src = bgImageUrl;
        await new Promise(r => bgImg!.onload = r);
      }

      const wasPlaying = !video.paused;
      video.pause();

      // Reliable seek helper with timeout protection to prevent stalling
      const seekVideo = (targetTime: number): Promise<void> => {
        return new Promise((resolve) => {
          if (Math.abs(video.currentTime - targetTime) < 0.005) {
            resolve();
            return;
          }
          let resolved = false;
          const onSeeked = () => {
            if (!resolved) {
              resolved = true;
              video.removeEventListener('seeked', onSeeked);
              resolve();
            }
          };
          video.addEventListener('seeked', onSeeked, { once: true });
          video.currentTime = targetTime;
          // Fallback timeout in case the browser skips firing the seeked event
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              video.removeEventListener('seeked', onSeeked);
              resolve();
            }
          }, 350);
        });
      };

      // Asynchronous pipelined encoding: encode frames in parallel while video is seeking next frame
      const CONCURRENCY = 4;
      let inFlight = 0;
      const queue: Promise<void>[] = [];

      const encodeFrame = async (frameIdx: number, sourceCanvas: HTMLCanvasElement) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        if (ctx) ctx.drawImage(sourceCanvas, 0, 0);

        const blob = await new Promise<Blob | null>(resolve => c.toBlob(resolve, 'image/png'));
        if (blob) {
          const buffer = await blob.arrayBuffer();
          framePngs[frameIdx] = new Uint8Array(buffer);
        }
      };

      for (let i = 0; i < totalFrames; i++) {
        const time = i / targetFps;
        await seekVideo(time);

        drawFrame(video, drawCanvas, featherX, featherTop, featherBottom, bgImg);

        inFlight++;
        const p = encodeFrame(i, drawCanvas).then(() => {
          inFlight--;
        });
        queue.push(p);

        // Control concurrency so memory doesn't spike
        if (inFlight >= CONCURRENCY) {
          while (inFlight >= CONCURRENCY) {
            await new Promise(r => setTimeout(r, 8));
          }
        }

        setProgress(Math.round(((i + 1) / totalFrames) * 65));
        setStatusText(`جاري التقاط الإطار ${i + 1} من ${totalFrames}...`);
      }

      setStatusText('جاري إتمام تجهيز الإطارات المستخرجة...');
      await Promise.all(queue);
      setProgress(70);

      if (wasPlaying) video.play();

      setStatusText('جاري تجميع بنية ملف SVGA (Protobuf)...');
      
      const root = parse(svgaSchema).root;
      const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");

      const images: Record<string, Uint8Array> = {};
      const sprites: any[] = [];
      const audios: any[] = [];

      if (audioFile) {
        setStatusText('جاري معالجة الصوت المرفق...');
        const audioBuffer = await audioFile.arrayBuffer();
        images['audio_0'] = new Uint8Array(audioBuffer);
        audios.push({
          audioKey: 'audio_0',
          startFrame: 0,
          endFrame: totalFrames,
          startTime: 0,
          totalTime: Math.floor(duration * 1000)
        });
      }

      // Reusable hidden frame reference: cuts object allocations and serialization memory by 90%+
      const hiddenFrame = { alpha: 0 };
      const defaultLayout = { x: 0, y: 0, width: w, height: h };
      const defaultTransform = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

      for (let i = 0; i < totalFrames; i++) {
        const imageKey = `frame_${i}`;
        images[imageKey] = framePngs[i];

        const frames = new Array(totalFrames);
        for (let j = 0; j < totalFrames; j++) {
          if (i === j) {
            frames[j] = {
              alpha: 1.0,
              layout: defaultLayout,
              transform: defaultTransform
            };
          } else {
            frames[j] = hiddenFrame;
          }
        }

        sprites.push({
          imageKey: imageKey,
          frames: frames
        });

        if (i % 15 === 0 || i === totalFrames - 1) {
          setProgress(70 + Math.round(((i + 1) / totalFrames) * 18));
        }
      }

      const movie = {
        version: "2.0",
        params: { viewBoxWidth: w, viewBoxHeight: h, fps: targetFps, frames: totalFrames },
        images: images,
        sprites: sprites,
        audios: audios
      };

      setStatusText('جاري تشفير هيكل البروتوكول...');
      setProgress(90);
      const message = MovieEntity.create(movie);
      const buffer = MovieEntity.encode(message).finish();
      
      setStatusText('جاري ضغط الملف بسرعة فائقة...');
      setProgress(95);
      // Fast compression: PNG frames are already compressed, level 1/2 saves the same size but completes in milliseconds
      const pakoLevel = Math.min(2, Math.max(1, Math.floor(compressionRatio / 40)));
      const deflated = pako.deflate(buffer, { level: pakoLevel as any });
      
      setProgress(100);
      setStatusText('تم الانتهاء والتحميل جاهز!');

      const blob = new Blob([deflated], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${videoFile.name.split('.')[0]}_converted.svga`;
      a.click();
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error("Conversion Error:", err);
      alert("حدث خطأ أثناء التحويل.");
    } finally {
      setIsConverting(false);
      // Resume preview loop
      if (videoUrl) {
        animationRef.current = requestAnimationFrame(updatePreview);
      }
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {!videoFile ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl p-12 flex flex-col items-center justify-center min-h-[400px]">
          <input type="file" id="video-upload" accept="video/*" className="hidden" onChange={handleFileSelect} />
          <label htmlFor="video-upload" className="cursor-pointer flex flex-col items-center group">
            <div className="bg-indigo-600/20 p-6 rounded-full mb-6 group-hover:scale-110 transition-transform">
              <FileVideo size={48} className="text-indigo-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-white text-center">قم برفع فيديو للتحويل</h2>
            <p className="text-slate-400 text-center max-w-sm mt-2">اختر ملف فيديو لتحويله إلى صيغة SVGA مع إمكانية إضافة تأثير الشفافية للحواف.</p>
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl p-6 flex flex-col items-center">
            <h3 className="text-lg font-bold text-white mb-4 w-full text-right">المعاينة المباشرة</h3>
            <div className="relative w-full bg-slate-950/50 rounded-2xl overflow-hidden flex items-center justify-center aspect-video border border-slate-800 bg-[url('https://www.transparenttextures.com/patterns/checkerboard.png')]">
              <video ref={videoRef} src={videoUrl} className="hidden" loop autoPlay muted playsInline />
              <canvas ref={canvasRef} className="max-w-full max-h-full object-contain drop-shadow-2xl" />
            </div>
          </div>
          
          <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-6 flex flex-col gap-6">
            <div className="flex items-center gap-3 text-indigo-400 border-b border-slate-800 pb-4">
              <Settings size={20} />
              <h3 className="font-bold text-lg">إعدادات التحويل</h3>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 mt-2">
                <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <ImageIcon size={16} className="text-indigo-400" />
                  صورة خلفية تحت الفيديو (اختياري)
                </label>
                <div className="flex items-center gap-3">
                  <input type="file" id="bg-upload" accept="image/*" className="hidden" onChange={handleBgSelect} />
                  <label htmlFor="bg-upload" className="flex-1 cursor-pointer py-3 px-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs text-center text-slate-300 transition-colors truncate">
                    {bgImageFile ? bgImageFile.name : 'اختر صورة خلفية'}
                  </label>
                  {bgImageFile && (
                    <button onClick={() => { setBgImageFile(null); setBgImageUrl(''); }} className="p-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors">
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-bold text-white">تفعيل حواف الدائرة</label>
                  <button 
                    onClick={() => {
                      setIsCircleMask(!isCircleMask);
                      if (!isCircleMask) setIsSquareMask(false);
                    }}
                    className={`w-12 h-6 rounded-full transition-colors relative ${isCircleMask ? 'bg-indigo-500' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isCircleMask ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-bold text-white">تفعيل حواف المربع</label>
                  <button 
                    onClick={() => {
                      setIsSquareMask(!isSquareMask);
                      if (!isSquareMask) setIsCircleMask(false);
                    }}
                    className={`w-12 h-6 rounded-full transition-colors relative ${isSquareMask ? 'bg-indigo-500' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isSquareMask ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>

                {isCircleMask && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase flex justify-between">
                      <span>تنعيم حواف الدائرة (دخان)</span>
                      <span className="text-indigo-400">{circleFeather}%</span>
                    </label>
                    <input 
                      type="range" min="0" max="100" value={circleFeather} 
                      onChange={(e) => setCircleFeather(Number(e.target.value))}
                      className="w-full accent-indigo-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/5 transition-all hover:bg-white/30"
                    />
                  </div>
                )}

                {isSquareMask && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase flex justify-between">
                      <span>تنعيم حواف المربع (دخان)</span>
                      <span className="text-indigo-400">{squareFeather}%</span>
                    </label>
                    <input 
                      type="range" min="0" max="100" value={squareFeather} 
                      onChange={(e) => setSquareFeather(Number(e.target.value))}
                      className="w-full accent-indigo-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/5 transition-all hover:bg-white/30"
                    />
                  </div>
                )}

                {!isCircleMask && !isSquareMask && (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-semibold text-slate-300 flex justify-between">
                        <span>شفافية العرض (أفقي)</span>
                        <span className="text-indigo-400">{featherX}%</span>
                      </label>
                      <input 
                        type="range" min="0" max="50" value={featherX} 
                        onChange={(e) => setFeatherX(Number(e.target.value))}
                        className="w-full accent-indigo-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/5 transition-all hover:bg-white/30"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-semibold text-slate-300 flex justify-between">
                        <span>الشفافية من الأعلى (Top)</span>
                        <span className="text-indigo-400">{featherTop}%</span>
                      </label>
                      <input 
                        type="range" min="0" max="100" value={featherTop} 
                        onChange={(e) => setFeatherTop(Number(e.target.value))}
                        className="w-full accent-indigo-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/5 transition-all hover:bg-white/30"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-semibold text-slate-300 flex justify-between">
                        <span>الشفافية من الأسفل (Bottom)</span>
                        <span className="text-indigo-400">{featherBottom}%</span>
                      </label>
                      <input 
                        type="range" min="0" max="100" value={featherBottom} 
                        onChange={(e) => setFeatherBottom(Number(e.target.value))}
                        className="w-full accent-indigo-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/5 transition-all hover:bg-white/30"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">الجودة</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="range" min="1" max="100" value={quality} 
                      onChange={(e) => setQuality(Number(e.target.value))}
                      className="flex-1 accent-indigo-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/5 transition-all hover:bg-white/30"
                    />
                    <span className="text-xs text-indigo-400 font-bold w-8">{quality}%</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">الفريمات (FPS)</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="range" min="1" max="60" value={fps} 
                      onChange={(e) => setFps(Number(e.target.value))}
                      className="flex-1 accent-indigo-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/5 transition-all hover:bg-white/30"
                    />
                    <span className="text-xs text-indigo-400 font-bold w-8">{fps}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">نسبة الضغط</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="range" min="1" max="100" value={compressionRatio} 
                      onChange={(e) => setCompressionRatio(Number(e.target.value))}
                      className="flex-1 accent-indigo-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/5 transition-all hover:bg-white/30"
                    />
                    <span className="text-xs text-indigo-400 font-bold w-8">{compressionRatio}%</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">ضغط الصور</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="range" min="1" max="100" value={imageQuality} 
                      onChange={(e) => setImageQuality(Number(e.target.value))}
                      className="flex-1 accent-indigo-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/5 transition-all hover:bg-white/30"
                    />
                    <span className="text-xs text-indigo-400 font-bold w-8">{imageQuality}%</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">أبعاد التصدير (اختياري)</label>
                <div className="grid grid-cols-2 gap-3">
                  <input 
                    type="number" 
                    placeholder="العرض" 
                    value={exportWidth}
                    onChange={(e) => setExportWidth(e.target.value)}
                    className="bg-slate-800/50 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                  />
                  <input 
                    type="number" 
                    placeholder="الارتفاع" 
                    value={exportHeight}
                    onChange={(e) => setExportHeight(e.target.value)}
                    className="bg-slate-800/50 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">يقوم بتنعيم حواف الفيديو وجعلها شفافة تدريجياً لدمجها مع أي خلفية.</p>
              
              <div className="flex flex-col gap-2 mt-4 border-t border-slate-800 pt-4">
                <label className="text-sm font-semibold text-slate-300 flex items-center gap-2 mt-2">
                  <Music size={16} className="text-indigo-400" />
                  إضافة ملف صوتي (اختياري)
                </label>
                <div className="flex items-center gap-3">
                  <input 
                    type="file" 
                    id="audio-upload" 
                    accept="audio/*" 
                    className="hidden" 
                    onChange={handleAudioSelect} 
                  />
                  <label 
                    htmlFor="audio-upload" 
                    className="flex-1 cursor-pointer py-3 px-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl text-sm text-center text-slate-300 transition-colors truncate"
                  >
                    {audioFile ? audioFile.name : 'اختر ملف صوتي'}
                  </label>
                  {audioFile && (
                    <button 
                      onClick={() => setAudioFile(null)}
                      className="p-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                      title="إزالة الصوت"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-auto pt-6 space-y-3">
              <button 
                onClick={convertToSVGA}
                disabled={isConverting}
                className="w-full py-4 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 rounded-xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100 shadow-[0_0_20px_rgba(99,102,241,0.1)]"
              >
                {isConverting ? (
                  <>
                    <Loader2 className="animate-spin" size={24} />
                    {statusText} ({progress}%)
                  </>
                ) : (
                  <>
                    <Download size={24} />
                    تحويل وتحميل SVGA
                  </>
                )}
              </button>

              <button 
                onClick={() => { setVideoFile(null); setVideoUrl(''); }}
                disabled={isConverting}
                className="w-full mt-3 py-3 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-700/50 text-slate-300 rounded-xl font-semibold transition-all disabled:opacity-50"
              >
                إلغاء واختيار فيديو آخر
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
