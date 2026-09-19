import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Download, 
  Settings, 
  Loader2, 
  Play, 
  Pause, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  RefreshCw, 
  FileImage, 
  X, 
  Film,
  Info
} from 'lucide-react';
import * as UPNG from 'upng-js';
import { motion, AnimatePresence } from 'motion/react';

interface FrameItem {
  id: string;
  name: string;
  size: number;
  url: string;
  delay: number; // delay in milliseconds
  width: number;
  height: number;
}

export const APNGCreator: React.FC = () => {
  const [frames, setFrames] = useState<FrameItem[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [globalDelay, setGlobalDelay] = useState<number>(100); // 100ms = 10 FPS
  const [isIndividualDelay, setIsIndividualDelay] = useState(false);
  
  // Encoding Settings
  const [qualityMode, setQualityMode] = useState<'lossless' | 'quantized'>('lossless');
  const [colorsCount, setColorsCount] = useState<number>(256);
  const [fitMode, setFitMode] = useState<'fit' | 'stretch'>('fit');
  const [customWidth, setCustomWidth] = useState<number>(0);
  const [customHeight, setCustomHeight] = useState<number>(0);
  const [dimensionMode, setDimensionMode] = useState<'first' | 'max' | 'custom'>('first');
  
  const [isEncoding, setIsEncoding] = useState(false);
  const [encodingProgress, setEncodingProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorText, setErrorText] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-detect resolution based on dimension mode
  const getTargetDimensions = () => {
    if (frames.length === 0) return { w: 0, h: 0 };
    if (dimensionMode === 'first') {
      return { w: frames[0].width, h: frames[0].height };
    } else if (dimensionMode === 'max') {
      let maxW = 0;
      let maxH = 0;
      frames.forEach(f => {
        if (f.width > maxW) maxW = f.width;
        if (f.height > maxH) maxH = f.height;
      });
      return { w: maxW, h: maxH };
    } else {
      return { w: customWidth || 500, h: customHeight || 500 };
    }
  };

  const targetDim = getTargetDimensions();

  // Load image dimensions helper
  const getImageDimensions = (url: string): Promise<{ w: number; h: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ w: img.naturalWidth, h: img.naturalHeight });
      };
      img.onerror = () => {
        resolve({ w: 300, h: 300 });
      };
      img.src = url;
    });
  };

  // Handle files upload
  const handleFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processUploadedFiles(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processUploadedFiles = async (fileList: File[]) => {
    setErrorText('');
    const validImageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    const imageFiles = fileList.filter(file => validImageTypes.includes(file.type) || file.name.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/i));

    if (imageFiles.length === 0) {
      setErrorText('يرجى رفع صور صالحة بصيغة PNG أو JPG أو WEBP.');
      return;
    }

    const newFrames: FrameItem[] = [];
    for (const file of imageFiles) {
      const url = URL.createObjectURL(file);
      const dims = await getImageDimensions(url);
      newFrames.push({
        id: Math.random().toString(36).substring(2, 9),
        name: file.name,
        size: file.size,
        url,
        delay: globalDelay,
        width: dims.w,
        height: dims.h,
      });
    }

    setFrames(prev => {
      const updated = [...prev, ...newFrames];
      // Set default custom dimensions if it's the first upload
      if (prev.length === 0 && newFrames.length > 0) {
        setCustomWidth(newFrames[0].width);
        setCustomHeight(newFrames[0].height);
      }
      return updated;
    });

    // Start playing if was empty
    if (frames.length === 0 && newFrames.length > 0) {
      setIsPlaying(true);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processUploadedFiles(Array.from(e.dataTransfer.files));
    }
  };

  // Sync refs to avoid breaking animation loop when dragging sliders
  const globalDelayRef = useRef(globalDelay);
  const isIndividualDelayRef = useRef(isIndividualDelay);
  const framesRef = useRef(frames);

  useEffect(() => {
    globalDelayRef.current = globalDelay;
  }, [globalDelay]);

  useEffect(() => {
    isIndividualDelayRef.current = isIndividualDelay;
  }, [isIndividualDelay]);

  useEffect(() => {
    framesRef.current = frames;
  }, [frames]);

  // Preview animation logic
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;

    const currentFrame = framesRef.current[currentPreviewIndex];
    const rawDelay = isIndividualDelayRef.current ? (currentFrame?.delay || globalDelayRef.current) : globalDelayRef.current;
    
    // Unrestricted speed (minimum 1ms)
    const delay = Math.max(1, rawDelay);

    const timer = setTimeout(() => {
      setCurrentPreviewIndex(prev => (prev + 1) % framesRef.current.length);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [isPlaying, currentPreviewIndex, frames.length]);

  // If frame index exceeds bounds
  useEffect(() => {
    if (currentPreviewIndex >= frames.length) {
      setCurrentPreviewIndex(0);
    }
  }, [frames.length, currentPreviewIndex]);

  // Frame action helpers
  const moveFrame = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === frames.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    setFrames(prev => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return updated;
    });

    if (currentPreviewIndex === index) {
      setCurrentPreviewIndex(targetIndex);
    } else if (currentPreviewIndex === targetIndex) {
      setCurrentPreviewIndex(index);
    }
  };

  const removeFrame = (id: string, index: number) => {
    setFrames(prev => prev.filter(f => f.id !== id));
    if (currentPreviewIndex === index) {
      setCurrentPreviewIndex(0);
    }
  };

  const updateFrameDelay = (index: number, delay: number) => {
    setFrames(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], delay };
      return updated;
    });
  };

  const clearAll = () => {
    frames.forEach(f => URL.revokeObjectURL(f.url));
    setFrames([]);
    setCurrentPreviewIndex(0);
    setIsPlaying(false);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // APNG Encoding engine
  const createAPNG = async () => {
    if (frames.length === 0) {
      setErrorText('يرجى إضافة صورة واحدة على الأقل لصناعة ملف APNG.');
      return;
    }

    setIsEncoding(true);
    setEncodingProgress(10);
    setStatusText('جاري تحضير الإطارات وضبط المقاسات...');
    setErrorText('');

    try {
      const width = targetDim.w;
      const height = targetDim.h;

      // Offscreen canvas for frame resizing/normalization
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not create 2D canvas context');

      const bufs: ArrayBuffer[] = [];
      const dels: number[] = [];

      for (let i = 0; i < frames.length; i++) {
        setEncodingProgress(Math.floor(10 + (i / frames.length) * 50));
        setStatusText(`جاري معالجة الإطار ${i + 1} من ${frames.length}...`);

        const frame = frames[i];
        
        // Load image onto canvas synchronously/with Promise
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = (e) => reject(new Error(`Failed to load frame image: ${frame.name}`));
          image.src = frame.url;
        });

        // Clear canvas with complete transparency
        ctx.clearRect(0, 0, width, height);

        if (fitMode === 'stretch') {
          ctx.drawImage(img, 0, 0, width, height);
        } else {
          // Maintain Aspect Ratio Fit
          const imgRatio = img.naturalWidth / img.naturalHeight;
          const canvasRatio = width / height;
          let drawW = width;
          let drawH = height;
          let drawX = 0;
          let drawY = 0;

          if (imgRatio > canvasRatio) {
            drawW = width;
            drawH = width / imgRatio;
            drawY = (height - drawH) / 2;
          } else {
            drawH = height;
            drawW = height * imgRatio;
            drawX = (width - drawW) / 2;
          }

          ctx.drawImage(img, drawX, drawY, drawW, drawH);
        }

        // Get raw RGBA pixels from context
        const imgData = ctx.getImageData(0, 0, width, height);
        bufs.push(imgData.data.buffer);
        
        // Add delay (unrestricted, down to 1ms)
        const frameDelay = isIndividualDelay ? frame.delay : globalDelay;
        dels.push(Math.max(1, frameDelay));
      }

      setEncodingProgress(75);
      setStatusText('جاري تشفير ودمج الإطارات في ملف APNG واحد (UPNG Encoder)...');

      // Quantization color settings
      const cnum = qualityMode === 'lossless' ? 0 : colorsCount;

      // Run UPNG encode (takes bufs, width, height, colors_count, delays)
      // Note: delays in UPNG are passed as array in milliseconds
      const apngArrayBuffer = UPNG.encode(bufs, width, height, cnum, dels);

      setEncodingProgress(95);
      setStatusText('جاري إنشاء الملف النهائي للتحميل...');

      const apngBlob = new Blob([apngArrayBuffer], { type: 'image/png' });
      const downloadUrl = URL.createObjectURL(apngBlob);

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `animation_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setEncodingProgress(100);
      setStatusText('تم صناعة وتحميل ملف APNG بنجاح!');
      
      setTimeout(() => {
        setIsEncoding(false);
        setEncodingProgress(0);
        setStatusText('');
      }, 3000);

    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'حدث خطأ غير متوقع أثناء معالجة ملفات APNG.');
      setIsEncoding(false);
      setEncodingProgress(0);
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto" dir="rtl">
      {/* Description header */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full"></div>
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600/10 text-blue-400 p-2.5 rounded-2xl border border-blue-500/20">
                <Film size={24} />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white">صانع ملفات APNG المتحركة</h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              صانع رسوم APNG الاحترافي. يتيح لك دمج مجموعة صور متتالية (PNG / JPG / WEBP) لإنشاء صورة متحركة بصيغة APNG بدقة عالية للغاية وبأحجام ممتازة مع التحكم الكامل بكل تفصيل.
            </p>
          </div>
          {frames.length > 0 && (
            <button 
              onClick={clearAll}
              className="text-xs font-black text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-5 py-3 rounded-full border border-red-500/20 transition-all cursor-pointer align-self-start md:align-self-auto"
            >
              مسح كافة الإطارات
            </button>
          )}
        </div>
      </div>

      {frames.length === 0 ? (
        /* Empty Upload Zone */
        <div 
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-700/60 bg-slate-900/60 hover:bg-slate-900/80 hover:border-blue-500/60 rounded-[2.5rem] p-12 text-center cursor-pointer transition-all duration-300 group shadow-2xl relative overflow-hidden"
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            multiple 
            accept="image/png, image/jpeg, image/jpg, image/webp" 
            onChange={handleFilesUpload}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-blue-500/0 via-blue-500/0 to-blue-500/[0.01] opacity-0 group-hover:opacity-100 transition-opacity"></div>
          
          <div className="relative flex flex-col items-center gap-6">
            <div className="w-20 h-20 bg-blue-600/5 rounded-[2rem] flex items-center justify-center text-blue-500 border border-blue-500/10 group-hover:scale-110 group-hover:border-blue-500/20 transition-all duration-300 shadow-lg">
              <Upload size={36} />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-black text-white group-hover:text-blue-400 transition-colors">اسحب وأسقط الصور هنا</h3>
              <p className="text-slate-500 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
                أو انقر لاختيار مجموعة صور متتالية من جهازك. يدعم صيغ PNG, JPG, JPEG, WEBP.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900/60 border border-slate-800 rounded-2xl text-slate-400 text-xs font-bold font-mono">
              <Info size={14} className="text-blue-400" />
              سيتم دمج الصور بالتتابع الزمني لتشكيل حركة انسيابية.
            </div>
          </div>
        </div>
      ) : (
        /* Creator workspace */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Timeline and frames management (8 Columns) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800/60">
                <h3 className="font-bold text-white text-md flex items-center gap-2">
                  <span className="bg-blue-600/10 text-blue-400 px-3 py-1 text-xs font-black rounded-lg">{frames.length}</span>
                  إطارات الرسوم المتحركة
                </h3>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-black text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-4 py-2 rounded-xl border border-blue-500/20 transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <Plus size={14} />
                  إضافة صور إضافية
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  multiple 
                  accept="image/png, image/jpeg, image/jpg, image/webp" 
                  onChange={handleFilesUpload}
                />
              </div>

              {/* Scrollable grid list of frames */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent pl-2">
                {frames.map((frame, index) => {
                  return (
                    <div 
                      key={frame.id}
                      className="relative rounded-2xl border bg-slate-900/60 p-3 flex flex-col gap-3 transition-all group border-slate-800/80 hover:border-slate-700"
                    >
                      {/* Thumbnail frame view */}
                      <div className="aspect-square w-full rounded-xl overflow-hidden bg-slate-950/80 border border-slate-800 relative flex items-center justify-center">
                        <img 
                          src={frame.url} 
                          alt={`Frame ${index + 1}`} 
                          className="max-w-full max-h-full object-contain" 
                        />
                        <div className="absolute top-2 right-2 bg-slate-950/85 text-[10px] font-black text-white px-2 py-0.5 rounded-full border border-slate-800">
                          {index + 1}
                        </div>
                      </div>

                      {/* Info & delay adjustment */}
                      <div className="space-y-2">
                        <div className="text-[11px] font-medium text-slate-400 truncate text-left" dir="ltr" title={frame.name}>
                          {frame.name}
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                          <span>{frame.width}x{frame.height}</span>
                          <span>{formatSize(frame.size)}</span>
                        </div>

                        {/* Individual Delay overrides */}
                        {isIndividualDelay && (
                          <div className="flex items-center gap-1 bg-slate-950/60 border border-slate-800 rounded-xl px-2 py-1">
                            <span className="text-[10px] font-bold text-slate-400 shrink-0">تأخير:</span>
                            <input 
                              type="number" 
                              value={frame.delay} 
                              onChange={(e) => updateFrameDelay(index, Math.max(1, parseInt(e.target.value) || 100))}
                              className="w-full text-[10px] font-bold text-blue-400 bg-transparent border-0 p-0 text-center focus:ring-0 outline-none"
                              min="1"
                              step="10"
                            />
                            <span className="text-[9px] text-slate-500 font-bold">ms</span>
                          </div>
                        )}
                      </div>

                      {/* Tool Actions overlay */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => removeFrame(frame.id, index)}
                          className="p-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg text-white shadow-lg transition-all"
                          title="حذف الإطار"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-800/60 pt-2 mt-1 gap-1">
                        <button 
                          disabled={index === 0}
                          onClick={() => moveFrame(index, 'up')}
                          className="flex-1 py-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors flex justify-center disabled:opacity-20"
                          title="نقل للخلف"
                        >
                          <ArrowRightIcon size={12} />
                        </button>
                        <button 
                          disabled={index === frames.length - 1}
                          onClick={() => moveFrame(index, 'down')}
                          className="flex-1 py-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors flex justify-center disabled:opacity-20"
                          title="نقل للأمام"
                        >
                          <ArrowLeftIcon size={12} />
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Settings and Real-time Visualizer (4 Columns) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Real-time preview animation */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-6 shadow-xl flex flex-col gap-4">
              <h3 className="font-bold text-white text-md">معاينة الحركة الحية</h3>
              
              <div className="aspect-square w-full rounded-2xl bg-slate-950/80 border border-slate-800 relative flex items-center justify-center p-4">
                {frames[currentPreviewIndex] ? (
                  <img 
                    src={frames[currentPreviewIndex].url} 
                    alt="APNG Preview" 
                    className="max-w-full max-h-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]" 
                  />
                ) : (
                  <div className="text-slate-500 text-xs">لا يوجد إطارات للعرض</div>
                )}
                
                {/* Visual resolution dimension badge */}
                <div className="absolute bottom-3 right-3 bg-slate-950/85 text-[10px] font-mono text-blue-400 px-3 py-1 rounded-full border border-slate-800">
                  {targetDim.w}x{targetDim.h} px
                </div>

                {/* Progress bar line */}
                {frames.length > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800 rounded-b-2xl overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-100" 
                      style={{ width: `${((currentPreviewIndex + 1) / frames.length) * 100}%` }}
                    ></div>
                  </div>
                )}
              </div>

              {/* Player control buttons */}
              <div className="flex items-center justify-between gap-4">
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="flex-1 py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] bg-blue-600/10 border border-blue-500/20 text-blue-400 hover:bg-blue-600/20"
                >
                  {isPlaying ? (
                    <>
                      <Pause size={14} />
                      إيقاف
                    </>
                  ) : (
                    <>
                      <Play size={14} />
                      تشغيل العرض
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quality & Encoding Controls */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-6">
              <h3 className="font-bold text-white text-md flex items-center gap-2">
                <Settings size={18} className="text-blue-500" />
                إعدادات الرسوم والسرعة
              </h3>

              {/* Frame rate controller */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>تأخير الإطارات (بالميلي ثانية)</span>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number"
                      min="1"
                      max="1000"
                      value={globalDelay}
                      disabled={isIndividualDelay}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(1000, Number(e.target.value) || 100));
                        setGlobalDelay(val);
                      }}
                      className="w-16 px-2 py-1 text-center text-xs font-mono font-bold text-blue-400 bg-slate-950/80 border border-slate-700/50 rounded-lg focus:outline-none focus:border-blue-500/50"
                    />
                    <span className="text-blue-400 font-mono">ms</span>
                    <span className="text-slate-500 text-[10px]">({Math.round(1000 / globalDelay)} FPS)</span>
                  </div>
                </div>
                
                <input 
                  type="range" 
                  min="1" 
                  max="1000" 
                  step="1"
                  value={globalDelay} 
                  disabled={isIndividualDelay}
                  onChange={(e) => setGlobalDelay(Number(e.target.value))} 
                  className="w-full h-3 bg-slate-950/80 border border-white/30 rounded-full appearance-none cursor-pointer outline-none transition-all [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-md disabled:opacity-30"
                />
                
                <div className="flex items-center gap-2 mt-2">
                  <input 
                    type="checkbox" 
                    id="individual-delay"
                    checked={isIndividualDelay}
                    onChange={(e) => setIsIndividualDelay(e.target.checked)}
                    className="rounded border-slate-800 text-blue-500 focus:ring-0 bg-slate-950"
                  />
                  <label htmlFor="individual-delay" className="text-[11px] font-bold text-slate-400 cursor-pointer select-none">
                    استخدام توقيت منفصل مخصص لكل إطار
                  </label>
                </div>
              </div>

              {/* Quality options */}
              <div className="space-y-3 border-t border-slate-800/60 pt-4">
                <span className="text-xs font-bold text-slate-300 block">جودة تشفير الألوان</span>
                <div className="grid grid-cols-2 gap-2 bg-slate-950/40 p-1.5 rounded-xl border border-slate-800">
                  <button 
                    onClick={() => setQualityMode('lossless')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg transition-all ${qualityMode === 'lossless' ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    أعلى جودة (بدون فقد)
                  </button>
                  <button 
                    onClick={() => setQualityMode('quantized')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg transition-all ${qualityMode === 'quantized' ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    مضغوط (أصغر حجم)
                  </button>
                </div>

                {qualityMode === 'quantized' && (
                  <div className="space-y-2 mt-2 bg-slate-950/20 p-3 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                      <span>لوحة الألوان القصوى</span>
                      <span className="text-blue-400 font-mono">{colorsCount} لون</span>
                    </div>
                    <input 
                      type="range" 
                      min="2" 
                      max="256" 
                      value={colorsCount} 
                      onChange={(e) => setColorsCount(Number(e.target.value))} 
                      className="w-full h-3 bg-slate-950/80 border border-white/30 rounded-full appearance-none cursor-pointer outline-none transition-all [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-md"
                    />
                  </div>
                )}
              </div>

              {/* Encoding action and feedback */}
              <div className="border-t border-slate-800/60 pt-6 space-y-4">
                {errorText && (
                  <p className="text-red-400 text-[10px] font-bold text-center bg-red-500/10 py-2.5 px-3 rounded-xl border border-red-500/15 leading-relaxed">
                    {errorText}
                  </p>
                )}

                {isEncoding ? (
                  <div className="space-y-3 bg-slate-950/40 p-4 rounded-2xl border border-slate-800">
                    <div className="flex justify-between items-center text-xs font-black text-slate-400">
                      <span className="flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin text-blue-500" />
                        {statusText}
                      </span>
                      <span className="font-mono text-blue-400">{encodingProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-300" 
                        style={{ width: `${encodingProgress}%` }}
                      ></div>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={createAPNG}
                    className="w-full py-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 font-black text-sm rounded-full transition-all flex items-center justify-center gap-2 shadow-none active:scale-[0.98] cursor-pointer"
                  >
                    <Download size={18} />
                    تحميل APNG
                  </button>
                )}
              </div>

            </div>

          </div>

        </div>
      )}
    </div>
  );
};

// Internal minimal Arrow icons for frame ordering
const ArrowRightIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ArrowLeftIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);
