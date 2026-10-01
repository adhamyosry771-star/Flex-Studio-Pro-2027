import React, { useEffect, useRef, useState } from 'react';
import { 
  Layers,
  Download,
  FileArchive,
  Eye,
  EyeOff,
  RefreshCw,
  X,
  Settings2,
  Check,
  Play,
  Pause,
  RotateCcw,
  Image as ImageIcon
} from 'lucide-react';
import { PAGInit } from 'libpag';
import * as UPNG from 'upng-js';
import { SVGAFileInfo, PlayerStatus } from '../types';

interface PAGViewerProps {
  file: SVGAFileInfo;
  onClear: () => void;
  originalFile?: File; 
}

let pagPromise: Promise<any> | null = null;

const initPAGSingleton = () => {
  if (!pagPromise) {
    pagPromise = PAGInit({
      locateFile: (file: string) => 'https://cdn.jsdelivr.net/npm/libpag@4.5.76/lib/' + file
    });
  }
  return pagPromise;
};

export const PAGViewer: React.FC<PAGViewerProps> = ({ file, onClear, originalFile }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pagViewRef = useRef<any>(null);
  const pagFileRef = useRef<any>(null);
  const pagInstanceRef = useRef<any>(null);
  
  const [status, setStatus] = useState<PlayerStatus>(PlayerStatus.LOADING);
  const [isLoop, setIsLoop] = useState(true);
  const [bgColor, setBgColor] = useState('#0f172a');
  const [progress, setProgress] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [videoSize, setVideoSize] = useState<{width: number, height: number} | null>(null);
  const [numImages, setNumImages] = useState<number>(0);
  const [assets, setAssets] = useState<{id: string, name: string, data?: string}[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [hiddenAssets, setHiddenAssets] = useState<Set<number>>(new Set());
  const [replacedAssets, setReplacedAssets] = useState<Record<number, string>>({});
  
  const [editingAsset, setEditingAsset] = useState<{
    index: number;
    originalName: string;
    newImageData?: string;
  } | null>(null);

  const [editSettings, setEditSettings] = useState({
    scale: 100,
    offsetX: 0,
    offsetY: 0,
    glowIntensity: 0,
    solidFill: 0,
    glowColor: '#ffffff',
  });

  const [savedEditSettings, setSavedEditSettings] = useState<Record<number, typeof editSettings>>({});
  const [originalPreviews, setOriginalPreviews] = useState<Record<number, string>>({});

  const editCanvasRef = useRef<HTMLCanvasElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeReplaceIndex, setActiveReplaceIndex] = useState<number | null>(null);

  // Drag states for editing modal
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [modalOffset, setModalOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!editingAsset) {
      setModalOffset({ x: 0, y: 0 });
    }
  }, [editingAsset]);

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
    if (e.button !== 0) return;
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

  // Initialize PAG View
  useEffect(() => {
    let isMounted = true;
    let pagView: any = null;

    const init = async () => {
      try {
        setStatus(PlayerStatus.LOADING);
        setErrorMsg(null);
        
        const PAG = await initPAGSingleton();
        pagInstanceRef.current = PAG;

        if (!isMounted) return;

        let pagFile;
        try {
          if (originalFile) {
            pagFile = await PAG.PAGFile.load(originalFile);
          } else {
            const res = await fetch(file.url);
            const blob = await res.blob();
            const customFile = new window.File([blob], file.name || 'animation.pag');
            pagFile = await PAG.PAGFile.load(customFile);
          }
        } catch (err) {
          console.warn('Failed to load File directly, trying ArrayBuffer...', err);
          let buffer: ArrayBuffer;
          if (originalFile) {
            buffer = await originalFile.arrayBuffer();
          } else {
            const res = await fetch(file.url);
            buffer = await res.arrayBuffer();
          }
          try {
            const customFile = new window.File([buffer], file.name || 'animation.pag');
            pagFile = await PAG.PAGFile.load(customFile);
          } catch (fileErr) {
            try {
              pagFile = await PAG.PAGFile.load(new Uint8Array(buffer));
            } catch (loadErr) {
              pagFile = await PAG.PAGFile.load(buffer);
            }
          }
        }

        if (!isMounted) return;

        pagFileRef.current = pagFile;

        const width = pagFile.width();
        const height = pagFile.height();
        setVideoSize({ width, height });

        const fps = pagFile.frameRate();
        const durationSec = pagFile.duration() / 1000000;
        const framesCount = Math.round(durationSec * fps) || 1;
        setTotalFrames(framesCount);

        const imagesCount = pagFile.numImages();
        setNumImages(imagesCount);

        // Extract original previews by isolating each replaceable layer
        const previews: Record<number, string> = {};
        if (imagesCount > 0) {
          try {
            const layerType = PAG.LayerType ? PAG.LayerType.Image : 5;
            
            const tempCanvas = document.createElement('canvas');
            // Use the original design size to ensure perfect fit
            tempCanvas.width = width || 512;
            tempCanvas.height = height || 512;
            
            const tempView = await PAG.PAGView.init(pagFile, tempCanvas, { useCanvas2D: true });
            
            if (tempView) {
              const isCanvasBlank = (canvas: HTMLCanvasElement) => {
                const ctx = canvas.getContext('2d');
                if (!ctx) return true;
                try {
                  const buffer = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
                  for (let idx = 0; idx < buffer.length; idx++) {
                    if (buffer[idx] !== 0) return false;
                  }
                } catch (e) {
                  return false;
                }
                return true;
              };

              for (let i = 0; i < imagesCount; i++) {
                let dataUrl = '';

                // 1. Try to extract original image bytes directly (extremely reliable, works for hidden/masked layers)
                try {
                  const targetLayers = pagFile.getLayersByEditableIndex(i, layerType);
                  if (targetLayers && targetLayers.length > 0) {
                    for (const layer of targetLayers) {
                      if (typeof layer.imageBytes === 'function') {
                        const bytes = layer.imageBytes();
                        if (bytes && bytes.length > 0) {
                          const blob = new Blob([bytes], { type: 'image/webp' });
                          dataUrl = await new Promise<string>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                          });
                          if (dataUrl) {
                            break;
                          }
                        }
                      }
                    }
                  }
                } catch (bytesErr) {
                  console.warn(`Failed to extract original image bytes for layer ${i}:`, bytesErr);
                }

                // 2. Fallback to rendering snapshot if direct extraction is not supported/failed
                if (!dataUrl) {
                  // Hide all OTHER replaceable image layers
                  for (let j = 0; j < imagesCount; j++) {
                    if (j === i) continue;
                    try {
                      const otherLayers = pagFile.getLayersByEditableIndex(j, layerType);
                      if (otherLayers && otherLayers.length > 0) {
                        for (const layer of otherLayers) {
                          if (typeof layer.setVisible === 'function') {
                            layer.setVisible(false);
                          }
                        }
                      }
                    } catch (err) {
                      // Ignore silent errors
                    }
                  }
                  
                  // Make the target image layer visible
                  try {
                    const targetLayers = pagFile.getLayersByEditableIndex(i, layerType);
                    if (targetLayers && targetLayers.length > 0) {
                      for (const layer of targetLayers) {
                        if (typeof layer.setVisible === 'function') {
                          layer.setVisible(true);
                        }
                      }
                    }
                  } catch (err) {
                    // Ignore silent errors
                  }
                  
                  // Try to render a non-blank frame using makeSnapshot() at various progresses
                  const testProgresses = [0.1, 0.5, 0.9, 0.0, 0.3, 0.7];
                  const offscreen = document.createElement('canvas');
                  
                  for (const prog of testProgresses) {
                    await tempView.setProgress(prog);
                    await tempView.flush();
                    
                    try {
                      const bitmap = await tempView.makeSnapshot();
                      if (bitmap) {
                        offscreen.width = bitmap.width;
                        offscreen.height = bitmap.height;
                        const ctx = offscreen.getContext('2d');
                        if (ctx) {
                          ctx.drawImage(bitmap, 0, 0);
                          if (!isCanvasBlank(offscreen)) {
                            dataUrl = offscreen.toDataURL('image/png');
                            break;
                          }
                        }
                      }
                    } catch (snapErr) {
                      // Fallback to direct canvas export if snapshot fails
                      const testUrl = tempCanvas.toDataURL('image/png');
                      if (testUrl && testUrl.length > 1000) {
                        dataUrl = testUrl;
                        break;
                      }
                    }
                  }
                  
                  if (!dataUrl) {
                    // If all progresses produced blank, try to use whatever was rendered at progress 0.1
                    await tempView.setProgress(0.1);
                    await tempView.flush();
                    try {
                      const bitmap = await tempView.makeSnapshot();
                      if (bitmap) {
                        offscreen.width = bitmap.width;
                        offscreen.height = bitmap.height;
                        const ctx = offscreen.getContext('2d');
                        if (ctx) {
                          ctx.drawImage(bitmap, 0, 0);
                          dataUrl = offscreen.toDataURL('image/png');
                        }
                      }
                    } catch (e) {
                      dataUrl = tempCanvas.toDataURL('image/png');
                    }
                  }
                  
                  // Restore OTHER replaceable image layers back to visible for next iteration
                  for (let j = 0; j < imagesCount; j++) {
                    try {
                      const otherLayers = pagFile.getLayersByEditableIndex(j, layerType);
                      if (otherLayers && otherLayers.length > 0) {
                        for (const layer of otherLayers) {
                          if (typeof layer.setVisible === 'function') {
                            layer.setVisible(true);
                          }
                        }
                      }
                    } catch (err) {
                      // Ignore
                    }
                  }
                }

                previews[i] = dataUrl;
              }
              
              // Clean up the temp PAGView
              tempView.destroy();
            }
          } catch (e) {
            console.warn('Failed to extract original layer previews:', e);
          }
        }
        setOriginalPreviews(previews);

        // Generate layer list
        const layerList = [];
        for (let i = 0; i < imagesCount; i++) {
          let layerName = `طبقة استبدال #${i + 1}`;
          try {
            const layerType = PAG.LayerType ? PAG.LayerType.Image : 5;
            const layers = pagFile.getLayersByEditableIndex(i, layerType);
            if (layers && layers.length > 0) {
              const name = layers[0].layerName();
              if (name) {
                layerName = name;
              }
            }
          } catch (e) {
            console.warn('Failed to retrieve PAG layer name:', e);
          }
          layerList.push({
            id: String(i),
            name: layerName,
            data: previews[i] || '',
          });
        }
        setAssets(layerList);

        if (canvasRef.current) {
          canvasRef.current.width = width;
          canvasRef.current.height = height;
          pagView = await PAG.PAGView.init(pagFile, canvasRef.current, { useCanvas2D: true });
          if (!isMounted) return;

          pagViewRef.current = pagView;
          pagView.setRepeatCount(isLoop ? 0 : 1);
          await pagView.play();

          setStatus(PlayerStatus.PLAYING);

          // Ticker to track current frame & progress
          const updateProgress = async () => {
            if (!isMounted || !pagViewRef.current) return;
            try {
              const curProg = pagViewRef.current.getProgress();
              const frameIdx = Math.round(curProg * (framesCount - 1));
              setCurrentFrame(frameIdx);
              setProgress(curProg * 100);
            } catch (e) {}
            requestAnimationFrame(updateProgress);
          };
          requestAnimationFrame(updateProgress);
        }
      } catch (err: any) {
        console.error('PAG Initialization error:', err);
        if (isMounted) {
          setStatus(PlayerStatus.ERROR);
          setErrorMsg(err?.message || String(err));
        }
      }
    };

    init();

    return () => {
      isMounted = false;
      if (pagView) {
        try {
          pagView.destroy();
        } catch (e) {}
      }
    };
  }, [file.url, originalFile]);

  // Handle setting looping
  const handleLoopToggle = async () => {
    if (pagViewRef.current) {
      const nextLoop = !isLoop;
      setIsLoop(nextLoop);
      pagViewRef.current.setRepeatCount(nextLoop ? 0 : 1);
    }
  };

  // Play / Pause Toggle
  const togglePlay = async () => {
    if (!pagViewRef.current) return;
    if (status === PlayerStatus.PLAYING) {
      await pagViewRef.current.pause();
      setStatus(PlayerStatus.PAUSED);
    } else {
      await pagViewRef.current.play();
      setStatus(PlayerStatus.PLAYING);
    }
  };

  // Seek Progress
  const handleSeek = async (newProgressPercent: number) => {
    if (!pagViewRef.current) return;
    const normProgress = newProgressPercent / 100;
    await pagViewRef.current.setProgress(normProgress);
    await pagViewRef.current.flush();
    setProgress(newProgressPercent);
    setCurrentFrame(Math.round(normProgress * (totalFrames - 1)));
  };

  // Handle Image Replacement selection
  const handleReplaceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeReplaceIndex !== null) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;

        if (editingAsset) {
          // Inside edit modal: update current editing asset image
          setEditingAsset(prev => prev ? {
            ...prev,
            newImageData: dataUrl
          } : null);
          const existing = savedEditSettings[activeReplaceIndex];
          setEditSettings(existing || {
            scale: 100,
            offsetX: 0,
            offsetY: 0,
            glowIntensity: 0,
            solidFill: 0,
            glowColor: '#ffffff',
          });
        } else {
          // Directly from the asset card list: perform instant direct replacement without modal
          if (pagFileRef.current && pagViewRef.current && pagInstanceRef.current) {
            const PAG = pagInstanceRef.current;
            const targetIndex = activeReplaceIndex;
            const img = new Image();
            img.onload = async () => {
              try {
                const pagImg = PAG.PAGImage.fromSource(img);
                pagFileRef.current.replaceImage(targetIndex, pagImg);
                await pagViewRef.current.flush();

                // Store replaced asset preview and default/existing settings
                setReplacedAssets(prev => ({ ...prev, [targetIndex]: dataUrl }));
                setSavedEditSettings(prev => ({
                  ...prev,
                  [targetIndex]: prev[targetIndex] || {
                    scale: 100,
                    offsetX: 0,
                    offsetY: 0,
                    glowIntensity: 0,
                    solidFill: 0,
                    glowColor: '#ffffff',
                  }
                }));
              } catch (err) {
                console.error('Error instantiating PAGImage directly:', err);
              }
            };
            img.src = dataUrl;
          }
        }
      };
      reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = '';
    setActiveReplaceIndex(null);
  };

  // Dynamic preview canvas updating
  useEffect(() => {
    if (!editingAsset || !editCanvasRef.current) return;

    const canvas = editCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const origSrc = originalPreviews[editingAsset.index] || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const newSrc = editingAsset.newImageData || origSrc;

    const origImg = new Image();
    origImg.onload = () => {
      canvas.width = origImg.width || 300;
      canvas.height = origImg.height || 300;
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

        const dataUrl = canvas.toDataURL('image/png');
        setPreviewUrl(dataUrl);
      };
      newImg.src = newSrc;
    };
    origImg.src = origSrc;
  }, [editingAsset, editSettings, originalPreviews]);

  // Apply edits to PAGView and flush
  const applyEdit = async () => {
    if (previewUrl && editingAsset && pagFileRef.current && pagViewRef.current) {
      try {
        const PAG = pagInstanceRef.current;
        if (!PAG) return;
        
        // Create PAGImage
        const img = new Image();
        img.onload = async () => {
          try {
            const pagImg = PAG.PAGImage.fromSource(img);
            pagFileRef.current.replaceImage(editingAsset.index, pagImg);
            await pagViewRef.current.flush();
            
            // Save settings
            setReplacedAssets(prev => ({ ...prev, [editingAsset.index]: previewUrl }));
            setSavedEditSettings(prev => ({ ...prev, [editingAsset.index]: { ...editSettings } }));

            setEditingAsset(null);
          } catch (err) {
            console.error('Error instantiating PAGImage:', err);
          }
        };
        img.src = previewUrl;
      } catch (err) {
        console.error('Failed to replace PAG image:', err);
      }
    }
  };

  const cancelEdit = () => {
    setEditingAsset(null);
  };

  const openEditModal = async (assetId: string, assetName: string) => {
    const index = Number(assetId);
    let baseImgData = replacedAssets[index] || originalPreviews[index];

    if (!baseImgData && pagFileRef.current && pagInstanceRef.current) {
      try {
        const PAG = pagInstanceRef.current;
        const pagFile = pagFileRef.current;
        const imagesCount = pagFile.numImages();

        // Store original visibility of all layers
        const originalVisibilities: Record<string, boolean> = {};
        for (let j = 0; j < imagesCount; j++) {
          try {
            const layers = pagFile.getLayersByEditableIndex(j, PAG.LayerType ? PAG.LayerType.Image : 5);
            for (let k = 0; k < layers.length; k++) {
              const layer = layers[k];
              const key = `${j}_${k}`;
              originalVisibilities[key] = layer.visible();
            }
          } catch (e) {}
        }

        // Hide other layers
        for (let j = 0; j < imagesCount; j++) {
          const layers = pagFile.getLayersByEditableIndex(j, PAG.LayerType ? PAG.LayerType.Image : 5);
          for (const layer of layers) {
            try {
              layer.setVisible(j === index);
            } catch (e) {}
          }
        }

        const width = pagFile.width();
        const height = pagFile.height();
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempPagView = await PAG.PAGView.init(pagFile, tempCanvas);

        let targetProgress = 0.1;
        try {
          const layersForI = pagFile.getLayersByEditableIndex(index, PAG.LayerType ? PAG.LayerType.Image : 5);
          if (layersForI && layersForI.length > 0) {
            const firstLayer = layersForI[0];
            const sTime = firstLayer.startTime();
            const dur = firstLayer.duration();
            const fileDur = pagFile.duration();
            if (fileDur > 0 && dur > 0) {
              const midTime = sTime + dur / 2;
              targetProgress = Math.max(0.05, Math.min(0.95, midTime / fileDur));
            }
          }
        } catch (e) {}

        await tempPagView.setProgress(targetProgress);
        await tempPagView.flush();

        const dataUrl = tempCanvas.toDataURL('image/png');
        setOriginalPreviews(prev => ({ ...prev, [index]: dataUrl }));
        baseImgData = dataUrl;

        try {
          tempPagView.destroy();
        } catch (e) {}

        // Restore visibility
        for (let j = 0; j < imagesCount; j++) {
          try {
            const layers = pagFile.getLayersByEditableIndex(j, PAG.LayerType ? PAG.LayerType.Image : 5);
            for (let k = 0; k < layers.length; k++) {
              const layer = layers[k];
              const key = `${j}_${k}`;
              const orig = originalVisibilities[key] !== false;
              layer.setVisible(orig);
            }
          } catch (e) {}
        }
      } catch (err) {
        console.error('Lazy extract failed:', err);
      }
    }

    setEditingAsset({
      index: index,
      originalName: assetName,
      newImageData: replacedAssets[index] || baseImgData || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    });

    const existing = savedEditSettings[index];
    setEditSettings(existing || {
      scale: 100,
      offsetX: 0,
      offsetY: 0,
      glowIntensity: 0,
      solidFill: 0,
      glowColor: '#ffffff',
    });

  };

  // Toggle Visibility of Image layer
  const toggleAssetVisibility = async (index: number) => {
    if (!pagFileRef.current || !pagViewRef.current) return;
    
    try {
      const isCurrentlyHidden = hiddenAssets.has(index);
      const newHidden = new Set(hiddenAssets);
      
      const PAG = pagInstanceRef.current;
      if (!PAG) return;

      const makeVisible = isCurrentlyHidden; // If it was hidden, we make it visible (true)
      if (makeVisible) {
        newHidden.delete(index);
      } else {
        newHidden.add(index);
      }

      // Find the actual layer(s) and set their visibility
      const layers = pagFileRef.current.getLayersByEditableIndex(index, PAG.LayerType ? PAG.LayerType.Image : 5);
      for (const layer of layers) {
        try {
          layer.setVisible(makeVisible);
        } catch (e) {
          console.warn('Failed to set layer visibility:', e);
        }
      }

      await pagViewRef.current.flush();
      setHiddenAssets(newHidden);
    } catch (e) {
      console.warn('Failed to toggle visibility:', e);
    }
  };

  // Download individual asset
  const downloadAsset = (displayData: string, fileName: string) => {
    if (!displayData || displayData.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8')) {
      alert("الصورة غير جاهزة للتحميل بعد.");
      return;
    }
    const link = document.createElement('a');
    link.href = displayData;
    link.download = fileName || 'layer-image.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reset replaced asset to original image
  const resetAsset = async (index: number) => {
    if (!pagFileRef.current || !pagViewRef.current || !pagInstanceRef.current) return;
    try {
      const PAG = pagInstanceRef.current;
      const originalSrc = originalPreviews[index];
      if (originalSrc) {
        const img = new Image();
        img.onload = async () => {
          try {
            const pagImg = PAG.PAGImage.fromSource(img);
            pagFileRef.current.replaceImage(index, pagImg);
            await pagViewRef.current.flush();
            
            setReplacedAssets(prev => {
              const next = { ...prev };
              delete next[index];
              return next;
            });
            setSavedEditSettings(prev => {
              const next = { ...prev };
              delete next[index];
              return next;
            });
          } catch (err) {
            console.error('Error resetting PAGImage:', err);
          }
        };
        img.src = originalSrc;
      } else {
        // Just delete from state if no original source is stored yet (though there should be)
        setReplacedAssets(prev => {
          const next = { ...prev };
          delete next[index];
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to reset PAG image:', err);
    }
  };

  // Export frames as ZIP
  const exportAsZip = async () => {
    if (!pagViewRef.current || !pagFileRef.current || exporting) return;
    const JSZip = (window as any).JSZip;
    if (!JSZip) return alert("يرجى الانتظار لتحميل مكتبة JSZip.");

    try {
      setExporting(true);
      setExportProgress(0);
      setExportStatus('جاري تهيئة محرك الاستخراج...');

      const wasPlaying = status === PlayerStatus.PLAYING;
      await pagViewRef.current.pause();
      setStatus(PlayerStatus.PAUSED);

      const zip = new JSZip();
      const width = videoSize?.width || pagFileRef.current.width() || 512;
      const height = videoSize?.height || pagFileRef.current.height() || 512;

      // Create a clean 2D canvas for compositing and reading frame data without WebGL buffer clears
      const renderCanvas = document.createElement('canvas');
      renderCanvas.width = width;
      renderCanvas.height = height;
      const renderCtx = renderCanvas.getContext('2d', { willReadFrequently: true });

      const framesToExport = Math.max(1, totalFrames);

      // Force a slight seek first to guarantee frame 0 triggers an active render and canvas update
      await pagViewRef.current.setProgress(0.0001);
      await pagViewRef.current.flush();

      // Loop from 0 to framesToExport and grab true animation frames
      for (let i = 0; i < framesToExport; i++) {
        setExportStatus(`جاري التقاط الإطار ${i + 1} من ${framesToExport}...`);
        
        const prog = framesToExport > 1 ? i / (framesToExport - 1) : 0;
        await pagViewRef.current.setProgress(prog);
        await pagViewRef.current.flush();
        
        // Wait a tiny moment for 2D canvas frame synchronization
        await new Promise(r => setTimeout(r, 25));

        if (canvasRef.current && renderCtx) {
          // Clear canvas with full transparency for each frame
          renderCtx.clearRect(0, 0, width, height);

          // Draw the current PAG frame directly with full alpha transparency
          renderCtx.drawImage(canvasRef.current, 0, 0, width, height);

          // Generate optimized lossless PNG using UPNG (drastically smaller file size with 100% original quality and alpha)
          try {
            const imgData = renderCtx.getImageData(0, 0, width, height);
            const pngBuffer = UPNG.encode([imgData.data.buffer], width, height, 0);
            const frameFileName = `${i.toString().padStart(3, '0')}.png`;
            zip.file(frameFileName, pngBuffer);
          } catch (err) {
            const dataUrl = renderCanvas.toDataURL('image/png');
            if (dataUrl && dataUrl.startsWith('data:image/png;base64,')) {
              const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
              const frameFileName = `${i.toString().padStart(3, '0')}.png`;
              zip.file(frameFileName, base64Data, { base64: true });
            }
          }
        } else if (canvasRef.current) {
          const dataUrl = canvasRef.current.toDataURL('image/png');
          if (dataUrl && dataUrl.startsWith('data:image/png;base64,')) {
            const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
            const frameFileName = `${i.toString().padStart(3, '0')}.png`;
            zip.file(frameFileName, base64Data, { base64: true });
          }
        }
        
        setExportProgress(Math.round(((i + 1) / framesToExport) * 100));
      }

      setExportStatus('جاري ضغط الملف وتحضير التحميل...');
      const content = await zip.generateAsync({ type: "blob" });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${file.name.replace('.pag', '')}_Sequence.zip`;
      link.click();

      setExporting(false);
      if (wasPlaying) {
        await pagViewRef.current.play();
        setStatus(PlayerStatus.PLAYING);
      }
    } catch (err) {
      console.error("PAG Export Error:", err);
      setExporting(false);
      alert("حدث خطأ أثناء التصدير.");
    }
  };

  // Download unmodified file
  const downloadPAG = () => {
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.name;
    a.click();
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
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <h4 className="text-sm font-bold text-white truncate max-w-[250px]">{file.name}</h4>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
             <button 
                onClick={exportAsZip}
                disabled={status !== PlayerStatus.PLAYING && status !== PlayerStatus.PAUSED || exporting}
                className="group flex items-center gap-2 px-4 py-2 bg-blue-600/10 border border-blue-500/50 text-blue-400 rounded-xl text-xs font-bold hover:bg-blue-600/20 transition-all disabled:opacity-30 active:scale-95 shadow-[0_0_15px_rgba(59,130,246,0.05)]"
                title="تصدير جميع الإطارات كصور PNG شفافة"
             >
                <FileArchive size={16} />
                تصدير لـ PNG
             </button>
             <div className="w-px h-6 bg-slate-800 mx-1"></div>
             <button 
                onClick={downloadPAG} 
                className="group flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all active:scale-95"
                title="تحميل ملف PAG"
             >
                <Download size={16} />
                تحميل PAG
             </button>
             <button onClick={onClear} className="p-2 text-slate-500 hover:text-white transition-colors ml-2" title="إغلاق الملف">
                <X size={18} />
             </button>
          </div>
        </div>

        <div className="flex-1 relative transition-colors duration-500 flex items-center justify-center m-4 rounded-[2rem] border border-slate-800/30 overflow-hidden" style={{ backgroundColor: bgColor }}>
          {status === PlayerStatus.LOADING && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-slate-900/50">
              <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
              <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">جاري تهيئة العرض...</p>
            </div>
          )}
          {status === PlayerStatus.ERROR && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-slate-950/95 p-6 text-center overflow-y-auto animate-fade-in" dir="rtl">
              <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-red-500 mb-1">
                <X size={24} />
              </div>
              <p className="text-sm font-black text-white">حدث خطأ أثناء تشغيل ملف الـ PAG</p>
              {errorMsg && (
                <p className="text-xs text-red-400 font-mono max-w-md break-all bg-red-500/5 p-3.5 rounded-2xl border border-red-500/10 shadow-inner">
                  {errorMsg}
                </p>
              )}
              <div className="max-w-xs text-right text-slate-400 text-[11px] leading-relaxed mt-2 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/80">
                <p className="font-bold text-slate-300 mb-1.5 border-b border-slate-800 pb-1">نصائح لحل المشكلة:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>تأكد من أن الملف بصيغة <span className="text-blue-400">.pag</span> صالحة وغير تالف.</li>
                  <li>تأكد من تفعيل تسريع الرسوميات (WebGL) في متصفحك.</li>
                  <li>تأكد من اتصالك بالإنترنت ليتمكن المشغل من تحميل ملفات الـ WASM الخاصة بمكتبة PAG من خوادم الـ CDN العالمية.</li>
                </ul>
              </div>
            </div>
          )}
          <canvas 
            key={`${file.name}-${file.url}`}
            ref={canvasRef} 
            className="max-w-full max-h-full object-contain block relative shadow-xl rounded-xl"
            style={{ width: videoSize ? `${videoSize.width}px` : 'auto', height: videoSize ? `${videoSize.height}px` : 'auto' }}
          />
        </div>

        <div className="p-8 bg-slate-900/50 border-t border-slate-800 z-30">
          <div className="max-w-5xl mx-auto flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-mono text-slate-500 w-16 text-center bg-slate-900 py-1 rounded-md border border-slate-800">{currentFrame + 1} / {totalFrames}</span>
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/30 cursor-pointer relative" onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const percentage = (clickX / rect.width) * 100;
                handleSeek(percentage);
              }}>
                <div className="h-full bg-gradient-to-l from-blue-600 to-blue-400 shadow-[0_0_10px_rgba(37,99,235,0.3)] transition-all duration-100" style={{ width: `${progress}%` }}></div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <button 
                  onClick={togglePlay}
                  className="p-3 bg-blue-600/10 border border-blue-500/20 hover:bg-blue-600/20 text-blue-400 rounded-full transition-all active:scale-90"
                >
                  {status === PlayerStatus.PLAYING ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button 
                  onClick={handleLoopToggle}
                  className={`px-4 py-2 border rounded-xl text-xs font-bold transition-all ${isLoop ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400' : 'bg-slate-800/40 border-transparent text-slate-400 hover:text-slate-200'}`}
                >
                  تكرار: {isLoop ? 'مفعل' : 'مرة واحدة'}
                </button>
              </div>
              
              <div className="flex flex-col items-center sm:items-end gap-3">
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
              <h3 className="text-lg font-bold text-white text-right">مكتبة العناصر (PAG Layers)</h3>
              <p className="text-xs text-slate-500 text-right">العناصر الصورية القابلة للاستبدال المكتشفة داخل ملف الـ PAG</p>
            </div>
          </div>

          {assets.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              لا توجد عناصر صورية قابلة للاستبدال في هذا الملف.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/png, image/jpeg" 
                onChange={handleReplaceFileChange} 
              />
              {assets.map((asset) => {
                const isHidden = hiddenAssets.has(Number(asset.id));
                const isReplaced = !!replacedAssets[Number(asset.id)];
                const displayData = replacedAssets[Number(asset.id)] || asset.data || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
                
                return (
                <div key={asset.id} className={`group relative bg-slate-900/40 rounded-[2rem] border ${isHidden ? 'border-red-500/50 opacity-50' : isReplaced ? 'border-green-500/50' : 'border-slate-800 hover:border-indigo-500/50'} overflow-hidden transition-all duration-300`}>
                  <div 
                    onClick={() => openEditModal(asset.id, asset.name)}
                    className="aspect-square relative bg-slate-800/30 p-4 flex items-center justify-center overflow-hidden cursor-pointer"
                  >
                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/checkerboard.png')]"></div>
                    {isReplaced || asset.data ? (
                      <img src={displayData} alt={asset.name} className={`relative max-w-full max-h-full object-contain drop-shadow-xl transition-transform duration-500 ${isHidden ? 'grayscale' : 'group-hover:scale-110'}`} />
                    ) : (
                      <div className="relative flex flex-col items-center justify-center text-center p-3 gap-2">
                        <ImageIcon size={28} className="text-slate-600 group-hover:text-indigo-400 group-hover:scale-110 transition-all duration-300" />
                        <span className="text-[11px] text-slate-400 font-bold leading-tight">الطبقة الأصلية</span>
                        <span className="text-[9px] text-slate-500 leading-none">انقر للاستبدال</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                       <button 
                         onClick={() => toggleAssetVisibility(Number(asset.id))} 
                         className={`p-2.5 rounded-full text-white transition-all active:scale-90 ${isHidden ? 'bg-green-500/20 hover:bg-green-500/40' : 'bg-red-500/20 hover:bg-red-500/40'}`}
                         title={isHidden ? "استرجاع القطعة" : "إخفاء القطعة"}
                       >
                        {isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                       </button>
                       <button 
                         onClick={() => {
                           setActiveReplaceIndex(Number(asset.id));
                           fileInputRef.current?.click();
                         }} 
                         className="p-2.5 bg-blue-500/20 hover:bg-blue-500/40 rounded-full text-white transition-all active:scale-90"
                         title="استبدال القطعة (بالمقاس الذكي)"
                       >
                        <RefreshCw size={16} />
                       </button>
                       <button 
                         onClick={() => downloadAsset(displayData, `${asset.name || 'layer'}.png`)} 
                         className="p-2.5 bg-emerald-500/20 hover:bg-emerald-500/40 rounded-full text-white transition-all active:scale-90"
                         title="تحميل القطعة الحالية"
                       >
                         <Download size={16} />
                       </button>
                       {isReplaced && (
                         <button 
                           onClick={() => resetAsset(Number(asset.id))} 
                           className="p-2.5 bg-amber-500/20 hover:bg-amber-500/40 rounded-full text-amber-400 transition-all active:scale-90"
                           title="إعادة تعيين للأصل"
                         >
                           <RotateCcw size={16} />
                         </button>
                       )}
                    </div>
                  </div>
                  <div 
                    className="p-3 bg-slate-900/80 text-center border-t border-slate-800/50 transition-colors select-none"
                  >
                    <span className="text-[11px] font-black text-slate-200 truncate block px-1" dir="ltr">{asset.name}</span>
                    <span className="text-[9px] font-mono text-slate-500 block mt-0.5">ID: {asset.id}</span>
                  </div>
                </div>
              )})}
            </div>
          )}
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
                <h3 className="text-white text-sm font-bold truncate max-w-[220px]">تعديل: {editingAsset.originalName}</h3>
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
                  <canvas ref={editCanvasRef} className="hidden" />
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
                      setActiveReplaceIndex(editingAsset.index);
                      fileInputRef.current?.click();
                    }}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 px-3.5 py-2 rounded-xl border border-blue-500/20 transition-all active:scale-95 flex-1 justify-center"
                  >
                    <RefreshCw size={12} />
                    استبدال بملف آخر
                  </button>
                  <button 
                    onClick={() => {
                      if (previewUrl) {
                        downloadAsset(previewUrl, `${editingAsset.originalName || 'layer-edited'}.png`);
                      }
                    }}
                    className="text-[11px] text-green-400 hover:text-green-300 font-bold flex items-center gap-1.5 bg-green-500/10 hover:bg-green-500/20 px-3.5 py-2 rounded-xl border border-green-500/20 transition-all active:scale-95 flex-1 justify-center"
                  >
                    <Download size={12} />
                    تحميل المعدلة
                  </button>
                  {!!replacedAssets[editingAsset.index] && (
                    <button 
                      onClick={() => {
                        resetAsset(editingAsset.index);
                        cancelEdit();
                      }}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 px-3.5 py-2 rounded-xl border border-amber-500/20 transition-all active:scale-95 flex-1 justify-center"
                    >
                      <RotateCcw size={12} />
                      إعادة تعيين للأصل
                    </button>
                  )}
                </div>
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
                      max="50" 
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
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
