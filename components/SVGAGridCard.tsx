import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2, AlertCircle, Check, Pencil, SlidersHorizontal } from 'lucide-react';
import pako from 'pako';
import { parse } from 'protobufjs';
import { svgaSchema } from '../svga-proto';
import { SVGAFileExtended } from '../types';

interface SVGAGridCardProps {
  file: SVGAFileExtended;
  onRemove: () => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onRename?: (newName: string) => void;
  onOpenEditor?: () => void;
}

export const SVGAGridCard: React.FC<SVGAGridCardProps> = ({
  file,
  onRemove,
  isSelected = false,
  onToggleSelect,
  onRename,
  onOpenEditor,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ width: number; height: number } | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(file.name.replace(/\.svga$/i, ''));

  useEffect(() => {
    setNameInput(file.name.replace(/\.svga$/i, ''));
  }, [file.name]);

  const handleSaveName = () => {
    const clean = nameInput.trim();
    if (clean && clean !== file.name.replace(/\.svga$/i, '')) {
      const finalName = clean.endsWith('.svga') ? clean : `${clean}.svga`;
      onRename?.(finalName);
    } else {
      setNameInput(file.name.replace(/\.svga$/i, ''));
    }
    setIsEditingName(false);
  };

  useEffect(() => {
    let isMounted = true;
    let player: any = null;

    const init = async () => {
      try {
        setLoading(true);
        setError(null);

        const SVGA: any = await new Promise((resolve) => {
          const check = () => (window as any).SVGA ? resolve((window as any).SVGA) : setTimeout(check, 80);
          check();
        });

        if (!isMounted || !containerRef.current) return;
        containerRef.current.innerHTML = '';

        player = new SVGA.Player(containerRef.current);
        playerRef.current = player;
        player.loops = 0; // Infinite loop
        player.setContentMode('AspectFit');

        const parser = new SVGA.Parser();

        const handleVideoReady = (videoItem: any) => {
          if (!isMounted) return;
          const w = videoItem.videoSize?.width || 500;
          const h = videoItem.videoSize?.height || 500;
          setMeta({ width: w, height: h });

          // Mute audio in group grid to keep preview silent & clean
          if (videoItem.audios && videoItem.audios.length > 0) {
            setTimeout(() => {
              try {
                if (player && player.audioPlayer && player.audioPlayer.audios) {
                  player.audioPlayer.audios.forEach((audio: any) => {
                    if (audio.howl) audio.howl.mute(true);
                  });
                }
              } catch (e) {}
            }, 100);
          }

          player._resize = function() {
            if (!this._drawingCanvas || !this._videoItem) return;
            const { width, height } = this._videoItem.videoSize;
            if (this._drawingCanvas.width !== width) this._drawingCanvas.width = width;
            if (this._drawingCanvas.height !== height) this._drawingCanvas.height = height;
            this._drawingCanvas.style.transform = '';
            this._drawingCanvas.style.webkitTransform = '';
          };

          player.setVideoItem(videoItem);
          player.startAnimation();
          setLoading(false);
        };

        // Fetch binary data
        let arrayBuffer: ArrayBuffer;
        if (file.rawFile) {
          arrayBuffer = await file.rawFile.arrayBuffer();
        } else {
          const res = await fetch(file.url);
          if (!res.ok) throw new Error('Failed to fetch SVGA file');
          arrayBuffer = await res.arrayBuffer();
        }

        const fileObj = new File([arrayBuffer], file.name || "animation.svga", {
          type: "application/octet-stream"
        });

        parser.load(fileObj, (videoItem: any) => {
          handleVideoReady(videoItem);
        }, async () => {
          // Direct fallback decompression
          try {
            const bytes = new Uint8Array(arrayBuffer);
            let movie: any;
            const images: Record<string, string> = {};

            if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
              const JSZipClass = (window as any).JSZip;
              const zip = await JSZipClass.loadAsync(arrayBuffer);
              if (zip.file("movie.binary")) {
                const bin = await zip.file("movie.binary").async("uint8array");
                const root = parse(svgaSchema).root;
                const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
                movie = MovieEntity.decode(bin);
                movie.ver = "1.5";
              } else if (zip.file("movie.spec")) {
                const specJson = await zip.file("movie.spec").async("string");
                movie = JSON.parse(specJson);
                movie.ver = "1.0";
              }
              for (const fname of Object.keys(zip.files)) {
                if (fname.endsWith('.png') || fname.endsWith('.jpg') || fname.endsWith('.jpeg') || fname.endsWith('.webp')) {
                  const k = fname.replace(/\.(png|jpg|jpeg|webp)$/, '');
                  images[k] = await zip.file(fname).async("base64");
                }
              }
            } else {
              const inflated = pako.inflate(bytes);
              const root = parse(svgaSchema).root;
              const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
              movie = MovieEntity.decode(inflated) as any;
              movie.ver = "2.0";
              if (movie.images) {
                for (const imgKey of Object.keys(movie.images)) {
                  const imgData = movie.images[imgKey];
                  if (typeof imgData === 'string') {
                    images[imgKey] = imgData;
                  } else if (imgData instanceof Uint8Array || Array.isArray(imgData)) {
                    let binary = '';
                    const len = imgData.length;
                    for (let i = 0; i < len; i++) {
                      binary += String.fromCharCode(imgData[i]);
                    }
                    images[imgKey] = btoa(binary);
                  }
                }
              }
            }

            const VideoEntityClass = (SVGA as any).VideoEntity || (parser as any).constructor?.VideoEntity;
            const fallbackVideoItem = new VideoEntityClass(movie, images);
            handleVideoReady(fallbackVideoItem);
          } catch (err: any) {
            console.error('Fallback decoder failed:', err);
            if (isMounted) {
              setError('تعذر قراءة ملف SVGA');
              setLoading(false);
            }
          }
        });

      } catch (err: any) {
        console.error('Init SVGA card failed:', err);
        if (isMounted) {
          setError(err.message || 'خطأ في التحميل');
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      isMounted = false;
      if (player) {
        try {
          player.stopAnimation();
          if (player.audioPlayer && player.audioPlayer.audios) {
            player.audioPlayer.audios.forEach((audio: any) => {
              if (audio.howl) {
                audio.howl.stop();
                audio.howl.unload();
              }
            });
          }
          if (containerRef.current) {
            containerRef.current.innerHTML = '';
          }
        } catch (e) {}
      }
    };
  }, [file.url]);

  return (
    <div 
      data-card-file={file.name}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onToggleSelect?.();
      }}
      className={`group relative aspect-square rounded-[2rem] border overflow-hidden p-3 flex flex-col justify-between cursor-default transition-all duration-300 hover:scale-[1.02] shadow-xl select-none ${
        isSelected 
          ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-950/30 shadow-[0_0_25px_rgba(59,130,246,0.3)]' 
          : 'border-white/10 hover:border-blue-500/40 bg-slate-950/35 hover:bg-slate-950/45 shadow-black/40 hover:shadow-[0_10px_30px_rgba(59,130,246,0.15)]'
      }`}
      dir="rtl"
    >
      {/* Authentic Subtle Checkerboard Grid Pattern for Transparency */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.09]"
        style={{
          backgroundImage: `linear-gradient(45deg, #ffffff 25%, transparent 25%), linear-gradient(-45deg, #ffffff 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ffffff 75%), linear-gradient(-45deg, transparent 75%, #ffffff 75%)`,
          backgroundSize: `16px 16px`,
          backgroundPosition: `0 0, 0 8px, 8px -8px, -8px 0`
        }}
      />

      {/* Top Header: Delete Button & Selection Checkmark & Dimension Tag */}
      <div className="relative z-10 flex items-center justify-between w-full">
        {/* Remove Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="w-7 h-7 rounded-xl bg-slate-950/50 hover:bg-red-500/30 border border-white/10 hover:border-red-500/40 text-slate-400 hover:text-red-300 flex items-center justify-center transition-all opacity-80 group-hover:opacity-100"
          title="إزالة هذا الإطار"
        >
          <X size={13} />
        </button>

        <div className="flex items-center gap-1.5">
          {/* Edit / Open in Editor Button */}
          {onOpenEditor && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenEditor();
              }}
              className="w-7 h-7 rounded-xl bg-slate-950/50 hover:bg-blue-600/30 border border-white/10 hover:border-blue-500/40 text-slate-400 hover:text-blue-300 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
              title="فتح في محرر التعديل والمكتبة"
            >
              <SlidersHorizontal size={12} />
            </button>
          )}

          {/* Dimension Tag */}
          {meta && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-950/50 border border-white/10 text-slate-400">
              {meta.width}×{meta.height}
            </span>
          )}

          {/* Selection Checkbox/Indicator (Toggles on Double Click or Click) */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.();
            }}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isSelected 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/40 scale-105' 
                : 'border border-white/20 bg-slate-950/40 text-transparent hover:border-blue-400 hover:text-blue-400 opacity-40 group-hover:opacity-100'
            }`}
            title={isSelected ? 'تم تحديد الإطار (انقر للإلغاء)' : 'انقر أو انقر نقراً مزدوجاً للتحديد'}
          >
            <Check size={12} strokeWidth={isSelected ? 3 : 2} />
          </div>
        </div>
      </div>

      {/* Center SVGA Stage - Enlarged animation */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden my-0.5">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Loader2 size={24} className="text-blue-500 animate-spin" />
            <span className="text-[10px] text-slate-500 font-bold">جاري التحميل...</span>
          </div>
        )}

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3 text-red-400 gap-1.5">
            <AlertCircle size={22} />
            <span className="text-xs font-bold">{error}</span>
          </div>
        ) : (
          <div 
            ref={containerRef} 
            className="svga-card-container w-full h-full flex items-center justify-center pointer-events-none scale-[1.04]"
          />
        )}
      </div>

      {/* Bottom Footer: Editable File Name */}
      <div 
        className="relative z-10 w-full pt-1 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {isEditingName ? (
          <div className="inline-flex items-center gap-1.5 bg-slate-800/70 border border-slate-700/60 rounded-xl px-2.5 py-1 transition-all">
            <input
              type="text"
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') {
                  setNameInput(file.name.replace(/\.svga$/i, ''));
                  setIsEditingName(false);
                }
              }}
              onBlur={handleSaveName}
              className="w-full bg-transparent text-xs font-bold text-white text-center outline-none min-w-[100px] max-w-[130px]"
              placeholder="اسم الإطار..."
            />
            <button
              onClick={handleSaveName}
              className="text-blue-400 hover:text-blue-300 p-0.5 rounded cursor-pointer shrink-0 transition-colors"
              title="حفظ الاسم"
            >
              <Check size={13} />
            </button>
          </div>
        ) : (
          <div
            onClick={() => setIsEditingName(true)}
            className="group/name inline-flex items-center justify-center gap-1.5 max-w-full px-2.5 py-1 rounded-xl hover:bg-slate-800/70 cursor-pointer transition-all border border-transparent hover:border-slate-700/60"
            title="انقر لتغيير اسم الإطار"
          >
            <p className="text-xs font-bold text-white/90 truncate block max-w-[130px] group-hover/name:text-blue-400 transition-colors">
              {file.name}
            </p>
            <Pencil size={11} className="text-slate-500 opacity-0 group-hover/name:opacity-100 transition-opacity shrink-0" />
          </div>
        )}
      </div>
    </div>
  );
};
