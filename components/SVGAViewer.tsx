
import React, { useEffect, useRef, useState } from 'react';
import { 
  Layers,
  Download,
  FileArchive,
  Video,
  Eye,
  EyeOff,
  RefreshCw,
  X,
  Settings2,
  Check,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RotateCcw,
  Plus,
  ZoomIn,
  ZoomOut,
  Scaling,
  Link,
  Unlink,
  Play,
  Pause
} from 'lucide-react';
import pako from 'pako';
import * as UPNG from 'upng-js';
import { parse } from 'protobufjs';
import { svgaSchema } from '../svga-proto';
import { SVGAFileInfo, PlayerStatus } from '../types';

interface SVGAViewerProps {
  file: SVGAFileInfo;
  onClear: () => void;
  originalFile?: File; 
}

export const SVGAViewer: React.FC<SVGAViewerProps> = ({ file, onClear, originalFile }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const videoItemRef = useRef<any>(null);
  const [status, setStatus] = useState<PlayerStatus>(PlayerStatus.LOADING);
  const statusRef = useRef<PlayerStatus>(PlayerStatus.LOADING);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  const [isLoop] = useState(true);
  const [bgColor, setBgColor] = useState('#0f172a');
  const [displayMode, setDisplayMode] = useState<'fit' | 'actual' | 'custom'>('fit');
  const [viewportDimensions, setViewportDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [frameScale, setFrameScale] = useState<number>(100);
  const [videoSize, setVideoSize] = useState<{width: number, height: number} | null>(null);
  const [customWidth, setCustomWidth] = useState<number | ''>('');
  const [customHeight, setCustomHeight] = useState<number | ''>('');
  const [lockAspect, setLockAspect] = useState<boolean>(true);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState<boolean>(false);

  useEffect(() => {
    const updateDimensions = () => {
      if (!viewportRef.current) return;
      const clientW = viewportRef.current.clientWidth;
      const clientH = viewportRef.current.clientHeight;
      setViewportDimensions({ width: clientW, height: clientH });

      const targetW = typeof customWidth === 'number' && customWidth > 0 
        ? customWidth 
        : (videoSize ? Math.round((videoSize.width * frameScale) / 100) : 0);
      const targetH = typeof customHeight === 'number' && customHeight > 0 
        ? customHeight 
        : (videoSize ? Math.round((videoSize.height * frameScale) / 100) : 0);

      if (displayMode === 'fit') {
        setIsOverflowing(false);
      } else if (targetW > 0 && targetH > 0 && clientW > 0 && clientH > 0) {
        const overflows = (targetW + 32 > clientW) || (targetH + 32 > clientH);
        setIsOverflowing(overflows);
      } else {
        setIsOverflowing(false);
      }
    };

    updateDimensions();

    const el = viewportRef.current;
    if (!el) return;

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateDimensions();
      });
      resizeObserver.observe(el);
    }

    window.addEventListener('resize', updateDimensions);
    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, [customWidth, customHeight, frameScale, videoSize, displayMode]);

  // Dynamic calculation to ensure any SVGA animation fits 100% completely in display stage
  const displayDimensions = React.useMemo(() => {
    if (!videoSize) return { width: 'auto', height: 'auto', scalePercent: 100, isFit: true };

    const vw = viewportDimensions.width;
    const vh = viewportDimensions.height;

    if (displayMode === 'fit') {
      if (vw > 0 && vh > 0) {
        // Leave comfortable 36px breathing room inside viewport
        const padding = 36;
        const maxW = Math.max(100, vw - padding);
        const maxH = Math.max(100, vh - padding);
        const scale = Math.min(maxW / videoSize.width, maxH / videoSize.height);
        return {
          width: `${Math.round(videoSize.width * scale)}px`,
          height: `${Math.round(videoSize.height * scale)}px`,
          scalePercent: Math.round(scale * 100),
          isFit: true
        };
      }
      return {
        width: '100%',
        height: '100%',
        scalePercent: 100,
        isFit: true
      };
    }

    if (displayMode === 'actual') {
      return {
        width: `${videoSize.width}px`,
        height: `${videoSize.height}px`,
        scalePercent: 100,
        isFit: false
      };
    }

    // 'custom' mode
    const scale = frameScale / 100;
    const baseW = typeof customWidth === 'number' && customWidth > 0 ? customWidth : videoSize.width;
    const baseH = typeof customHeight === 'number' && customHeight > 0 ? customHeight : videoSize.height;
    return {
      width: `${Math.round(baseW * scale)}px`,
      height: `${Math.round(baseH * scale)}px`,
      scalePercent: frameScale,
      isFit: false
    };
  }, [displayMode, viewportDimensions, videoSize, customWidth, customHeight, frameScale]);

  const handleWidthChange = (val: number | '') => {
    setCustomWidth(val);
    if (typeof val === 'number' && val > 0 && videoSize && videoSize.width > 0) {
      if (lockAspect) {
        const computedH = Math.round((val * videoSize.height) / videoSize.width);
        setCustomHeight(computedH);
      }
      const computedScale = Math.round((val / videoSize.width) * 100);
      setFrameScale(computedScale);
    }
  };

  const handleHeightChange = (val: number | '') => {
    setCustomHeight(val);
    if (typeof val === 'number' && val > 0 && videoSize && videoSize.height > 0) {
      if (lockAspect) {
        const computedW = Math.round((val * videoSize.width) / videoSize.height);
        setCustomWidth(computedW);
      }
      const computedScale = Math.round((val / videoSize.height) * 100);
      setFrameScale(computedScale);
    }
  };

  const handleScalePreset = (s: number) => {
    setFrameScale(s);
    if (videoSize) {
      setCustomWidth(Math.round((videoSize.width * s) / 100));
      setCustomHeight(Math.round((videoSize.height * s) / 100));
    }
  };
  const [hasAudio, setHasAudio] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [assets, setAssets] = useState<{id: string, data: string}[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');
  const [hiddenAssets, setHiddenAssets] = useState<Set<string>>(new Set());
  
  const [replacedAssetsPart1, setReplacedAssetsPart1] = useState<Record<string, string>>({});
  const [replacedAssetsPart2, setReplacedAssetsPart2] = useState<Record<string, string>>({});

  const replacedAssetsPart1Ref = useRef<Record<string, string>>({});
  const replacedAssetsPart2Ref = useRef<Record<string, string>>({});
  const lastActivePhaseRef = useRef<number | null>(null);

  useEffect(() => {
    replacedAssetsPart1Ref.current = replacedAssetsPart1;
  }, [replacedAssetsPart1]);

  useEffect(() => {
    replacedAssetsPart2Ref.current = replacedAssetsPart2;
  }, [replacedAssetsPart2]);

  const addedAssets1Ref = useRef<Record<string, string>>({});
  const addedAssets2Ref = useRef<Record<string, string>>({});
  const savedAddedSettings1Ref = useRef<Record<string, any>>({});
  const savedAddedSettings2Ref = useRef<Record<string, any>>({});
  const uploadedAssetsRef = useRef<Record<string, string>>({});
  const savedEditSettingsRef = useRef<Record<string, any>>({});
  const assetsRef = useRef<any[]>([]);

  const [uploadedAssets, setUploadedAssets] = useState<Record<string, string>>({});
  const [savedEditSettings, setSavedEditSettings] = useState<Record<string, {
    scale: number;
    offsetX: number;
    offsetY: number;
    glowIntensity: number;
    solidFill: number;
    glowColor: string;
    smartMatch: boolean;
  }>>({});

  const [addedAssets1, setAddedAssets1] = useState<Record<string, string>>({});
  const [addedAssets2, setAddedAssets2] = useState<Record<string, string>>({});
  
  const [savedAddedSettings1, setSavedAddedSettings1] = useState<Record<string, {
    scale: number;
    offsetX: number;
    offsetY: number;
    rotation: number;
    opacity: number;
  }>>({});
  const [savedAddedSettings2, setSavedAddedSettings2] = useState<Record<string, {
    scale: number;
    offsetX: number;
    offsetY: number;
    rotation: number;
    opacity: number;
  }>>({});

  useEffect(() => {
    addedAssets1Ref.current = addedAssets1;
  }, [addedAssets1]);

  useEffect(() => {
    addedAssets2Ref.current = addedAssets2;
  }, [addedAssets2]);

  useEffect(() => {
    savedAddedSettings1Ref.current = savedAddedSettings1;
  }, [savedAddedSettings1]);

  useEffect(() => {
    savedAddedSettings2Ref.current = savedAddedSettings2;
  }, [savedAddedSettings2]);

  useEffect(() => {
    uploadedAssetsRef.current = uploadedAssets;
  }, [uploadedAssets]);

  useEffect(() => {
    savedEditSettingsRef.current = savedEditSettings;
  }, [savedEditSettings]);

  const assetMediaCacheRef = useRef<Record<string, {
    bgImg: HTMLImageElement | null;
    bgSrc: string;
    bgLoaded: boolean;

    over1Img: HTMLImageElement | null;
    over1Src: string;
    over1Loaded: boolean;

    over2Img: HTMLImageElement | null;
    over2Src: string;
    over2Loaded: boolean;
  }>>({});

  const getMediaCache = (assetId: string, bgSrc: string, over1Src: string, over2Src: string) => {
    if (!assetMediaCacheRef.current[assetId]) {
      assetMediaCacheRef.current[assetId] = {
        bgImg: null,
        bgSrc: '',
        bgLoaded: false,

        over1Img: null,
        over1Src: '',
        over1Loaded: false,

        over2Img: null,
        over2Src: '',
        over2Loaded: false,
      };
    }

    const cache = assetMediaCacheRef.current[assetId];

    if (cache.bgSrc !== bgSrc && bgSrc) {
      cache.bgSrc = bgSrc;
      cache.bgLoaded = false;
      const img = new Image();
      img.onload = () => { cache.bgLoaded = true; };
      img.src = bgSrc;
      cache.bgImg = img;
    }

    if (cache.over1Src !== over1Src && over1Src) {
      cache.over1Src = over1Src;
      cache.over1Loaded = false;
      const img = new Image();
      img.onload = () => { cache.over1Loaded = true; };
      img.src = over1Src;
      cache.over1Img = img;
    } else if (!over1Src) {
      cache.over1Src = '';
      cache.over1Img = null;
      cache.over1Loaded = false;
    }

    if (cache.over2Src !== over2Src && over2Src) {
      cache.over2Src = over2Src;
      cache.over2Loaded = false;
      const img = new Image();
      img.onload = () => { cache.over2Loaded = true; };
      img.src = over2Src;
      cache.over2Img = img;
    } else if (!over2Src) {
      cache.over2Src = '';
      cache.over2Img = null;
      cache.over2Loaded = false;
    }

    return cache;
  };

  const generateProgressFrame = (
    origWidth: number,
    origHeight: number,
    newImg: HTMLImageElement,
    over1Img: HTMLImageElement | null,
    over2Img: HTMLImageElement | null,
    editSet: any,
    over1Set: any,
    over2Set: any,
    progressPercent: number
  ): HTMLCanvasElement | null => {
    const canvas = document.createElement('canvas');
    canvas.width = origWidth;
    canvas.height = origHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // 1. Draw base/background image (e.g., the rectangle)
    const baseScale = Math.min(origWidth / newImg.width, origHeight / newImg.height);
    const userScale = (editSet?.scale ?? 100) / 100;
    
    const drawW = newImg.width * baseScale * userScale;
    const drawH = newImg.height * baseScale * userScale;
    
    const drawX = (canvas.width - drawW) / 2 + (editSet?.offsetX ?? 0);
    const drawY = (canvas.height - drawH) / 2 - (editSet?.offsetY ?? 0);

    if (editSet?.glowIntensity > 0) {
      ctx.shadowColor = editSet.glowColor;
      ctx.shadowBlur = editSet.glowIntensity;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.drawImage(newImg, drawX, drawY, drawW, drawH);
      ctx.drawImage(newImg, drawX, drawY, drawW, drawH);
    } else {
      ctx.drawImage(newImg, drawX, drawY, drawW, drawH);
    }

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    if (editSet?.solidFill > 0) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = editSet.glowColor;
      ctx.globalAlpha = editSet.solidFill / 100;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();

    // 2. Compute dynamic opacities for overlays
    let opacity1 = 0;
    let opacity2 = 0;

    // Overlay 1 (Word 1): active range 0% to 50%
    if (progressPercent >= 0 && progressPercent <= 50) {
      if (progressPercent < 15) {
        // Fade in from 0% to 15%
        opacity1 = progressPercent / 15;
      } else if (progressPercent > 35) {
        // Fade out from 35% to 50%
        opacity1 = (50 - progressPercent) / 15;
      } else {
        opacity1 = 1;
      }
    }

    // Overlay 2 (Word 2): active range 50% to 100%
    if (progressPercent >= 50 && progressPercent <= 100) {
      if (progressPercent < 65) {
        // Fade in from 50% to 65%
        opacity2 = (progressPercent - 50) / 15;
      } else if (progressPercent > 85) {
        // Fade out from 85% to 100%
        opacity2 = (100 - progressPercent) / 15;
      } else {
        opacity2 = 1;
      }
    }

    // 3. Draw Overlay 1 (Word 1) if available and opacity1 > 0
    if (over1Img && opacity1 > 0) {
      ctx.save();
      const overlayScale = ((over1Set?.scale ?? 50) / 100) * baseScale;
      const overW = over1Img.width * overlayScale;
      const overH = over1Img.height * overlayScale;
      
      const overX = (canvas.width - overW) / 2 + (over1Set?.offsetX ?? 0);
      const overY = (canvas.height - overH) / 2 - (over1Set?.offsetY ?? 0);
      
      const finalOpacity = (opacity1 * ((over1Set?.opacity ?? 100) / 100));
      ctx.globalAlpha = Math.max(0, Math.min(1, finalOpacity));
      
      if (over1Set?.rotation !== 0) {
        ctx.translate(overX + overW / 2, overY + overH / 2);
        ctx.rotate(((over1Set?.rotation ?? 0) * Math.PI) / 180);
        ctx.drawImage(over1Img, -overW / 2, -overH / 2, overW, overH);
      } else {
        ctx.drawImage(over1Img, overX, overY, overW, overH);
      }
      ctx.restore();
    }

    // 4. Draw Overlay 2 (Word 2) if available and opacity2 > 0
    if (over2Img && opacity2 > 0) {
      ctx.save();
      const overlayScale = ((over2Set?.scale ?? 50) / 100) * baseScale;
      const overW = over2Img.width * overlayScale;
      const overH = over2Img.height * overlayScale;
      
      const overX = (canvas.width - overW) / 2 + (over2Set?.offsetX ?? 0);
      const overY = (canvas.height - overH) / 2 - (over2Set?.offsetY ?? 0);
      
      const finalOpacity = (opacity2 * ((over2Set?.opacity ?? 100) / 100));
      ctx.globalAlpha = Math.max(0, Math.min(1, finalOpacity));
      
      if (over2Set?.rotation !== 0) {
        ctx.translate(overX + overW / 2, overY + overH / 2);
        ctx.rotate(((over2Set?.rotation ?? 0) * Math.PI) / 180);
        ctx.drawImage(over2Img, -overW / 2, -overH / 2, overW, overH);
      } else {
        ctx.drawImage(over2Img, overX, overY, overW, overH);
      }
      ctx.restore();
    }

    return canvas;
  };

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  const [addedFileData1, setAddedFileData1] = useState<string | null>(null);
  const [addedFileSettings1, setAddedFileSettings1] = useState({
    scale: 50,
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    opacity: 100,
  });

  const [addedFileData2, setAddedFileData2] = useState<string | null>(null);
  const [addedFileSettings2, setAddedFileSettings2] = useState({
    scale: 50,
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    opacity: 100,
  });

  const [activeOverlayTab, setActiveOverlayTab] = useState<'one' | 'two'>('one');

  const addedFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setReplacedAssetsPart1({});
    setReplacedAssetsPart2({});
    setUploadedAssets({});
    setSavedEditSettings({});
    setHiddenAssets(new Set());
    setAddedAssets1({});
    setAddedAssets2({});
    setSavedAddedSettings1({});
    setSavedAddedSettings2({});
    lastActivePhaseRef.current = null;
  }, [file.url, originalFile]);

  const [activeReplaceId, setActiveReplaceId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingAsset, setEditingAsset] = useState<{
    id: string;
    originalData: string;
    newImageData: string;
  } | null>(null);

  const [editSettings, setEditSettings] = useState({
    scale: 100,
    offsetX: 0,
    offsetY: 0,
    glowIntensity: 0,
    solidFill: 0,
    glowColor: '#ffffff',
    smartMatch: true
  });

  const editCanvasRef = useRef<HTMLCanvasElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Drag states for editing modal
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [modalOffset, setModalOffset] = useState({ x: 0, y: 0 });

  // Reset drag offset when editingAsset changes
  useEffect(() => {
    if (!editingAsset) {
      setModalOffset({ x: 0, y: 0 });
    }
  }, [editingAsset]);

  // Window-level mouse listeners for modal dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setModalOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  // Touch event listeners for mobile dragging
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      setModalOffset({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y
      });
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, dragStart]);

  const handleDragStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left click
    setIsDragging(true);
    setDragStart({
      x: e.clientX - modalOffset.x,
      y: e.clientY - modalOffset.y
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({
      x: touch.clientX - modalOffset.x,
      y: touch.clientY - modalOffset.y
    });
  };

  const bgOptions = [
    { label: 'داكن', value: '#0f172a' },
    { label: 'أخضر', value: '#14532d' },
    { label: 'أبيض', value: '#ffffff' },
    { label: 'شفاف', value: 'transparent' },
  ];

  // Auto-resume audio context on any click in the document
  useEffect(() => {
    const resumeAudio = () => {
      // Resume Howler context if present
      const Howler = (window as any).Howler;
      if (Howler && Howler.ctx && Howler.ctx.state === 'suspended') {
        Howler.ctx.resume().catch((err: any) => console.error(err));
      }
      
      if (playerRef.current?.audioPlayer?.context?.state === 'suspended') {
        playerRef.current.audioPlayer.context.resume().catch((err: any) => {});
      }
    };
    window.addEventListener('click', resumeAudio);
    return () => window.removeEventListener('click', resumeAudio);
  }, []);

  useEffect(() => {
    if (!videoSize || !containerRef.current) return;
    const targetWidth = typeof customWidth === 'number' && customWidth > 0 
      ? customWidth 
      : Math.round((videoSize.width * frameScale) / 100);
    const targetHeight = typeof customHeight === 'number' && customHeight > 0 
      ? customHeight 
      : Math.round((videoSize.height * frameScale) / 100);

    if (containerRef.current) {
      containerRef.current.style.width = `${targetWidth}px`;
      containerRef.current.style.height = `${targetHeight}px`;

      if (playerRef.current) {
        try {
          playerRef.current.setContentMode('AspectFit');
          if (typeof playerRef.current._update === 'function') {
            playerRef.current._update();
          }
          if (statusRef.current === PlayerStatus.PAUSED) {
            playerRef.current.stepToFrame(currentFrame, false);
          }
        } catch (e) {
          console.warn('Error adjusting content mode on scale change:', e);
        }
      }
    }
  }, [frameScale, customWidth, customHeight, videoSize]);

  useEffect(() => {
    let isMounted = true;
    let player: any = null;

    const init = async () => {
      try {
        setStatus(PlayerStatus.LOADING);
        const SVGA: any = await new Promise((resolve) => {
          const check = () => (window as any).SVGA ? resolve((window as any).SVGA) : setTimeout(check, 100);
          check();
        });

        if (containerRef.current) containerRef.current.innerHTML = '';
        player = new SVGA.Player(containerRef.current);

        // Dynamic interception of audioPlayer assignment to prevent resetting sound
        let currentAudioPlayer: any = null;
        Object.defineProperty(player, 'audioPlayer', {
          get() {
            return currentAudioPlayer;
          },
          set(val) {
            if (val) {
              try {
                const originalStop = val.stop;
                val.stop = function() {
                  if (statusRef.current === PlayerStatus.PAUSED) {
                    // Temporary pause: do NOT stop (which resets seek), just pause!
                    if (this.audios) {
                      this.audios.forEach((audio: any) => {
                        if (audio.howl && typeof audio.howl.pause === 'function') {
                          audio.howl.pause();
                        }
                      });
                    }
                  } else {
                    // Real stop or loop restart: run original stop to rewind
                    if (originalStop) {
                      originalStop.call(this);
                    } else if (this.audios) {
                      this.audios.forEach((audio: any) => {
                        if (audio.howl && typeof audio.howl.stop === 'function') {
                          audio.howl.stop();
                        }
                      });
                    }
                  }
                };
              } catch (e) {
                console.warn("Failed to override stop on new audioPlayer", e);
              }
            }
            currentAudioPlayer = val;
          },
          configurable: true,
          enumerable: true
        });

        const parser = new SVGA.Parser();
        
        // Resilient renderer prepare patch to prevent hangs on WebP, empty assets, or audio errors
        if (player._renderer) {
          player._renderer.prepare = function() {
            this._prepared = false;
            this._bitmapCache = {};
            const videoItem = this._owner?._videoItem;
            if (!videoItem || !videoItem.images || Object.keys(videoItem.images).length === 0) {
              this._prepared = true;
              return;
            }

            const images = videoItem.images;
            const keys = Object.keys(images);
            let totalToLoad = 0;
            let loadedCount = 0;

            const markPrepared = () => {
              if (this._prepared) return;
              this._prepared = true;
              if (typeof this._undrawFrame === 'number') {
                this.drawFrame(this._undrawFrame);
                this._undrawFrame = undefined;
              }
            };

            const onItemComplete = () => {
              loadedCount++;
              if (loadedCount >= totalToLoad) {
                markPrepared();
              }
            };

            // Watchdog timer: force prepared after 800ms max so the animation is never blocked
            const watchdog = setTimeout(() => {
              markPrepared();
            }, 800);

            keys.forEach((key: string) => {
              const rawVal = images[key];
              if (!rawVal) return;

              const isAudio = (typeof rawVal === 'string' && rawVal.startsWith('SUQz')) ||
                              (videoItem.audios && videoItem.audios.some((a: any) => a.audioKey === key));

              if (isAudio && typeof window !== 'undefined' && (window as any).Howl) {
                totalToLoad++;
                try {
                  const HowlClass = (window as any).Howl;
                  const audioSrc = typeof rawVal === 'string' && rawVal.startsWith('data:')
                    ? rawVal
                    : `data:audio/x-mpeg;base64,${rawVal}`;
                  const howl = new HowlClass({
                    src: [audioSrc],
                    html5: false,
                    preload: true,
                    format: ['mp3']
                  });
                  howl.once('load', onItemComplete);
                  howl.once('loaderror', onItemComplete);
                  setTimeout(onItemComplete, 1200);
                  this._bitmapCache[key] = howl;
                } catch (err) {
                  onItemComplete();
                }
              } else {
                totalToLoad++;
                const img = document.createElement('img');
                img.onload = onItemComplete;
                img.onerror = () => {
                  img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
                  onItemComplete();
                };

                let imgSrc = rawVal;
                if (typeof rawVal === 'string') {
                  if (rawVal.startsWith('data:')) {
                    imgSrc = rawVal;
                  } else if (rawVal.startsWith('iVBO') || rawVal.startsWith('/9j/2w') || rawVal.startsWith('/9j/4')) {
                    imgSrc = `data:${rawVal.startsWith('/9j') ? 'image/jpeg' : 'image/png'};base64,${rawVal}`;
                  } else if (rawVal.startsWith('UklG')) {
                    imgSrc = `data:image/webp;base64,${rawVal}`;
                  } else if (rawVal.startsWith('R0lG')) {
                    imgSrc = `data:image/gif;base64,${rawVal}`;
                  } else {
                    imgSrc = `data:image/png;base64,${rawVal}`;
                  }
                } else if (rawVal && rawVal.src) {
                  imgSrc = rawVal.src;
                }

                img.src = imgSrc;
                const cleanKey = key.replace('.matte', '');
                this._bitmapCache[cleanKey] = img;
              }
            });

            if (totalToLoad === 0) {
              clearTimeout(watchdog);
              markPrepared();
            }
          };
        }

        player.setContentMode('AspectFit'); 
        player.loops = isLoop ? 0 : 1;
        player.clearsAfterStop = false;
        
        // Audio handling
        if (player.setAudioMuted) {
          player.setAudioMuted(false);
        }

        player.onFrame((frame: number) => {
          if (isMounted) {
            setCurrentFrame(frame);
            const videoItem = videoItemRef.current;
            let currentProgress = 0;
            if (videoItem?.frames) {
              currentProgress = (frame / videoItem.frames) * 100;
            } else if (totalFrames > 0) {
              currentProgress = (frame / totalFrames) * 100;
            }
            setProgress(currentProgress);

            // Real-time overlay/asset swap based on progress with a smooth fade transition on overlays only
            if (player) {
              const activeAssets = assetsRef.current || [];
              activeAssets.forEach((asset: any) => {
                const assetId = asset.id;
                
                const hasOverlay1 = !!addedAssets1Ref.current[assetId];
                const hasOverlay2 = !!addedAssets2Ref.current[assetId];
                const hasReplacement = !!uploadedAssetsRef.current[assetId];
                const hasSettings = !!savedEditSettingsRef.current[assetId];

                if (hasOverlay1 || hasOverlay2 || hasReplacement || hasSettings) {
                  const bgSrc = uploadedAssetsRef.current[assetId] || asset.data;
                  const over1Src = addedAssets1Ref.current[assetId] || '';
                  const over2Src = addedAssets2Ref.current[assetId] || '';

                  const cache = getMediaCache(assetId, bgSrc, over1Src, over2Src);

                  if (cache.bgImg && cache.bgLoaded) {
                    const editSet = savedEditSettingsRef.current[assetId];
                    const over1Set = savedAddedSettings1Ref.current[assetId];
                    const over2Set = savedAddedSettings2Ref.current[assetId];

                    const dynamicFrameCanvas = generateProgressFrame(
                      cache.bgImg.width || 500,
                      cache.bgImg.height || 500,
                      cache.bgImg,
                      cache.over1Loaded ? cache.over1Img : null,
                      cache.over2Loaded ? cache.over2Img : null,
                      editSet,
                      over1Set,
                      over2Set,
                      currentProgress
                    );

                    if (dynamicFrameCanvas) {
                      player.setImage(dynamicFrameCanvas, assetId);
                    }
                  }
                }
              });
            }

            // Real-time Audio-to-Frame Sync
            try {
              if (player && player.audioPlayer && player.audioPlayer.audios && videoItem) {
                const fps = videoItem.FPS || 20;
                player.audioPlayer.audios.forEach((audio: any) => {
                  if (audio.howl) {
                    // Lazy intercept of howl methods to prevent double-play within the same frame ticker
                    if (!audio.howl._overridden) {
                      audio.howl._overridden = true;
                      const originalPlay = audio.howl.play;
                      const originalPause = audio.howl.pause;
                      const originalStop = audio.howl.stop;
                      
                      audio.howl._playState = 'stopped';
                      audio.howl._activeSoundId = undefined;
                      
                      audio.howl.play = function(id?: any, ...args: any[]) {
                        if (this._playState === 'playing') {
                          return this._activeSoundId;
                        }
                        this._playState = 'playing';
                        const playId = (id !== undefined) ? id : this._activeSoundId;
                        const newId = originalPlay.call(this, playId, ...args);
                        this._activeSoundId = newId;
                        return newId;
                      };
                      
                      audio.howl.pause = function(...args: any[]) {
                        this._playState = 'paused';
                        return originalPause.apply(this, args);
                      };
                      
                      audio.howl.stop = function(...args: any[]) {
                        this._playState = 'stopped';
                        this._activeSoundId = undefined;
                        return originalStop.apply(this, args);
                      };

                      const self = audio.howl;
                      audio.howl.on('end', () => {
                        self._playState = 'stopped';
                        self._activeSoundId = undefined;
                      });
                    }

                    if (frame >= audio.startFrame && frame < audio.endFrame) {
                      const elapsedFrames = frame - audio.startFrame;
                      const targetTime = elapsedFrames / fps;
                      
                      const isPlaying = audio.howl._playState === 'playing';
                      
                      if (statusRef.current === PlayerStatus.PLAYING) {
                        if (!isPlaying) {
                          // Sound should be playing, start it and seek to the exact position!
                          audio.howl.play();
                          audio.howl.seek(targetTime);
                        } else {
                          // It is playing, check if there's any drift/desync (more than 0.15s)
                          const currentTime = audio.howl.seek() as number;
                          if (Math.abs(currentTime - targetTime) > 0.15) {
                            audio.howl.seek(targetTime);
                          }
                        }
                      } else {
                        // If we are paused, make sure the audio is paused and synced
                        if (isPlaying) {
                          audio.howl.pause();
                        }
                        audio.howl.seek(targetTime);
                      }
                    } else {
                      // Out of frame range, pause/stop the audio
                      const isPlaying = audio.howl._playState === 'playing';
                      if (isPlaying) {
                        audio.howl.stop();
                      }
                    }
                  }
                });
              }
            } catch (err) {
              console.warn("Real-time Audio sync failed:", err);
            }
          }
        });

        player.onFinished(() => {
          if (isMounted) {
            statusRef.current = PlayerStatus.PAUSED;
            setStatus(PlayerStatus.PAUSED);
            try {
              const Howler = (window as any).Howler;
              if (Howler && Howler.ctx && typeof Howler.ctx.suspend === 'function') {
                Howler.ctx.suspend().catch((err: any) => {});
              }
            } catch (e) {}

            // Pause all playing howls on completion
            try {
              if (player && player.audioPlayer && player.audioPlayer.audios) {
                player.audioPlayer.audios.forEach((audio: any) => {
                  if (audio.howl && typeof audio.howl.pause === 'function') {
                    audio.howl.pause();
                    audio._wasPlaying = false;
                  }
                });
              }
            } catch (e) {}
          }
        });

        const handleVideoItemReady = (videoItem: any) => {
          if (!isMounted) return;
          if (videoItem.images) {
            const extracted = Object.keys(videoItem.images).map(key => ({
              id: key,
              data: typeof videoItem.images[key] === 'string' 
                ? (videoItem.images[key].startsWith('data') ? videoItem.images[key] : `data:image/png;base64,${videoItem.images[key]}`)
                : videoItem.images[key].src
            }));
            setAssets(extracted);
          }
          videoItemRef.current = videoItem;
          setHasAudio(!!(videoItem.audios && videoItem.audios.length > 0));

          const rawW = videoItem.videoSize?.width || 500;
          const rawH = videoItem.videoSize?.height || 500;

          setVideoSize({
            width: rawW,
            height: rawH
          });

          setCustomWidth(rawW);
          setCustomHeight(rawH);
          setFrameScale(100);
          setDisplayMode('fit');
          setTotalFrames(videoItem.frames || 1);

          // Override player._resize to prevent matrix translation bugs and ensure 100% full rendering
          player._resize = function() {
            if (!this._drawingCanvas || !this._videoItem) return;
            const { width, height } = this._videoItem.videoSize;
            if (this._drawingCanvas.width !== width) this._drawingCanvas.width = width;
            if (this._drawingCanvas.height !== height) this._drawingCanvas.height = height;
            this._drawingCanvas.style.transform = '';
            this._drawingCanvas.style.webkitTransform = '';
          };

          player.setContentMode('AspectFit');
          player.setVideoItem(videoItem);

          statusRef.current = PlayerStatus.PLAYING;
          player.startAnimation();

          // Try to resume audio context if suspended
          try {
            if (player.audioPlayer?.context?.state === 'suspended') {
              player.audioPlayer.context.resume();
            }
          } catch (e) {}

          requestAnimationFrame(() => {
            if (player && typeof player._update === 'function') {
              player._update();
            }
          });

          playerRef.current = player;
          setStatus(PlayerStatus.PLAYING);
        };

        // 1. Fetch raw binary ArrayBuffer directly without giant Data URLs
        let arrayBuffer: ArrayBuffer;
        if (originalFile) {
          arrayBuffer = await originalFile.arrayBuffer();
        } else {
          const res = await fetch(file.url);
          if (!res.ok) throw new Error(`Failed to load SVGA: HTTP ${res.status}`);
          arrayBuffer = await res.arrayBuffer();
        }

        // 2. Wrap as File so svgaplayerweb parser uses internal ArrayBuffer reader directly
        const fileObj = new File([arrayBuffer], file.name || "animation.svga", {
          type: "application/octet-stream"
        });

        // 3. Parser load with direct decompression fallback
        parser.load(fileObj, (videoItem: any) => {
          handleVideoItemReady(videoItem);
        }, async (parserErr: any) => {
          console.warn("svgaplayerweb load failed, activating direct fallback decoder:", parserErr);
          try {
            const bytes = new Uint8Array(arrayBuffer);
            let movie: any;
            const images: Record<string, string> = {};

            // Check if ZIP format (SVGA 1.0 / 1.5, magic bytes: PK\x03\x04)
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
              // Protobuf format (SVGA 2.0)
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
            handleVideoItemReady(fallbackVideoItem);
          } catch (fallbackError) {
            console.error("Direct fallback decoder also failed:", fallbackError);
            if (isMounted) {
              statusRef.current = PlayerStatus.ERROR;
              setStatus(PlayerStatus.ERROR);
            }
          }
        });
      } catch (err) {
        if (isMounted) setStatus(PlayerStatus.ERROR);
      }
    };
    init();
    return () => { 
      isMounted = false; 
      if (player) {
        player.stopAnimation();
        try {
          if (player.audioPlayer && player.audioPlayer.audios) {
            player.audioPlayer.audios.forEach((audio: any) => {
              if (audio.howl) {
                if (typeof audio.howl.stop === 'function') {
                  audio.howl.stop();
                }
                if (typeof audio.howl.unload === 'function') {
                  audio.howl.unload();
                }
              }
            });
          }
        } catch (e) {}
      }
      try {
        const Howler = (window as any).Howler;
        if (Howler) {
          if (typeof Howler.stop === 'function') {
            Howler.stop();
          }
          if (typeof Howler.unload === 'function') {
            Howler.unload();
          }
        }
      } catch (e) {}
    };
  }, [file.url, originalFile, isLoop]);

  const base64ToUint8Array = (base64: string) => {
    const binaryString = window.atob(base64.split(',')[1]);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const handleAddedFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result as string;
        const defaultSettings = {
          scale: 50,
          offsetX: 0,
          offsetY: 0,
          rotation: 0,
          opacity: 100,
        };
        if (activeOverlayTab === 'one') {
          setAddedFileData1(data);
          setAddedFileSettings1(defaultSettings);
        } else {
          setAddedFileData2(data);
          setAddedFileSettings2(defaultSettings);
        }
      };
      reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = '';
  };

  const removeAddedFile = (tab: 'one' | 'two') => {
    if (tab === 'one') {
      setAddedFileData1(null);
    } else {
      setAddedFileData2(null);
    }
  };

  const openEditModal = (assetId: string) => {
    const originalAsset = assets.find(a => a.id === assetId);
    if (originalAsset) {
      setEditingAsset({
        id: assetId,
        originalData: originalAsset.data,
        newImageData: uploadedAssets[assetId] || originalAsset.data
      });
      
      const existing = savedEditSettings[assetId];
      setEditSettings(existing || {
        scale: 100,
        offsetX: 0,
        offsetY: 0,
        glowIntensity: 0,
        solidFill: 0,
        glowColor: '#ffffff',
        smartMatch: true
      });

      const existingAddedData1 = addedAssets1[assetId];
      const existingAddedSettings1 = savedAddedSettings1[assetId];
      setAddedFileData1(existingAddedData1 || null);
      setAddedFileSettings1(existingAddedSettings1 || {
        scale: 50,
        offsetX: 0,
        offsetY: 0,
        rotation: 0,
        opacity: 100,
      });

      const existingAddedData2 = addedAssets2[assetId];
      const existingAddedSettings2 = savedAddedSettings2[assetId];
      setAddedFileData2(existingAddedData2 || null);
      setAddedFileSettings2(existingAddedSettings2 || {
        scale: 50,
        offsetX: 0,
        offsetY: 0,
        rotation: 0,
        opacity: 100,
      });

      setActiveOverlayTab('one');
    }
  };

  const openEditModalWithAddFile = (assetId: string) => {
    openEditModal(assetId);
    setTimeout(() => {
      addedFileInputRef.current?.click();
    }, 150);
  };

  const handleReplaceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeReplaceId) {
      const originalAsset = assets.find(a => a.id === activeReplaceId);
      if (originalAsset) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setEditingAsset({
            id: activeReplaceId,
            originalData: originalAsset.data,
            newImageData: event.target?.result as string
          });
          const existing = savedEditSettings[activeReplaceId];
          setEditSettings(existing || {
            scale: 100,
            offsetX: 0,
            offsetY: 0,
            glowIntensity: 0,
            solidFill: 0,
            glowColor: '#ffffff',
            smartMatch: true
          });
        };
        reader.readAsDataURL(file);
      }
    }
    if (e.target) e.target.value = '';
    setActiveReplaceId(null);
  };

  useEffect(() => {
    if (!editingAsset || !editCanvasRef.current) return;
    
    const origImg = new Image();
    origImg.onload = () => {
      const canvas = editCanvasRef.current!;
      // Use exact original dimensions to ensure standard SVGA files keep their correct layout on export
      canvas.width = origImg.width;
      canvas.height = origImg.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const newImg = new Image();
      newImg.onload = () => {
        ctx.save();
        // Base scale to match original image size relative to the canvas
        const baseScale = Math.min(origImg.width / newImg.width, origImg.height / newImg.height);
        const userScale = editSettings.scale / 100;
        
        const drawW = newImg.width * baseScale * userScale;
        const drawH = newImg.height * baseScale * userScale;
        
        // Center in the canvas and apply user offsets
        const drawX = (canvas.width - drawW) / 2 + editSettings.offsetX;
        const drawY = (canvas.height - drawH) / 2 - editSettings.offsetY;

        if (editSettings.glowIntensity > 0) {
          ctx.shadowColor = editSettings.glowColor;
          ctx.shadowBlur = editSettings.glowIntensity;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          ctx.drawImage(newImg, drawX, drawY, drawW, drawH);
          ctx.drawImage(newImg, drawX, drawY, drawW, drawH);
        } else {
          ctx.drawImage(newImg, drawX, drawY, drawW, drawH);
        }

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        if (editSettings.solidFill > 0) {
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = editSettings.glowColor;
          ctx.globalAlpha = editSettings.solidFill / 100;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.globalAlpha = 1.0;
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.restore();

        // Determine which overlay is active in the current edit tab
        const activeOverlayData = activeOverlayTab === 'one' ? addedFileData1 : addedFileData2;
        const activeOverlaySettings = activeOverlayTab === 'one' ? addedFileSettings1 : addedFileSettings2;

        if (activeOverlayData) {
          const overlayImg = new Image();
          overlayImg.onload = () => {
            ctx.save();
            const overlayScale = (activeOverlaySettings.scale / 100) * baseScale;
            const overW = overlayImg.width * overlayScale;
            const overH = overlayImg.height * overlayScale;
            
            const overX = (canvas.width - overW) / 2 + activeOverlaySettings.offsetX;
            const overY = (canvas.height - overH) / 2 - activeOverlaySettings.offsetY;
            
            ctx.globalAlpha = activeOverlaySettings.opacity / 100;
            
            if (activeOverlaySettings.rotation !== 0) {
              ctx.translate(overX + overW / 2, overY + overH / 2);
              ctx.rotate((activeOverlaySettings.rotation * Math.PI) / 180);
              ctx.drawImage(overlayImg, -overW / 2, -overH / 2, overW, overH);
            } else {
              ctx.drawImage(overlayImg, overX, overY, overW, overH);
            }
            
            ctx.restore();
            
            const dataUrl = canvas.toDataURL('image/png');
            setPreviewUrl(dataUrl);
            if (playerRef.current) {
              playerRef.current.setImage(dataUrl, editingAsset.id);
            }
          };
          overlayImg.src = activeOverlayData;
        } else {
          const dataUrl = canvas.toDataURL('image/png');
          setPreviewUrl(dataUrl);
          if (playerRef.current) {
            playerRef.current.setImage(dataUrl, editingAsset.id);
          }
        }
      };
      newImg.src = editingAsset.newImageData;
    };
    origImg.src = editingAsset.originalData;
  }, [editingAsset, editSettings, addedFileData1, addedFileSettings1, addedFileData2, addedFileSettings2, activeOverlayTab]);

  const generatePreviewDataUrl = (
    origImg: HTMLImageElement,
    newImg: HTMLImageElement,
    overlayImg: HTMLImageElement | null,
    overlaySettings: any
  ): string => {
    const canvas = document.createElement('canvas');
    canvas.width = origImg.width;
    canvas.height = origImg.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.save();
    const baseScale = Math.min(origImg.width / newImg.width, origImg.height / newImg.height);
    const userScale = editSettings.scale / 100;
    
    const drawW = newImg.width * baseScale * userScale;
    const drawH = newImg.height * baseScale * userScale;
    
    const drawX = (canvas.width - drawW) / 2 + editSettings.offsetX;
    const drawY = (canvas.height - drawH) / 2 - editSettings.offsetY;

    if (editSettings.glowIntensity > 0) {
      ctx.shadowColor = editSettings.glowColor;
      ctx.shadowBlur = editSettings.glowIntensity;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.drawImage(newImg, drawX, drawY, drawW, drawH);
      ctx.drawImage(newImg, drawX, drawY, drawW, drawH);
    } else {
      ctx.drawImage(newImg, drawX, drawY, drawW, drawH);
    }

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    if (editSettings.solidFill > 0) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = editSettings.glowColor;
      ctx.globalAlpha = editSettings.solidFill / 100;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();

    if (overlayImg) {
      ctx.save();
      const overlayScale = (overlaySettings.scale / 100) * baseScale;
      const overW = overlayImg.width * overlayScale;
      const overH = overlayImg.height * overlayScale;
      
      const overX = (canvas.width - overW) / 2 + overlaySettings.offsetX;
      const overY = (canvas.height - overH) / 2 - overlaySettings.offsetY;
      
      ctx.globalAlpha = overlaySettings.opacity / 100;
      
      if (overlaySettings.rotation !== 0) {
        ctx.translate(overX + overW / 2, overY + overH / 2);
        ctx.rotate((overlaySettings.rotation * Math.PI) / 180);
        ctx.drawImage(overlayImg, -overW / 2, -overH / 2, overW, overH);
      } else {
        ctx.drawImage(overlayImg, overX, overY, overW, overH);
      }
      ctx.restore();
    }

    return canvas.toDataURL('image/png');
  };

  const applyEdit = () => {
    if (editingAsset) {
      const origImg = new Image();
      origImg.onload = () => {
        const newImg = new Image();
        newImg.onload = () => {
          const loadOverlay1 = (): Promise<HTMLImageElement | null> => {
            if (!addedFileData1) return Promise.resolve(null);
            return new Promise((r) => {
              const img = new Image();
              img.onload = () => r(img);
              img.onerror = () => r(null);
              img.src = addedFileData1;
            });
          };

          const loadOverlay2 = (): Promise<HTMLImageElement | null> => {
            if (!addedFileData2) return Promise.resolve(null);
            return new Promise((r) => {
              const img = new Image();
              img.onload = () => r(img);
              img.onerror = () => r(null);
              img.src = addedFileData2;
            });
          };

          Promise.all([loadOverlay1(), loadOverlay2()]).then(([over1, over2]) => {
            const part1 = generatePreviewDataUrl(origImg, newImg, over1, addedFileSettings1);
            const part2 = generatePreviewDataUrl(origImg, newImg, over2, addedFileSettings2);

            setReplacedAssetsPart1(prev => ({ ...prev, [editingAsset.id]: part1 }));
            setReplacedAssetsPart2(prev => ({ ...prev, [editingAsset.id]: part2 }));

            // Save the raw newImageData in uploadedAssets only if it's different from the original data
            if (editingAsset.newImageData !== editingAsset.originalData) {
              setUploadedAssets(prev => ({ ...prev, [editingAsset.id]: editingAsset.newImageData }));
            }
            
            // Save the editSettings for this asset
            setSavedEditSettings(prev => ({ ...prev, [editingAsset.id]: { ...editSettings } }));

            // Save added overlay assets and settings for part 1
            if (addedFileData1) {
              setAddedAssets1(prev => ({ ...prev, [editingAsset.id]: addedFileData1 }));
              setSavedAddedSettings1(prev => ({ ...prev, [editingAsset.id]: { ...addedFileSettings1 } }));
            } else {
              setAddedAssets1(prev => {
                const newAdded = { ...prev };
                delete newAdded[editingAsset.id];
                return newAdded;
              });
              setSavedAddedSettings1(prev => {
                const newAddedSettings = { ...prev };
                delete newAddedSettings[editingAsset.id];
                return newAddedSettings;
              });
            }

            // Save added overlay assets and settings for part 2
            if (addedFileData2) {
              setAddedAssets2(prev => ({ ...prev, [editingAsset.id]: addedFileData2 }));
              setSavedAddedSettings2(prev => ({ ...prev, [editingAsset.id]: { ...addedFileSettings2 } }));
            } else {
              setAddedAssets2(prev => {
                const newAdded = { ...prev };
                delete newAdded[editingAsset.id];
                return newAdded;
              });
              setSavedAddedSettings2(prev => {
                const newAddedSettings = { ...prev };
                delete newAddedSettings[editingAsset.id];
                return newAddedSettings;
              });
            }
            
            // Immediately set the correct image on the player based on the current timeline progress
            if (playerRef.current) {
              const curProgress = progress;
              const phase = curProgress <= 50 ? 1 : 2;
              playerRef.current.setImage(phase === 1 ? part1 : part2, editingAsset.id);
            }

            // PERSIST THE CHANGE IN THE VIDEO ITEM AND FIX Z-INDEX
            if (videoItemRef.current) {
              const videoItem = videoItemRef.current;
              
              // 1. Update the image resource in the videoItem itself
              if (videoItem.images) {
                 const currentPhaseData = progress <= 50 ? part1 : part2;
                 videoItem.images[editingAsset.id] = currentPhaseData;
                 console.log(`Persisted image update for ${editingAsset.id}`);
              }

              // Keeping the original layer order (Z-Index) intact so swapped elements don't overlap upper layers.

              // 3. Refresh player with the MODIFIED videoItem
              if (playerRef.current) {
                playerRef.current.setVideoItem(videoItem);
                playerRef.current.startAnimation(); // Ensure it keeps playing
              }
            }

            setEditingAsset(null);
            setAddedFileData1(null);
            setAddedFileData2(null);
          });
        };
        newImg.src = editingAsset.newImageData;
      };
      origImg.src = editingAsset.originalData;
    }
  };

  const cancelEdit = () => {
    if (editingAsset && playerRef.current) {
      const previousData = replacedAssetsPart1[editingAsset.id] || replacedAssetsPart2[editingAsset.id] || editingAsset.originalData;
      playerRef.current.setImage(previousData, editingAsset.id);
    }
    setEditingAsset(null);
    setAddedFileData1(null);
    setAddedFileData2(null);
  };

  const togglePlay = () => {
    if (!playerRef.current) return;
    
    // Resume audio context if suspended (browser requirement)
    try {
      if (playerRef.current.audioPlayer && playerRef.current.audioPlayer.context) {
        if (playerRef.current.audioPlayer.context.state === 'suspended') {
          playerRef.current.audioPlayer.context.resume().catch((err: any) => {});
        }
      }
    } catch (e) {
      console.warn("Audio context resume failed", e);
    }

    if (status === PlayerStatus.PLAYING) {
      statusRef.current = PlayerStatus.PAUSED;
      
      // 1. Pause currently playing individual Howls and mark them for resume BEFORE stopping the animation loop!
      try {
        if (playerRef.current.audioPlayer && playerRef.current.audioPlayer.audios) {
          playerRef.current.audioPlayer.audios.forEach((audio: any) => {
            if (audio.howl && audio.howl._playState === 'playing') {
              audio._wasPlaying = true;
              audio.howl.pause();
            }
          });
        }
      } catch (e) {}

      // 2. Pause the player's animation
      playerRef.current.pauseAnimation();
      setStatus(PlayerStatus.PAUSED);
      
      // Mute audio players when pausing to ensure complete silence
      if (typeof playerRef.current.setAudioMuted === 'function') {
        playerRef.current.setAudioMuted(true);
      }
      try {
        const Howler = (window as any).Howler;
        if (Howler && typeof Howler.mute === 'function') {
          Howler.mute(true);
        }
      } catch (e) {}
      try {
        if (playerRef.current.audioPlayer) {
          if (typeof playerRef.current.audioPlayer.mute === 'function') {
            playerRef.current.audioPlayer.mute(true);
          } else if (playerRef.current.audioPlayer.gainNode?.gain) {
            playerRef.current.audioPlayer.gainNode.gain.value = 0;
          }
        }
      } catch (e) {}

      // Suspend Howler context to pause audio
      try {
        const Howler = (window as any).Howler;
        if (Howler && Howler.ctx && typeof Howler.ctx.suspend === 'function') {
          Howler.ctx.suspend().catch((err: any) => {});
        }
      } catch (e) {}

      // Suspend player's internal audio context if present
      try {
        if (playerRef.current.audioPlayer?.context?.state === 'running') {
          playerRef.current.audioPlayer.context.suspend().catch((err: any) => {});
        }
      } catch (e) {}
    } else {
      statusRef.current = PlayerStatus.PLAYING;
      
      // Unmute audio players when playing to ensure sound is heard
      if (typeof playerRef.current.setAudioMuted === 'function') {
        playerRef.current.setAudioMuted(false);
      }
      try {
        const Howler = (window as any).Howler;
        if (Howler && typeof Howler.mute === 'function') {
          Howler.mute(false);
        }
      } catch (e) {}
      try {
        if (playerRef.current.audioPlayer) {
          if (typeof playerRef.current.audioPlayer.mute === 'function') {
            playerRef.current.audioPlayer.mute(false);
          } else if (playerRef.current.audioPlayer.gainNode?.gain) {
            playerRef.current.audioPlayer.gainNode.gain.value = 1;
          }
        }
      } catch (e) {}

      // Resume Howler context to play audio
      try {
        const Howler = (window as any).Howler;
        if (Howler && Howler.ctx && typeof Howler.ctx.resume === 'function') {
          Howler.ctx.resume().catch((err: any) => {});
        }
      } catch (e) {}

      // Resume player's internal audio context if present
      try {
        if (playerRef.current.audioPlayer?.context?.state === 'suspended') {
          playerRef.current.audioPlayer.context.resume().catch((err: any) => {});
        }
      } catch (e) {}

      // Start/Resume the animation
      if (currentFrame >= totalFrames - 1) {
        playerRef.current.startAnimation();
      } else {
        playerRef.current.stepToFrame(currentFrame, true);
      }
      setStatus(PlayerStatus.PLAYING);

      // Seek and resume individual Howls precisely aligned to the current frame position
      try {
        if (playerRef.current.audioPlayer && playerRef.current.audioPlayer.audios && videoItemRef.current) {
          const fps = videoItemRef.current.FPS || 20;
          playerRef.current.audioPlayer.audios.forEach((audio: any) => {
            if (audio.howl) {
              // Lazy intercept of howl methods to prevent double-play within the same frame ticker
              if (!audio.howl._overridden) {
                audio.howl._overridden = true;
                const originalPlay = audio.howl.play;
                const originalPause = audio.howl.pause;
                const originalStop = audio.howl.stop;
                
                audio.howl._playState = 'stopped';
                audio.howl._activeSoundId = undefined;
                
                audio.howl.play = function(id?: any, ...args: any[]) {
                  if (this._playState === 'playing') {
                    return this._activeSoundId;
                  }
                  this._playState = 'playing';
                  const playId = (id !== undefined) ? id : this._activeSoundId;
                  const newId = originalPlay.call(this, playId, ...args);
                  this._activeSoundId = newId;
                  return newId;
                };
                
                audio.howl.pause = function(...args: any[]) {
                  this._playState = 'paused';
                  return originalPause.apply(this, args);
                };
                
                audio.howl.stop = function(...args: any[]) {
                  this._playState = 'stopped';
                  this._activeSoundId = undefined;
                  return originalStop.apply(this, args);
                };

                const self = audio.howl;
                audio.howl.on('end', () => {
                  self._playState = 'stopped';
                  self._activeSoundId = undefined;
                });
              }

              if (currentFrame >= audio.startFrame && currentFrame < audio.endFrame) {
                const elapsedFrames = currentFrame - audio.startFrame;
                const targetTime = elapsedFrames / fps;
                
                const isPlaying = audio.howl._playState === 'playing';
                if (!isPlaying) {
                  audio.howl.play();
                  audio.howl.seek(targetTime);
                } else {
                  audio.howl.seek(targetTime);
                }
                audio._wasPlaying = false;
              } else {
                const isPlaying = audio.howl._playState === 'playing';
                if (isPlaying) {
                  audio.howl.stop();
                }
              }
            }
          });
        }
      } catch (e) {
        console.warn("Failed to seek-resume howls", e);
      }
    }
  };

  const toggleAssetVisibility = (assetId: string) => {
    if (!playerRef.current || !videoItemRef.current) return;
    
    setHiddenAssets(prev => {
      const newHidden = new Set(prev);
      if (newHidden.has(assetId)) {
        newHidden.delete(assetId);
      } else {
        newHidden.add(assetId);
      }
      
      // Update SVGA player dynamically
      const videoItem = videoItemRef.current;
      if (videoItem && videoItem.sprites) {
        // We need to modify the sprites array to hide/show the specific imageKey
        videoItem.sprites.forEach((sprite: any) => {
          if (sprite.imageKey === assetId) {
            // If hiding, we set alpha to 0 for all frames. If showing, we restore original alpha.
            // SVGA Player doesn't have a direct "hide layer" API, so we manipulate the dynamic text/image feature
            // or we can use setImage to replace it with an empty transparent image
          }
        });
        
        if (newHidden.has(assetId)) {
          // Hide by setting an empty transparent 1x1 image
          playerRef.current.setImage('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', assetId);
        } else {
          // Restore original image
          const originalAsset = assets.find(a => a.id === assetId);
          if (originalAsset) {
            playerRef.current.setImage(originalAsset.data, assetId);
          }
        }
      }
      
      return newHidden;
    });
  };

  const exportAsZip = async () => {
    if (!playerRef.current || !videoItemRef.current || exporting) return;
    const JSZip = (window as any).JSZip;
    if (!JSZip) return alert("يرجى الانتظار لتحميل المكتبات اللازمة.");

    try {
      setExporting(true);
      setExportProgress(0);
      setExportStatus('جاري تهيئة محرك الاستخراج...');
      
      playerRef.current.pauseAnimation();
      setStatus(PlayerStatus.PAUSED);

      // Pause currently playing individual Howls and mark them for resume
      try {
        if (playerRef.current.audioPlayer && playerRef.current.audioPlayer.audios) {
          playerRef.current.audioPlayer.audios.forEach((audio: any) => {
            if (audio.howl && typeof audio.howl.playing === 'function' && audio.howl.playing()) {
              audio._wasPlaying = true;
              audio.howl.pause();
            }
          });
        }
      } catch (e) {}

      const { width, height } = videoItemRef.current.videoSize;
      const exportWidth = typeof customWidth === 'number' && customWidth > 0 
        ? customWidth 
        : Math.round((width * frameScale) / 100);
      const exportHeight = typeof customHeight === 'number' && customHeight > 0 
        ? customHeight 
        : Math.round((height * frameScale) / 100);
      const zip = new JSZip();

      const exportContainer = document.createElement('div');
      exportContainer.style.position = 'fixed';
      exportContainer.style.left = '-9999px';
      exportContainer.style.top = '-9999px';
      exportContainer.style.width = `${exportWidth}px`;
      exportContainer.style.height = `${exportHeight}px`;
      exportContainer.style.backgroundColor = 'transparent';
      document.body.appendChild(exportContainer);

      const SVGA = (window as any).SVGA;
      const exportPlayer = new SVGA.Player(exportContainer);
      exportPlayer.setContentMode('Fill'); 
      exportPlayer.setVideoItem(videoItemRef.current);

      // Apply hidden assets to export player
      hiddenAssets.forEach(assetId => {
         exportPlayer.setImage('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', assetId);
      });

      await new Promise(r => setTimeout(r, 800));

      setExportStatus('جاري تحميل وتجهيز صور الملحقات...');
      // Pre-load all edited asset caches before running the synchronous loop
      const loadPromises: Promise<void>[] = [];
      const activeAssetsBefore = assetsRef.current || [];
      activeAssetsBefore.forEach((asset: any) => {
        const assetId = asset.id;
        const hasOverlay1 = !!addedAssets1Ref.current[assetId];
        const hasOverlay2 = !!addedAssets2Ref.current[assetId];
        const hasReplacement = !!uploadedAssetsRef.current[assetId];
        const hasSettings = !!savedEditSettingsRef.current[assetId];

        if (hasOverlay1 || hasOverlay2 || hasReplacement || hasSettings) {
          const bgSrc = uploadedAssetsRef.current[assetId] || asset.data;
          const over1Src = addedAssets1Ref.current[assetId] || '';
          const over2Src = addedAssets2Ref.current[assetId] || '';

          const cache = getMediaCache(assetId, bgSrc, over1Src, over2Src);
          
          const waitForCache = () => {
            return new Promise<void>((resolve) => {
              const check = () => {
                const bgOk = !bgSrc || (cache.bgImg && cache.bgLoaded);
                const over1Ok = !over1Src || (cache.over1Img && cache.over1Loaded);
                const over2Ok = !over2Src || (cache.over2Img && cache.over2Loaded);
                if (bgOk && over1Ok && over2Ok) {
                  resolve();
                } else {
                  setTimeout(check, 30);
                }
              };
              check();
            });
          };
          loadPromises.push(waitForCache());
        }
      });

      await Promise.all(loadPromises);
      await new Promise(r => setTimeout(r, 200));

      for (let i = 0; i < totalFrames; i++) {
        setExportStatus(`جاري التقاط الإطار ${i + 1} من ${totalFrames}...`);
        
        // Render dynamic overlay fades and alignments on each frame before capturing
        const currentProgress = (i / totalFrames) * 100;
        const activeAssets = assetsRef.current || [];
        activeAssets.forEach((asset: any) => {
          const assetId = asset.id;
          
          const hasOverlay1 = !!addedAssets1Ref.current[assetId];
          const hasOverlay2 = !!addedAssets2Ref.current[assetId];
          const hasReplacement = !!uploadedAssetsRef.current[assetId];
          const hasSettings = !!savedEditSettingsRef.current[assetId];

          if (hasOverlay1 || hasOverlay2 || hasReplacement || hasSettings) {
            const bgSrc = uploadedAssetsRef.current[assetId] || asset.data;
            const over1Src = addedAssets1Ref.current[assetId] || '';
            const over2Src = addedAssets2Ref.current[assetId] || '';

            const cache = getMediaCache(assetId, bgSrc, over1Src, over2Src);

            if (cache.bgImg && cache.bgLoaded) {
              const editSet = savedEditSettingsRef.current[assetId];
              const over1Set = savedAddedSettings1Ref.current[assetId];
              const over2Set = savedAddedSettings2Ref.current[assetId];

              const dynamicFrameCanvas = generateProgressFrame(
                cache.bgImg.width || 500,
                cache.bgImg.height || 500,
                cache.bgImg,
                cache.over1Loaded ? cache.over1Img : null,
                cache.over2Loaded ? cache.over2Img : null,
                editSet,
                over1Set,
                over2Set,
                currentProgress
              );

              if (dynamicFrameCanvas) {
                exportPlayer.setImage(dynamicFrameCanvas, assetId);
              }
            }
          }
        });

        exportPlayer.stepToFrame(i, false);
        await new Promise(r => setTimeout(r, 100));
        
        const canvas = exportContainer.querySelector('canvas');
        if (canvas) {
          const outCanvas = document.createElement('canvas');
          outCanvas.width = exportWidth;
          outCanvas.height = exportHeight;
          const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
          if (outCtx) {
            outCtx.clearRect(0, 0, exportWidth, exportHeight);
            outCtx.drawImage(canvas, 0, 0, exportWidth, exportHeight);
            
            // Generate optimized lossless PNG using UPNG (drastically smaller file size with 100% original quality and alpha)
            try {
              const imgData = outCtx.getImageData(0, 0, exportWidth, exportHeight);
              const pngBuffer = UPNG.encode([imgData.data.buffer], exportWidth, exportHeight, 0);
              const frameFileName = `${i.toString().padStart(3, '0')}.png`;
              zip.file(frameFileName, pngBuffer);
            } catch (err) {
              // Fallback to canvas.toDataURL if UPNG encoding fails
              const dataUrl = outCanvas.toDataURL('image/png');
              const base64Data = dataUrl.replace(/^data:image\/(png|jpg);base64,/, "");
              const frameFileName = `${i.toString().padStart(3, '0')}.png`;
              zip.file(frameFileName, base64Data, {base64: true});
            }
          }
        }
        setExportProgress(Math.round(((i + 1) / totalFrames) * 100));
      }

      setExportStatus('جاري ضغط الملف وتحضير التحميل...');
      const content = await zip.generateAsync({type: "blob"});
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${file.name.replace('.svga', '')}_Sequence.zip`;
      link.click();

      document.body.removeChild(exportContainer);
      exportPlayer.clear();
      
      setExporting(false);
      playerRef.current.resumeAnimation();
      setStatus(PlayerStatus.PLAYING);

      // Resume individual Howls that were actively playing before export pause
      try {
        if (playerRef.current.audioPlayer && playerRef.current.audioPlayer.audios) {
          playerRef.current.audioPlayer.audios.forEach((audio: any) => {
            if (audio._wasPlaying && audio.howl && typeof audio.howl.play === 'function') {
              audio.howl.play();
              audio._wasPlaying = false;
            }
          });
        }
      } catch (e) {}
    } catch (err) {
      console.error("Export Error:", err);
      setExporting(false);
      alert("حدث خطأ أثناء التصدير.");
    }
  };

  const exportAsAEProject = async () => {
    if (!playerRef.current || !videoItemRef.current || exporting) return;
    const JSZip = (window as any).JSZip;
    if (!JSZip) return alert("يرجى الانتظار لتحميل المكتبات اللازمة.");

    try {
      setExporting(true);
      setExportProgress(0);
      setExportStatus('جاري تحضير ملفات After Effects...');
      
      const zip = new JSZip();
      const assetsFolder = zip.folder("assets");
      const videoItem = videoItemRef.current;
      
      const imageKeys = Object.keys(videoItem.images);
      
      for (let i = 0; i < imageKeys.length; i++) {
        const key = imageKeys[i];
        let data = videoItem.images[key];
        let base64Data = "";
        if (typeof data === 'string') {
           base64Data = data.replace(/^data:image\/(png|jpg);base64,/, "");
        } else if (data.src) {
           base64Data = data.src.replace(/^data:image\/(png|jpg);base64,/, "");
        }
        
        if (base64Data) {
           assetsFolder?.file(`${key}.png`, base64Data, {base64: true});
        }
      }

      setExportProgress(30);
      setExportStatus('جاري توليد بيانات التحريك...');

      const width = videoItem.videoSize.width;
      const height = videoItem.videoSize.height;
      const exportWidth = typeof customWidth === 'number' && customWidth > 0 
        ? customWidth 
        : Math.round((width * frameScale) / 100);
      const exportHeight = typeof customHeight === 'number' && customHeight > 0 
        ? customHeight 
        : Math.round((height * frameScale) / 100);
      const fps = videoItem.FPS || 30;
      const totalFrames = videoItem.frames;
      const duration = totalFrames / fps;

      const spritesData = videoItem.sprites.map((sprite: any) => {
          return {
              imageKey: sprite.imageKey,
              frames: sprite.frames.map((f: any) => ({
                  alpha: f.alpha,
                  transform: f.transform ? {
                      a: f.transform.a,
                      b: f.transform.b,
                      c: f.transform.c,
                      d: f.transform.d,
                      tx: f.transform.tx,
                      ty: f.transform.ty
                  } : null
              }))
          };
      });

      zip.file("data.json", JSON.stringify(spritesData));

      setExportProgress(60);
      setExportStatus('جاري توليد سكربت JSX...');

      const fileNameWithoutExt = file.name.replace('.svga', '').replace(/"/g, '\\"');
      const jsxContent = `// Auto-generated After Effects Script from Flex Studio Pro
(function() {
    app.beginUndoGroup("Import SVGA");

    var compName = "${fileNameWithoutExt}";
    var compWidth = ${exportWidth};
    var compHeight = ${exportHeight};
    var compPixelAspect = 1;
    var compDuration = ${duration};
    var compFPS = ${fps};

    // Prompt user to select the assets folder
    var assetsFolder = Folder.selectDialog("Please select the 'assets' folder for " + compName);
    if (!assetsFolder) {
        alert("Operation cancelled. You must select the assets folder.");
        return;
    }

    // Look for data.json in the parent directory of the selected assets folder
    var dataFile = new File(assetsFolder.parent.fsName + "/data.json");
    if (!dataFile.exists) {
        // Fallback: look inside the assets folder just in case
        dataFile = new File(assetsFolder.fsName + "/data.json");
        if (!dataFile.exists) {
            alert("Could not find data.json! Please make sure it's in the same folder as the assets folder.");
            return;
        }
    }

    var myItemCollection = app.project.items;
    var myComp = myItemCollection.addComp(compName, compWidth, compHeight, compPixelAspect, compDuration, compFPS);
    myComp.openInViewer();

    var importedAssets = {};

    if (assetsFolder.exists) {
        var files = assetsFolder.getFiles("*.png");
        for (var i = 0; i < files.length; i++) {
            var importOptions = new ImportOptions(files[i]);
            if (importOptions.canImportAs(ImportAsType.FOOTAGE)) {
                var importedItem = app.project.importFile(importOptions);
                var keyName = decodeURIComponent(files[i].name).replace(".png", "");
                importedAssets[keyName] = importedItem;
            }
        }
    }

    dataFile.open("r");
    var jsonString = dataFile.read();
    dataFile.close();

    var sprites = eval("(" + jsonString + ")");

    for (var s = 0; s < sprites.length; s++) {
        var sprite = sprites[s];
        if (!sprite.imageKey || !importedAssets[sprite.imageKey]) continue;
        
        var assetItem = importedAssets[sprite.imageKey];
        var layer = myComp.layers.add(assetItem);
        layer.name = sprite.imageKey + "_" + s;
        
        layer.property("Anchor Point").setValue([0, 0]);
        
        var opacityProp = layer.property("Opacity");
        var positionProp = layer.property("Position");
        var scaleProp = layer.property("Scale");
        var rotationProp = layer.property("Rotation");

        for (var f = 0; f < sprite.frames.length; f++) {
            var frameData = sprite.frames[f];
            var time = f / compFPS;
            
            var alpha = frameData.alpha !== undefined ? frameData.alpha * 100 : 100;
            opacityProp.setValueAtTime(time, alpha);
            
            if (frameData.transform) {
                var t = frameData.transform;
                var scaleX = Math.sqrt(t.a * t.a + t.b * t.b);
                var scaleY = Math.sqrt(t.c * t.c + t.d * t.d);
                
                var det = t.a * t.d - t.b * t.c;
                if (det < 0) {
                    scaleY = -scaleY;
                }
                
                var rotation = 0;
                if (scaleX !== 0) {
                    rotation = Math.atan2(t.b, t.a) * (180 / Math.PI);
                } else if (scaleY !== 0) {
                    rotation = Math.atan2(-t.c, t.d) * (180 / Math.PI);
                }
                
                positionProp.setValueAtTime(time, [t.tx, t.ty]);
                scaleProp.setValueAtTime(time, [scaleX * 100, scaleY * 100]);
                rotationProp.setValueAtTime(time, rotation);
            }
        }
    }

    app.endUndoGroup();
    alert("تم استيراد مشروع SVGA بنجاح!");
})();`;

      zip.file(`${fileNameWithoutExt}.jsx`, jsxContent);

      setExportProgress(80);
      setExportStatus('جاري ضغط الملف وتحضير التحميل...');
      const content = await zip.generateAsync({type: "blob"});
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${file.name.replace('.svga', '')}_AE_Project.zip`;
      link.click();
      
      setExporting(false);
      setExportProgress(100);
    } catch (err) {
      console.error("AE Export Error:", err);
      setExporting(false);
      alert("حدث خطأ أثناء التصدير إلى After Effects.");
    }
  };

  const downloadModifiedSVGA = async () => {
    const isResized = videoItemRef.current?.videoSize && (
      (typeof customWidth === 'number' && customWidth > 0 && customWidth !== videoItemRef.current.videoSize.width) ||
      (typeof customHeight === 'number' && customHeight > 0 && customHeight !== videoItemRef.current.videoSize.height) ||
      frameScale !== 100
    );

    if (!isResized && hiddenAssets.size === 0 && Object.keys(replacedAssetsPart1).length === 0 && Object.keys(replacedAssetsPart2).length === 0) {
      const a = document.createElement('a');
      a.href = file.url;
      a.download = file.name;
      a.click();
      return;
    }

    try {
      setExporting(true);
      setExportStatus('جاري تعديل ملف SVGA...');
      setExportProgress(10);

      let buffer: ArrayBuffer;
      if (originalFile) {
        buffer = await originalFile.arrayBuffer();
      } else {
        const res = await fetch(file.url);
        buffer = await res.arrayBuffer();
      }

      setExportProgress(30);

      const uint8Array = new Uint8Array(buffer);
      const isZip = uint8Array[0] === 0x50 && uint8Array[1] === 0x4B && uint8Array[2] === 0x03 && uint8Array[3] === 0x04;

      const transparentPngBytes = new Uint8Array([
        137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 
        0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 
        0, 0, 11, 73, 68, 65, 84, 8, 215, 99, 96, 0, 2, 0, 0, 5, 0, 
        1, 226, 38, 5, 155, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130
      ]);

      let finalBlob: Blob;

      if (isZip) {
        // SVGA 1.0 (ZIP)
        const JSZip = (window as any).JSZip;
        if (!JSZip) throw new Error("JSZip not loaded");
        
        const zip = await JSZip.loadAsync(buffer);
        setExportProgress(60);

        if (zip.file('spec.json')) {
          const specText = await zip.file('spec.json')!.async('string');
          try {
            const specObj = JSON.parse(specText);
            if (specObj.movie) {
              if (videoItemRef.current?.videoSize) {
                const origW = videoItemRef.current.videoSize.width;
                const origH = videoItemRef.current.videoSize.height;
                const exportW = typeof customWidth === 'number' && customWidth > 0 
                  ? customWidth 
                  : Math.round((origW * frameScale) / 100);
                const exportH = typeof customHeight === 'number' && customHeight > 0 
                  ? customHeight 
                  : Math.round((origH * frameScale) / 100);

                specObj.movie.viewBoxWidth = exportW;
                specObj.movie.viewBoxHeight = exportH;

                const scaleX = origW > 0 ? exportW / origW : 1;
                const scaleY = origH > 0 ? exportH / origH : 1;

                if ((Math.abs(scaleX - 1) > 0.0001 || Math.abs(scaleY - 1) > 0.0001) && specObj.sprites) {
                  specObj.sprites.forEach((sprite: any) => {
                    if (sprite.frames) {
                      sprite.frames.forEach((frame: any) => {
                        if (frame.layout) {
                          frame.layout.x = (frame.layout.x || 0) * scaleX;
                          frame.layout.y = (frame.layout.y || 0) * scaleY;
                          frame.layout.width = (frame.layout.width || 0) * scaleX;
                          frame.layout.height = (frame.layout.height || 0) * scaleY;
                        }
                        if (frame.transform) {
                          frame.transform.a = (frame.transform.a ?? 1) * scaleX;
                          frame.transform.b = (frame.transform.b ?? 0) * scaleY;
                          frame.transform.c = (frame.transform.c ?? 0) * scaleX;
                          frame.transform.d = (frame.transform.d ?? 1) * scaleY;
                          frame.transform.tx = (frame.transform.tx || 0) * scaleX;
                          frame.transform.ty = (frame.transform.ty || 0) * scaleY;
                        }
                      });
                    }
                  });
                }
                zip.file('spec.json', JSON.stringify(specObj));
              }
            }
          } catch (e) {
            console.warn("Error parsing spec.json in SVGA ZIP:", e);
          }
        }

        hiddenAssets.forEach(assetId => {
          const possibleNames = [assetId, `${assetId}.png`, `${assetId}.jpg`, `${assetId}.jpeg`];
          let found = false;
          for (const name of possibleNames) {
            if (zip.file(name)) {
              zip.file(name, transparentPngBytes);
              found = true;
            }
          }
          if (!found) {
            zip.file(assetId, transparentPngBytes);
            zip.file(`${assetId}.png`, transparentPngBytes);
          }
        });

        Object.entries(replacedAssetsPart1).forEach(([assetId, dataUrl]) => {
          const bytes = base64ToUint8Array(dataUrl as string);
          const possibleNames = [assetId, `${assetId}.png`, `${assetId}.jpg`, `${assetId}.jpeg`];
          let found = false;
          for (const name of possibleNames) {
            if (zip.file(name)) {
              zip.file(name, bytes);
              found = true;
            }
          }
          if (!found) {
            zip.file(assetId, bytes);
            zip.file(`${assetId}.png`, bytes);
          }
        });

        Object.entries(replacedAssetsPart2).forEach(([assetId, dataUrl]) => {
          if (replacedAssetsPart1[assetId]) return;
          const bytes = base64ToUint8Array(dataUrl as string);
          const possibleNames = [assetId, `${assetId}.png`, `${assetId}.jpg`, `${assetId}.jpeg`];
          let found = false;
          for (const name of possibleNames) {
            if (zip.file(name)) {
              zip.file(name, bytes);
              found = true;
            }
          }
          if (!found) {
            zip.file(assetId, bytes);
            zip.file(`${assetId}.png`, bytes);
          }
        });

        setExportProgress(80);
        const content = await zip.generateAsync({type: "blob"});
        finalBlob = content;
      } else {
        // SVGA 2.0 (zlib + protobuf)
        setExportStatus('جاري فك ضغط الملف...');
        const inflated = pako.inflate(uint8Array);
        
        setExportProgress(50);
        setExportStatus('جاري تحليل البيانات...');
        
        const root = parse(svgaSchema).root;
        const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
        
        const message = MovieEntity.decode(inflated) as any;
        
        setExportProgress(70);
        setExportStatus('جاري تطبيق التعديلات...');

        if (message.params && videoItemRef.current?.videoSize) {
          const origWidth = videoItemRef.current.videoSize.width;
          const origHeight = videoItemRef.current.videoSize.height;
          const exportWidth = typeof customWidth === 'number' && customWidth > 0 
            ? customWidth 
            : Math.round((origWidth * frameScale) / 100);
          const exportHeight = typeof customHeight === 'number' && customHeight > 0 
            ? customHeight 
            : Math.round((origHeight * frameScale) / 100);

          const scaleX = origWidth > 0 ? exportWidth / origWidth : 1;
          const scaleY = origHeight > 0 ? exportHeight / origHeight : 1;

          message.params.viewBoxWidth = exportWidth;
          message.params.viewBoxHeight = exportHeight;

          if ((Math.abs(scaleX - 1) > 0.0001 || Math.abs(scaleY - 1) > 0.0001) && message.sprites) {
            message.sprites.forEach((sprite: any) => {
              if (sprite.frames) {
                sprite.frames.forEach((frame: any) => {
                  if (frame.layout) {
                    if (typeof frame.layout.x === 'number') frame.layout.x *= scaleX;
                    if (typeof frame.layout.y === 'number') frame.layout.y *= scaleY;
                    if (typeof frame.layout.width === 'number') frame.layout.width *= scaleX;
                    if (typeof frame.layout.height === 'number') frame.layout.height *= scaleY;
                  }
                  if (frame.transform) {
                    if (typeof frame.transform.a === 'number') frame.transform.a *= scaleX;
                    if (typeof frame.transform.b === 'number') frame.transform.b *= scaleY;
                    if (typeof frame.transform.c === 'number') frame.transform.c *= scaleX;
                    if (typeof frame.transform.d === 'number') frame.transform.d *= scaleY;
                    if (typeof frame.transform.tx === 'number') frame.transform.tx *= scaleX;
                    if (typeof frame.transform.ty === 'number') frame.transform.ty *= scaleY;
                  }
                  if (frame.shapes) {
                    frame.shapes.forEach((shape: any) => {
                      if (shape.transform) {
                        if (typeof shape.transform.a === 'number') shape.transform.a *= scaleX;
                        if (typeof shape.transform.b === 'number') shape.transform.b *= scaleY;
                        if (typeof shape.transform.c === 'number') shape.transform.c *= scaleX;
                        if (typeof shape.transform.d === 'number') shape.transform.d *= scaleY;
                        if (typeof shape.transform.tx === 'number') shape.transform.tx *= scaleX;
                        if (typeof shape.transform.ty === 'number') shape.transform.ty *= scaleY;
                      }
                    });
                  }
                });
              }
            });
          }
        }

        if (message.images) {
          hiddenAssets.forEach(assetId => {
            if (message.images[assetId]) {
              message.images[assetId] = transparentPngBytes;
            }
          });
          
          Object.entries(replacedAssetsPart1).forEach(([assetId, dataUrl]) => {
            if (message.images[assetId]) {
              message.images[assetId] = base64ToUint8Array(dataUrl as string);
            }
          });

          Object.entries(replacedAssetsPart2).forEach(([assetId, dataUrl]) => {
            if (replacedAssetsPart1[assetId]) return;
            if (message.images[assetId]) {
              message.images[assetId] = base64ToUint8Array(dataUrl as string);
            }
          });
        }

        setExportProgress(80);
        setExportStatus('جاري إعادة ضغط الملف...');

        const encoded = MovieEntity.encode(message).finish();
        const deflated = pako.deflate(encoded);
        
        finalBlob = new Blob([deflated], { type: 'application/octet-stream' });
      }

      setExportProgress(90);
      setExportStatus('جاري حفظ الملف...');
      
      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.name.replace('.svga', '')}_modified.svga`;
      a.click();
      URL.revokeObjectURL(url);

      setExportProgress(100);
      setExporting(false);
    } catch (err) {
      console.error("SVGA Modify Error:", err);
      setExporting(false);
      alert("حدث خطأ أثناء تعديل وحفظ ملف SVGA. يرجى التأكد من صحة الملف.");
    }
  };

  const handleClose = () => {
    // 1. Stop animation and clear player immediately
    if (playerRef.current) {
      try {
        playerRef.current.stopAnimation();
        playerRef.current.clear();
      } catch (e) {}
    }
    
    // 2. Stop and unload all individual howls inside the player
    try {
      if (playerRef.current && playerRef.current.audioPlayer && playerRef.current.audioPlayer.audios) {
        playerRef.current.audioPlayer.audios.forEach((audio: any) => {
          if (audio.howl) {
            if (typeof audio.howl.stop === 'function') {
              audio.howl.stop();
            }
            if (typeof audio.howl.unload === 'function') {
              audio.howl.unload();
            }
          }
        });
      }
    } catch (e) {
      console.warn("Failed to stop howls inside handleClose:", e);
    }

    // Try to suspend/close AudioContext
    try {
      if (playerRef.current && playerRef.current.audioPlayer && playerRef.current.audioPlayer.context) {
        if (typeof playerRef.current.audioPlayer.context.close === 'function') {
          playerRef.current.audioPlayer.context.close();
        } else if (typeof playerRef.current.audioPlayer.context.suspend === 'function') {
          playerRef.current.audioPlayer.context.suspend();
        }
      }
    } catch (e) {}

    // 3. Stop and unload all Howler sounds globally to be absolutely sure
    try {
      const Howler = (window as any).Howler;
      if (Howler) {
        if (typeof Howler.stop === 'function') {
          Howler.stop();
        }
        if (typeof Howler.unload === 'function') {
          Howler.unload();
        }
      }
    } catch (e) {}

    // 4. Empty the container
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    playerRef.current = null;

    // 5. Call parent's onClear to close/remove the file
    onClear();
  };

  return (
    <div className="flex flex-col bg-transparent w-full overflow-hidden">
      {exporting && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 flex items-center justify-center p-6 text-right" dir="rtl">
          <div className="max-w-md w-full bg-slate-900/60 p-10 rounded-[2.5rem] border border-blue-500/20 shadow-2xl">
            <div className="flex items-center justify-between mb-10">
                <div className="w-16 h-16 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin flex items-center justify-center">
                    <FileArchive size={20} className="text-blue-500" />
                </div>
                <div className="text-right">
                    <h3 className="text-2xl font-black text-white">تصدير PNG</h3>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
                        {exportStatus}
                    </p>
                </div>
            </div>
            
            <div className="space-y-6">
                <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="absolute inset-y-0 right-0 transition-all duration-300 bg-gradient-to-l from-blue-600 to-indigo-500"
                    style={{ width: `${exportProgress}%` }}
                  ></div>
                </div>

                <div className="flex justify-between items-end">
                    <div className="flex flex-col">
                        <span className="text-3xl font-black text-white">{exportProgress}%</span>
                        <span className="text-[10px] text-slate-500 font-bold">نسبة المعالجة</span>
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col h-[750px] bg-slate-900/50 overflow-hidden shadow-2xl relative border border-slate-800/50 rounded-[2.5rem]">
        <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 z-30">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            <h4 className="text-sm font-bold text-white truncate max-w-[250px]">{file.name}</h4>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
             <button 
                onClick={exportAsAEProject}
                disabled={status !== PlayerStatus.PLAYING && status !== PlayerStatus.PAUSED || exporting}
                className="group flex items-center gap-2 px-4 py-2 bg-indigo-600/10 border border-indigo-500/50 text-indigo-400 rounded-xl text-xs font-bold hover:bg-indigo-600/20 transition-all disabled:opacity-30 active:scale-95 shadow-[0_0_15px_rgba(99,102,241,0.05)]"
             >
                <Video size={16} />
                تصدير لـ AE
             </button>
             <button 
                onClick={exportAsZip}
                disabled={status !== PlayerStatus.PLAYING && status !== PlayerStatus.PAUSED || exporting}
                className="group flex items-center gap-2 px-4 py-2 bg-blue-600/10 border border-blue-500/50 text-blue-400 rounded-xl text-xs font-bold hover:bg-blue-600/20 transition-all disabled:opacity-30 active:scale-95 shadow-[0_0_15px_rgba(59,130,246,0.05)]"
             >
                <FileArchive size={16} />
                تصدير لـ PNG
             </button>
             <div className="w-px h-6 bg-slate-800 mx-1"></div>
             <button 
                onClick={downloadModifiedSVGA} 
                className="group flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all active:scale-95"
                title="تحميل ملف SVGA (يتضمن التعديلات)"
             >
                <Download size={16} />
                تحميل SVGA
             </button>
             <button onClick={handleClose} className="p-2 text-slate-500 hover:text-white transition-colors ml-2" title="إغلاق الملف">
                <X size={18} />
             </button>
          </div>
        </div>

        <div 
          ref={viewportRef}
          className={`flex-1 relative transition-colors duration-500 flex items-center justify-center m-4 rounded-[2rem] border border-slate-800/30 ${
            isOverflowing 
              ? 'overflow-auto scrollbar-thin scrollbar-thumb-slate-700/50 scrollbar-track-transparent' 
              : 'overflow-hidden'
          }`} 
          style={{ backgroundColor: bgColor }}
        >
          {status === PlayerStatus.LOADING && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-slate-900/50">
              <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
              <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">جاري تهيئة العرض...</p>
            </div>
          )}

          {/* Floating Viewport Quick Controls (Fit, 1:1, Zoom) */}
          {videoSize && (
            <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-slate-900/60 backdrop-blur-md px-2.5 py-1.5 rounded-2xl border border-slate-800/60 shadow-lg select-none">
              <button
                onClick={() => {
                  setDisplayMode('fit');
                  setFrameScale(100);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                  displayMode === 'fit'
                    ? 'bg-blue-500/15 border border-blue-500/30 text-blue-400'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
                title="عرض كامل دون قص أو إخفاء (احتواء تلقائي)"
              >
                <Maximize2 size={13} />
                <span>احتواء كامل</span>
              </button>

              <button
                onClick={() => {
                  setDisplayMode('actual');
                  setFrameScale(100);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                  displayMode === 'actual'
                    ? 'bg-blue-500/15 border border-blue-500/30 text-blue-400'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
                title="عرض بالحجم الأصلي الحقيقي 100%"
              >
                <ZoomIn size={13} />
                <span>100% الأصلي</span>
              </button>

              <div className="w-px h-4 bg-slate-800 mx-0.5"></div>

              <button
                onClick={() => {
                  setDisplayMode('custom');
                  setFrameScale(prev => Math.max(20, prev - 15));
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                title="تصغير العرض"
              >
                <ZoomOut size={13} />
              </button>

              <span className="text-[11px] font-mono text-blue-400 font-bold px-1 min-w-[36px] text-center">
                {displayDimensions.scalePercent}%
              </span>

              <button
                onClick={() => {
                  setDisplayMode('custom');
                  setFrameScale(prev => Math.min(300, prev + 15));
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                title="تكبير العرض"
              >
                <ZoomIn size={13} />
              </button>
            </div>
          )}

          <div className="w-full h-full flex items-center justify-center p-4 transition-all duration-300 ease-out overflow-visible">
            <div 
              id="svga-player-container-frame"
              className="relative flex items-center justify-center transition-all duration-300 ease-out overflow-visible select-none"
              style={{
                width: displayDimensions.width,
                height: displayDimensions.height,
                maxWidth: displayMode === 'fit' ? '100%' : undefined,
                maxHeight: displayMode === 'fit' ? '100%' : undefined,
              }}
            >
              <div 
                id="svga-player-container"
                ref={containerRef} 
                className="w-full h-full pointer-events-none flex items-center justify-center relative overflow-visible" 
              />
            </div>
          </div>
        </div>

        <div className="p-8 bg-slate-900/50 border-t border-slate-800 z-30">
          <div className="max-w-5xl mx-auto flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <button
                onClick={togglePlay}
                className="p-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-all active:scale-95 flex items-center justify-center"
                title={status === PlayerStatus.PLAYING ? 'إيقاف مؤقت' : 'تشغيل الأنيميشن'}
              >
                {status === PlayerStatus.PLAYING ? <Pause size={15} /> : <Play size={15} />}
              </button>
              <span className="text-[10px] font-mono text-slate-500 w-14 text-center bg-slate-900 py-1 rounded-md border border-slate-800">{currentFrame} / {totalFrames}</span>
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/30">
                <div className="h-full bg-gradient-to-l from-blue-600 to-blue-400 shadow-[0_0_10px_rgba(37,99,235,0.3)] transition-all duration-100" style={{ width: `${progress}%` }}></div>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              {/* Composition Size Direct Pixel Controls */}
              <div className="flex flex-col items-center lg:items-start gap-3 w-full lg:w-auto">
                <div className="flex items-center gap-2">
                  <Scaling size={14} className="text-indigo-400" />
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    حجم الإطار (Dimensions)
                  </span>
                </div>

                {/* Direct Pixel Size Inputs */}
                <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-2xl border border-slate-800/50">
                  <div className="flex items-center gap-1.5 bg-slate-900/50 px-2.5 py-1 rounded-xl border border-slate-800/50">
                    <span className="text-[10px] text-slate-400 font-bold">العرض:</span>
                    <input
                      type="number"
                      value={customWidth}
                      onChange={(e) => handleWidthChange(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="336"
                      className="w-16 bg-transparent text-xs font-mono font-bold text-white focus:outline-none text-center"
                    />
                    <span className="text-[10px] text-slate-500">px</span>
                  </div>

                  <button
                    onClick={() => setLockAspect(!lockAspect)}
                    className={`p-1.5 rounded-xl border transition-all ${
                      lockAspect
                        ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                        : 'bg-slate-900/50 text-slate-500 border-slate-800/50 hover:text-slate-300'
                    }`}
                    title={lockAspect ? 'ربط نسبة العرض إلى الارتفاع (مفعّل)' : 'فك ربط نسبة العرض إلى الارتفاع'}
                  >
                    {lockAspect ? <Link size={14} /> : <Unlink size={14} />}
                  </button>

                  <div className="flex items-center gap-1.5 bg-slate-900/50 px-2.5 py-1 rounded-xl border border-slate-800/50">
                    <span className="text-[10px] text-slate-400 font-bold">الارتفاع:</span>
                    <input
                      type="number"
                      value={customHeight}
                      onChange={(e) => handleHeightChange(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="336"
                      className="w-16 bg-transparent text-xs font-mono font-bold text-white focus:outline-none text-center"
                    />
                    <span className="text-[10px] text-slate-500">px</span>
                  </div>

                  <button
                    onClick={() => handleScalePreset(100)}
                    className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all border border-slate-800/50 bg-slate-900/50"
                    title="إعادة ضبط حجم الإطار إلى الأصلي"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              </div>
              
              <div className="flex flex-col items-center lg:items-end gap-3 w-full lg:w-auto">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">لون خلفية العرض</span>
                <div className="flex gap-2 bg-slate-900/20 p-2 rounded-2xl border border-slate-800/50">
                  {bgOptions.map(opt => (
                    <button 
                      key={opt.value} 
                      onClick={() => setBgColor(opt.value)} 
                      className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                        bgColor === opt.value 
                          ? 'bg-blue-500/20 border border-blue-500/30 text-blue-400' 
                          : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-8 bg-slate-900/50 border border-slate-800 rounded-[2.5rem] mt-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-10 border-b border-slate-800 pb-5">
            <div className="p-2 bg-indigo-500/10 rounded-xl">
              <Layers className="text-indigo-400" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white text-right">مكتبة العناصر</h3>
              <p className="text-xs text-slate-500 text-right">العناصر الصورية المكتشفة داخل ملف الـ SVGA</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/png, image/jpeg" 
              onChange={handleReplaceFileChange} 
            />
            <input 
              type="file" 
              ref={addedFileInputRef} 
              className="hidden" 
              accept="image/png, image/jpeg" 
              onChange={handleAddedFileChange} 
            />
            {assets.map((asset, idx) => {
              const isHidden = hiddenAssets.has(asset.id);
              const isReplaced = !!replacedAssetsPart1[asset.id] || !!replacedAssetsPart2[asset.id];
              const displayData = replacedAssetsPart1[asset.id] || replacedAssetsPart2[asset.id] || asset.data;
              
              return (
              <div key={asset.id + idx} className={`group relative bg-slate-900/40 rounded-[2rem] border ${isHidden ? 'border-red-500/50 opacity-50' : isReplaced ? 'border-green-500/50' : 'border-slate-800 hover:border-indigo-500/50'} overflow-hidden transition-all duration-300`}>
                <div 
                  onClick={() => openEditModal(asset.id)}
                  className="aspect-square relative bg-slate-800/30 p-4 flex items-center justify-center overflow-hidden cursor-pointer"
                >
                  <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/checkerboard.png')]"></div>
                  <img src={displayData} alt={asset.id} className={`relative max-w-full max-h-full object-contain drop-shadow-xl transition-transform duration-500 ${isHidden ? 'grayscale' : 'group-hover:scale-110'}`} />
                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                     <button 
                       onClick={() => toggleAssetVisibility(asset.id)} 
                       className={`p-2.5 rounded-full text-white transition-all active:scale-90 ${isHidden ? 'bg-green-500/20 hover:bg-green-500/40' : 'bg-red-500/20 hover:bg-red-500/40'}`}
                       title={isHidden ? "استرجاع القطعة" : "إخفاء القطعة"}
                     >
                      {isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                     </button>
                     <button 
                       onClick={() => {
                         setActiveReplaceId(asset.id);
                         fileInputRef.current?.click();
                       }} 
                       className="p-2.5 bg-blue-500/20 hover:bg-blue-500/40 rounded-full text-white transition-all active:scale-90"
                       title="استبدال القطعة (بالمقاس الذكي)"
                     >
                      <RefreshCw size={16} />
                     </button>
                     <button 
                       onClick={() => { const l=document.createElement('a'); l.href=displayData; l.download=`${asset.id}.png`; l.click(); }} 
                       className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all active:scale-90"
                       title="تحميل القطعة"
                     >
                      <Download size={16} />
                     </button>
                  </div>
                </div>
                <div 
                  onClick={() => openEditModal(asset.id)}
                  className="p-3 bg-slate-900/80 text-center border-t border-slate-800/50 cursor-pointer hover:bg-slate-800 transition-colors"
                >
                  <span className="text-[10px] font-mono text-slate-400 truncate block px-2">ID: {asset.id}</span>
                </div>
              </div>
            )})}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingAsset && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-transparent pointer-events-none animate-fade-in" dir="rtl">
          <div 
            style={{ transform: `translate(${modalOffset.x}px, ${modalOffset.y}px)` }}
            className="bg-slate-900 border border-slate-800 rounded-[2rem] shadow-2xl shadow-black/80 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] pointer-events-auto"
          >
            {/* Header */}
            <div 
              onMouseDown={handleDragStart}
              onTouchStart={handleTouchStart}
              className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/20 cursor-grab active:cursor-grabbing select-none"
            >
              <div className="flex items-center gap-2">
                <Settings2 size={18} className="text-indigo-400" />
                <h3 className="text-white text-sm font-bold truncate max-w-[220px]">تعديل: {editingAsset.id}</h3>
              </div>
              <button 
                onClick={cancelEdit} 
                onMouseDown={(e) => e.stopPropagation()} 
                onTouchStart={(e) => e.stopPropagation()}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-5 flex flex-col gap-5 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              
              {/* Compact Preview Area */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-full h-40 bg-[url('https://www.transparenttextures.com/patterns/checkerboard.png')] bg-slate-950 border border-slate-800/80 rounded-2xl flex items-center justify-center p-4 shadow-inner overflow-hidden">
                  {previewUrl && (
                    <img 
                      src={previewUrl} 
                      className="max-w-full max-h-full object-contain drop-shadow-lg transition-transform" 
                      alt="Preview" 
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
                <div className="flex gap-2.5 flex-wrap justify-center w-full">
                  <button 
                    onClick={() => {
                      setActiveReplaceId(editingAsset.id);
                      fileInputRef.current?.click();
                    }}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 px-3.5 py-2 rounded-xl border border-blue-500/20 transition-all active:scale-95 flex-1 justify-center"
                  >
                    <RefreshCw size={12} />
                    استبدال بملف آخر
                  </button>
                  <button 
                    onClick={() => {
                      addedFileInputRef.current?.click();
                    }}
                    className="text-[11px] text-green-400 hover:text-green-300 font-bold flex items-center gap-1.5 bg-green-500/10 hover:bg-green-500/20 px-3.5 py-2 rounded-xl border border-green-500/20 transition-all active:scale-95 flex-1 justify-center"
                  >
                    <Plus size={12} />
                    إضافة قطعة إضافية
                  </button>
                </div>
              </div>

              {/* Extra Overlay Assets Section */}
              <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800 flex flex-col gap-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-300">القطع الإضافية المتزامنة مع الوقت</span>
                </div>

                {/* Tab selector */}
                <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setActiveOverlayTab('one')}
                    className={`py-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-0.5 ${
                      activeOverlayTab === 'one'
                        ? 'bg-gradient-to-l from-green-500/20 to-emerald-500/10 text-green-400 border border-green-500/20 shadow-md'
                        : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    <span>القطعة الأولى</span>
                    <span className="text-[9px] opacity-75 font-mono">(0% - 50%)</span>
                  </button>
                  <button
                    onClick={() => setActiveOverlayTab('two')}
                    className={`py-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-0.5 ${
                      activeOverlayTab === 'two'
                        ? 'bg-gradient-to-l from-green-500/20 to-emerald-500/10 text-green-400 border border-green-500/20 shadow-md'
                        : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    <span>القطعة الثانية</span>
                    <span className="text-[9px] opacity-75 font-mono">(50% - 100%)</span>
                  </button>
                </div>

                {/* Tab Content */}
                {activeOverlayTab === 'one' ? (
                  addedFileData1 ? (
                    <div className="flex flex-col gap-4 animate-fade-in">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-slate-400 font-bold">إعدادات القطعة الأولى</span>
                        <button 
                          onClick={() => removeAddedFile('one')}
                          className="text-[10px] text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 rounded-lg border border-red-500/10 transition-all active:scale-95"
                        >
                          حذف القطعة
                        </button>
                      </div>

                      {/* Scale */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-xs font-bold text-slate-300">
                          <span>حجم القطعة</span>
                          <span className="text-green-400">{addedFileSettings1.scale}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="5" 
                          max="200" 
                          value={addedFileSettings1.scale} 
                          onChange={(e) => setAddedFileSettings1(s => ({...s, scale: Number(e.target.value)}))} 
                          className="w-full accent-green-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/30 transition-all" 
                        />
                      </div>

                      {/* Offset X & Y in a grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between text-xs text-slate-300">
                            <span>إزاحة أفقية (X)</span>
                            <span className="text-green-400 font-mono text-[11px]">{addedFileSettings1.offsetX}px</span>
                          </div>
                          <input 
                            type="range" 
                            min="-400" 
                            max="400" 
                            value={addedFileSettings1.offsetX} 
                            onChange={(e) => setAddedFileSettings1(s => ({...s, offsetX: Number(e.target.value)}))} 
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
                                e.preventDefault();
                                setAddedFileSettings1(s => ({ ...s, offsetX: Math.min(400, s.offsetX + 1) }));
                              } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
                                e.preventDefault();
                                setAddedFileSettings1(s => ({ ...s, offsetX: Math.max(-400, s.offsetX - 1) }));
                              }
                            }}
                            className="w-full accent-green-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/30 transition-all" 
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between text-xs text-slate-300">
                            <span>إزاحة عمودية (Y)</span>
                            <span className="text-green-400 font-mono text-[11px]">{addedFileSettings1.offsetY}px</span>
                          </div>
                          <input 
                            type="range" 
                            min="-400" 
                            max="400" 
                            value={addedFileSettings1.offsetY} 
                            onChange={(e) => setAddedFileSettings1(s => ({...s, offsetY: Number(e.target.value)}))} 
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
                                e.preventDefault();
                                setAddedFileSettings1(s => ({ ...s, offsetY: Math.min(400, s.offsetY + 1) }));
                              } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
                                e.preventDefault();
                                setAddedFileSettings1(s => ({ ...s, offsetY: Math.max(-400, s.offsetY - 1) }));
                              }
                            }}
                            className="w-full accent-green-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/30 transition-all" 
                          />
                        </div>
                      </div>

                      {/* Rotation & Opacity in grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between text-xs text-slate-300">
                            <span>زاوية الدوران</span>
                            <span className="text-green-400 font-mono text-[11px]">{addedFileSettings1.rotation}°</span>
                          </div>
                          <input 
                            type="range" 
                            min="-180" 
                            max="180" 
                            value={addedFileSettings1.rotation} 
                            onChange={(e) => setAddedFileSettings1(s => ({...s, rotation: Number(e.target.value)}))} 
                            className="w-full accent-green-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/30 transition-all" 
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between text-xs text-slate-300">
                            <span>الشفافية</span>
                            <span className="text-green-400 font-mono text-[11px]">{addedFileSettings1.opacity}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={addedFileSettings1.opacity} 
                            onChange={(e) => setAddedFileSettings1(s => ({...s, opacity: Number(e.target.value)}))} 
                            className="w-full accent-green-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/30 transition-all" 
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => addedFileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-800 hover:border-green-500/50 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 group transition-all bg-slate-900/20 active:scale-95"
                    >
                      <Plus className="text-slate-500 group-hover:text-green-400 transition-colors" size={24} />
                      <span className="text-xs text-slate-400 group-hover:text-slate-300 font-bold">اضغط لإضافة صورة للقطعة الأولى</span>
                    </button>
                  )
                ) : (
                  addedFileData2 ? (
                    <div className="flex flex-col gap-4 animate-fade-in">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-slate-400 font-bold">إعدادات القطعة الثانية</span>
                        <button 
                          onClick={() => removeAddedFile('two')}
                          className="text-[10px] text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 rounded-lg border border-red-500/10 transition-all active:scale-95"
                        >
                          حذف القطعة
                        </button>
                      </div>

                      {/* Scale */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-xs font-bold text-slate-300">
                          <span>حجم القطعة</span>
                          <span className="text-green-400">{addedFileSettings2.scale}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="5" 
                          max="200" 
                          value={addedFileSettings2.scale} 
                          onChange={(e) => setAddedFileSettings2(s => ({...s, scale: Number(e.target.value)}))} 
                          className="w-full accent-green-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/30 transition-all" 
                        />
                      </div>

                      {/* Offset X & Y in a grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between text-xs text-slate-300">
                            <span>إزاحة أفقية (X)</span>
                            <span className="text-green-400 font-mono text-[11px]">{addedFileSettings2.offsetX}px</span>
                          </div>
                          <input 
                            type="range" 
                            min="-400" 
                            max="400" 
                            value={addedFileSettings2.offsetX} 
                            onChange={(e) => setAddedFileSettings2(s => ({...s, offsetX: Number(e.target.value)}))} 
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
                                e.preventDefault();
                                setAddedFileSettings2(s => ({ ...s, offsetX: Math.min(400, s.offsetX + 1) }));
                              } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
                                e.preventDefault();
                                setAddedFileSettings2(s => ({ ...s, offsetX: Math.max(-400, s.offsetX - 1) }));
                              }
                            }}
                            className="w-full accent-green-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/30 transition-all" 
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between text-xs text-slate-300">
                            <span>إزاحة عمودية (Y)</span>
                            <span className="text-green-400 font-mono text-[11px]">{addedFileSettings2.offsetY}px</span>
                          </div>
                          <input 
                            type="range" 
                            min="-400" 
                            max="400" 
                            value={addedFileSettings2.offsetY} 
                            onChange={(e) => setAddedFileSettings2(s => ({...s, offsetY: Number(e.target.value)}))} 
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
                                e.preventDefault();
                                setAddedFileSettings2(s => ({ ...s, offsetY: Math.min(400, s.offsetY + 1) }));
                              } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
                                e.preventDefault();
                                setAddedFileSettings2(s => ({ ...s, offsetY: Math.max(-400, s.offsetY - 1) }));
                              }
                            }}
                            className="w-full accent-green-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/30 transition-all" 
                          />
                        </div>
                      </div>

                      {/* Rotation & Opacity in grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between text-xs text-slate-300">
                            <span>زاوية الدوران</span>
                            <span className="text-green-400 font-mono text-[11px]">{addedFileSettings2.rotation}°</span>
                          </div>
                          <input 
                            type="range" 
                            min="-180" 
                            max="180" 
                            value={addedFileSettings2.rotation} 
                            onChange={(e) => setAddedFileSettings2(s => ({...s, rotation: Number(e.target.value)}))} 
                            className="w-full accent-green-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/30 transition-all" 
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between text-xs text-slate-300">
                            <span>الشفافية</span>
                            <span className="text-green-400 font-mono text-[11px]">{addedFileSettings2.opacity}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={addedFileSettings2.opacity} 
                            onChange={(e) => setAddedFileSettings2(s => ({...s, opacity: Number(e.target.value)}))} 
                            className="w-full accent-green-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/30 transition-all" 
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => addedFileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-800 hover:border-green-500/50 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 group transition-all bg-slate-900/20 active:scale-95"
                    >
                      <Plus className="text-slate-500 group-hover:text-green-400 transition-colors" size={24} />
                      <span className="text-xs text-slate-400 group-hover:text-slate-300 font-bold">اضغط لإضافة صورة للقطعة الثانية</span>
                    </button>
                  )
                )}
              </div>

              {/* Controls */}
              <div className="flex flex-col gap-4">
                {/* Scale */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-300">
                    <span>حجم القطعة (Scale)</span>
                    <span className="text-indigo-400">{editSettings.scale}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="400" 
                    value={editSettings.scale} 
                    onChange={(e) => setEditSettings(s => ({...s, scale: Number(e.target.value)}))} 
                    className="w-full accent-indigo-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/30 transition-all hover:bg-white/30 hover:border-white/60" 
                  />
                </div>

                {/* Offset X & Y in a grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>إزاحة أفقية (X)</span>
                      <span className="text-indigo-400 font-mono text-[11px]">{editSettings.offsetX}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="-200" 
                      max="200" 
                      value={editSettings.offsetX} 
                      onChange={(e) => setEditSettings(s => ({...s, offsetX: Number(e.target.value)}))} 
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
                          e.preventDefault();
                          setEditSettings(s => ({ ...s, offsetX: Math.min(200, s.offsetX + 1) }));
                        } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
                          e.preventDefault();
                          setEditSettings(s => ({ ...s, offsetX: Math.max(-200, s.offsetX - 1) }));
                        }
                      }}
                      className="w-full accent-indigo-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/30 transition-all hover:bg-white/30 hover:border-white/60" 
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>إزاحة عمودية (Y)</span>
                      <span className="text-indigo-400 font-mono text-[11px]">{editSettings.offsetY}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="-200" 
                      max="200" 
                      value={editSettings.offsetY} 
                      onChange={(e) => setEditSettings(s => ({...s, offsetY: Number(e.target.value)}))} 
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
                          e.preventDefault();
                          setEditSettings(s => ({ ...s, offsetY: Math.min(200, s.offsetY + 1) }));
                        } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
                          e.preventDefault();
                          setEditSettings(s => ({ ...s, offsetY: Math.max(-200, s.offsetY - 1) }));
                        }
                      }}
                      className="w-full accent-indigo-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/30 transition-all hover:bg-white/30 hover:border-white/60" 
                    />
                  </div>
                </div>

                <div className="h-px bg-slate-800/60 w-full my-1"></div>

                {/* Glow Color & Intensity in a row or tight stack */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-slate-300">لون التأثير</span>
                    <div className="flex gap-2 items-center bg-slate-950/45 p-1.5 rounded-xl border border-slate-800/80">
                      <input 
                        type="color" 
                        value={editSettings.glowColor} 
                        onChange={(e) => setEditSettings(s => ({...s, glowColor: e.target.value}))} 
                        className="w-6 h-6 rounded cursor-pointer bg-transparent border-none" 
                      />
                      <span className="text-[10px] font-mono text-slate-400 uppercase">{editSettings.glowColor}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>قوة التوهج</span>
                      <span className="text-pink-400 font-mono text-[11px]">{editSettings.glowIntensity}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={editSettings.glowIntensity} 
                      onChange={(e) => setEditSettings(s => ({...s, glowIntensity: Number(e.target.value)}))} 
                      className="w-full accent-pink-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/30 transition-all hover:bg-white/30 hover:border-white/60" 
                    />
                  </div>
                </div>

                {/* Solid Fill */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>تعبئة اللمعة (Solid Fill)</span>
                    <span className="text-pink-400 font-mono text-[11px]">{editSettings.solidFill}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={editSettings.solidFill} 
                    onChange={(e) => setEditSettings(s => ({...s, solidFill: Number(e.target.value)}))} 
                    className="w-full accent-pink-500 h-2 bg-white/20 rounded-full appearance-none cursor-pointer border border-white/30 transition-all hover:bg-white/30 hover:border-white/60" 
                  />
                </div>
              </div>

            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-slate-950/30 border-t border-slate-800 flex gap-3">
              <button 
                onClick={cancelEdit}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700/80 text-slate-300 rounded-xl text-xs font-bold transition-all active:scale-95 border border-slate-700/30"
              >
                إلغاء
              </button>
              <button 
                onClick={applyEdit}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
              >
                <Check size={14} />
                تطبيق وحفظ
              </button>
            </div>
          </div>
          <canvas ref={editCanvasRef} className="hidden" />
        </div>
      )}
    </div>
  );
};
