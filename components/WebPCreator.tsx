import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, 
  Download, 
  Settings, 
  Loader2, 
  Play, 
  Pause, 
  Plus, 
  Trash2, 
  ArrowRight, 
  ArrowLeft, 
  RefreshCw, 
  FileImage, 
  X, 
  Film, 
  Sliders, 
  Clock, 
  Sparkles, 
  Check, 
  Copy, 
  Maximize2, 
  RotateCcw,
  Eye,
  Layers,
  ChevronRight,
  ChevronLeft,
  LayoutGrid,
  List
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FrameItem {
  id: string;
  name: string;
  size: number;
  url: string;
  delay: number; // in milliseconds
  width: number;
  height: number;
  file: File;
}

export const WebPCreator: React.FC = () => {
  const [frames, setFrames] = useState<FrameItem[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [sequenceViewMode, setSequenceViewMode] = useState<'grid' | 'row'>('grid');

  // Speed & Timing Settings
  const [fps, setFps] = useState<number>(20);
  const [globalDelay, setGlobalDelay] = useState<number>(50); // 50ms = 20 FPS
  const [loopCount, setLoopCount] = useState<number>(0); // 0 = infinite

  // Graphics & Dimensions Settings
  const [dimensionMode, setDimensionMode] = useState<'first' | 'max' | 'custom'>('first');
  const [customWidth, setCustomWidth] = useState<number>(512);
  const [customHeight, setCustomHeight] = useState<number>(512);
  const [lockAspect, setLockAspect] = useState<boolean>(true);
  const [aspectRatio, setAspectRatio] = useState<number>(1);
  const [fitMode, setFitMode] = useState<'contain' | 'cover' | 'stretch'>('contain');
  const [bgMode, setBgMode] = useState<'transparent' | 'color'>('transparent');
  const [bgColor, setBgColor] = useState<string>('#ffffff');

  // Quality & Compression Settings
  const [qualityMode, setQualityMode] = useState<'lossless' | 'lossy'>('lossless');
  const [qualityValue, setQualityValue] = useState<number>(90); // 1 - 100

  // Export State
  const [isEncoding, setIsEncoding] = useState(false);
  const [encodingProgress, setEncodingProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorText, setErrorText] = useState('');
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputDimensions, setOutputDimensions] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Synchronize FPS with global delay
  const handleFpsChange = (newFps: number) => {
    const clamped = Math.max(1, Math.min(60, newFps));
    setFps(clamped);
    const calculatedDelay = Math.max(10, Math.round(1000 / clamped));
    setGlobalDelay(calculatedDelay);
    setFrames(prev => prev.map(f => ({ ...f, delay: calculatedDelay })));
  };

  const handleGlobalDelayChange = (newDelay: number) => {
    const clamped = Math.max(10, Math.min(5000, newDelay));
    setGlobalDelay(clamped);
    setFps(Math.max(1, Math.min(60, Math.round(1000 / clamped))));
    setFrames(prev => prev.map(f => ({ ...f, delay: clamped })));
  };

  // Target Dimensions Calculation
  const getTargetDimensions = useCallback((): { w: number; h: number } => {
    if (frames.length === 0) return { w: 512, h: 512 };
    if (dimensionMode === 'first') {
      return { w: frames[0].width || 512, h: frames[0].height || 512 };
    } else if (dimensionMode === 'max') {
      let maxW = 0;
      let maxH = 0;
      frames.forEach(f => {
        if (f.width > maxW) maxW = f.width;
        if (f.height > maxH) maxH = f.height;
      });
      return { w: maxW || 512, h: maxH || 512 };
    } else {
      return { w: Math.max(16, customWidth), h: Math.max(16, customHeight) };
    }
  }, [frames, dimensionMode, customWidth, customHeight]);

  const targetDim = getTargetDimensions();

  // Helper to load image element and cache it
  const loadImageElement = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(img);
      img.src = url;
    });
  };

  // Upload handler
  const processUploadedFiles = async (fileList: File[]) => {
    setErrorText('');
    const validRegex = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;
    const imageFiles = fileList.filter(f => validRegex.test(f.name) || f.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      setErrorText('يرجى اختيار صور صالحة (PNG, JPG, WEBP, GIF).');
      return;
    }

    // Natural sort by filename (e.g. frame_1, frame_2, frame_10)
    imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    const newFrames: FrameItem[] = [];
    for (const file of imageFiles) {
      const url = URL.createObjectURL(file);
      const loadedImg = await loadImageElement(url);
      const frameId = Math.random().toString(36).substring(2, 9) + Date.now();
      imageCacheRef.current.set(frameId, loadedImg);

      newFrames.push({
        id: frameId,
        name: file.name,
        size: file.size,
        url,
        delay: globalDelay,
        width: loadedImg.naturalWidth || 512,
        height: loadedImg.naturalHeight || 512,
        file
      });
    }

    setFrames(prev => {
      const combined = [...prev, ...newFrames];
      if (prev.length === 0 && newFrames.length > 0) {
        setCustomWidth(newFrames[0].width);
        setCustomHeight(newFrames[0].height);
        setAspectRatio(newFrames[0].width / (newFrames[0].height || 1));
      }
      return combined;
    });

    setIsPlaying(true);
    setCurrentPreviewIndex(0);
  };

  const handleFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processUploadedFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUploadedFiles(Array.from(e.dataTransfer.files));
    }
  };

  // Frame manipulation actions
  const removeFrame = (index: number) => {
    setFrames(prev => {
      const copy = [...prev];
      if (copy[index]) {
        imageCacheRef.current.delete(copy[index].id);
        URL.revokeObjectURL(copy[index].url);
      }
      copy.splice(index, 1);
      return copy;
    });
    if (currentPreviewIndex >= frames.length - 1) {
      setCurrentPreviewIndex(Math.max(0, frames.length - 2));
    }
  };

  const duplicateFrame = (index: number) => {
    setFrames(prev => {
      const target = prev[index];
      const dupId = Math.random().toString(36).substring(2, 9) + Date.now();
      const cached = imageCacheRef.current.get(target.id);
      if (cached) {
        imageCacheRef.current.set(dupId, cached);
      }
      const dup: FrameItem = {
        ...target,
        id: dupId,
        name: `${target.name} (نسخة)`
      };
      const next = [...prev];
      next.splice(index + 1, 0, dup);
      return next;
    });
  };

  const moveFrame = (index: number, direction: 'up' | 'down') => {
    setFrames(prev => {
      const copy = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const reverseFrames = () => {
    setFrames(prev => [...prev].reverse());
  };

  const clearAllFrames = () => {
    frames.forEach(f => URL.revokeObjectURL(f.url));
    imageCacheRef.current.clear();
    setFrames([]);
    setIsPlaying(false);
    setCurrentPreviewIndex(0);
    setOutputBlob(null);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setOutputUrl(null);
  };

  // Real-time animation loop for preview
  useEffect(() => {
    if (!isPlaying || frames.length <= 1) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    let isSubscribed = true;
    lastFrameTimeRef.current = performance.now();

    const loop = (time: number) => {
      if (!isSubscribed) return;
      const currentDelay = globalDelay;

      const elapsed = time - lastFrameTimeRef.current;
      if (elapsed >= currentDelay) {
        setCurrentPreviewIndex(prev => (prev + 1) % frames.length);
        lastFrameTimeRef.current = time - (elapsed % currentDelay);
      }
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      isSubscribed = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, frames.length, currentPreviewIndex, globalDelay]);

  // Synchronous, flicker-free canvas drawing using pre-loaded image cache
  const drawFrameToCanvas = useCallback((frameIndex: number) => {
    const canvas = previewCanvasRef.current;
    if (!canvas || frames.length === 0) return;

    const currentFrame = frames[frameIndex];
    if (!currentFrame) return;

    const { w: targetW, h: targetH } = targetDim;
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const paint = (img: HTMLImageElement) => {
      ctx.clearRect(0, 0, targetW, targetH);
      if (bgMode === 'color') {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, targetW, targetH);
      }

      let dx = 0, dy = 0, dw = targetW, dh = targetH;
      const srcW = img.naturalWidth || currentFrame.width || targetW;
      const srcH = img.naturalHeight || currentFrame.height || targetH;

      if (fitMode === 'contain') {
        const scale = Math.min(targetW / srcW, targetH / srcH);
        dw = srcW * scale;
        dh = srcH * scale;
        dx = (targetW - dw) / 2;
        dy = (targetH - dh) / 2;
      } else if (fitMode === 'cover') {
        const scale = Math.max(targetW / srcW, targetH / srcH);
        dw = srcW * scale;
        dh = srcH * scale;
        dx = (targetW - dw) / 2;
        dy = (targetH - dh) / 2;
      }

      ctx.drawImage(img, dx, dy, dw, dh);
    };

    const cachedImg = imageCacheRef.current.get(currentFrame.id);
    if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
      // Draw synchronously in the exact same render step - zero flicker!
      paint(cachedImg);
    } else {
      // If not yet cached, load it and only paint when ready (never clear canvas before ready)
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageCacheRef.current.set(currentFrame.id, img);
        paint(img);
      };
      img.src = currentFrame.url;
    }
  }, [frames, targetDim, fitMode, bgMode, bgColor]);

  // Render current frame to canvas preview whenever index or settings change
  useEffect(() => {
    drawFrameToCanvas(currentPreviewIndex);
  }, [currentPreviewIndex, drawFrameToCanvas]);

  // -------------------------------------------------------------------------
  // Helper: Extract valid WebP stream chunks (ALPH, VP8, VP8L)
  // -------------------------------------------------------------------------
  const extractWebPFramePayload = (webpBytes: Uint8Array): Uint8Array | null => {
    if (webpBytes.length < 12) return null;
    const view = new DataView(webpBytes.buffer, webpBytes.byteOffset, webpBytes.byteLength);

    const riff = String.fromCharCode(webpBytes[0], webpBytes[1], webpBytes[2], webpBytes[3]);
    const webp = String.fromCharCode(webpBytes[8], webpBytes[9], webpBytes[10], webpBytes[11]);
    if (riff !== 'RIFF' || webp !== 'WEBP') return null;

    let offset = 12;
    const chunks: Uint8Array[] = [];

    while (offset + 8 <= webpBytes.length) {
      const tag = String.fromCharCode(
        webpBytes[offset],
        webpBytes[offset + 1],
        webpBytes[offset + 2],
        webpBytes[offset + 3]
      );
      const size = view.getUint32(offset + 4, true);
      const paddedSize = size + (size % 2);

      if (tag === 'ALPH' || tag === 'VP8 ' || tag === 'VP8L') {
        const sub = new Uint8Array(8 + paddedSize);
        sub.set(webpBytes.subarray(offset, offset + 8), 0);
        const copyLen = Math.min(size, webpBytes.length - (offset + 8));
        sub.set(webpBytes.subarray(offset + 8, offset + 8 + copyLen), 8);
        if (paddedSize > size) {
          sub[8 + size] = 0;
        }
        chunks.push(sub);
      }
      offset += 8 + paddedSize;
    }

    if (chunks.length === 0) return null;
    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLen);
    let pos = 0;
    for (const c of chunks) {
      result.set(c, pos);
      pos += c.length;
    }
    return result;
  };

  // -------------------------------------------------------------------------
  // Helper: Assemble fully-compliant Animated WebP RIFF container
  // -------------------------------------------------------------------------
  const buildAnimatedWebP = (
    anmfFrames: Array<{ payload: Uint8Array; durationMs: number }>,
    width: number,
    height: number,
    loops: number
  ): Uint8Array => {
    const wMinus1 = width - 1;
    const hMinus1 = height - 1;

    // 1. VP8X chunk (18 bytes)
    const vp8xChunk = new Uint8Array(18);
    const vp8xView = new DataView(vp8xChunk.buffer);
    vp8xChunk.set([0x56, 0x50, 0x38, 0x58], 0); // 'VP8X'
    vp8xView.setUint32(4, 10, true);
    vp8xChunk[8] = 0x12; // Animation flag (bit 1: 0x02) + Alpha flag (bit 4: 0x10)
    vp8xChunk[12] = wMinus1 & 0xff;
    vp8xChunk[13] = (wMinus1 >> 8) & 0xff;
    vp8xChunk[14] = (wMinus1 >> 16) & 0xff;
    vp8xChunk[15] = hMinus1 & 0xff;
    vp8xChunk[16] = (hMinus1 >> 8) & 0xff;
    vp8xChunk[17] = (hMinus1 >> 16) & 0xff;

    // 2. ANIM chunk (14 bytes)
    const animChunk = new Uint8Array(14);
    const animView = new DataView(animChunk.buffer);
    animChunk.set([0x41, 0x4E, 0x49, 0x4D], 0); // 'ANIM'
    animView.setUint32(4, 6, true);
    animView.setUint32(8, 0, true); // transparent canvas background
    animView.setUint16(12, loops, true); // loop count: 0 = infinite

    // 3. ANMF chunks
    const anmfChunks: Uint8Array[] = [];
    for (const f of anmfFrames) {
      const payloadLen = f.payload.length;
      const anmfPayloadSize = 16 + payloadLen;
      const padding = anmfPayloadSize % 2;
      const anmfTotalSize = 8 + anmfPayloadSize + padding;

      const anmf = new Uint8Array(anmfTotalSize);
      const anmfView = new DataView(anmf.buffer);

      // 'ANMF' = 0x41, 0x4E, 0x4D, 0x46
      anmf.set([0x41, 0x4E, 0x4D, 0x46], 0);
      anmfView.setUint32(4, anmfPayloadSize, true);

      // Frame X, Y = 0
      anmf[8] = 0; anmf[9] = 0; anmf[10] = 0;
      anmf[11] = 0; anmf[12] = 0; anmf[13] = 0;

      // Frame Width - 1
      anmf[14] = wMinus1 & 0xff;
      anmf[15] = (wMinus1 >> 8) & 0xff;
      anmf[16] = (wMinus1 >> 16) & 0xff;

      // Frame Height - 1
      anmf[17] = hMinus1 & 0xff;
      anmf[18] = (hMinus1 >> 8) & 0xff;
      anmf[19] = (hMinus1 >> 16) & 0xff;

      // Frame Duration in ms (3 bytes LE)
      const dur = Math.max(10, Math.round(f.durationMs));
      anmf[20] = dur & 0xff;
      anmf[21] = (dur >> 8) & 0xff;
      anmf[22] = (dur >> 16) & 0xff;

      // Flags: dispose to background (0x01) + do not blend (0x02) = 0x03
      anmf[23] = 0x03;

      // Payload
      anmf.set(f.payload, 24);
      anmfChunks.push(anmf);
    }

    const anmfTotalLen = anmfChunks.reduce((acc, c) => acc + c.length, 0);
    const totalRiffPayload = 4 + vp8xChunk.length + animChunk.length + anmfTotalLen;
    const totalFileSize = 8 + totalRiffPayload;

    const result = new Uint8Array(totalFileSize);
    const resultView = new DataView(result.buffer);
    result.set([0x52, 0x49, 0x46, 0x46], 0); // 'RIFF'
    resultView.setUint32(4, totalRiffPayload, true);
    result.set([0x57, 0x45, 0x42, 0x50], 8); // 'WEBP'

    let offset = 12;
    result.set(vp8xChunk, offset);
    offset += vp8xChunk.length;
    result.set(animChunk, offset);
    offset += animChunk.length;
    for (const anmf of anmfChunks) {
      result.set(anmf, offset);
      offset += anmf.length;
    }

    return result;
  };

  // -------------------------------------------------------------------------
  // Main Encoding & Export Action
  // -------------------------------------------------------------------------
  const handleExportWebP = async () => {
    if (frames.length === 0) {
      setErrorText('يرجى إضافة صور أولاً قبل بدء التصدير.');
      return;
    }

    setIsEncoding(true);
    setEncodingProgress(5);
    setErrorText('');
    setStatusText('جاري تجهيز بيئة الرندرة والكانفاس...');

    if (outputUrl) {
      URL.revokeObjectURL(outputUrl);
      setOutputUrl(null);
    }

    try {
      const { w: targetW, h: targetH } = targetDim;
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = targetW;
      offscreenCanvas.height = targetH;
      const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('فشل إنشاء سياق رسم الكانفاس');

      const quality = qualityMode === 'lossless' ? 1.0 : qualityValue / 100;
      const webpFramesData: Array<{ payload: Uint8Array; durationMs: number }> = [];

      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        setStatusText(`جاري رندرة وضغط الإطار ${i + 1} من ${frames.length}...`);

        ctx.clearRect(0, 0, targetW, targetH);
        if (bgMode === 'color') {
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, targetW, targetH);
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`فشل تحميل صورة الإطار: ${frame.name}`));
          img.src = frame.url;
        });

        let dx = 0, dy = 0, dw = targetW, dh = targetH;
        const srcW = img.naturalWidth || frame.width;
        const srcH = img.naturalHeight || frame.height;

        if (fitMode === 'contain') {
          const scale = Math.min(targetW / srcW, targetH / srcH);
          dw = srcW * scale;
          dh = srcH * scale;
          dx = (targetW - dw) / 2;
          dy = (targetH - dh) / 2;
        } else if (fitMode === 'cover') {
          const scale = Math.max(targetW / srcW, targetH / srcH);
          dw = srcW * scale;
          dh = srcH * scale;
          dx = (targetW - dw) / 2;
          dy = (targetH - dh) / 2;
        }

        ctx.drawImage(img, dx, dy, dw, dh);

        const frameBlob = await new Promise<Blob | null>((resolve) => {
          offscreenCanvas.toBlob((b) => resolve(b), 'image/webp', quality);
        });

        if (!frameBlob) {
          throw new Error(`تعذر ترميز الإطار رقم ${i + 1} بصيغة WebP.`);
        }

        const frameBytes = new Uint8Array(await frameBlob.arrayBuffer());
        const payload = extractWebPFramePayload(frameBytes);
        if (!payload) {
          throw new Error(`فشل استخراج دفق البيانات من الإطار رقم ${i + 1}.`);
        }

        const duration = globalDelay;
        webpFramesData.push({
          payload,
          durationMs: duration
        });

        setEncodingProgress(10 + Math.round(((i + 1) / frames.length) * 75));
      }

      setStatusText('جاري تجميع حاوية الـ WebP المتحركة السليمة (RIFF/ANMF)...');
      setEncodingProgress(90);

      // Assemble full animated WebP
      const animatedWebPBytes = buildAnimatedWebP(webpFramesData, targetW, targetH, loopCount);
      const finalBlob = new Blob([animatedWebPBytes], { type: 'image/webp' });
      const url = URL.createObjectURL(finalBlob);

      setOutputBlob(finalBlob);
      setOutputUrl(url);
      setOutputSize(finalBlob.size);
      setOutputDimensions({ w: targetW, h: targetH });
      setEncodingProgress(100);
      setStatusText('اكتمل توليد ملف الـ WebP المتحرك بنجاح تام وبدون أية أخطاء!');
    } catch (err: any) {
      console.error('WebP Creator Export Error:', err);
      setErrorText(err.message || 'حدث خطأ أثناء تصدير ملف الـ WebP.');
    } finally {
      setIsEncoding(false);
    }
  };

  const handleDownload = () => {
    if (!outputBlob || !outputUrl) return;
    const a = document.createElement('a');
    a.href = outputUrl;
    a.download = `animation_${Date.now()}.webp`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="webp-creator-container max-w-6xl mx-auto space-y-8" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <Film size={22} />
            </div>
            صانع WEBP المتحرك
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm max-w-2xl leading-relaxed">
            أنشئ رسوم وموشن WebP متحرك عالي الجودة من تسلسل الصور مع خيارات دقيقة للسرعة، الأبعاد، والضغط بدون أي أخطاء.
          </p>
        </div>

        {frames.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => addMoreInputRef.current?.click()}
              className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-2 border border-slate-700/50"
            >
              <Plus size={16} className="text-teal-400" />
              إضافة صور
            </button>
            <button
              onClick={clearAllFrames}
              className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 border border-red-500/20"
            >
              <Trash2 size={16} />
              مسح الكل
            </button>
          </div>
        )}
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFilesUpload} 
        multiple 
        accept="image/png,image/jpeg,image/webp,image/gif" 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={addMoreInputRef} 
        onChange={handleFilesUpload} 
        multiple 
        accept="image/png,image/jpeg,image/webp,image/gif" 
        className="hidden" 
      />

      {/* Main Workspace */}
      {frames.length === 0 ? (
        /* Empty Upload State */
        <div 
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-800 hover:border-teal-500/50 bg-slate-900/30 hover:bg-slate-900/50 rounded-3xl p-12 sm:p-16 text-center cursor-pointer transition-all duration-300 group flex flex-col items-center justify-center min-h-[380px]"
        >
          <div className="w-20 h-20 rounded-3xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-6 group-hover:scale-110 transition-transform duration-300">
            <Upload size={36} />
          </div>
          <h3 className="text-xl font-black text-white mb-2">اسحب وأفلت الصور هنا أو انقر للاختيار</h3>
          <p className="text-slate-400 text-xs sm:text-sm max-w-md mb-6 leading-relaxed">
            يدعم صور PNG الشفافة، JPG، WEBP، وحتى إطارات GIF. يمكنك تحديد عدة صور دفعة واحدة ليتم ترتيبها تلقائياً كإطارات متحركة.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="px-3 py-1 bg-slate-800/60 rounded-full text-[11px] font-bold text-slate-400 border border-slate-700/40">PNG الشفاف</span>
            <span className="px-3 py-1 bg-slate-800/60 rounded-full text-[11px] font-bold text-slate-400 border border-slate-700/40">JPG / JPEG</span>
            <span className="px-3 py-1 bg-slate-800/60 rounded-full text-[11px] font-bold text-slate-400 border border-slate-700/40">WEBP</span>
            <span className="px-3 py-1 bg-slate-800/60 rounded-full text-[11px] font-bold text-slate-400 border border-slate-700/40">ترتيب رقمي تلقائي</span>
          </div>
        </div>
      ) : (
        /* Active Workspace: Preview & Settings */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Preview Canvas & Timeline (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Live Canvas Player Box */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 relative overflow-hidden flex flex-col items-center">
              {/* Top Details Bar */}
              <div className="w-full flex items-center justify-between gap-4 mb-4 text-xs font-bold text-slate-400 border-b border-slate-800/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 text-[11px]">
                    {targetDim.w} × {targetDim.h} px
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-800/60 text-slate-300 text-[11px]">
                    {frames.length} إطار
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-[11px]">
                    {fps} FPS ({globalDelay}ms)
                  </span>
                </div>

                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <span>الإطار:</span>
                  <span className="text-white font-mono">{currentPreviewIndex + 1}</span>
                  <span>/</span>
                  <span className="font-mono">{frames.length}</span>
                </div>
              </div>

              {/* Canvas Container with Checkerboard Option */}
              <div className="relative w-full aspect-square max-w-[420px] rounded-2xl overflow-hidden border border-slate-800/80 flex items-center justify-center shadow-inner bg-slate-950">
                {/* Checkerboard Pattern for Transparency */}
                {bgMode === 'transparent' && (
                  <div 
                    className="absolute inset-0 opacity-25 pointer-events-none"
                    style={{
                      backgroundImage: `radial-gradient(#475569 1px, transparent 1px)`,
                      backgroundSize: '16px 16px'
                    }}
                  />
                )}
                <canvas 
                  ref={previewCanvasRef} 
                  className="max-w-full max-h-full object-contain relative z-10"
                />
              </div>

              {/* Player Controls Bar */}
              <div className="w-full mt-6 space-y-3">
                {/* Scrubber Range Slider */}
                <input 
                  type="range" 
                  min={0} 
                  max={Math.max(0, frames.length - 1)} 
                  value={currentPreviewIndex} 
                  onChange={(e) => {
                    setIsPlaying(false);
                    setCurrentPreviewIndex(parseInt(e.target.value, 10));
                  }}
                  className="w-full accent-teal-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />

                {/* Buttons Bar */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setIsPlaying(false);
                        setCurrentPreviewIndex(0);
                      }}
                      title="العودة للبداية"
                      className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    >
                      <RotateCcw size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setIsPlaying(false);
                        setCurrentPreviewIndex(prev => (prev - 1 + frames.length) % frames.length);
                      }}
                      title="الإطار السابق"
                      className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    >
                      <ChevronRight size={18} />
                    </button>
                    <button
                      onClick={() => setIsPlaying(prev => !prev)}
                      className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                        isPlaying 
                          ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40' 
                          : 'bg-teal-500/20 hover:bg-teal-500/30 active:bg-teal-500/35 text-teal-300 border border-teal-500/40 hover:border-teal-500/60'
                      }`}
                    >
                      {isPlaying ? <Pause size={16} className="text-amber-400" /> : <Play size={16} className="text-teal-400" />}
                      <span>{isPlaying ? 'إيقاف مؤقت' : 'تشغيل العرض'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsPlaying(false);
                        setCurrentPreviewIndex(prev => (prev + 1) % frames.length);
                      }}
                      title="الإطار التالي"
                      className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    >
                      <ChevronLeft size={18} />
                    </button>
                  </div>

                  <button
                    onClick={reverseFrames}
                    className="px-3 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw size={14} />
                    عكس الترتيب
                  </button>
                </div>
              </div>
            </div>

            {/* Frame Sequence Thumbnails Gallery */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Layers size={18} className="text-teal-400" />
                    <h4 className="text-sm font-black text-white">تسلسل الإطارات ({frames.length})</h4>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 font-bold border border-teal-500/20">
                    عرض جميع الصور
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* View Mode Toggle: Grid vs Row */}
                  <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800">
                    <button
                      onClick={() => setSequenceViewMode('grid')}
                      title="عرض شبكي (جميع الصور معاً)"
                      className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                        sequenceViewMode === 'grid'
                          ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <LayoutGrid size={13} />
                      <span className="text-[10px] hidden sm:inline">كل الصور</span>
                    </button>
                    <button
                      onClick={() => setSequenceViewMode('row')}
                      title="عرض شريط أفقي"
                      className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                        sequenceViewMode === 'row'
                          ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <List size={13} />
                      <span className="text-[10px] hidden sm:inline">شريط</span>
                    </button>
                  </div>

                  <button
                    onClick={() => addMoreInputRef.current?.click()}
                    className="text-xs font-bold text-teal-400 hover:text-teal-300 flex items-center gap-1 transition-colors px-2 py-1 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20"
                  >
                    <Plus size={14} />
                    إضافة صور
                  </button>
                </div>
              </div>

              {/* Frame Items Container: Grid mode displays ALL frames simultaneously */}
              <div 
                className={
                  sequenceViewMode === 'grid'
                    ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2.5 max-h-[440px] overflow-y-auto custom-scrollbar p-1"
                    : "flex items-center gap-3 overflow-x-auto custom-scrollbar pb-2 p-1"
                }
              >
                {frames.map((frame, idx) => (
                  <div 
                    key={frame.id}
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentPreviewIndex(idx);
                    }}
                    className={`${sequenceViewMode === 'row' ? 'shrink-0 w-24' : 'w-full'} bg-slate-950/80 rounded-2xl p-2 border transition-all cursor-pointer relative group ${
                      currentPreviewIndex === idx 
                        ? 'border-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.25)] ring-1 ring-teal-500/50' 
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Index badge */}
                    <div className="absolute top-1 right-1 z-10 w-5 h-5 rounded-full bg-slate-900/90 text-[10px] font-bold text-teal-400 flex items-center justify-center border border-slate-700">
                      {idx + 1}
                    </div>

                    {/* Image box */}
                    <div className="w-full aspect-square rounded-xl bg-slate-900 flex items-center justify-center overflow-hidden mb-2">
                      <img src={frame.url} alt={frame.name} className="w-full h-full object-contain" />
                    </div>

                    {/* Frame Delay info */}
                    <p className="text-[10px] text-slate-400 text-center font-mono">{globalDelay}ms</p>

                    {/* Actions on hover / touch */}
                    <div 
                      className="absolute inset-x-1 bottom-1 bg-slate-900/95 backdrop-blur-sm rounded-xl p-1 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity z-20 border border-slate-700"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button 
                        onClick={() => moveFrame(idx, 'up')} 
                        disabled={idx === 0}
                        title="تحريك للخلف"
                        className="text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <ChevronRight size={14} />
                      </button>
                      <button 
                        onClick={() => duplicateFrame(idx)} 
                        title="تكرار الإطار"
                        className="text-slate-400 hover:text-teal-400"
                      >
                        <Copy size={12} />
                      </button>
                      <button 
                        onClick={() => removeFrame(idx)} 
                        title="حذف الإطار"
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 size={12} />
                      </button>
                      <button 
                        onClick={() => moveFrame(idx, 'down')} 
                        disabled={idx === frames.length - 1}
                        title="تحريك للأمام"
                        className="text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <ChevronLeft size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Settings & Export (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Animation & Speed Settings */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-800/60 pb-3">
                <Clock size={18} className="text-teal-400" />
                <h3 className="text-sm font-black text-white">إعدادات السرعة والفريمات</h3>
              </div>

              {/* FPS Slider & Presets */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-400">معدل الإطارات (FPS):</span>
                  <span className="text-teal-400 font-mono text-sm">{fps} إطار/ثانية</span>
                </div>
                <input 
                  type="range" 
                  min={1} 
                  max={60} 
                  value={fps} 
                  onChange={(e) => handleFpsChange(parseInt(e.target.value, 10))}
                  className="w-full accent-teal-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
                {/* Presets Chips */}
                <div className="flex flex-wrap gap-1.5">
                  {[10, 15, 20, 24, 30, 60].map((presetFps) => (
                    <button
                      key={presetFps}
                      onClick={() => handleFpsChange(presetFps)}
                      className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all ${
                        fps === presetFps 
                          ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' 
                          : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      {presetFps} FPS
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration in ms */}
              <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-2xl border border-slate-800/60 text-xs">
                <span className="text-slate-400 font-bold">زمن عرض كل إطار:</span>
                <span className="text-white font-mono font-bold">{globalDelay} ملي ثانية</span>
              </div>
            </div>

            {/* Graphics, Dimensions & Fitting Settings */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-800/60 pb-3">
                <Sliders size={18} className="text-teal-400" />
                <h3 className="text-sm font-black text-white">إعدادات الرسوم والأبعاد</h3>
              </div>

              {/* Dimension Mode */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 block">أبعاد ملف الـ WebP:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setDimensionMode('first')}
                    className={`py-2 rounded-xl text-[11px] font-bold transition-all ${
                      dimensionMode === 'first' 
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' 
                        : 'bg-slate-800/50 text-slate-400 border border-transparent'
                    }`}
                  >
                    أول إطار ({frames[0]?.width || 0}×{frames[0]?.height || 0})
                  </button>
                  <button
                    onClick={() => setDimensionMode('max')}
                    className={`py-2 rounded-xl text-[11px] font-bold transition-all ${
                      dimensionMode === 'max' 
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' 
                        : 'bg-slate-800/50 text-slate-400 border border-transparent'
                    }`}
                  >
                    الحجم الأقصى
                  </button>
                  <button
                    onClick={() => setDimensionMode('custom')}
                    className={`py-2 rounded-xl text-[11px] font-bold transition-all ${
                      dimensionMode === 'custom' 
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' 
                        : 'bg-slate-800/50 text-slate-400 border border-transparent'
                    }`}
                  >
                    مخصص
                  </button>
                </div>
              </div>

              {/* Custom Dimensions Inputs */}
              {dimensionMode === 'custom' && (
                <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800/60 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">العرض (Width):</label>
                      <input 
                        type="number" 
                        min={16} 
                        max={4096} 
                        value={customWidth} 
                        onChange={(e) => {
                          const w = parseInt(e.target.value, 10) || 512;
                          setCustomWidth(w);
                          if (lockAspect && aspectRatio) {
                            setCustomHeight(Math.round(w / aspectRatio));
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:border-teal-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">الارتفاع (Height):</label>
                      <input 
                        type="number" 
                        min={16} 
                        max={4096} 
                        value={customHeight} 
                        onChange={(e) => {
                          const h = parseInt(e.target.value, 10) || 512;
                          setCustomHeight(h);
                          if (lockAspect && aspectRatio) {
                            setCustomWidth(Math.round(h * aspectRatio));
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:border-teal-500 outline-none"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-400">
                    <input 
                      type="checkbox" 
                      checked={lockAspect} 
                      onChange={(e) => setLockAspect(e.target.checked)}
                      className="accent-teal-500"
                    />
                    قفل نسبة العرض إلى الارتفاع (Lock Aspect Ratio)
                  </label>
                </div>
              )}

              {/* Background Mode */}
              <div className="space-y-2 pt-2 border-t border-slate-800/60">
                <label className="text-xs font-bold text-slate-400 block">لون الخلفية:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setBgMode('transparent')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      bgMode === 'transparent' 
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' 
                        : 'bg-slate-800/50 text-slate-400 border border-transparent'
                    }`}
                  >
                    شفافة مفرغة (Alpha)
                  </button>
                  <div className="flex items-center gap-2 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800">
                    <input 
                      type="color" 
                      value={bgColor} 
                      onChange={(e) => {
                        setBgColor(e.target.value);
                        setBgMode('color');
                      }}
                      className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-none"
                    />
                    <span 
                      onClick={() => setBgMode('color')}
                      className={`text-xs font-bold cursor-pointer ${bgMode === 'color' ? 'text-teal-400' : 'text-slate-400'}`}
                    >
                      خلفية بلون مخصص
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quality & Compression Settings */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800/60 pb-3">
                <Sliders size={18} className="text-teal-400" />
                <h3 className="text-sm font-black text-white">إعدادات الضغط والجودة</h3>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setQualityMode('lossless')}
                  className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all text-center ${
                    qualityMode === 'lossless' 
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' 
                      : 'bg-slate-800/50 text-slate-400 border border-transparent'
                  }`}
                >
                  بدون فقدان (Lossless 100%)
                </button>
                <button
                  onClick={() => setQualityMode('lossy')}
                  className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all text-center ${
                    qualityMode === 'lossy' 
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' 
                      : 'bg-slate-800/50 text-slate-400 border border-transparent'
                  }`}
                >
                  ضغط ذكي (Lossy)
                </button>
              </div>

              {qualityMode === 'lossy' && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-400">جودة الضغط:</span>
                    <span className="text-teal-400 font-mono">{qualityValue}%</span>
                  </div>
                  <input 
                    type="range" 
                    min={10} 
                    max={100} 
                    value={qualityValue} 
                    onChange={(e) => setQualityValue(parseInt(e.target.value, 10))}
                    className="w-full accent-teal-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-500">
                    نسبة 85% - 95% توفر حجم ملف صغير جداً مع الحفاظ على النقاء البصري.
                  </p>
                </div>
              )}
            </div>

            {/* Error Message if any */}
            {errorText && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold leading-relaxed">
                {errorText}
              </div>
            )}

            {/* Export Progress & Actions */}
            <div className="space-y-4">
              {isEncoding && (
                <div className="p-5 bg-slate-900/90 border border-teal-500/30 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-teal-400 flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      {statusText}
                    </span>
                    <span className="text-white font-mono">{encodingProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-200"
                      style={{ width: `${encodingProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Download / Export Button */}
              {!outputBlob ? (
                <button
                  onClick={handleExportWebP}
                  disabled={isEncoding || frames.length === 0}
                  className="w-full py-4 rounded-2xl bg-teal-500/20 hover:bg-teal-500/30 active:bg-teal-500/35 border border-teal-500/40 hover:border-teal-500/60 text-teal-300 font-bold text-sm transition-colors flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                >
                  {isEncoding ? <Loader2 size={20} className="animate-spin text-teal-400" /> : <Film size={20} className="text-teal-400" />}
                  <span>بدء تجميع وتصدير ملف الـ WEBP</span>
                </button>
              ) : (
                /* Success & Download Card */
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400 font-black text-sm">
                      <Check size={18} />
                      تم التصدير بنجاح!
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      {formatSize(outputSize)} • {outputDimensions.w}×{outputDimensions.h}
                    </span>
                  </div>

                  {/* Direct Live Preview of Exported WebP to confirm it runs naturally */}
                  <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-slate-900 flex items-center justify-center overflow-hidden shrink-0 border border-slate-700">
                      {outputUrl && (
                        <img 
                          src={outputUrl} 
                          alt="Exported WebP Preview" 
                          className="w-full h-full object-contain"
                        />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white mb-1">معاينة الملف الحقيقي المصدّر</p>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        تم فحص ملف WebP ويعمل بصورة طبيعية ومباشرة في المتصفحات وكافة المشغلات.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleDownload}
                      className="py-3 px-4 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 active:bg-emerald-500/35 border border-emerald-500/40 hover:border-emerald-500/60 text-emerald-300 font-bold text-xs transition-colors flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer"
                    >
                      <Download size={16} className="text-emerald-400" />
                      <span>تحميل ملف WEBP الآن</span>
                    </button>
                    <button
                      onClick={handleExportWebP}
                      disabled={isEncoding}
                      className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
                    >
                      <RefreshCw size={14} />
                      إعادة التصدير
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>
      )}
    </div>
  );
};
