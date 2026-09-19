
import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, Image as ImageIcon, X, Circle, Square, Loader2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const ImageEditor: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isCircleMask, setIsCircleMask] = useState<boolean>(false);
  const [isSquareMask, setIsSquareMask] = useState<boolean>(false);
  const [isRoundedSquareMask, setIsRoundedSquareMask] = useState<boolean>(false);
  const [squareTopOnly, setSquareTopOnly] = useState<boolean>(false);
  const [squareBottomOnly, setSquareBottomOnly] = useState<boolean>(false);
  const [feather, setFeather] = useState<number>(20);
  const [roundedRadius, setRoundedRadius] = useState<number>(20);
  const [roundedFeather, setRoundedFeather] = useState<number>(20);
  const [vOffset, setVOffset] = useState<number>(50); // Vertical offset in percentage (0 = top, 50 = center, 100 = bottom)
  const [isProcessing, setIsProcessing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      
      const img = new Image();
      img.src = url;
      img.onload = () => {
        originalImageRef.current = img;
        applyMask();
      };
    }
  };

  const applyMask = () => {
    if (!originalImageRef.current || !canvasRef.current) return;
    
    const img = originalImageRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use a square aspect ratio for the mask operations
    const size = Math.min(img.width, img.height);
    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);

    // Draw the image centered and cropped to square
    const offsetX = (img.width - size) / 2;
    
    // Calculate offsetY based on vOffset percentage
    // Total scrollable distance is img.height - size
    const scrollableH = img.height - size;
    const offsetY = scrollableH > 0 ? (scrollableH * (vOffset / 100)) : 0;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = size;
    tempCanvas.height = size;
    const tctx = tempCanvas.getContext('2d');
    if (!tctx) return;

    tctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, size, size);

    if (isCircleMask) {
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = size;
      maskCanvas.height = size;
      const mctx = maskCanvas.getContext('2d');
      if (!mctx) return;

      const centerX = size / 2;
      const centerY = size / 2;
      const radius = size / 2;

      const grad = mctx.createRadialGradient(centerX, centerY, radius * (1 - feather/100), centerX, centerY, radius);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');

      mctx.fillStyle = grad;
      mctx.beginPath();
      mctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      mctx.fill();

      tctx.globalCompositeOperation = 'destination-in';
      tctx.drawImage(maskCanvas, 0, 0);
      tctx.globalCompositeOperation = 'source-over';
    } else if (isSquareMask) {
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = size;
      maskCanvas.height = size;
      const mctx = maskCanvas.getContext('2d');
      if (!mctx) return;

      mctx.fillStyle = 'black';
      mctx.fillRect(0, 0, size, size);
      mctx.globalCompositeOperation = 'destination-out';

      const f = (size / 2) * (feather / 100);

      if (squareTopOnly) {
        // Top alone
        let grad = mctx.createLinearGradient(0, 0, 0, f);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = grad;
        mctx.fillRect(0, 0, size, f);
      } else if (squareBottomOnly) {
        // Bottom alone
        let grad = mctx.createLinearGradient(0, size, 0, size - f);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = grad;
        mctx.fillRect(0, size - f, size, size);
      } else {
        // All sides
        // Top
        let grad = mctx.createLinearGradient(0, 0, 0, f);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = grad;
        mctx.fillRect(0, 0, size, f);

        // Bottom
        grad = mctx.createLinearGradient(0, size, 0, size - f);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = grad;
        mctx.fillRect(0, size - f, size, size);

        // Left
        grad = mctx.createLinearGradient(0, 0, f, 0);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = grad;
        mctx.fillRect(0, 0, f, size);

        // Right
        grad = mctx.createLinearGradient(size, 0, size - f, 0);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = grad;
        mctx.fillRect(size - f, 0, size, size);
      }

      tctx.globalCompositeOperation = 'destination-in';
      tctx.drawImage(maskCanvas, 0, 0);
      tctx.globalCompositeOperation = 'source-over';
    } else if (isRoundedSquareMask) {
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = size;
      maskCanvas.height = size;
      const mctx = maskCanvas.getContext('2d');
      if (!mctx) return;

      mctx.fillStyle = 'black';
      
      // Calculate inset/blur based on feather
      const f = (size / 10) * (roundedFeather / 100); 
      const x = f;
      const y = f;
      const w = size - 2 * f;
      const h = size - 2 * f;
      
      const maxRadius = w / 2;
      const r = maxRadius * (roundedRadius / 100);

      mctx.beginPath();
      mctx.moveTo(x + r, y);
      mctx.arcTo(x + w, y, x + w, y + h, r);
      mctx.arcTo(x + w, y + h, x, y + h, r);
      mctx.arcTo(x, y + h, x, y, r);
      mctx.arcTo(x, y, x + w, y, r);
      mctx.closePath();
      mctx.fill();

      tctx.globalCompositeOperation = 'destination-in';
      if (roundedFeather > 0) {
        const blurCanvas = document.createElement('canvas');
        blurCanvas.width = size;
        blurCanvas.height = size;
        const bctx = blurCanvas.getContext('2d');
        if (bctx) {
          bctx.filter = `blur(${f}px)`;
          bctx.drawImage(maskCanvas, 0, 0);
          tctx.drawImage(blurCanvas, 0, 0);
        } else {
          tctx.drawImage(maskCanvas, 0, 0);
        }
      } else {
        tctx.drawImage(maskCanvas, 0, 0);
      }
      tctx.globalCompositeOperation = 'source-over';
    }

    ctx.drawImage(tempCanvas, 0, 0);
    setPreviewUrl(canvas.toDataURL('image/png'));
  };

  useEffect(() => {
    applyMask();
  }, [isCircleMask, isSquareMask, isRoundedSquareMask, feather, roundedRadius, roundedFeather, vOffset, squareTopOnly, squareBottomOnly]);

  const handleDownload = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `edited_${imageFile?.name || 'image'}.png`;
    a.click();
  };

  const handleReset = () => {
    setImageFile(null);
    setImageUrl('');
    setPreviewUrl('');
    setIsCircleMask(false);
    setIsSquareMask(false);
    setIsRoundedSquareMask(false);
    setSquareTopOnly(false);
    setSquareBottomOnly(false);
    setFeather(20);
    setRoundedRadius(20);
    setRoundedFeather(20);
    setVOffset(50);
    originalImageRef.current = null;
  };

  return (
    <div className="max-w-4xl mx-auto" dir="rtl">
      <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/5 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2"></div>

        <div className="flex flex-col gap-8 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                <ImageIcon size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">تعديل الصور</h2>
                <p className="text-slate-500 text-xs font-bold tracking-widest uppercase mt-1">إضافة الحواف والأقنعة</p>
              </div>
            </div>
            {imageFile && (
              <button 
                onClick={handleReset}
                className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-full transition-all border border-red-500/20"
                title="إعادة تعيين"
              >
                <RefreshCw size={20} />
              </button>
            )}
          </div>

          {!imageFile ? (
            <div className="group relative">
              <input 
                type="file" 
                id="image-upload" 
                className="hidden" 
                accept="image/*"
                onChange={handleImageSelect}
              />
              <label 
                htmlFor="image-upload"
                className="flex flex-col items-center justify-center gap-6 py-24 px-8 border-2 border-dashed border-slate-800 rounded-[3rem] bg-slate-800/20 hover:bg-slate-800/40 hover:border-indigo-500/30 cursor-pointer transition-all group-hover:scale-[0.99]"
              >
                <div className="w-20 h-20 bg-indigo-500/10 rounded-[2rem] flex items-center justify-center text-indigo-400 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 border border-indigo-500/20">
                  <Upload size={32} />
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white mb-2">اختر صورة للبدء</p>
                  <p className="text-slate-500 text-sm">اسحب الصورة هنا أو اضغط للاختيار</p>
                </div>
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Preview Area */}
              <div className="flex flex-col gap-4">
                <div className="bg-black/40 rounded-[2.5rem] border border-white/5 relative aspect-square overflow-hidden shadow-inner flex items-center justify-center group">
                  {previewUrl ? (
                    <img 
                      src={previewUrl} 
                      alt="Preview" 
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <Loader2 className="animate-spin text-indigo-500" size={40} />
                  )}
                  
                  {/* Grid overlay for positioning hint */}
                  <div className="absolute inset-0 border border-white/5 pointer-events-none opacity-20"></div>
                </div>
                <div className="bg-slate-800/20 p-4 rounded-2xl border border-slate-800/50">
                  <p className="text-[10px] text-slate-500 uppercase mb-1">اسم الملف</p>
                  <p className="text-xs font-bold text-white truncate">{imageFile.name}</p>
                </div>
              </div>

              {/* Controls Area */}
              <div className="flex flex-col gap-6">
                <div className="bg-slate-800/30 p-6 rounded-[2rem] border border-slate-700/50 space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <Circle size={18} className="text-indigo-400" />
                      <span className="text-sm font-bold text-white">حواف الدائرة</span>
                    </div>
                    <button 
                      onClick={() => {
                        const newVal = !isCircleMask;
                        setIsCircleMask(newVal);
                        if (newVal) {
                          setIsSquareMask(false);
                          setIsRoundedSquareMask(false);
                        }
                      }}
                      className={`w-12 h-6 rounded-full transition-colors relative ${isCircleMask ? 'bg-indigo-500' : 'bg-slate-700'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isCircleMask ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pb-4 border-b border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <Square size={18} className="text-purple-400" />
                      <span className="text-sm font-bold text-white">حواف المربع (1×1)</span>
                    </div>
                    <button 
                      onClick={() => {
                        const newVal = !isSquareMask;
                        setIsSquareMask(newVal);
                        if (newVal) {
                          setIsCircleMask(false);
                          setIsRoundedSquareMask(false);
                        }
                      }}
                      className={`w-12 h-6 rounded-full transition-colors relative ${isSquareMask ? 'bg-indigo-500' : 'bg-slate-700'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isSquareMask ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pb-4 border-b border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-pink-400 rounded-[5px] shrink-0" />
                      <span className="text-sm font-bold text-white">حواف المربع الدائري</span>
                    </div>
                    <button 
                      onClick={() => {
                        const newVal = !isRoundedSquareMask;
                        setIsRoundedSquareMask(newVal);
                        if (newVal) {
                          setIsCircleMask(false);
                          setIsSquareMask(false);
                        }
                      }}
                      className={`w-12 h-6 rounded-full transition-colors relative ${isRoundedSquareMask ? 'bg-indigo-500' : 'bg-slate-700'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isRoundedSquareMask ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>

                  {(isCircleMask || isSquareMask || isRoundedSquareMask) && (
                    <div className="space-y-4 pt-2">
                      {isRoundedSquareMask ? (
                        <>
                          <div className="flex flex-col gap-3">
                            <label className="text-sm font-bold text-slate-300 flex justify-between">
                              <span>انحناء الحواف الدائرية</span>
                              <span className="text-indigo-400">{roundedRadius}%</span>
                            </label>
                            <input 
                              type="range" min="0" max="100" value={roundedRadius} 
                              onChange={(e) => setRoundedRadius(Number(e.target.value))}
                              className="w-full accent-indigo-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/5 transition-all hover:bg-white/30"
                            />
                          </div>

                          <div className="flex flex-col gap-3 pt-2 border-t border-slate-800/40">
                            <label className="text-sm font-bold text-slate-300 flex justify-between">
                              <span>شفافية الحواف (التنعيم)</span>
                              <span className="text-indigo-400">{roundedFeather}%</span>
                            </label>
                            <input 
                              type="range" min="0" max="100" value={roundedFeather} 
                              onChange={(e) => setRoundedFeather(Number(e.target.value))}
                              className="w-full accent-indigo-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/5 transition-all hover:bg-white/30"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex flex-col gap-3">
                            <label className="text-sm font-bold text-slate-300 flex justify-between">
                              <span>شدة تنعيم الحواف</span>
                              <span className="text-indigo-400">{feather}%</span>
                            </label>
                            <input 
                              type="range" min="1" max="100" value={feather} 
                              onChange={(e) => setFeather(Number(e.target.value))}
                              className="w-full accent-indigo-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/5 transition-all hover:bg-white/30"
                            />
                          </div>

                          {isSquareMask && (
                            <div className="space-y-3 pt-4 border-t border-slate-700/50">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-300">حواف شفافة من الأعلى بمفردها</span>
                                <button 
                                  onClick={() => {
                                    const newVal = !squareTopOnly;
                                    setSquareTopOnly(newVal);
                                    if (newVal) setSquareBottomOnly(false);
                                  }}
                                  className={`w-10 h-5 rounded-full transition-colors relative ${squareTopOnly ? 'bg-indigo-500' : 'bg-slate-700'}`}
                                >
                                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${squareTopOnly ? 'right-0.5' : 'left-0.5'}`} />
                                </button>
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-300">حواف شفافة من الأسفل بمفردها</span>
                                <button 
                                  onClick={() => {
                                    const newVal = !squareBottomOnly;
                                    setSquareBottomOnly(newVal);
                                    if (newVal) setSquareTopOnly(false);
                                  }}
                                  className={`w-10 h-5 rounded-full transition-colors relative ${squareBottomOnly ? 'bg-indigo-500' : 'bg-slate-700'}`}
                                >
                                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${squareBottomOnly ? 'right-0.5' : 'left-0.5'}`} />
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {!isCircleMask && !isSquareMask && !isRoundedSquareMask && (
                    <div className="py-6 text-center bg-slate-900/40 rounded-2xl border border-dashed border-slate-700">
                      <p className="text-xs text-slate-500 font-bold">يرجى تفعيل أحد الأقنعة للبدء بالتعديل</p>
                    </div>
                  )}
                </div>

                <div className="bg-slate-800/30 p-6 rounded-[2rem] border border-slate-700/50 space-y-4">
                  <div className="flex flex-col gap-3">
                    <label className="text-sm font-bold text-slate-300 flex justify-between">
                      <span>إزاحة الصورة (رأسي)</span>
                      <span className="text-indigo-400">{vOffset}%</span>
                    </label>
                    <input 
                      type="range" min="0" max="100" value={vOffset} 
                      onChange={(e) => setVOffset(Number(e.target.value))}
                      className="w-full accent-indigo-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/5 transition-all hover:bg-white/30"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase">
                      <span>أعلى</span>
                      <span>منتصف</span>
                      <span>أسفل</span>
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-4">
                  <button 
                    onClick={handleDownload}
                    disabled={!previewUrl}
                    className="w-full py-4 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 rounded-2xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 shadow-[0_0_30px_rgba(99,102,241,0.1)]"
                  >
                    <Download size={24} />
                    تحميل الصورة المعدلة
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
