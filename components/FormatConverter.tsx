import React, { useState, useRef } from 'react';
import { Upload, Download, Settings, Loader2, Play, AlertTriangle, RefreshCw, Layers, FileImage } from 'lucide-react';
import pako from 'pako';
import { parse } from 'protobufjs';
import { svgaSchema } from '../svga-proto';
import parseAPNG from 'apng-js';
import * as UPNG from 'upng-js';
import { motion, AnimatePresence } from 'motion/react';
// @ts-ignore
import { parseGIF, decompressFrames } from 'gifuct-js';
// @ts-ignore
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export const FormatConverter: React.FC = () => {
  const [conversionType, setConversionType] = useState<'apng-to-svga' | 'gif-to-svga' | 'svga-to-apng' | 'svga-to-gif' | 'svga-to-json' | 'json-to-svga'>('apng-to-svga');

  // Input states
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [inputUrl, setInputUrl] = useState<string>('');
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorText, setErrorText] = useState('');
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputFileName, setOutputFileName] = useState('');

  // Mode 1: APNG to SVGA Settings
  const [fpsMode, setFpsMode] = useState<'auto' | 'custom'>('auto');
  const [customFps, setCustomFps] = useState<number>(20);
  const [compressionRatio, setCompressionRatio] = useState<number>(80);
  const [imageQuality, setImageQuality] = useState<number>(85);

  // Mode 2: SVGA to APNG Settings
  const [apngFpsMode, setApngFpsMode] = useState<'auto' | 'custom'>('auto');
  const [apngCustomFps, setApngCustomFps] = useState<number>(20);
  const [apngCompressMode, setApngCompressMode] = useState<'lossless' | 'lossy'>('lossless');
  const [apngColorsCount, setApngColorsCount] = useState<number>(256);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let isMounted = true;
    let player: any = null;

    if ((conversionType === 'svga-to-apng' || conversionType === 'svga-to-gif' || conversionType === 'svga-to-json') && inputFile && previewContainerRef.current) {
      const initPreview = async () => {
        try {
          const SVGA: any = await new Promise((resolve, reject) => {
            let attempts = 0;
            const check = () => {
              if ((window as any).SVGA) {
                resolve((window as any).SVGA);
              } else {
                attempts++;
                if (attempts > 50) {
                  reject(new Error("SVGA library not found on window"));
                } else {
                  setTimeout(check, 100);
                }
              }
            };
            check();
          });

          if (!isMounted || !previewContainerRef.current) return;
          previewContainerRef.current.innerHTML = '';
          player = new SVGA.Player(previewContainerRef.current);
          const parser = new SVGA.Parser();

          player.setContentMode('AspectFit');
          player.loops = 0; // infinite loops
          player.clearsAfterStop = false;

          const source = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(inputFile);
          });

          if (!isMounted) return;
          parser.load(source, (videoItem: any) => {
            if (!isMounted) return;
            player.setVideoItem(videoItem);
            player.startAnimation();
          });
        } catch (err) {
          console.error("Failed to load SVGA preview", err);
        }
      };

      initPreview();
    }

    return () => {
      isMounted = false;
      if (player) {
        try {
          player.stopAnimation();
        } catch (e) {}
      }
    };
  }, [inputFile, conversionType]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file: File) => {
    const nameLower = file.name.toLowerCase();
    if (conversionType === 'gif-to-svga') {
      if (file.type === 'image/gif' || nameLower.endsWith('.gif')) {
        setInputFile(file);
        setInputUrl(URL.createObjectURL(file));
        setErrorText('');
        setOutputBlob(null);
        setProgress(0);
        setStatusText('');
      } else {
        setErrorText('يرجى اختيار ملف GIF صالح (.gif).');
      }
    } else if (conversionType === 'apng-to-svga') {
      if (file.type === 'image/png' || nameLower.endsWith('.png') || nameLower.endsWith('.apng')) {
        setInputFile(file);
        setInputUrl(URL.createObjectURL(file));
        setErrorText('');
        setOutputBlob(null);
        setProgress(0);
        setStatusText('');
      } else {
        setErrorText('يرجى اختيار ملف APNG صالح (.png أو .apng).');
      }
    } else if (conversionType === 'json-to-svga') {
      if (file.type === 'application/json' || nameLower.endsWith('.json')) {
        setInputFile(file);
        setInputUrl(URL.createObjectURL(file));
        setErrorText('');
        setOutputBlob(null);
        setProgress(0);
        setStatusText('');
      } else {
        setErrorText('يرجى اختيار ملف JSON صالح (.json).');
      }
    } else {
      if (nameLower.endsWith('.svga')) {
        setInputFile(file);
        setInputUrl(URL.createObjectURL(file));
        setErrorText('');
        setOutputBlob(null);
        setProgress(0);
        setStatusText('');
      } else {
        setErrorText('يرجى اختيار ملف فلاش SVGA صالح (.svga).');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const resetConverter = () => {
    setInputFile(null);
    if (inputUrl) {
      URL.revokeObjectURL(inputUrl);
    }
    setInputUrl('');
    setOutputBlob(null);
    setProgress(0);
    setStatusText('');
    setErrorText('');
  };

  const handleTypeChange = (type: 'apng-to-svga' | 'gif-to-svga' | 'svga-to-apng' | 'svga-to-gif' | 'svga-to-json' | 'json-to-svga') => {
    setConversionType(type);
    resetConverter();
  };

  // ----------------------------------------------------
  // CONVERSION: APNG to SVGA
  // ----------------------------------------------------
  const convertApngToSvga = async () => {
    if (!inputFile) return;

    setIsConverting(true);
    setProgress(5);
    setErrorText('');
    setStatusText('جاري قراءة الملف وتفسير هياكل الـ APNG...');

    try {
      const arrayBuffer = await inputFile.arrayBuffer();
      
      const apng = parseAPNG(arrayBuffer);
      if (apng instanceof Error) {
        throw new Error('الملف ليس بصيغة APNG صالحة أو حدث خطأ أثناء تحليله. تأكد من أنه صورة PNG متحركة وليست صورة عادية.');
      }

      if (!apng.frames || apng.frames.length === 0) {
        throw new Error('لم يتم العثور على أي إطارات متحركة داخل ملف الـ APNG. تأكد من أن الملف متحرك.');
      }

      const totalFrames = apng.frames.length;
      const w = apng.width;
      const h = apng.height;

      setStatusText(`تم العثور على ${totalFrames} إطار بدقة ${w}x${h}. جاري تهيئة سياق الرسم...`);
      setProgress(15);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('فشل تهيئة سياق الرسم ثنائي الأبعاد Canvas.');
      }

      const framePngs: Uint8Array[] = [];
      let lastCanvasData: ImageData | null = null;

      setStatusText('جاري فك ضغط الإطارات وتجهيزها...');
      const images: HTMLImageElement[] = [];
      for (let i = 0; i < totalFrames; i++) {
        const frame = apng.frames[i];
        const blob = frame.imageData;
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.src = url;

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`فشل تحميل الإطار رقم ${i + 1}`));
        });

        images.push(img);
        setProgress(15 + Math.round((i / totalFrames) * 20));
      }

      setStatusText('جاري تجميع ودمج الإطارات وبناء المشهد...');
      
      for (let i = 0; i < totalFrames; i++) {
        const frame = apng.frames[i];
        const img = images[i];

        if (i > 0) {
          const prevFrame = apng.frames[i - 1];
          if (prevFrame.disposeOp === 1) {
            ctx.clearRect(prevFrame.left, prevFrame.top, prevFrame.width, prevFrame.height);
          } else if (prevFrame.disposeOp === 2 && lastCanvasData) {
            ctx.putImageData(lastCanvasData, 0, 0);
          }
        }

        if (frame.disposeOp === 2) {
          lastCanvasData = ctx.getImageData(0, 0, w, h);
        }

        if (frame.blendOp === 0) {
          ctx.clearRect(frame.left, frame.top, frame.width, frame.height);
        } else {
          ctx.globalCompositeOperation = 'source-over';
        }

        ctx.drawImage(img, frame.left, frame.top, frame.width, frame.height);

        const frameBlob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/png', imageQuality / 100);
        });

        if (!frameBlob) {
          throw new Error(`فشل تصدير الإطار المدمج رقم ${i + 1}`);
        }

        const frameBuffer = new Uint8Array(await frameBlob.arrayBuffer());
        framePngs.push(frameBuffer);

        URL.revokeObjectURL(img.src);
        setProgress(35 + Math.round((i / totalFrames) * 25));
      }

      let targetFps = customFps;
      if (fpsMode === 'auto') {
        let totalDelay = 0;
        for (let i = 0; i < totalFrames; i++) {
          totalDelay += apng.frames[i].delay || 50;
        }
        const avgDelayMs = totalDelay / totalFrames;
        targetFps = Math.max(1, Math.round(1000 / avgDelayMs));
        setStatusText(`تحديد السرعة تلقائياً: ${targetFps} إطار/ثانية (إجمالي المدة: ${totalDelay}ms)`);
      }

      setStatusText('جاري تجميع الهيكل البروتوكولي لـ SVGA...');
      setProgress(65);

      const root = parse(svgaSchema).root;
      const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");

      const svgaImages: Record<string, Uint8Array> = {};
      const svgaSprites: any[] = [];

      for (let i = 0; i < totalFrames; i++) {
        const imageKey = `frame_${i}`;
        svgaImages[imageKey] = framePngs[i];

        const spriteFrames = [];
        for (let j = 0; j < totalFrames; j++) {
          spriteFrames.push({
            alpha: i === j ? 1.0 : 0.0,
            layout: { x: 0, y: 0, width: w, height: h },
            transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
          });
        }

        svgaSprites.push({
          imageKey: imageKey,
          frames: spriteFrames
        });
      }

      const movie = {
        version: "2.0",
        params: { viewBoxWidth: w, viewBoxHeight: h, fps: targetFps, frames: totalFrames },
        images: svgaImages,
        sprites: svgaSprites,
        audios: []
      };

      setStatusText('جاري ضغط الملف وتحزيمه (Pako Deflate)...');
      setProgress(80);

      const message = MovieEntity.create(movie);
      const buffer = MovieEntity.encode(message).finish();

      const pakoLevel = Math.min(9, Math.max(0, Math.floor(compressionRatio / 10)));
      const deflated = pako.deflate(buffer, { level: pakoLevel as any });

      setProgress(100);
      setStatusText('اكتمل التحويل بنجاح!');

      const finalBlob = new Blob([deflated], { type: 'application/octet-stream' });
      setOutputBlob(finalBlob);
      
      const originalName = inputFile.name.substring(0, inputFile.name.lastIndexOf('.')) || 'converted';
      setOutputFileName(`${originalName}.svga`);

    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'حدث خطأ غير متوقع أثناء عملية تحويل الـ APNG.');
    } finally {
      setIsConverting(false);
    }
  };

  // ----------------------------------------------------
  // CONVERSION: GIF to SVGA
  // ----------------------------------------------------
  const convertGifToSvga = async () => {
    if (!inputFile) return;

    setIsConverting(true);
    setProgress(5);
    setErrorText('');
    setStatusText('جاري قراءة ملف GIF وتفسير هياكل الفريمات...');

    try {
      const arrayBuffer = await inputFile.arrayBuffer();
      const gif = parseGIF(arrayBuffer);
      const frames = decompressFrames(gif, true);

      if (!frames || frames.length === 0) {
        throw new Error('لم يتم العثور على أي إطارات متحركة داخل ملف الـ GIF. تأكد من أن الملف متحرك.');
      }

      const totalFrames = frames.length;
      const w = gif.lsd.width;
      const h = gif.lsd.height;

      setStatusText(`تم العثور على ${totalFrames} إطار بدقة ${w}x${h}. جاري تهيئة سياق الرسم...`);
      setProgress(15);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('فشل تهيئة سياق الرسم ثنائي الأبعاد Canvas.');
      }

      const framePngs: Uint8Array[] = [];
      let lastCanvasData: ImageData | null = null;

      setStatusText('جاري فك ضغط الإطارات وتجهيزها...');
      
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');

      for (let i = 0; i < totalFrames; i++) {
        const frame = frames[i];

        if (i > 0) {
          const prevFrame = frames[i - 1];
          if (prevFrame.disposalType === 2) {
            ctx.clearRect(prevFrame.dims.left, prevFrame.dims.top, prevFrame.dims.width, prevFrame.dims.height);
          } else if (prevFrame.disposalType === 3 && lastCanvasData) {
            ctx.putImageData(lastCanvasData, 0, 0);
          }
        }

        if (frame.disposalType === 3) {
          lastCanvasData = ctx.getImageData(0, 0, w, h);
        }

        // Render patch to temp canvas
        tempCanvas.width = frame.dims.width;
        tempCanvas.height = frame.dims.height;
        if (tempCtx) {
          const imgData = tempCtx.createImageData(frame.dims.width, frame.dims.height);
          imgData.data.set(frame.patch);
          tempCtx.putImageData(imgData, 0, 0);
          
          // Draw temp canvas to main canvas
          ctx.drawImage(tempCanvas, frame.dims.left, frame.dims.top);
        }

        // Export to blob
        const frameBlob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/png', imageQuality / 100);
        });

        if (!frameBlob) {
          throw new Error(`فشل تصدير الإطار المدمج رقم ${i + 1}`);
        }

        const frameBuffer = new Uint8Array(await frameBlob.arrayBuffer());
        framePngs.push(frameBuffer);

        setProgress(15 + Math.round((i / totalFrames) * 50));
      }

      let targetFps = customFps;
      if (fpsMode === 'auto') {
        let totalDelay = 0;
        for (let i = 0; i < totalFrames; i++) {
          totalDelay += frames[i].delay || 50;
        }
        const avgDelayMs = totalDelay / totalFrames;
        targetFps = Math.max(1, Math.round(1000 / avgDelayMs));
        setStatusText(`تحديد السرعة تلقائياً: ${targetFps} إطار/ثانية (إجمالي المدة: ${totalDelay}ms)`);
      }

      setStatusText('جاري تجميع الهيكل البروتوكولي لـ SVGA...');
      setProgress(70);

      const root = parse(svgaSchema).root;
      const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");

      const svgaImages: Record<string, Uint8Array> = {};
      const svgaSprites: any[] = [];

      for (let i = 0; i < totalFrames; i++) {
        const imageKey = `frame_${i}`;
        svgaImages[imageKey] = framePngs[i];

        const spriteFrames = [];
        for (let j = 0; j < totalFrames; j++) {
          spriteFrames.push({
            alpha: i === j ? 1.0 : 0.0,
            layout: { x: 0, y: 0, width: w, height: h },
            transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
          });
        }

        svgaSprites.push({
          imageKey: imageKey,
          frames: spriteFrames
        });
      }

      const movie = {
        version: "2.0",
        params: { viewBoxWidth: w, viewBoxHeight: h, fps: targetFps, frames: totalFrames },
        images: svgaImages,
        sprites: svgaSprites,
        audios: []
      };

      setStatusText('جاري ضغط الملف وتحزيمه (Pako Deflate)...');
      setProgress(85);

      const message = MovieEntity.create(movie);
      const buffer = MovieEntity.encode(message).finish();

      const pakoLevel = Math.min(9, Math.max(0, Math.floor(compressionRatio / 10)));
      const deflated = pako.deflate(buffer, { level: pakoLevel as any });

      setProgress(100);
      setStatusText('اكتمل التحويل بنجاح!');

      const finalBlob = new Blob([deflated], { type: 'application/octet-stream' });
      setOutputBlob(finalBlob);

      const originalName = inputFile.name.substring(0, inputFile.name.lastIndexOf('.')) || 'converted';
      setOutputFileName(`${originalName}.svga`);

    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'حدث خطأ غير متوقع أثناء عملية تحويل الـ GIF.');
    } finally {
      setIsConverting(false);
    }
  };

  // ----------------------------------------------------
  // CONVERSION: SVGA to APNG
  // ----------------------------------------------------
  const convertSvgaToApng = async () => {
    if (!inputFile) return;

    setIsConverting(true);
    setProgress(5);
    setErrorText('');
    setStatusText('جاري قراءة ملف فلاش SVGA وكسر ترميز Zlib...');

    const imageElements: Record<string, HTMLImageElement> = {};

    try {
      const arrayBuffer = await inputFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // 1. Inflate Zlib stream
      let inflated: Uint8Array;
      try {
        inflated = pako.inflate(uint8Array);
      } catch (e) {
        throw new Error('فشل فك ضغط الملف. تأكد من أن الملف هو ملف SVGA 2.0 صالح وغير معطوب.');
      }

      setProgress(15);
      setStatusText('جاري فك ترميز ملف البروتوكول Protobuf...');

      // 2. Decode using SVGA Schema
      const root = parse(svgaSchema).root;
      const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
      const message = MovieEntity.decode(inflated) as any;

      if (!message || !message.params) {
        throw new Error('بنية الـ SVGA غير صالحة أو تفتقد المحددات والبارامترات الأساسية.');
      }

      const width = message.params.viewBoxWidth || 300;
      const height = message.params.viewBoxHeight || 300;
      const totalFrames = message.params.frames || 1;
      const fps = message.params.fps || 20;

      if (totalFrames <= 0) {
        throw new Error('ملف الـ SVGA يحتوي على 0 إطارات ولا يمكن تحويله.');
      }

      setProgress(30);
      setStatusText(`تم التعرف على المشهد: ${totalFrames} إطار بدقة ${width}x${height}. جاري معالجة الصور الداخلية...`);

      // 3. Load all inner SVGA images
      const imagesObj = message.images || {};
      const imageKeys = Object.keys(imagesObj);
      
      for (let i = 0; i < imageKeys.length; i++) {
        const key = imageKeys[i];
        const bytes = imagesObj[key];
        
        try {
          const blob = new Blob([bytes], { type: 'image/png' });
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.src = url;
          
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => {
              console.warn(`Failed to render inner image ${key}`);
              resolve(); // keep going
            };
          });
          imageElements[key] = img;
        } catch (e) {
          console.error(`Error processing image ${key}`, e);
        }

        setProgress(30 + Math.round((i / imageKeys.length) * 20));
      }

      setStatusText('جاري رندرة الإطارات المتتابعة على الكانفاس...');
      setProgress(50);

      // 4. Set up canvas for rendering
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('فشل تهيئة سياق الرسم ثنائي الأبعاد Canvas.');
      }

      const bufs: ArrayBuffer[] = [];

      for (let f = 0; f < totalFrames; f++) {
        ctx.clearRect(0, 0, width, height);

        if (message.sprites) {
          for (const sprite of message.sprites) {
            const frameData = sprite.frames?.[f];
            if (frameData && (frameData.alpha === undefined || frameData.alpha > 0)) {
              const img = imageElements[sprite.imageKey];
              if (img) {
                ctx.save();
                
                // Apply opacity / alpha
                if (frameData.alpha !== undefined) {
                  ctx.globalAlpha = frameData.alpha;
                } else {
                  ctx.globalAlpha = 1.0;
                }

                // Apply transform if present
                if (frameData.transform) {
                  const t = frameData.transform;
                  ctx.transform(
                    t.a !== undefined ? t.a : 1,
                    t.b !== undefined ? t.b : 0,
                    t.c !== undefined ? t.c : 0,
                    t.d !== undefined ? t.d : 1,
                    t.tx !== undefined ? t.tx : 0,
                    t.ty !== undefined ? t.ty : 0
                  );
                }

                // Draw the image
                if (frameData.layout) {
                  const l = frameData.layout;
                  ctx.drawImage(
                    img,
                    l.x !== undefined ? l.x : 0,
                    l.y !== undefined ? l.y : 0,
                    l.width !== undefined ? l.width : img.width,
                    l.height !== undefined ? l.height : img.height
                  );
                } else {
                  ctx.drawImage(img, 0, 0);
                }

                ctx.restore();
              }
            }
          }
        }

        // Extract raw pixels for UPNG
        const imgData = ctx.getImageData(0, 0, width, height);
        bufs.push(imgData.data.buffer);

        setProgress(50 + Math.round((f / totalFrames) * 20));
      }

      setStatusText('جاري تحزيم وضغط إطارات الـ APNG النهائية...');
      setProgress(80);

      // 5. Build delays & encode with UPNG
      const targetFps = apngFpsMode === 'custom' ? apngCustomFps : fps;
      const frameDelayMs = Math.round(1000 / targetFps);
      const delays = Array(totalFrames).fill(frameDelayMs);

      const colorsNum = apngCompressMode === 'lossless' ? 0 : apngColorsCount;
      const apngBuffer = UPNG.encode(bufs, width, height, colorsNum, delays);

      setProgress(100);
      setStatusText('اكتمل التحويل إلى APNG بنجاح!');

      const finalBlob = new Blob([apngBuffer], { type: 'image/png' });
      setOutputBlob(finalBlob);

      const originalName = inputFile.name.substring(0, inputFile.name.lastIndexOf('.')) || 'converted';
      setOutputFileName(`${originalName}.png`);

    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'حدث خطأ غير متوقع أثناء عملية تفكيك وتحويل الـ SVGA.');
    } finally {
      // Clean up object URLs
      Object.values(imageElements).forEach((img) => {
        if (img.src) URL.revokeObjectURL(img.src);
      });
      setIsConverting(false);
    }
  };

  // ----------------------------------------------------
  // CONVERSION: SVGA to GIF
  // ----------------------------------------------------
  const convertSvgaToGif = async () => {
    if (!inputFile) return;

    setIsConverting(true);
    setProgress(10);
    setErrorText('');
    setStatusText('جاري فك ضغط ملف الـ SVGA...');

    const imageElements: Record<string, HTMLImageElement> = {};

    try {
      const arrayBuffer = await inputFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // 1. Inflate Zlib stream
      let inflated: Uint8Array;
      try {
        inflated = pako.inflate(uint8Array);
      } catch (e) {
        throw new Error('فشل فك ضغط الملف. تأكد من أن الملف هو ملف SVGA 2.0 صالح وغير معطوب.');
      }

      setProgress(20);
      setStatusText('جاري تفسير محتوى الهيكل البروتوكولي (Protobuf)...');

      // 2. Decode Protobuf message
      const root = parse(svgaSchema).root;
      const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
      const message = MovieEntity.decode(inflated) as any;

      if (!message || !message.params) {
        throw new Error('بنية الـ SVGA غير صالحة أو تفتقد المحددات والبارامترات الأساسية.');
      }

      const width = message.params.viewBoxWidth || 300;
      const height = message.params.viewBoxHeight || 300;
      const totalFrames = message.params.frames || 1;
      const fps = message.params.fps || 20;

      if (totalFrames <= 0) {
        throw new Error('ملف الـ SVGA يحتوي على 0 إطارات ولا يمكن تحويله.');
      }

      setProgress(30);
      setStatusText(`تم التعرف على المشهد: ${totalFrames} إطار بدقة ${width}x${height}. جاري معالجة الصور الداخلية...`);

      // 3. Load all inner SVGA images
      const imagesObj = message.images || {};
      const imageKeys = Object.keys(imagesObj);
      
      for (let i = 0; i < imageKeys.length; i++) {
        const key = imageKeys[i];
        const bytes = imagesObj[key];
        
        try {
          const blob = new Blob([bytes], { type: 'image/png' });
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.src = url;
          
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => {
              console.warn(`Failed to render inner image ${key}`);
              resolve(); // keep going
            };
          });
          imageElements[key] = img;
        } catch (e) {
          console.error(`Error processing image ${key}`, e);
        }

        setProgress(30 + Math.round((i / imageKeys.length) * 20));
      }

      setStatusText('جاري رندرة الإطارات المتتابعة على الكانفاس وكتابة ملف الـ GIF...');
      setProgress(50);

      // 4. Set up canvas for rendering
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('فشل تهيئة سياق الرسم ثنائي الأبعاد Canvas.');
      }

      // Initialize gifenc GIFEncoder
      const gif = GIFEncoder();
      const targetFps = apngFpsMode === 'custom' ? apngCustomFps : fps;
      const frameDelayMs = Math.round(1000 / targetFps);

      for (let f = 0; f < totalFrames; f++) {
        ctx.clearRect(0, 0, width, height);

        if (message.sprites) {
          for (const sprite of message.sprites) {
            const frameData = sprite.frames?.[f];
            if (frameData && (frameData.alpha === undefined || frameData.alpha > 0)) {
              const img = imageElements[sprite.imageKey];
              if (img) {
                ctx.save();
                
                // Apply opacity / alpha
                if (frameData.alpha !== undefined) {
                  ctx.globalAlpha = frameData.alpha;
                } else {
                  ctx.globalAlpha = 1.0;
                }

                // Apply transform if present
                if (frameData.transform) {
                  const t = frameData.transform;
                  ctx.transform(
                    t.a !== undefined ? t.a : 1,
                    t.b !== undefined ? t.b : 0,
                    t.c !== undefined ? t.c : 0,
                    t.d !== undefined ? t.d : 1,
                    t.tx !== undefined ? t.tx : 0,
                    t.ty !== undefined ? t.ty : 0
                  );
                }

                // Draw the image
                if (frameData.layout) {
                  const l = frameData.layout;
                  ctx.drawImage(
                    img,
                    l.x !== undefined ? l.x : 0,
                    l.y !== undefined ? l.y : 0,
                    l.width !== undefined ? l.width : img.width,
                    l.height !== undefined ? l.height : img.height
                  );
                } else {
                  ctx.drawImage(img, 0, 0);
                }

                ctx.restore();
              }
            }
          }
        }

        // Extract raw pixels for gifenc
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // Check transparency
        let hasTransparent = false;
        for (let idx = 3; idx < data.length; idx += 4) {
          if (data[idx] < 128) {
            hasTransparent = true;
            break;
          }
        }

        const format = hasTransparent ? 'rgba4444' : 'rgb565';
        const palette = quantize(data, 256, { format });
        const index = applyPalette(data, palette, format);

        const frameOpts: any = {
          palette,
          delay: frameDelayMs
        };

        if (hasTransparent) {
          const transparentIndex = palette.indexOf(0x0000);
          if (transparentIndex !== -1) {
            frameOpts.transparent = true;
            frameOpts.transparentIndex = transparentIndex;
          }
        }

        gif.writeFrame(index, width, height, frameOpts);

        setProgress(50 + Math.round((f / totalFrames) * 40));
      }

      setStatusText('جاري تجميع وحفظ ملف الـ GIF النهائي...');
      setProgress(90);

      gif.finish();
      const gifBytes = gif.bytes();

      setProgress(100);
      setStatusText('اكتمل التحويل إلى GIF بنجاح!');

      const finalBlob = new Blob([gifBytes], { type: 'image/gif' });
      setOutputBlob(finalBlob);

      const originalName = inputFile.name.substring(0, inputFile.name.lastIndexOf('.')) || 'converted';
      setOutputFileName(`${originalName}.gif`);

    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'حدث خطأ غير متوقع أثناء عملية تحويل الـ SVGA إلى GIF.');
    } finally {
      // Clean up object URLs
      Object.values(imageElements).forEach((img) => {
        if (img.src) URL.revokeObjectURL(img.src);
      });
      setIsConverting(false);
    }
  };

  const convertSvgaToJson = async () => {
    if (!inputFile) return;

    setIsConverting(true);
    setProgress(10);
    setErrorText('');
    setStatusText('جاري فك ضغط ملف الـ SVGA...');

    try {
      const arrayBuffer = await inputFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // 1. Inflate Zlib stream
      let inflated: Uint8Array;
      try {
        inflated = pako.inflate(uint8Array);
      } catch (e) {
        throw new Error('فشل فك ضغط الملف. تأكد من أن الملف هو ملف SVGA 2.0 صالح وغير معطوب.');
      }

      setProgress(40);
      setStatusText('جاري قراءة بنية البروتوكول وفك الترميز...');

      // 2. Decode using SVGA Schema
      const root = parse(svgaSchema).root;
      const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
      const message = MovieEntity.decode(inflated) as any;

      if (!message) {
        throw new Error('بنية الـ SVGA غير صالحة ولا يمكن فك تشفيرها.');
      }

      setProgress(60);
      setStatusText('جاري تحويل البيانات وتجهيز ملف الـ JSON المنسق...');

      // Convert to clean JSON object
      const jsonObject = MovieEntity.toObject(message, {
        defaults: true,
        arrays: true,
        objects: true,
        enums: String
      });

      // Convert image buffers/Uint8Array to Base64 so they can be viewed/used easily
      if (jsonObject.images) {
        const base64Images: Record<string, string> = {};
        for (const [key, val] of Object.entries(jsonObject.images)) {
          if (val instanceof Uint8Array || ArrayBuffer.isView(val)) {
            const arr = val as Uint8Array;
            let binary = '';
            const len = arr.byteLength;
            const chunk = 8192;
            for (let i = 0; i < len; i += chunk) {
              binary += String.fromCharCode.apply(null, arr.subarray(i, i + chunk) as any);
            }
            base64Images[key] = btoa(binary);
          } else if (typeof val === 'string') {
            base64Images[key] = val;
          } else {
            base64Images[key] = String(val);
          }
        }
        jsonObject.images = base64Images;
      }

      setProgress(85);
      setStatusText('جاري تنسيق وإنتاج ملف الـ JSON النهائي...');

      const jsonString = JSON.stringify(jsonObject, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      const originalName = inputFile.name.substring(0, inputFile.name.lastIndexOf('.')) || 'converted';
      setOutputFileName(`${originalName}.json`);
      setOutputBlob(blob);
      setProgress(100);
      setStatusText('اكتمل التحويل إلى JSON بنجاح!');
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'حدث خطأ غير متوقع أثناء عملية تحويل الـ SVGA إلى JSON.');
    } finally {
      setIsConverting(false);
    }
  };

  const convertJsonToSvga = async () => {
    if (!inputFile) return;

    setIsConverting(true);
    setProgress(10);
    setErrorText('');
    setStatusText('جاري قراءة ملف الـ JSON وتحليل البيانات...');

    try {
      const text = await inputFile.text();
      let jsonObject: any;
      try {
        jsonObject = JSON.parse(text);
      } catch (e) {
        throw new Error('ملف الـ JSON غير صالح. يرجى التأكد من أن الملف مكتوب بتنسيق JSON صحيح ولا يحتوي على أخطاء هيكلية.');
      }

      setProgress(30);
      setStatusText('جاري معالجة وتجهيز ملفات الصور المدمجة...');

      // Convert Base64 images back to Uint8Arrays if needed
      if (jsonObject.images) {
        const decodedImages: Record<string, Uint8Array> = {};
        for (const [key, val] of Object.entries(jsonObject.images)) {
          if (typeof val === 'string') {
            try {
              const base64Clean = val.replace(/^data:image\/[a-z]+;base64,/, "");
              const binaryString = atob(base64Clean);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              decodedImages[key] = bytes;
            } catch (e) {
              throw new Error(`فشل تحويل الصورة المدمجة "${key}" من ترميز Base64. يرجى التأكد من سلامة ترميز الصور.`);
            }
          } else if (val instanceof Uint8Array || ArrayBuffer.isView(val)) {
            decodedImages[key] = new Uint8Array(val as any);
          } else {
            throw new Error(`تنسيق الصورة "${key}" غير مدعوم في ملف الـ JSON.`);
          }
        }
        jsonObject.images = decodedImages;
      }

      setProgress(60);
      setStatusText('جاري بناء وترميز هيكل البروتوكول لـ SVGA (Protobuf)...');

      // Validate and encode with Protobuf
      const root = parse(svgaSchema).root;
      const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");

      // Verify basic required fields are present or provide fallback
      if (!jsonObject.version) {
        jsonObject.version = "2.0";
      }
      if (!jsonObject.params) {
        jsonObject.params = { viewBoxWidth: 300, viewBoxHeight: 300, fps: 20, frames: 1 };
      }

      const message = MovieEntity.create(jsonObject);
      const buffer = MovieEntity.encode(message).finish();

      setProgress(80);
      setStatusText('جاري ضغط الملف الناتج (Pako Deflate)...');

      // Compress with pako
      const pakoLevel = Math.min(9, Math.max(0, Math.floor(compressionRatio / 10)));
      const deflated = pako.deflate(buffer, { level: pakoLevel as any });

      setProgress(100);
      setStatusText('اكتمل تحويل الـ JSON إلى SVGA بنجاح!');

      const finalBlob = new Blob([deflated], { type: 'application/octet-stream' });
      setOutputBlob(finalBlob);
      
      const originalName = inputFile.name.substring(0, inputFile.name.lastIndexOf('.')) || 'converted';
      setOutputFileName(`${originalName}.svga`);

    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'حدث خطأ غير متوقع أثناء عملية تحويل الـ JSON إلى SVGA.');
    } finally {
      setIsConverting(false);
    }
  };

  const startConversion = () => {
    if (conversionType === 'apng-to-svga') {
      convertApngToSvga();
    } else if (conversionType === 'gif-to-svga') {
      convertGifToSvga();
    } else if (conversionType === 'svga-to-apng') {
      convertSvgaToApng();
    } else if (conversionType === 'svga-to-gif') {
      convertSvgaToGif();
    } else if (conversionType === 'svga-to-json') {
      convertSvgaToJson();
    } else {
      convertJsonToSvga();
    }
  };

  const triggerDownload = () => {
    if (!outputBlob) return;
    const url = URL.createObjectURL(outputBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outputFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8" dir="rtl">
      {/* Tab Selector & Title */}
      <div className="flex flex-col gap-6 border-b border-slate-800/80 pb-6">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight mb-2 flex items-center gap-3">
            <Layers className="text-indigo-500" size={32} />
            تحويل الصيغ الاحترافي
          </h2>
          <p className="text-slate-400 text-xs">
            أداة متقدمة للتحويل السريع بين صور الـ APNG والـ GIF المتحركة وملفات الفلاش التفاعلية SVGA.
          </p>
        </div>

        {/* Conversion Type Mode Switcher */}
        <div className="bg-slate-900/40 p-2 rounded-[1.5rem] md:rounded-[2rem] border border-slate-800/80 grid grid-cols-2 md:grid-cols-6 gap-2 w-full">
          <button
            onClick={() => handleTypeChange('apng-to-svga')}
            disabled={isConverting}
            className={`px-3 py-2.5 rounded-[1.25rem] text-[10px] sm:text-xs font-black transition-all whitespace-nowrap text-center ${
              conversionType === 'apng-to-svga'
                ? 'bg-indigo-600 text-white shadow-[0_4px_15px_rgba(99,102,241,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            APNG → SVGA
          </button>
          <button
            onClick={() => handleTypeChange('svga-to-apng')}
            disabled={isConverting}
            className={`px-3 py-2.5 rounded-[1.25rem] text-[10px] sm:text-xs font-black transition-all whitespace-nowrap text-center ${
              conversionType === 'svga-to-apng'
                ? 'bg-indigo-600 text-white shadow-[0_4px_15px_rgba(99,102,241,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            SVGA → APNG
          </button>
          <button
            onClick={() => handleTypeChange('gif-to-svga')}
            disabled={isConverting}
            className={`px-3 py-2.5 rounded-[1.25rem] text-[10px] sm:text-xs font-black transition-all whitespace-nowrap text-center ${
              conversionType === 'gif-to-svga'
                ? 'bg-indigo-600 text-white shadow-[0_4px_15px_rgba(99,102,241,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            GIF → SVGA
          </button>
          <button
            onClick={() => handleTypeChange('svga-to-gif')}
            disabled={isConverting}
            className={`px-3 py-2.5 rounded-[1.25rem] text-[10px] sm:text-xs font-black transition-all whitespace-nowrap text-center ${
              conversionType === 'svga-to-gif'
                ? 'bg-indigo-600 text-white shadow-[0_4px_15px_rgba(99,102,241,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            SVGA → GIF
          </button>
          <button
            onClick={() => handleTypeChange('json-to-svga')}
            disabled={isConverting}
            className={`px-3 py-2.5 rounded-[1.25rem] text-[10px] sm:text-xs font-black transition-all whitespace-nowrap text-center ${
              conversionType === 'json-to-svga'
                ? 'bg-indigo-600 text-white shadow-[0_4px_15px_rgba(99,102,241,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            JSON → SVGA
          </button>
          <button
            onClick={() => handleTypeChange('svga-to-json')}
            disabled={isConverting}
            className={`px-3 py-2.5 rounded-[1.25rem] text-[10px] sm:text-xs font-black transition-all whitespace-nowrap text-center ${
              conversionType === 'svga-to-json'
                ? 'bg-indigo-600 text-white shadow-[0_4px_15px_rgba(99,102,241,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            SVGA → JSON
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Main Workspace */}
        <div className="md:col-span-7 space-y-6">
          {!inputFile ? (
            /* Upload DropZone */
            <div 
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-800 bg-slate-900/30 hover:bg-slate-900/50 hover:border-indigo-500/50 rounded-[2.5rem] p-12 text-center cursor-pointer transition-all duration-300 group relative overflow-hidden flex flex-col items-center justify-center min-h-[350px]"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2"></div>
              
              <div className="w-20 h-20 bg-indigo-600/10 rounded-3xl flex items-center justify-center text-indigo-500 mb-6 border border-indigo-500/20 group-hover:scale-110 transition-transform">
                <Upload size={36} />
              </div>
              
              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                {conversionType === 'apng-to-svga' 
                  ? 'قم بسحب وإفلات ملف الـ APNG هنا' 
                  : conversionType === 'gif-to-svga'
                    ? 'قم بسحب وإفلات ملف الـ GIF هنا'
                    : conversionType === 'json-to-svga'
                      ? 'قم بسحب وإفلات ملف الـ JSON هنا'
                      : 'قم بسحب وإفلات ملف الـ SVGA هنا'}
              </h3>
              <p className="text-slate-500 text-xs max-w-sm mx-auto leading-relaxed">
                {conversionType === 'apng-to-svga'
                  ? 'أو انقر لتصفح ملفات جهازك. ندعم ملفات PNG المتحركة وملفات APNG المخصصة.'
                  : conversionType === 'gif-to-svga'
                    ? 'أو انقر لتصفح ملفات جهازك. ندعم ملفات GIF المتحركة.'
                    : conversionType === 'json-to-svga'
                      ? 'أو انقر لتصفح ملفات جهازك. ندعم ملفات JSON منسقة لـ SVGA.'
                      : 'أو انقر لتصفح ملفات جهازك. ندعم ملفات SVGA الإصدار 2.0.'}
              </p>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                accept={
                  conversionType === 'apng-to-svga' 
                    ? 'image/png,image/apng' 
                    : conversionType === 'gif-to-svga'
                      ? 'image/gif'
                      : conversionType === 'json-to-svga' 
                        ? 'application/json,.json' 
                        : '.svga'
                } 
                className="hidden" 
              />
            </div>
          ) : (
            /* Active File Preview & Conversion Area */
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2"></div>
              
              <div className="flex flex-col md:flex-row items-center gap-6 pb-6 border-b border-slate-800/80 mb-6">
                <div className="relative w-36 h-36 bg-slate-950/50 border border-slate-800 rounded-2xl overflow-hidden flex items-center justify-center">
                  {conversionType === 'apng-to-svga' ? (
                    <img src={inputUrl} alt="APNG preview" className="max-w-full max-h-full object-contain" />
                  ) : conversionType === 'gif-to-svga' ? (
                    <img src={inputUrl} alt="GIF preview" className="max-w-full max-h-full object-contain" />
                  ) : conversionType === 'json-to-svga' ? (
                    <div className="flex flex-col items-center justify-center p-4 text-indigo-400">
                      <Layers size={40} className="mb-2" />
                      <span className="text-[10px] font-bold text-slate-400">ملف JSON</span>
                    </div>
                  ) : (
                    <div 
                      id="svga-player-container"
                      ref={previewContainerRef}
                      className="w-full h-full pointer-events-none flex items-center justify-center relative overflow-hidden" 
                    />
                  )}
                  <div className="absolute top-2 right-2 bg-indigo-500/90 text-white font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-widest">
                    {conversionType === 'apng-to-svga' ? 'APNG' : conversionType === 'gif-to-svga' ? 'GIF' : conversionType === 'json-to-svga' ? 'JSON' : 'SVGA'}
                  </div>
                </div>
                
                <div className="flex-1 w-full text-right flex flex-col items-start md:items-start">
                  <h4 className="text-lg font-black text-white truncate max-w-full mb-1 text-right w-full" style={{ direction: 'rtl' }}>{inputFile.name}</h4>
                  <p className="text-slate-500 text-xs mb-3 text-right w-full" style={{ direction: 'rtl' }}>حجم الملف: {(inputFile.size / 1024 / 1024).toFixed(2)} ميجابايت</p>
                  
                  <button 
                    onClick={resetConverter} 
                    disabled={isConverting}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-full text-[11px] font-black flex items-center gap-2 transition-all active:scale-95"
                  >
                    <RefreshCw size={14} />
                    تغيير الملف
                  </button>
                </div>
              </div>

              {/* Conversion Actions & Progress */}
              <div className="space-y-6">
                {isConverting ? (
                  <div className="space-y-4 py-6">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                      <span>{statusText}</span>
                      <span className="text-indigo-400 font-mono">{progress}%</span>
                    </div>
                    
                    <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden p-[1px] border border-white/5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className="h-full bg-gradient-to-l from-indigo-500 to-indigo-600 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                      />
                    </div>
                    
                    <div className="flex items-center justify-center gap-2 text-indigo-400 text-xs font-bold">
                      <Loader2 className="animate-spin" size={16} />
                      جاري التحويل، يرجى الانتظار وعدم إغلاق الصفحة...
                    </div>
                  </div>
                ) : outputBlob ? (
                  /* Success & Download */
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center space-y-4">
                    <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                      <Download size={24} />
                    </div>
                    <div>
                      <h4 className="text-white font-black text-sm">تم تحويل الملف بنجاح!</h4>
                      <p className="text-slate-400 text-xs mt-1">اسم الملف المستهدف: <span className="font-mono text-indigo-400">{outputFileName}</span></p>
                    </div>
                    
                    <div className="flex justify-center gap-3 pt-2">
                      <button 
                        onClick={triggerDownload}
                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-full flex items-center gap-2 transition-all shadow-[0_4px_15px_rgba(16,185,129,0.2)] active:scale-95"
                      >
                        <Download size={16} />
                        تحميل الملف الناتج
                      </button>
                      <button 
                        onClick={resetConverter}
                        className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black text-xs rounded-full flex items-center gap-2 transition-all active:scale-95"
                      >
                        <RefreshCw size={16} />
                        تحويل ملف آخر
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Convert trigger button */
                  <button 
                    onClick={startConversion}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-full flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(99,102,241,0.25)] active:scale-95 text-sm"
                  >
                    <Play size={18} fill="currentColor" />
                    {conversionType === 'apng-to-svga' 
                      ? 'بدء عملية التحويل إلى SVGA' 
                      : conversionType === 'gif-to-svga'
                        ? 'بدء عملية التحويل إلى SVGA'
                        : conversionType === 'svga-to-apng'
                          ? 'بدء عملية التحويل إلى APNG'
                          : conversionType === 'svga-to-gif'
                            ? 'بدء عملية التحويل إلى GIF'
                            : conversionType === 'svga-to-json'
                              ? 'بدء تحويل وتصدير JSON المنسق'
                              : 'بدء تحويل وتجميع ملف الـ SVGA'}
                  </button>
                )}

                {errorText && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
                    <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
                    <p className="text-red-400 text-xs font-bold leading-relaxed">{errorText}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Configurations Panel */}
        <div className="md:col-span-5">
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-[2.5rem] p-8 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-600/5 blur-3xl rounded-full -translate-y-1/2 -translate-x-1/2"></div>
            
            <h3 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-800 pb-4">
              <Settings className="text-indigo-400" size={20} />
              إعدادات ومحددات التحويل
            </h3>

            {conversionType === 'apng-to-svga' || conversionType === 'gif-to-svga' ? (
              /* Mode 1 Settings */
              <div className="space-y-6">
                {/* FPS Mode */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider block">سرعة الفريمات (FPS)</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-1 rounded-2xl border border-white/5">
                    <button 
                      onClick={() => setFpsMode('auto')}
                      disabled={isConverting}
                      className={`py-2 px-1 whitespace-nowrap rounded-xl text-[10px] sm:text-xs font-bold transition-all ${fpsMode === 'auto' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      تلقائي (حسب الملف)
                    </button>
                    <button 
                      onClick={() => setFpsMode('custom')}
                      disabled={isConverting}
                      className={`py-2 px-1 whitespace-nowrap rounded-xl text-[10px] sm:text-xs font-bold transition-all ${fpsMode === 'custom' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      مخصص (تثبيت السرعة)
                    </button>
                  </div>

                  {fpsMode === 'custom' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="flex flex-col gap-2 pt-2"
                    >
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>السرعة المستهدفة</span>
                        <span className="text-indigo-400 font-bold">{customFps} إطار/ثانية</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="60" 
                        value={customFps} 
                        disabled={isConverting}
                        onChange={(e) => setCustomFps(Number(e.target.value))}
                        className="w-full accent-indigo-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/10 transition-all hover:bg-white/30 focus:outline-none focus:border-indigo-500/50"
                      />
                    </motion.div>
                  )}
                </div>

                {/* Image Quality */}
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-black text-slate-400">
                    <span>جودة الصور المضغوطة</span>
                    <span className="text-indigo-400 font-mono">{imageQuality}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="30" 
                    max="100" 
                    value={imageQuality} 
                    disabled={isConverting}
                    onChange={(e) => setImageQuality(Number(e.target.value))}
                    className="w-full accent-indigo-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/10 transition-all hover:bg-white/30 focus:outline-none focus:border-indigo-500/50"
                  />
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    تعديل دقة وجودة صور الفريمات الفردية لتقليل الحجم الكلي لملف الـ SVGA الناتج بشكل ملحوظ.
                  </p>
                </div>

                {/* Compression Ratio */}
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-black text-slate-400">
                    <span>نسبة الضغط الكلية (Deflate)</span>
                    <span className="text-indigo-400 font-mono">{compressionRatio}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="100" 
                    value={compressionRatio} 
                    disabled={isConverting}
                    onChange={(e) => setCompressionRatio(Number(e.target.value))}
                    className="w-full accent-indigo-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/10 transition-all hover:bg-white/30 focus:outline-none focus:border-indigo-500/50"
                  />
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    مستوى الضغط لخوارزمية zlib/pako المدمجة. قيم أعلى تزيد جودة الضغط وتقلل حجم الملف مع زيادة طفيفة في زمن المعالجة.
                  </p>
                </div>
              </div>
            ) : (conversionType === 'svga-to-apng' || conversionType === 'svga-to-gif') ? (
              /* Mode 2: SVGA to APNG/GIF Settings */
              <div className="space-y-6">
                {/* APNG/GIF FPS Mode */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider block">سرعة الفريمات (FPS)</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-1 rounded-2xl border border-white/5">
                    <button 
                      onClick={() => setApngFpsMode('auto')}
                      disabled={isConverting}
                      className={`py-2 px-1 whitespace-nowrap rounded-xl text-[10px] sm:text-xs font-bold transition-all ${apngFpsMode === 'auto' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      تلقائي (حسب الـ SVGA)
                    </button>
                    <button 
                      onClick={() => setApngFpsMode('custom')}
                      disabled={isConverting}
                      className={`py-2 px-1 whitespace-nowrap rounded-xl text-[10px] sm:text-xs font-bold transition-all ${apngFpsMode === 'custom' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      مخصص (تعديل السرعة)
                    </button>
                  </div>

                  {apngFpsMode === 'custom' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="flex flex-col gap-2 pt-2"
                    >
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>{conversionType === 'svga-to-apng' ? 'السرعة المستهدفة للـ APNG' : 'السرعة المستهدفة للـ GIF'}</span>
                        <span className="text-indigo-400 font-bold">{apngCustomFps} إطار/ثانية</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="60" 
                        value={apngCustomFps} 
                        disabled={isConverting}
                        onChange={(e) => setApngCustomFps(Number(e.target.value))}
                        className="w-full accent-indigo-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/10 transition-all hover:bg-white/30 focus:outline-none focus:border-indigo-500/50"
                      />
                    </motion.div>
                  )}
                </div>

                {conversionType === 'svga-to-apng' && (
                  <>
                    {/* Compression Mode */}
                    <div className="space-y-3">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-wider block">نوع جودة الضغط للـ APNG</label>
                      <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-1 rounded-2xl border border-white/5">
                        <button 
                          onClick={() => setApngCompressMode('lossless')}
                          disabled={isConverting}
                          className={`py-2 px-1 whitespace-nowrap rounded-xl text-[10px] sm:text-xs font-bold transition-all ${apngCompressMode === 'lossless' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          جودة فائقة (Lossless)
                        </button>
                        <button 
                          onClick={() => setApngCompressMode('lossy')}
                          disabled={isConverting}
                          className={`py-2 px-1 whitespace-nowrap rounded-xl text-[10px] sm:text-xs font-bold transition-all ${apngCompressMode === 'lossy' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          ضغط ذكي للحجم (Lossy)
                        </button>
                      </div>
                    </div>

                    {/* Colors palette limit (for lossy compression) */}
                    {apngCompressMode === 'lossy' && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-3 pt-2"
                      >
                        <div className="flex justify-between text-xs font-black text-slate-400">
                          <span>الحد الأقصى للألوان باللوحة</span>
                          <span className="text-indigo-400 font-mono">{apngColorsCount} لون</span>
                        </div>
                        <input 
                          type="range" 
                          min="2" 
                          max="256" 
                          value={apngColorsCount} 
                          disabled={isConverting}
                          onChange={(e) => setApngColorsCount(Number(e.target.value))}
                          className="w-full accent-indigo-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/10 transition-all hover:bg-white/30 focus:outline-none focus:border-indigo-500/50"
                        />
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          تخفيض عدد الألوان في لوحة الألوان (Color Palette) يقلل من حجم ملف الـ APNG الناتج بنسبة تصل إلى 70%، مع تضحية طفيفة جداً في دقة الألوان.
                        </p>
                      </motion.div>
                    )}
                  </>
                )}

                {conversionType === 'svga-to-gif' && (
                  <div className="p-4 bg-slate-950/50 rounded-2xl border border-white/5 space-y-2">
                    <h4 className="text-xs font-black text-indigo-400 block">معلومات التصدير إلى GIF</h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      يتم تحويل ملف الـ SVGA التفاعلي إلى تنسيق GIF متحرك قياسي يدعم الشفافية مع الحفاظ على الألوان والحركة الانسيابية.
                    </p>
                  </div>
                )}
              </div>
            ) : conversionType === 'svga-to-json' ? (
              /* Mode 3: SVGA to JSON Settings */
              <div className="space-y-6">
                <div className="p-4 bg-slate-950/50 rounded-2xl border border-white/5 space-y-3">
                  <h4 className="text-xs font-black text-indigo-400 uppercase tracking-wider block">معلومات التصدير إلى JSON</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    تقوم هذه الأداة بفك ضغط ملف الـ SVGA وفك ترميز بيانات الـ Protobuf بالكامل وتحويلها إلى كائن JSON منسق ومفهوم.
                  </p>
                  <ul className="text-[10px] text-slate-500 space-y-2 list-disc list-inside">
                    <li>تصدير جميع محددات المشهد (FPS، الأبعاد، عدد الفريمات).</li>
                    <li>تصدير الطبقات والعناصر المتحركة والـ Sprite entities.</li>
                    <li>تشفير الصور الداخلية والرموز الرسومية المدمجة كـ Base64.</li>
                    <li>مثالي لمطوري الألعاب وتطبيقات الموبايل لمعاينة البنية الرياضية للملف.</li>
                  </ul>
                </div>
              </div>
            ) : (
              /* Mode 4: JSON to SVGA Settings */
              <div className="space-y-6">
                {/* SVGA Compression Ratio */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">نسبة الضغط المستهدفة (Deflate)</span>
                    <span className="text-xs font-mono text-indigo-400 font-bold">{compressionRatio}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="100" 
                    step="10"
                    value={compressionRatio}
                    disabled={isConverting}
                    onChange={(e) => setCompressionRatio(Number(e.target.value))}
                    className="w-full accent-indigo-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/10 transition-all hover:bg-white/30 focus:outline-none focus:border-indigo-500/50"
                  />
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    مستوى ضغط Zlib/Pako لضغط دفق البيانات المشفر قبل حفظه كملف SVGA قياسي.
                  </p>
                </div>

                <div className="p-4 bg-slate-950/50 rounded-2xl border border-white/5 space-y-3">
                  <h4 className="text-xs font-black text-indigo-400 uppercase tracking-wider block">معلومات تحويل JSON إلى SVGA</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    تقوم هذه الأداة ببناء وتجميع ملف SVGA حقيقي متوافق بالكامل مع مشغلات SVGA من كائن الـ JSON الخاص بك.
                  </p>
                  <ul className="text-[10px] text-slate-500 space-y-2 list-disc list-inside">
                    <li>تفسير بيانات المشهد والأنيميشن وإعدادات الفريمات والـ Sprite layers.</li>
                    <li>فك ترميز وتشفير صور Base64 المدمجة وإعادتها كصور ثنائية نقية داخل الحاوية.</li>
                    <li>بناء رسائل البروتوكول (Protobuf Block) المتوافقة كلياً مع معيار SVGA.</li>
                    <li>ضغط ملف الـ SVGA النهائي للحصول على أصغر حجم ممكن وبأقصى سرعة تحميل.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
