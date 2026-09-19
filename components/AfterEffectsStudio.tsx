import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Download, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  Copy, 
  Upload, 
  Image as ImageIcon, 
  Settings, 
  Maximize2, 
  Square, 
  FileCode, 
  FolderArchive, 
  Check, 
  Loader2, 
  X, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  ChevronsDown,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Clock,
  Sliders,
  Grid,
  Palette,
  Crosshair,
  Layers,
  Film,
  ZoomIn,
  ZoomOut,
  MousePointer,
  Hand,
  RotateCw,
  FolderOpen,
  Save,
  HelpCircle,
  Key,
  Shield,
  Sun
} from 'lucide-react';
import { motion } from 'motion/react';
import pako from 'pako';
import { parse } from 'protobufjs';
import { svgaSchema } from '../svga-proto';
import * as UPNG from 'upng-js';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import JSZip from 'jszip';
import { SVGAFileExtended } from '../types';

// Keyframe interface for animatable properties
export interface Keyframe<T = number> {
  frame: number;
  value: T;
  easing?: 'linear' | 'ease-in-out';
}

export type LayerKind = 'shape' | 'text' | 'image' | 'solid';
export type ShapeKind = 'ring' | 'circle' | 'rectangle' | 'polygon' | 'star';

export interface AELayer {
  id: string;
  name: string;
  kind: LayerKind;
  visible: boolean;
  locked: boolean;
  colorLabel: string; // AE color label (red, yellow, cyan, purple, etc.)
  expanded: boolean; // Twirl-down in timeline

  // Static / Fallback Transform values
  position: { x: number; y: number };
  scale: number; // percentage (100 = 1.0)
  rotation: number; // degrees
  opacity: number; // 0 to 100

  // Keyframes for Transforms (After Effects stopwatch feature)
  animatingPosition: boolean;
  positionKeyframes: Keyframe<{ x: number; y: number }>[];

  animatingScale: boolean;
  scaleKeyframes: Keyframe<number>[];

  animatingRotation: boolean;
  rotationKeyframes: Keyframe<number>[];

  animatingOpacity: boolean;
  opacityKeyframes: Keyframe<number>[];

  // Shape Specific Properties
  shapeKind?: ShapeKind;
  width?: number;
  height?: number;
  innerRadius?: number; // for ring
  outerRadius?: number; // for ring / circle
  points?: number; // for star or polygon
  strokeWidth?: number;
  strokeColor?: string;
  fillColor?: string;
  glowRadius?: number;
  glowColor?: string;

  // Text Specific Properties
  text?: string;
  fontSize?: number;
  fontColor?: string;
  fontFamily?: string;

  // Image Specific Properties
  imageSrc?: string;
  imageElement?: HTMLImageElement | null;
}

export interface CompositionSettings {
  name: string;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  backgroundColor: string;
}

interface AfterEffectsStudioProps {
  onOpenInViewer?: (file: SVGAFileExtended) => void;
}

export const AfterEffectsStudio: React.FC<AfterEffectsStudioProps> = ({ onOpenInViewer }) => {
  // Project State: whether a composition is currently open
  const [hasProject, setHasProject] = useState<boolean>(false);
  const [showCompSettingsModal, setShowCompSettingsModal] = useState<boolean>(true);

  // Composition Settings
  const [compSettings, setCompSettings] = useState<CompositionSettings>({
    name: 'Comp 1',
    width: 750,
    height: 750,
    fps: 30,
    totalFrames: 90, // 3 seconds at 30 fps
    backgroundColor: '#000000'
  });

  // Modal temporary state for Comp Settings
  const [modalName, setModalName] = useState('Comp 1');
  const [modalWidth, setModalWidth] = useState(750);
  const [modalHeight, setModalHeight] = useState(750);
  const [modalFps, setModalFps] = useState(30);
  const [modalTotalFrames, setModalTotalFrames] = useState(90);
  const [modalDurationSec, setModalDurationSec] = useState(3);
  const [modalDurationMode, setModalDurationMode] = useState<'frames' | 'seconds'>('frames');
  const [modalBg, setModalBg] = useState('#000000');

  // Layers stack (User builds from scratch! Zero pre-loaded templates)
  const [layers, setLayers] = useState<AELayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  // Drag and Drop Layer Stacking / Reorder State
  const [draggedLayerIdx, setDraggedLayerIdx] = useState<number | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<'above' | 'below' | null>(null);

  // Timeline / Playback State
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);
  isPlayingRef.current = isPlaying;
  const rulerRef = useRef<HTMLDivElement>(null);

  // Viewport Settings
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 1 = 100%
  const [showTransparencyGrid, setShowTransparencyGrid] = useState<boolean>(true);
  const [showSafeGuides, setShowSafeGuides] = useState<boolean>(false);
  const [showAvatarGuide, setShowAvatarGuide] = useState<boolean>(false);
  const [activeTool, setActiveTool] = useState<'select' | 'hand' | 'rotate' | 'shape' | 'text'>('select');

  // Export State
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportStatusText, setExportStatusText] = useState<string>('');
  const [lastExportedSVGA, setLastExportedSVGA] = useState<SVGAFileExtended | null>(null);
  const [svgaExportMode, setSvgaExportMode] = useState<'pieces' | 'render'>('pieces');

  // Container ref for viewport stage auto-sizing
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number }>({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  // Layer dragging interaction state on canvas
  const [isDraggingLayer, setIsDraggingLayer] = useState<boolean>(false);
  const dragInfoRef = useRef<{
    layerId: string;
    startCanvasX: number;
    startCanvasY: number;
    startLayerPos: { x: number; y: number };
  } | null>(null);

  const handleStageMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'hand' && stageContainerRef.current) {
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: stageContainerRef.current.scrollLeft,
        scrollTop: stageContainerRef.current.scrollTop
      };
    } else {
      // Check if click was on a scrollbar anywhere
      const target = e.target as HTMLElement | null;
      if (target) {
        // If clicking on an input, button, select, or scrubber, keep selection
        if (target.closest('input, button, select, textarea, label, .timeline-scrubber, .timeline-keyframe, .properties-inspector, .layer-row-item')) {
          return;
        }

        // Check if click was on scrollbar of stage or any container
        const rect = target.getBoundingClientRect();
        const isVerticalScrollbar = e.clientX >= rect.left + target.clientWidth && e.clientX <= rect.right;
        const isHorizontalScrollbar = e.clientY >= rect.top + target.clientHeight && e.clientY <= rect.bottom;
        if (isVerticalScrollbar || isHorizontalScrollbar) {
          return;
        }
      }

      // If clicked on empty area outside canvas (the stage canvas work area), deselect layer
      setSelectedLayerId(null);
    }
  };

  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning && activeTool === 'hand' && stageContainerRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      stageContainerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
      stageContainerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
    }
  };

  const handleStageMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    }
  };

  // Auto-fit helper to fit composition perfectly within viewport without scrolling or clipping
  const fitToView = useCallback(() => {
    if (!stageContainerRef.current) return;
    const stageW = stageContainerRef.current.clientWidth - 48; // account for p-6 padding
    const stageH = stageContainerRef.current.clientHeight - 48;
    if (stageW <= 0 || stageH <= 0) return;
    const scaleW = stageW / compSettings.width;
    const scaleH = stageH / compSettings.height;
    const bestScale = Math.min(scaleW, scaleH, 1.25); // cap at 125% max auto zoom
    setZoomLevel(Math.max(0.2, Number(bestScale.toFixed(2))));
  }, [compSettings.width, compSettings.height]);

  // Automatically fit on project open or dimension change
  useEffect(() => {
    if (hasProject) {
      // Small timeout to allow container layout pass
      const timer = setTimeout(() => {
        fitToView();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [hasProject, compSettings.width, compSettings.height, fitToView]);

  // Scrub timeline to frame from mouse clientX
  const updateScrubFrame = useCallback((clientX: number) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const targetF = Math.round(pct * (compSettings.totalFrames - 1));
    setCurrentFrame(targetF);
  }, [compSettings.totalFrames]);

  // Global mouse move & up listeners for scrubbing
  useEffect(() => {
    if (!isScrubbing) return;
    const onMouseMove = (e: MouseEvent) => {
      updateScrubFrame(e.clientX);
    };
    const onMouseUp = () => {
      setIsScrubbing(false);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isScrubbing, updateScrubFrame]);

  // Window resize observer to keep canvas responsive
  useEffect(() => {
    const handleResize = () => {
      if (hasProject) {
        fitToView();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [hasProject, fitToView]);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animReqRef = useRef<number | null>(null);

  // Get current selected layer
  const selectedLayer = useMemo(() => {
    return layers.find(l => l.id === selectedLayerId) || null;
  }, [layers, selectedLayerId]);

  // Handle Duration & Frame calculations in Modal
  const handleFpsChange = (newFps: number) => {
    setModalFps(newFps);
    if (modalDurationMode === 'seconds') {
      setModalTotalFrames(Math.round(modalDurationSec * newFps));
    } else {
      setModalDurationSec(Number((modalTotalFrames / newFps).toFixed(2)));
    }
  };

  const handleTotalFramesChange = (frames: number) => {
    const val = Math.max(1, Math.round(frames));
    setModalTotalFrames(val);
    setModalDurationSec(Number((val / modalFps).toFixed(2)));
  };

  const handleDurationSecChange = (sec: number) => {
    const val = Math.max(0.1, Number(sec));
    setModalDurationSec(val);
    setModalTotalFrames(Math.round(val * modalFps));
  };

  // Preset Resolution choices for fast setup
  const setResolutionPreset = (w: number, h: number, defaultFrames = 90, fpsChoice = 30) => {
    setModalWidth(w);
    setModalHeight(h);
    setModalFps(fpsChoice);
    setModalTotalFrames(defaultFrames);
    setModalDurationSec(Number((defaultFrames / fpsChoice).toFixed(2)));
  };

  // Commit and Open Composition
  const handleCreateComposition = () => {
    setCompSettings({
      name: modalName || 'Comp 1',
      width: Math.max(100, modalWidth),
      height: Math.max(100, modalHeight),
      fps: modalFps,
      totalFrames: Math.max(1, modalTotalFrames),
      backgroundColor: modalBg
    });
    setHasProject(true);
    setShowCompSettingsModal(false);
    setCurrentFrame(0);
    setIsPlaying(false);
    setTimeout(() => {
      fitToView();
    }, 60);
  };

  // Keyboard shortcut Ctrl+K to toggle composition settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCompSettingsModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Keyframe Interpolation Math
  const interpolateNumber = (keyframes: Keyframe<number>[], frame: number, defaultValue: number): number => {
    if (!keyframes || keyframes.length === 0) return defaultValue;
    if (keyframes.length === 1) return keyframes[0].value;

    const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
    if (frame <= sorted[0].frame) return sorted[0].value;
    if (frame >= sorted[sorted.length - 1].frame) return sorted[sorted.length - 1].value;

    for (let i = 0; i < sorted.length - 1; i++) {
      const k1 = sorted[i];
      const k2 = sorted[i + 1];
      if (frame >= k1.frame && frame <= k2.frame) {
        const span = k2.frame - k1.frame;
        if (span === 0) return k1.value;
        const t = (frame - k1.frame) / span;
        return k1.value + (k2.value - k1.value) * t;
      }
    }
    return defaultValue;
  };

  const interpolatePoint = (
    keyframes: Keyframe<{ x: number; y: number }>[], 
    frame: number, 
    defaultValue: { x: number; y: number }
  ): { x: number; y: number } => {
    if (!keyframes || keyframes.length === 0) return defaultValue;
    if (keyframes.length === 1) return keyframes[0].value;

    const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
    if (frame <= sorted[0].frame) return sorted[0].value;
    if (frame >= sorted[sorted.length - 1].frame) return sorted[sorted.length - 1].value;

    for (let i = 0; i < sorted.length - 1; i++) {
      const k1 = sorted[i];
      const k2 = sorted[i + 1];
      if (frame >= k1.frame && frame <= k2.frame) {
        const span = k2.frame - k1.frame;
        if (span === 0) return k1.value;
        const t = (frame - k1.frame) / span;
        return {
          x: k1.value.x + (k2.value.x - k1.value.x) * t,
          y: k1.value.y + (k2.value.y - k1.value.y) * t
        };
      }
    }
    return defaultValue;
  };

  // Evaluate Layer transform at a given frame
  const evaluateLayerAtFrame = useCallback((layer: AELayer, frame: number) => {
    const pos = layer.animatingPosition
      ? interpolatePoint(layer.positionKeyframes, frame, layer.position)
      : layer.position;

    const scale = layer.animatingScale
      ? interpolateNumber(layer.scaleKeyframes, frame, layer.scale)
      : layer.scale;

    const rotation = layer.animatingRotation
      ? interpolateNumber(layer.rotationKeyframes, frame, layer.rotation)
      : layer.rotation;

    const opacity = layer.animatingOpacity
      ? interpolateNumber(layer.opacityKeyframes, frame, layer.opacity)
      : layer.opacity;

    return { pos, scale, rotation, opacity };
  }, []);

  // Helper to determine intrinsic / configured bounds for any layer
  const getLayerDimensions = useCallback((layer: AELayer, compW: number, compH: number) => {
    switch (layer.kind) {
      case 'image': {
        const w = layer.width || (layer.imageElement ? layer.imageElement.width : 250);
        const h = layer.height || (layer.imageElement ? layer.imageElement.height : 250);
        return { width: w, height: h };
      }
      case 'shape': {
        if (layer.shapeKind === 'rectangle') {
          return { width: layer.width || 200, height: layer.height || 200 };
        }
        const r = (layer.outerRadius || 180) + (layer.strokeWidth || 8) / 2;
        return { width: r * 2, height: r * 2 };
      }
      case 'text': {
        const fontSize = layer.fontSize || 32;
        const textLen = (layer.text || 'AFTER EFFECTS').length;
        return {
          width: Math.max(60, textLen * fontSize * 0.65),
          height: Math.max(30, fontSize * 1.3)
        };
      }
      case 'solid': {
        return { width: layer.width || compW, height: layer.height || compH };
      }
      default:
        return { width: 200, height: 200 };
    }
  }, []);

  // Draw Adobe After Effects Style Selection Bounding Box with 8 Transform Handles & Anchor Point
  const drawSelectionBox = useCallback((
    ctx: CanvasRenderingContext2D,
    layer: AELayer,
    frame: number,
    compW: number,
    compH: number
  ) => {
    const { pos, scale, rotation } = evaluateLayerAtFrame(layer, frame);
    const { width: lw, height: lh } = getLayerDimensions(layer, compW, compH);
    const halfW = lw / 2;
    const halfH = lh / 2;

    ctx.save();
    const cx = compW / 2 + pos.x;
    const cy = compH / 2 + pos.y;
    ctx.translate(cx, cy);
    ctx.rotate((rotation * Math.PI) / 180);
    const s = scale / 100;
    ctx.scale(s, s);

    const invScale = 1 / Math.max(0.05, s);

    // 1. Neon Cyan Bounding Box Outline with drop shadow for clarity on all backgrounds
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 4 * invScale;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5 * invScale;
    ctx.setLineDash([]);
    ctx.strokeRect(-halfW, -halfH, lw, lh);
    ctx.restore();

    // 2. 8 Transform Handles (Corners and Midpoints)
    const handleSize = 7 * invScale;
    const hsHalf = handleSize / 2;
    const handlePositions: [number, number][] = [
      [-halfW, -halfH], // Top-Left
      [0, -halfH],      // Top-Center
      [halfW, -halfH],  // Top-Right
      [halfW, 0],       // Middle-Right
      [halfW, halfH],   // Bottom-Right
      [0, halfH],       // Bottom-Center
      [-halfW, halfH],  // Bottom-Left
      [-halfW, 0]       // Middle-Left
    ];

    handlePositions.forEach(([hx, hy]) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hx - hsHalf, hy - hsHalf, handleSize, handleSize);
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1 * invScale;
      ctx.strokeRect(hx - hsHalf, hy - hsHalf, handleSize, handleSize);
    });

    // 3. Center Anchor Point Marker (classic After Effects red crosshair + circle)
    const ancR = 5 * invScale;
    ctx.strokeStyle = '#f43f5e';
    ctx.fillStyle = 'rgba(244, 63, 94, 0.25)';
    ctx.lineWidth = 1.2 * invScale;

    ctx.beginPath();
    ctx.arc(0, 0, ancR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-ancR - (3 * invScale), 0);
    ctx.lineTo(ancR + (3 * invScale), 0);
    ctx.moveTo(0, -ancR - (3 * invScale));
    ctx.lineTo(0, ancR + (3 * invScale));
    ctx.stroke();

    ctx.restore();
  }, [evaluateLayerAtFrame, getLayerDimensions]);

  // Hit-test a layer in canvas coordinate space
  const hitTestLayer = useCallback((
    layer: AELayer,
    canvasX: number,
    canvasY: number,
    frame: number,
    compW: number,
    compH: number
  ): boolean => {
    if (!layer.visible || layer.locked) return false;

    const { pos, scale, rotation, opacity } = evaluateLayerAtFrame(layer, frame);
    if (opacity <= 0) return false;

    const cx = compW / 2 + pos.x;
    const cy = compH / 2 + pos.y;

    const dx = canvasX - cx;
    const dy = canvasY - cy;

    // Inverse rotate
    const rad = (-rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;

    // Inverse scale
    const s = (scale || 100) / 100;
    if (s <= 0.001) return false;
    const lx = rx / s;
    const ly = ry / s;

    const { width, height } = getLayerDimensions(layer, compW, compH);
    const halfW = width / 2;
    const halfH = height / 2;

    return Math.abs(lx) <= halfW && Math.abs(ly) <= halfH;
  }, [evaluateLayerAtFrame, getLayerDimensions]);

  // Draw Layer into Canvas Context
  const drawLayer = useCallback((
    ctx: CanvasRenderingContext2D,
    layer: AELayer,
    frame: number,
    compW: number,
    compH: number
  ) => {
    if (!layer.visible) return;

    const { pos, scale, rotation, opacity } = evaluateLayerAtFrame(layer, frame);
    if (opacity <= 0) return;

    ctx.save();

    // Center origin is composition center + layer position
    const cx = compW / 2 + pos.x;
    const cy = compH / 2 + pos.y;

    ctx.translate(cx, cy);
    ctx.rotate((rotation * Math.PI) / 180);
    const s = scale / 100;
    ctx.scale(s, s);
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity / 100));

    // Optional Glow Effect
    if (layer.glowRadius && layer.glowRadius > 0) {
      ctx.shadowColor = layer.glowColor || '#f59e0b';
      ctx.shadowBlur = layer.glowRadius;
    }

    // Render by Layer Kind
    switch (layer.kind) {
      case 'shape': {
        const outerR = layer.outerRadius || 180;
        const innerR = layer.innerRadius || 150;
        const strokeW = layer.strokeWidth || 8;

        ctx.fillStyle = layer.fillColor || 'transparent';
        ctx.strokeStyle = layer.strokeColor || '#fbbf24';
        ctx.lineWidth = strokeW;

        if (layer.shapeKind === 'ring') {
          // Double Ring / Donut
          ctx.beginPath();
          ctx.arc(0, 0, outerR, 0, Math.PI * 2);
          ctx.stroke();

          if (innerR > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, innerR, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Accent studs on the ring
          const studs = 8;
          for (let i = 0; i < studs; i++) {
            const a = (i * Math.PI * 2) / studs;
            const sx = Math.cos(a) * ((outerR + innerR) / 2);
            const sy = Math.sin(a) * ((outerR + innerR) / 2);
            ctx.beginPath();
            ctx.arc(sx, sy, Math.max(2, strokeW * 0.4), 0, Math.PI * 2);
            ctx.fillStyle = layer.strokeColor || '#ffffff';
            ctx.fill();
          }
        } else if (layer.shapeKind === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, outerR, 0, Math.PI * 2);
          if (layer.fillColor && layer.fillColor !== 'transparent') ctx.fill();
          if (strokeW > 0) ctx.stroke();
        } else if (layer.shapeKind === 'rectangle') {
          const w = layer.width || 300;
          const h = layer.height || 300;
          ctx.beginPath();
          ctx.rect(-w / 2, -h / 2, w, h);
          if (layer.fillColor && layer.fillColor !== 'transparent') ctx.fill();
          if (strokeW > 0) ctx.stroke();
        } else if (layer.shapeKind === 'polygon') {
          const sides = layer.points || 6;
          ctx.beginPath();
          for (let i = 0; i < sides; i++) {
            const angle = (i * Math.PI * 2) / sides - Math.PI / 2;
            const x = Math.cos(angle) * outerR;
            const y = Math.sin(angle) * outerR;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          if (layer.fillColor && layer.fillColor !== 'transparent') ctx.fill();
          if (strokeW > 0) ctx.stroke();
        } else if (layer.shapeKind === 'star') {
          const pts = layer.points || 5;
          const r1 = outerR;
          const r2 = innerR || outerR * 0.45;
          ctx.beginPath();
          for (let i = 0; i < pts * 2; i++) {
            const r = i % 2 === 0 ? r1 : r2;
            const angle = (i * Math.PI) / pts - Math.PI / 2;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          if (layer.fillColor && layer.fillColor !== 'transparent') ctx.fill();
          if (strokeW > 0) ctx.stroke();
        }
        break;
      }

      case 'text': {
        const txt = layer.text || 'AFTER EFFECTS';
        ctx.font = `bold ${layer.fontSize || 36}px ${layer.fontFamily || 'sans-serif'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = layer.fontColor || '#ffffff';
        ctx.fillText(txt, 0, 0);

        if (layer.strokeWidth && layer.strokeWidth > 0) {
          ctx.lineWidth = layer.strokeWidth;
          ctx.strokeStyle = layer.strokeColor || '#000000';
          ctx.strokeText(txt, 0, 0);
        }
        break;
      }

      case 'image': {
        if (layer.imageElement && layer.imageElement.complete) {
          const w = layer.width || layer.imageElement.width;
          const h = layer.height || layer.imageElement.height;
          ctx.drawImage(layer.imageElement, -w / 2, -h / 2, w, h);
        }
        break;
      }

      case 'solid': {
        const w = layer.width || compW;
        const h = layer.height || compH;
        ctx.fillStyle = layer.fillColor || '#ffffff';
        ctx.fillRect(-w / 2, -h / 2, w, h);
        break;
      }
    }

    ctx.restore();
  }, [evaluateLayerAtFrame]);

  // Main Canvas Render loop for Viewport
  const renderCompositionToCanvas = useCallback((
    targetCanvas: HTMLCanvasElement, 
    frame: number, 
    forExport = false
  ) => {
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;

    const w = compSettings.width;
    const h = compSettings.height;

    ctx.clearRect(0, 0, w, h);

    // If exporting with transparent background, keep canvas completely clean.
    // If viewing in viewport and transparency grid is active, show AE checkerboard pattern!
    if (!forExport) {
      if (showTransparencyGrid) {
        // After Effects classic grey checkerboard
        const sq = 16;
        for (let y = 0; y < h; y += sq) {
          for (let x = 0; x < w; x += sq) {
            ctx.fillStyle = ((x / sq + y / sq) % 2 === 0) ? '#28303f' : '#1e2430';
            ctx.fillRect(x, y, sq, sq);
          }
        }
      } else {
        ctx.fillStyle = compSettings.backgroundColor || '#000000';
        ctx.fillRect(0, 0, w, h);
      }
    }

    // Render layers from bottom to top (like After Effects)
    const reversed = [...layers].reverse();
    reversed.forEach(layer => {
      drawLayer(ctx, layer, frame, w, h);
    });

    // Viewport-only Guides (Safe Zones / Avatar Outline)
    if (!forExport) {
      if (showSafeGuides) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        // 90% Action Safe
        ctx.strokeRect(w * 0.05, h * 0.05, w * 0.9, h * 0.9);
        // 80% Title Safe
        ctx.strokeRect(w * 0.1, h * 0.1, w * 0.8, h * 0.8);
        // Center crosshair
        ctx.beginPath();
        ctx.moveTo(w / 2 - 15, h / 2);
        ctx.lineTo(w / 2 + 15, h / 2);
        ctx.moveTo(w / 2, h / 2 - 15);
        ctx.lineTo(w / 2, h / 2 + 15);
        ctx.stroke();
        ctx.restore();
      }

      if (showAvatarGuide) {
        ctx.save();
        ctx.strokeStyle = 'rgba(234, 179, 8, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Render Adobe After Effects Selection Bounding Box & Handles
      if (selectedLayerId) {
        const selLayer = layers.find(l => l.id === selectedLayerId);
        if (selLayer && selLayer.visible) {
          drawSelectionBox(ctx, selLayer, frame, w, h);
        }
      }
    }
  }, [compSettings, layers, showTransparencyGrid, showSafeGuides, showAvatarGuide, selectedLayerId, drawLayer, drawSelectionBox]);

  // Update canvas on frame change or selection change
  useEffect(() => {
    if (canvasRef.current && hasProject) {
      renderCompositionToCanvas(canvasRef.current, currentFrame, false);
    }
  }, [currentFrame, hasProject, renderCompositionToCanvas, selectedLayerId]);

  // Canvas Mouse Down: Select layer on canvas or initiate mouse drag
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'hand') return; // Hand tool handled by viewport container
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const canvasX = (clientX / rect.width) * compSettings.width;
    const canvasY = (clientY / rect.height) * compSettings.height;

    // 1. Check if the currently selected layer was clicked first
    let hitLayer: AELayer | null = null;
    if (selectedLayerId) {
      const currentSelected = layers.find(l => l.id === selectedLayerId);
      if (currentSelected && hitTestLayer(currentSelected, canvasX, canvasY, currentFrame, compSettings.width, compSettings.height)) {
        hitLayer = currentSelected;
      }
    }

    // 2. If not, check all layers top-to-bottom
    if (!hitLayer) {
      for (const layer of layers) {
        if (hitTestLayer(layer, canvasX, canvasY, currentFrame, compSettings.width, compSettings.height)) {
          hitLayer = layer;
          break;
        }
      }
    }

    if (hitLayer) {
      e.stopPropagation();
      setSelectedLayerId(hitLayer.id);

      const currentPos = evaluateLayerAtFrame(hitLayer, currentFrame).pos;
      dragInfoRef.current = {
        layerId: hitLayer.id,
        startCanvasX: canvasX,
        startCanvasY: canvasY,
        startLayerPos: { ...currentPos }
      };
      setIsDraggingLayer(true);
    } else {
      // Clicked on empty canvas space: deselect
      e.stopPropagation();
      setSelectedLayerId(null);
    }
  };

  // Global mouse move & mouse up for smooth layer dragging across canvas and window
  useEffect(() => {
    if (!isDraggingLayer) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!dragInfoRef.current || !canvasRef.current) return;
      const { layerId, startCanvasX, startCanvasY, startLayerPos } = dragInfoRef.current;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      const currentCanvasX = (clientX / rect.width) * compSettings.width;
      const currentCanvasY = (clientY / rect.height) * compSettings.height;

      const deltaX = currentCanvasX - startCanvasX;
      const deltaY = currentCanvasY - startCanvasY;

      const newPos = {
        x: Math.round(startLayerPos.x + deltaX),
        y: Math.round(startLayerPos.y + deltaY)
      };

      setLayers(prev => prev.map(l => {
        if (l.id !== layerId) return l;
        if (l.locked) return l;

        if (l.animatingPosition) {
          const existingIdx = l.positionKeyframes.findIndex(k => k.frame === currentFrame);
          let nextKfs = [...l.positionKeyframes];
          if (existingIdx >= 0) {
            nextKfs[existingIdx] = { ...nextKfs[existingIdx], value: newPos };
          } else {
            nextKfs.push({ frame: currentFrame, value: newPos });
            nextKfs.sort((a, b) => a.frame - b.frame);
          }
          return { ...l, position: newPos, positionKeyframes: nextKfs };
        } else {
          return { ...l, position: newPos };
        }
      }));
    };

    const handleWindowMouseUp = () => {
      setIsDraggingLayer(false);
      dragInfoRef.current = null;
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDraggingLayer, currentFrame, compSettings.width, compSettings.height]);

  // Keyboard Arrow Keys Nudge Listener (1px, Shift=10px) like Adobe After Effects
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not capture if user is typing in form inputs, textareas, or contentEditable
      const target = e.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) {
          return;
        }
      }

      if (!selectedLayerId) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedLayerId(null);
        return;
      }

      // Layer Reorder Shortcuts: Ctrl+] (Bring Forward), Ctrl+[ (Send Backward)
      if ((e.ctrlKey || e.metaKey) && (e.key === ']' || e.key === '}')) {
        e.preventDefault();
        setLayers(prev => {
          const idx = prev.findIndex(l => l.id === selectedLayerId);
          if (idx <= 0) return prev;
          const updated = [...prev];
          const [moved] = updated.splice(idx, 1);
          if (e.shiftKey) {
            updated.unshift(moved);
          } else {
            updated.splice(idx - 1, 0, moved);
          }
          return updated;
        });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '[' || e.key === '{')) {
        e.preventDefault();
        setLayers(prev => {
          const idx = prev.findIndex(l => l.id === selectedLayerId);
          if (idx < 0 || idx >= prev.length - 1) return prev;
          const updated = [...prev];
          const [moved] = updated.splice(idx, 1);
          if (e.shiftKey) {
            updated.push(moved);
          } else {
            updated.splice(idx + 1, 0, moved);
          }
          return updated;
        });
        return;
      }

      const isArrow = e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight';
      if (!isArrow) return;

      e.preventDefault();

      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;

      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;

      setLayers(prev => prev.map(l => {
        if (l.id !== selectedLayerId) return l;
        if (l.locked) return l;

        const currentPos = evaluateLayerAtFrame(l, currentFrame).pos;
        const newPos = {
          x: Math.round(currentPos.x + dx),
          y: Math.round(currentPos.y + dy)
        };

        if (l.animatingPosition) {
          const existingIdx = l.positionKeyframes.findIndex(k => k.frame === currentFrame);
          let nextKfs = [...l.positionKeyframes];
          if (existingIdx >= 0) {
            nextKfs[existingIdx] = { ...nextKfs[existingIdx], value: newPos };
          } else {
            nextKfs.push({ frame: currentFrame, value: newPos });
            nextKfs.sort((a, b) => a.frame - b.frame);
          }
          return { ...l, position: newPos, positionKeyframes: nextKfs };
        } else {
          return { ...l, position: newPos };
        }
      }));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLayerId, currentFrame, evaluateLayerAtFrame]);

  // Ensure layer selection remains robust:
  // Selection will ONLY clear if explicitly clicking on empty space directly inside the canvas,
  // or by pressing the Escape key, or when deleting a layer.
  // Using scrollbars (horizontal/vertical on page, panels, properties, or timeline) will never clear selection.

  // Animation Playback Engine
  useEffect(() => {
    if (!hasProject) return;

    let lastTimestamp = performance.now();
    const frameDuration = 1000 / compSettings.fps;

    const tick = (now: number) => {
      if (isPlayingRef.current) {
        const elapsed = now - lastTimestamp;
        if (elapsed >= frameDuration) {
          lastTimestamp = now - (elapsed % frameDuration);
          setCurrentFrame(prev => (prev + 1) % compSettings.totalFrames);
        }
      }
      animReqRef.current = requestAnimationFrame(tick);
    };

    animReqRef.current = requestAnimationFrame(tick);
    return () => {
      if (animReqRef.current) cancelAnimationFrame(animReqRef.current);
    };
  }, [hasProject, compSettings.fps, compSettings.totalFrames]);

  // -------------------------------------------------------------
  // LAYER MANAGEMENT & KEYFRAME SYSTEM
  // -------------------------------------------------------------

  const addNewLayer = (kind: LayerKind, subType?: string) => {
    const newId = `layer-${Date.now()}`;
    const count = layers.length + 1;
    let newLayer: AELayer;

    if (kind === 'shape') {
      if (subType === 'ring') {
        newLayer = {
          id: newId,
          name: `Ring Frame ${count}`,
          kind: 'shape',
          shapeKind: 'ring',
          visible: true,
          locked: false,
          colorLabel: 'yellow',
          expanded: false,
          position: { x: 0, y: 0 },
          scale: 100,
          rotation: 0,
          opacity: 100,
          animatingPosition: false,
          positionKeyframes: [],
          animatingScale: false,
          scaleKeyframes: [],
          animatingRotation: false,
          rotationKeyframes: [],
          animatingOpacity: false,
          opacityKeyframes: [],
          outerRadius: Math.round(compSettings.width * 0.36),
          innerRadius: Math.round(compSettings.width * 0.32),
          strokeWidth: 8,
          strokeColor: '#f59e0b',
          glowRadius: 15,
          glowColor: '#fbbf24'
        };
      } else if (subType === 'star') {
        newLayer = {
          id: newId,
          name: `Star ${count}`,
          kind: 'shape',
          shapeKind: 'star',
          visible: true,
          locked: false,
          colorLabel: 'purple',
          expanded: false,
          position: { x: 0, y: 0 },
          scale: 100,
          rotation: 0,
          opacity: 100,
          animatingPosition: false,
          positionKeyframes: [],
          animatingScale: false,
          scaleKeyframes: [],
          animatingRotation: false,
          rotationKeyframes: [],
          animatingOpacity: false,
          opacityKeyframes: [],
          outerRadius: 60,
          innerRadius: 28,
          points: 5,
          fillColor: '#ec4899',
          strokeWidth: 2,
          strokeColor: '#ffffff',
          glowRadius: 12,
          glowColor: '#f43f5e'
        };
      } else {
        // Circle default
        newLayer = {
          id: newId,
          name: `Circle Shape ${count}`,
          kind: 'shape',
          shapeKind: 'circle',
          visible: true,
          locked: false,
          colorLabel: 'blue',
          expanded: false,
          position: { x: 0, y: 0 },
          scale: 100,
          rotation: 0,
          opacity: 100,
          animatingPosition: false,
          positionKeyframes: [],
          animatingScale: false,
          scaleKeyframes: [],
          animatingRotation: false,
          rotationKeyframes: [],
          animatingOpacity: false,
          opacityKeyframes: [],
          outerRadius: 120,
          strokeWidth: 4,
          strokeColor: '#38bdf8',
          fillColor: 'transparent',
          glowRadius: 10,
          glowColor: '#0ea5e9'
        };
      }
    } else if (kind === 'text') {
      newLayer = {
        id: newId,
        name: `Text ${count}`,
        kind: 'text',
        visible: true,
        locked: false,
        colorLabel: 'red',
        expanded: false,
        position: { x: 0, y: 0 },
        scale: 100,
        rotation: 0,
        opacity: 100,
        animatingPosition: false,
        positionKeyframes: [],
        animatingScale: false,
        scaleKeyframes: [],
        animatingRotation: false,
        rotationKeyframes: [],
        animatingOpacity: false,
        opacityKeyframes: [],
        text: 'MOTION FRAME',
        fontSize: 32,
        fontColor: '#ffffff',
        strokeWidth: 2,
        strokeColor: '#000000',
        glowRadius: 10,
        glowColor: '#3b82f6'
      };
    } else {
      // Solid Layer
      newLayer = {
        id: newId,
        name: `Solid ${count}`,
        kind: 'solid',
        visible: true,
        locked: false,
        colorLabel: 'gray',
        expanded: false,
        position: { x: 0, y: 0 },
        scale: 100,
        rotation: 0,
        opacity: 50,
        animatingPosition: false,
        positionKeyframes: [],
        animatingScale: false,
        scaleKeyframes: [],
        animatingRotation: false,
        rotationKeyframes: [],
        animatingOpacity: false,
        opacityKeyframes: [],
        width: compSettings.width,
        height: compSettings.height,
        fillColor: '#1e293b'
      };
    }

    setLayers(prev => [newLayer, ...prev]);
    setSelectedLayerId(newId);
  };

  // Upload custom asset as an Image Layer
  const handleUploadAsset = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        const newId = `layer-${Date.now()}`;
        const newLayer: AELayer = {
          id: newId,
          name: file.name.replace(/\.[^/.]+$/, ''),
          kind: 'image',
          visible: true,
          locked: false,
          colorLabel: 'orange',
          expanded: false,
          position: { x: 0, y: 0 },
          scale: 100,
          rotation: 0,
          opacity: 100,
          animatingPosition: false,
          positionKeyframes: [],
          animatingScale: false,
          scaleKeyframes: [],
          animatingRotation: false,
          rotationKeyframes: [],
          animatingOpacity: false,
          opacityKeyframes: [],
          width: img.width,
          height: img.height,
          imageSrc: url,
          imageElement: img
        };
        setLayers(prev => [newLayer, ...prev]);
        setSelectedLayerId(newId);
      };
    }
  };

  const updateSelectedLayer = (updates: Partial<AELayer>) => {
    if (!selectedLayerId) return;
    setLayers(prev => prev.map(l => l.id === selectedLayerId ? { ...l, ...updates } : l));
  };

  const duplicateLayer = (layer: AELayer) => {
    const copy: AELayer = {
      ...layer,
      id: `layer-${Date.now()}`,
      name: `${layer.name} Copy`,
      position: { x: layer.position.x + 15, y: layer.position.y + 15 }
    };
    setLayers(prev => [copy, ...prev]);
    setSelectedLayerId(copy.id);
  };

  const deleteLayer = (id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id));
    if (selectedLayerId === id) {
      setSelectedLayerId(null);
    }
  };

  // Reorder layers by indices (HTML5 Drag & Drop)
  const reorderLayers = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    setLayers(prev => {
      if (fromIndex >= prev.length || toIndex >= prev.length) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  }, []);

  // Move layer up one position (bring forward in workspace)
  const moveLayerUp = useCallback((layerId: string) => {
    setLayers(prev => {
      const idx = prev.findIndex(l => l.id === layerId);
      if (idx <= 0) return prev; // Already at the top
      const updated = [...prev];
      const temp = updated[idx];
      updated[idx] = updated[idx - 1];
      updated[idx - 1] = temp;
      return updated;
    });
  }, []);

  // Move layer down one position (send backward in workspace)
  const moveLayerDown = useCallback((layerId: string) => {
    setLayers(prev => {
      const idx = prev.findIndex(l => l.id === layerId);
      if (idx < 0 || idx >= prev.length - 1) return prev; // Already at the bottom
      const updated = [...prev];
      const temp = updated[idx];
      updated[idx] = updated[idx + 1];
      updated[idx + 1] = temp;
      return updated;
    });
  }, []);

  // Bring layer to front (top of layers list, renders over all other layers)
  const bringLayerToFront = useCallback((layerId: string) => {
    setLayers(prev => {
      const idx = prev.findIndex(l => l.id === layerId);
      if (idx <= 0) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(idx, 1);
      updated.unshift(moved);
      return updated;
    });
  }, []);

  // Send layer to back (bottom of layers list, renders behind all other layers)
  const sendLayerToBack = useCallback((layerId: string) => {
    setLayers(prev => {
      const idx = prev.findIndex(l => l.id === layerId);
      if (idx < 0 || idx === prev.length - 1) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(idx, 1);
      updated.push(moved);
      return updated;
    });
  }, []);

  // Toggle Stopwatch (Enable/Disable Keyframing like Adobe After Effects)
  // When turned on, After Effects places EXACTLY ONE keyframe at the current playhead frame.
  // The layer remains completely static until the user moves the playhead and modifies values!
  const toggleStopwatch = (property: 'position' | 'scale' | 'rotation' | 'opacity') => {
    if (!selectedLayer) return;
    const l = selectedLayer;
    const f = currentFrame;
    const evaluated = evaluateLayerAtFrame(l, f);

    if (property === 'rotation') {
      const nextState = !l.animatingRotation;
      let kfs: Keyframe<number>[] = [];
      if (nextState) {
        // Place single keyframe at current playhead frame with current value (static hold)
        kfs = [{ frame: f, value: Math.round(evaluated.rotation) }];
      }
      updateSelectedLayer({ animatingRotation: nextState, rotationKeyframes: kfs, rotation: Math.round(evaluated.rotation) });
    } else if (property === 'scale') {
      const nextState = !l.animatingScale;
      let kfs: Keyframe<number>[] = [];
      if (nextState) {
        kfs = [{ frame: f, value: Math.round(evaluated.scale) }];
      }
      updateSelectedLayer({ animatingScale: nextState, scaleKeyframes: kfs, scale: Math.round(evaluated.scale) });
    } else if (property === 'position') {
      const nextState = !l.animatingPosition;
      let kfs: Keyframe<{ x: number; y: number }>[] = [];
      if (nextState) {
        kfs = [{ frame: f, value: { x: Math.round(evaluated.pos.x), y: Math.round(evaluated.pos.y) } }];
      }
      updateSelectedLayer({ animatingPosition: nextState, positionKeyframes: kfs, position: { x: Math.round(evaluated.pos.x), y: Math.round(evaluated.pos.y) } });
    } else if (property === 'opacity') {
      const nextState = !l.animatingOpacity;
      let kfs: Keyframe<number>[] = [];
      if (nextState) {
        kfs = [{ frame: f, value: Math.round(evaluated.opacity) }];
      }
      updateSelectedLayer({ animatingOpacity: nextState, opacityKeyframes: kfs, opacity: Math.round(evaluated.opacity) });
    }
  };

  // Add / Toggle a Keyframe Diamond at Current Frame (like After Effects ◇ button)
  const toggleKeyframeAtCurrentFrame = (property: 'rotation' | 'scale' | 'position' | 'opacity') => {
    if (!selectedLayer) return;
    const l = selectedLayer;
    const f = currentFrame;
    const evaluated = evaluateLayerAtFrame(l, f);

    if (property === 'rotation') {
      const existingIdx = l.rotationKeyframes.findIndex(k => k.frame === f);
      let nextKfs = [...l.rotationKeyframes];
      if (existingIdx >= 0) {
        nextKfs.splice(existingIdx, 1);
      } else {
        const val = Math.round(evaluated.rotation);
        nextKfs.push({ frame: f, value: val });
        nextKfs.sort((a, b) => a.frame - b.frame);
      }
      updateSelectedLayer({ animatingRotation: true, rotationKeyframes: nextKfs });
    } else if (property === 'scale') {
      const existingIdx = l.scaleKeyframes.findIndex(k => k.frame === f);
      let nextKfs = [...l.scaleKeyframes];
      if (existingIdx >= 0) {
        nextKfs.splice(existingIdx, 1);
      } else {
        const val = Math.round(evaluated.scale);
        nextKfs.push({ frame: f, value: val });
        nextKfs.sort((a, b) => a.frame - b.frame);
      }
      updateSelectedLayer({ animatingScale: true, scaleKeyframes: nextKfs });
    } else if (property === 'position') {
      const existingIdx = l.positionKeyframes.findIndex(k => k.frame === f);
      let nextKfs = [...l.positionKeyframes];
      if (existingIdx >= 0) {
        nextKfs.splice(existingIdx, 1);
      } else {
        const val = { x: Math.round(evaluated.pos.x), y: Math.round(evaluated.pos.y) };
        nextKfs.push({ frame: f, value: val });
        nextKfs.sort((a, b) => a.frame - b.frame);
      }
      updateSelectedLayer({ animatingPosition: true, positionKeyframes: nextKfs });
    } else if (property === 'opacity') {
      const existingIdx = l.opacityKeyframes.findIndex(k => k.frame === f);
      let nextKfs = [...l.opacityKeyframes];
      if (existingIdx >= 0) {
        nextKfs.splice(existingIdx, 1);
      } else {
        const val = Math.round(evaluated.opacity);
        nextKfs.push({ frame: f, value: val });
        nextKfs.sort((a, b) => a.frame - b.frame);
      }
      updateSelectedLayer({ animatingOpacity: true, opacityKeyframes: nextKfs });
    }
  };

  // Check if a layer has a keyframe at the current frame for a given property
  const hasKeyframeAtCurrentFrame = (
    property: 'rotation' | 'scale' | 'position' | 'opacity',
    layer?: AELayer | null
  ): boolean => {
    const l = layer || selectedLayer;
    if (!l) return false;
    const f = currentFrame;
    if (property === 'rotation') return l.rotationKeyframes.some(k => k.frame === f);
    if (property === 'scale') return l.scaleKeyframes.some(k => k.frame === f);
    if (property === 'position') return l.positionKeyframes.some(k => k.frame === f);
    if (property === 'opacity') return l.opacityKeyframes.some(k => k.frame === f);
    return false;
  };

  // Update a property value: if animating, updates or creates a keyframe at currentFrame
  const updateLayerPropertyValue = (
    property: 'position' | 'scale' | 'rotation' | 'opacity',
    value: any
  ) => {
    if (!selectedLayerId) return;

    setLayers(prev => prev.map(l => {
      if (l.id !== selectedLayerId) return l;

      if (property === 'rotation') {
        const numVal = Number(value);
        if (l.animatingRotation) {
          const existingIdx = l.rotationKeyframes.findIndex(k => k.frame === currentFrame);
          let nextKfs = [...l.rotationKeyframes];
          if (existingIdx >= 0) {
            nextKfs[existingIdx] = { ...nextKfs[existingIdx], value: numVal };
          } else {
            nextKfs.push({ frame: currentFrame, value: numVal });
            nextKfs.sort((a, b) => a.frame - b.frame);
          }
          return { ...l, rotation: numVal, rotationKeyframes: nextKfs };
        }
        return { ...l, rotation: numVal };
      }

      if (property === 'scale') {
        const numVal = Number(value);
        if (l.animatingScale) {
          const existingIdx = l.scaleKeyframes.findIndex(k => k.frame === currentFrame);
          let nextKfs = [...l.scaleKeyframes];
          if (existingIdx >= 0) {
            nextKfs[existingIdx] = { ...nextKfs[existingIdx], value: numVal };
          } else {
            nextKfs.push({ frame: currentFrame, value: numVal });
            nextKfs.sort((a, b) => a.frame - b.frame);
          }
          return { ...l, scale: numVal, scaleKeyframes: nextKfs };
        }
        return { ...l, scale: numVal };
      }

      if (property === 'opacity') {
        const numVal = Number(value);
        if (l.animatingOpacity) {
          const existingIdx = l.opacityKeyframes.findIndex(k => k.frame === currentFrame);
          let nextKfs = [...l.opacityKeyframes];
          if (existingIdx >= 0) {
            nextKfs[existingIdx] = { ...nextKfs[existingIdx], value: numVal };
          } else {
            nextKfs.push({ frame: currentFrame, value: numVal });
            nextKfs.sort((a, b) => a.frame - b.frame);
          }
          return { ...l, opacity: numVal, opacityKeyframes: nextKfs };
        }
        return { ...l, opacity: numVal };
      }

      if (property === 'position') {
        const posVal = value as { x: number; y: number };
        if (l.animatingPosition) {
          const existingIdx = l.positionKeyframes.findIndex(k => k.frame === currentFrame);
          let nextKfs = [...l.positionKeyframes];
          if (existingIdx >= 0) {
            nextKfs[existingIdx] = { ...nextKfs[existingIdx], value: posVal };
          } else {
            nextKfs.push({ frame: currentFrame, value: posVal });
            nextKfs.sort((a, b) => a.frame - b.frame);
          }
          return { ...l, position: posVal, positionKeyframes: nextKfs };
        }
        return { ...l, position: posVal };
      }

      return l;
    }));
  };

  // Add / Toggle keyframe for the layer at current playhead position
  const addOrToggleKeyframeForLayer = (layerId: string) => {
    const targetLayer = layers.find(l => l.id === layerId);
    if (!targetLayer) return;

    const f = currentFrame;
    const evalResult = evaluateLayerAtFrame(targetLayer, f);

    setLayers(prev => prev.map(l => {
      if (l.id !== layerId) return l;

      const hasAnyAnim = l.animatingRotation || l.animatingPosition || l.animatingScale || l.animatingOpacity;

      if (!hasAnyAnim) {
        // Default (e.g. wing animation): activate rotation with a single keyframe at current frame holding current value!
        return {
          ...l,
          animatingRotation: true,
          rotation: Math.round(evalResult.rotation),
          rotationKeyframes: [{ frame: f, value: Math.round(evalResult.rotation) }]
        };
      }

      let updated = { ...l };

      if (l.animatingRotation) {
        const existIdx = l.rotationKeyframes.findIndex(k => k.frame === f);
        let nextKfs = [...l.rotationKeyframes];
        if (existIdx >= 0) {
          nextKfs.splice(existIdx, 1);
        } else {
          nextKfs.push({ frame: f, value: Math.round(evalResult.rotation) });
          nextKfs.sort((a, b) => a.frame - b.frame);
        }
        updated.rotationKeyframes = nextKfs;
      }

      if (l.animatingPosition) {
        const existIdx = l.positionKeyframes.findIndex(k => k.frame === f);
        let nextKfs = [...l.positionKeyframes];
        if (existIdx >= 0) {
          nextKfs.splice(existIdx, 1);
        } else {
          nextKfs.push({ frame: f, value: { x: Math.round(evalResult.pos.x), y: Math.round(evalResult.pos.y) } });
          nextKfs.sort((a, b) => a.frame - b.frame);
        }
        updated.positionKeyframes = nextKfs;
      }

      if (l.animatingScale) {
        const existIdx = l.scaleKeyframes.findIndex(k => k.frame === f);
        let nextKfs = [...l.scaleKeyframes];
        if (existIdx >= 0) {
          nextKfs.splice(existIdx, 1);
        } else {
          nextKfs.push({ frame: f, value: Math.round(evalResult.scale) });
          nextKfs.sort((a, b) => a.frame - b.frame);
        }
        updated.scaleKeyframes = nextKfs;
      }

      if (l.animatingOpacity) {
        const existIdx = l.opacityKeyframes.findIndex(k => k.frame === f);
        let nextKfs = [...l.opacityKeyframes];
        if (existIdx >= 0) {
          nextKfs.splice(existIdx, 1);
        } else {
          nextKfs.push({ frame: f, value: Math.round(evalResult.opacity) });
          nextKfs.sort((a, b) => a.frame - b.frame);
        }
        updated.opacityKeyframes = nextKfs;
      }

      return updated;
    }));
  };

  // Keyframe navigation helpers (J / K shortcuts like AE)
  const getAllKeyframeFrames = (layer?: AELayer | null): number[] => {
    const l = layer || selectedLayer;
    if (!l) return [];
    const frames = new Set<number>();
    if (l.animatingPosition) l.positionKeyframes.forEach(k => frames.add(k.frame));
    if (l.animatingScale) l.scaleKeyframes.forEach(k => frames.add(k.frame));
    if (l.animatingRotation) l.rotationKeyframes.forEach(k => frames.add(k.frame));
    if (l.animatingOpacity) l.opacityKeyframes.forEach(k => frames.add(k.frame));
    return Array.from(frames).sort((a, b) => a - b);
  };

  const goToPrevKeyframe = () => {
    const all = getAllKeyframeFrames(selectedLayer);
    const prevs = all.filter(f => f < currentFrame);
    if (prevs.length > 0) {
      setCurrentFrame(prevs[prevs.length - 1]);
    }
  };

  const goToNextKeyframe = () => {
    const all = getAllKeyframeFrames(selectedLayer);
    const nexts = all.filter(f => f > currentFrame);
    if (nexts.length > 0) {
      setCurrentFrame(nexts[0]);
    }
  };

  // -------------------------------------------------------------
  // EXPORT PIPELINE (SVGA, APNG, GIF, JSX AFTER EFFECTS SCRIPT)
  // -------------------------------------------------------------

  const captureAllFrames = async (progressCb: (percent: number, msg: string) => void) => {
    const w = compSettings.width;
    const h = compSettings.height;
    const total = compSettings.totalFrames;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = w;
    offCanvas.height = h;

    const canvases: HTMLCanvasElement[] = [];
    const dataUrls: string[] = [];

    for (let f = 0; f < total; f++) {
      renderCompositionToCanvas(offCanvas, f, true);

      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = w;
      frameCanvas.height = h;
      const fCtx = frameCanvas.getContext('2d')!;
      fCtx.drawImage(offCanvas, 0, 0);

      canvases.push(frameCanvas);
      dataUrls.push(frameCanvas.toDataURL('image/png'));

      const p = Math.round(((f + 1) / total) * 50);
      progressCb(p, `رندرة الإطار ${f + 1} من ${total}...`);
      await new Promise(r => setTimeout(r, 0));
    }

    return { canvases, dataUrls };
  };

  // Helper to render an individual layer as an isolated piece/sprite asset
  const renderLayerPiece = useCallback((layer: AELayer): {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    anchorX: number;
    anchorY: number;
  } => {
    let pw = 256;
    let ph = 256;

    const strokeW = layer.strokeWidth || 0;
    const glow = (layer.glowRadius && layer.glowRadius > 0) ? layer.glowRadius : 0;
    const margin = Math.ceil(strokeW + glow + 16);

    switch (layer.kind) {
      case 'shape': {
        if (layer.shapeKind === 'rectangle') {
          const rw = layer.width || 300;
          const rh = layer.height || 300;
          pw = Math.ceil(rw + margin * 2);
          ph = Math.ceil(rh + margin * 2);
        } else {
          // ring, circle, polygon, star
          const outerR = layer.outerRadius || 180;
          const dim = Math.ceil((outerR + margin) * 2);
          pw = dim;
          ph = dim;
        }
        break;
      }

      case 'text': {
        const txt = layer.text || 'AFTER EFFECTS';
        const fontSize = layer.fontSize || 36;
        const fontFamily = layer.fontFamily || 'sans-serif';
        const tempCanvas = document.createElement('canvas');
        const tctx = tempCanvas.getContext('2d')!;
        tctx.font = `bold ${fontSize}px ${fontFamily}`;
        const metrics = tctx.measureText(txt);
        pw = Math.ceil(metrics.width + margin * 2);
        ph = Math.ceil(fontSize * 1.8 + margin * 2);
        break;
      }

      case 'image': {
        const iw = layer.width || (layer.imageElement ? layer.imageElement.width : 256);
        const ih = layer.height || (layer.imageElement ? layer.imageElement.height : 256);
        pw = Math.ceil(iw + margin * 2);
        ph = Math.ceil(ih + margin * 2);
        break;
      }

      case 'solid': {
        pw = layer.width || compSettings.width;
        ph = layer.height || compSettings.height;
        break;
      }
    }

    // Ensure even dimensions
    if (pw % 2 !== 0) pw += 1;
    if (ph % 2 !== 0) ph += 1;
    const anchorX = pw / 2;
    const anchorY = ph / 2;

    const canvas = document.createElement('canvas');
    canvas.width = pw;
    canvas.height = ph;
    const ctx = canvas.getContext('2d')!;

    // Move to center anchor point
    ctx.translate(anchorX, anchorY);

    // Apply glow if active
    if (glow > 0) {
      ctx.shadowColor = layer.glowColor || '#f59e0b';
      ctx.shadowBlur = glow;
    }

    // Draw the layer graphic at local origin (0, 0)
    switch (layer.kind) {
      case 'shape': {
        const outerR = layer.outerRadius || 180;
        const innerR = layer.innerRadius || 150;
        ctx.fillStyle = layer.fillColor || 'transparent';
        ctx.strokeStyle = layer.strokeColor || '#fbbf24';
        ctx.lineWidth = strokeW;

        if (layer.shapeKind === 'ring') {
          ctx.beginPath();
          ctx.arc(0, 0, outerR, 0, Math.PI * 2);
          ctx.stroke();

          if (innerR > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, innerR, 0, Math.PI * 2);
            ctx.stroke();
          }

          const studs = 8;
          for (let i = 0; i < studs; i++) {
            const a = (i * Math.PI * 2) / studs;
            const sx = Math.cos(a) * ((outerR + innerR) / 2);
            const sy = Math.sin(a) * ((outerR + innerR) / 2);
            ctx.beginPath();
            ctx.arc(sx, sy, Math.max(2, strokeW * 0.4), 0, Math.PI * 2);
            ctx.fillStyle = layer.strokeColor || '#ffffff';
            ctx.fill();
          }
        } else if (layer.shapeKind === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, outerR, 0, Math.PI * 2);
          if (layer.fillColor && layer.fillColor !== 'transparent') ctx.fill();
          if (strokeW > 0) ctx.stroke();
        } else if (layer.shapeKind === 'rectangle') {
          const rw = layer.width || 300;
          const rh = layer.height || 300;
          ctx.beginPath();
          ctx.rect(-rw / 2, -rh / 2, rw, rh);
          if (layer.fillColor && layer.fillColor !== 'transparent') ctx.fill();
          if (strokeW > 0) ctx.stroke();
        } else if (layer.shapeKind === 'polygon') {
          const sides = layer.points || 6;
          ctx.beginPath();
          for (let i = 0; i < sides; i++) {
            const angle = (i * Math.PI * 2) / sides - Math.PI / 2;
            const x = Math.cos(angle) * outerR;
            const y = Math.sin(angle) * outerR;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          if (layer.fillColor && layer.fillColor !== 'transparent') ctx.fill();
          if (strokeW > 0) ctx.stroke();
        } else if (layer.shapeKind === 'star') {
          const pts = layer.points || 5;
          const r1 = outerR;
          const r2 = innerR || outerR * 0.45;
          ctx.beginPath();
          for (let i = 0; i < pts * 2; i++) {
            const r = i % 2 === 0 ? r1 : r2;
            const angle = (i * Math.PI) / pts - Math.PI / 2;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          if (layer.fillColor && layer.fillColor !== 'transparent') ctx.fill();
          if (strokeW > 0) ctx.stroke();
        }
        break;
      }

      case 'text': {
        const txt = layer.text || 'AFTER EFFECTS';
        ctx.font = `bold ${layer.fontSize || 36}px ${layer.fontFamily || 'sans-serif'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = layer.fontColor || '#ffffff';
        ctx.fillText(txt, 0, 0);

        if (strokeW > 0) {
          ctx.lineWidth = strokeW;
          ctx.strokeStyle = layer.strokeColor || '#000000';
          ctx.strokeText(txt, 0, 0);
        }
        break;
      }

      case 'image': {
        if (layer.imageElement && layer.imageElement.complete) {
          const iw = layer.width || layer.imageElement.width;
          const ih = layer.height || layer.imageElement.height;
          ctx.drawImage(layer.imageElement, -iw / 2, -ih / 2, iw, ih);
        }
        break;
      }

      case 'solid': {
        const sw = layer.width || compSettings.width;
        const sh = layer.height || compSettings.height;
        ctx.fillStyle = layer.fillColor || '#ffffff';
        ctx.fillRect(-sw / 2, -sh / 2, sw, sh);
        break;
      }
    }

    return { canvas, width: pw, height: ph, anchorX, anchorY };
  }, [compSettings.width, compSettings.height]);

  // 1. Export as SVGA 2.0 (Piece-based Sprites or Full-frame Sequence)
  const exportAsSVGA = async () => {
    try {
      setExporting(true);
      setExportProgress(10);

      const root = parse(svgaSchema).root;
      const MovieEntity = root.lookupType('com.opensource.svga.MovieEntity');
      const total = compSettings.totalFrames;

      const images: Record<string, Uint8Array> = {};
      const sprites: any[] = [];

      if (svgaExportMode === 'pieces') {
        // --- PIECE-BASED SPRITES (قطع عادي ومصفوفات تحريك أصلية) ---
        setExportStatusText('جاري تقطيع الطبقات إلى أصول شفافة (Sprites)...');

        // Order from bottom to top so top layer is drawn last in SVGA Player
        const activeLayers = [...layers].filter(l => l.visible).reverse();
        if (activeLayers.length === 0) {
          throw new Error('لا توجد طبقات مرئية في المشروع لتصديرها.');
        }

        for (let idx = 0; idx < activeLayers.length; idx++) {
          const layer = activeLayers[idx];
          const piece = renderLayerPiece(layer);

          // Convert piece canvas to PNG byte array
          const dataUrl = piece.canvas.toDataURL('image/png');
          const base64 = dataUrl.split(',')[1];
          const binaryStr = atob(base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let b = 0; b < binaryStr.length; b++) {
            bytes[b] = binaryStr.charCodeAt(b);
          }

          const cleanName = layer.name.replace(/[^a-zA-Z0-9_]/g, '_');
          const imageKey = `piece_${idx}_${cleanName || 'layer'}`;
          images[imageKey] = bytes;

          // Build sprite frame transformations across all frames
          const spriteFrames = [];
          for (let f = 0; f < total; f++) {
            const { pos, scale, rotation, opacity } = evaluateLayerAtFrame(layer, f);
            const alpha = !layer.visible ? 0.0 : Math.max(0, Math.min(1, opacity / 100));

            const s = scale / 100;
            const rad = (rotation * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);

            const a = s * cos;
            const b = s * sin;
            const c = -s * sin;
            const d = s * cos;

            const cx = compSettings.width / 2 + pos.x;
            const cy = compSettings.height / 2 + pos.y;

            const tx = cx - (piece.anchorX * a + piece.anchorY * c);
            const ty = cy - (piece.anchorX * b + piece.anchorY * d);

            spriteFrames.push({
              alpha: Number(alpha.toFixed(4)),
              layout: {
                x: 0,
                y: 0,
                width: piece.width,
                height: piece.height
              },
              transform: {
                a: Number(a.toFixed(5)),
                b: Number(b.toFixed(5)),
                c: Number(c.toFixed(5)),
                d: Number(d.toFixed(5)),
                tx: Number(tx.toFixed(3)),
                ty: Number(ty.toFixed(3))
              }
            });
          }

          sprites.push({
            imageKey: imageKey,
            frames: spriteFrames
          });

          setExportProgress(10 + Math.round(((idx + 1) / activeLayers.length) * 60));
          setExportStatusText(`تم تجهيز القطعة ${idx + 1} من ${activeLayers.length}: ${layer.name}`);
          await new Promise(r => setTimeout(r, 0));
        }
      } else {
        // Fallback: Full Frame Bitmap Sequence Render
        setExportStatusText('جاري رندرة الإطارات المتتابعة...');
        const { dataUrls } = await captureAllFrames((p, msg) => {
          setExportProgress(Math.round(p * 0.7));
          setExportStatusText(msg);
        });

        for (let i = 0; i < total; i++) {
          const imageKey = `frame_${i}`;
          const base64 = dataUrls[i].split(',')[1];
          const binaryStr = atob(base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let b = 0; b < binaryStr.length; b++) {
            bytes[b] = binaryStr.charCodeAt(b);
          }
          images[imageKey] = bytes;

          const spriteFrames = [];
          for (let j = 0; j < total; j++) {
            spriteFrames.push({
              alpha: i === j ? 1.0 : 0.0,
              layout: { x: 0, y: 0, width: compSettings.width, height: compSettings.height },
              transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
            });
          }

          sprites.push({
            imageKey: imageKey,
            frames: spriteFrames
          });
        }
      }

      setExportProgress(80);
      setExportStatusText('جاري ضغط وترميز ملف الـ SVGA...');

      const movie = {
        version: '2.0',
        params: {
          viewBoxWidth: compSettings.width,
          viewBoxHeight: compSettings.height,
          fps: compSettings.fps,
          frames: total
        },
        images: images,
        sprites: sprites
      };

      const errMsg = MovieEntity.verify(movie);
      if (errMsg) throw new Error(errMsg);

      const message = MovieEntity.create(movie);
      const encoded = MovieEntity.encode(message).finish();
      const compressed = pako.deflate(encoded);

      const blob = new Blob([compressed], { type: 'application/octet-stream' });
      const filename = `${compSettings.name.replace(/\s+/g, '_')}_${Date.now()}.svga`;

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.click();

      const rawFile = new File([blob], filename, { type: 'application/octet-stream' });
      const svgaFileExt: SVGAFileExtended = {
        name: filename,
        size: blob.size,
        type: 'application/octet-stream',
        lastModified: Date.now(),
        url: downloadUrl,
        rawFile: rawFile
      };
      setLastExportedSVGA(svgaFileExt);

      setExportProgress(100);
      setExportStatusText(
        svgaExportMode === 'pieces'
          ? 'تم تصدير ملف الـ SVGA (قطع عادي أصلي) بنجاح!'
          : 'تم تصدير ملف الـ SVGA (رندر إطارات) بنجاح!'
      );
      setTimeout(() => setExporting(false), 1200);
    } catch (err: any) {
      console.error(err);
      alert('خطأ أثناء تصدير SVGA: ' + err.message);
      setExporting(false);
    }
  };

  // 2. Export as Transparent APNG
  const exportAsAPNG = async () => {
    try {
      setExporting(true);
      setExportProgress(5);
      setExportStatusText('جاري رندرة الإطارات لـ APNG...');

      const { canvases } = await captureAllFrames((p, msg) => {
        setExportProgress(p);
        setExportStatusText(msg);
      });

      setExportProgress(65);
      setExportStatusText('جاري تجميع فريمات APNG مع قنوات الشفافية...');

      const buffers: ArrayBuffer[] = [];
      const delays: number[] = [];
      const frameDelay = Math.round(1000 / compSettings.fps);

      for (let i = 0; i < canvases.length; i++) {
        const ctx = canvases[i].getContext('2d')!;
        const imgData = ctx.getImageData(0, 0, compSettings.width, compSettings.height);
        buffers.push(imgData.data.buffer);
        delays.push(frameDelay);
      }

      setExportProgress(85);
      setExportStatusText('جاري تشفير ملف APNG...');

      const apngBuffer = UPNG.encode(buffers, compSettings.width, compSettings.height, 0, delays);
      const blob = new Blob([apngBuffer], { type: 'image/png' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `${compSettings.name.replace(/\s+/g, '_')}_${Date.now()}.png`;
      link.click();

      setExportProgress(100);
      setExportStatusText('تم تصدير APNG الشفاف بنجاح!');
      setTimeout(() => setExporting(false), 1200);
    } catch (err: any) {
      console.error(err);
      alert('خطأ أثناء تصدير APNG: ' + err.message);
      setExporting(false);
    }
  };

  // 3. Export as Transparent GIF
  const exportAsGIF = async () => {
    try {
      setExporting(true);
      setExportProgress(5);
      setExportStatusText('جاري رندرة الإطارات للـ GIF...');

      const { canvases } = await captureAllFrames((p, msg) => {
        setExportProgress(p);
        setExportStatusText(msg);
      });

      setExportProgress(65);
      setExportStatusText('جاري تشفير ألوان الـ GIF الشفاف...');

      const gif = GIFEncoder();
      const delayMs = Math.round(1000 / compSettings.fps);
      const w = compSettings.width;
      const h = compSettings.height;

      for (let i = 0; i < canvases.length; i++) {
        const ctx = canvases[i].getContext('2d')!;
        const imgData = ctx.getImageData(0, 0, w, h);
        const { data } = imgData;

        const palette = quantize(data, 256, { format: 'rgba4444' });
        const index = applyPalette(data, palette, 'rgba4444');

        gif.writeFrame(index, w, h, {
          palette,
          delay: delayMs,
          transparent: true,
          dispose: 2
        });
      }

      gif.finish();
      const bytes = gif.bytes();
      const blob = new Blob([bytes], { type: 'image/gif' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `${compSettings.name.replace(/\s+/g, '_')}_${Date.now()}.gif`;
      link.click();

      setExportProgress(100);
      setExportStatusText('تم تصدير GIF بنجاح!');
      setTimeout(() => setExporting(false), 1200);
    } catch (err: any) {
      console.error(err);
      alert('خطأ أثناء تصدير GIF: ' + err.message);
      setExporting(false);
    }
  };

  // 4. Export AE ExtendScript (.jsx)
  const exportAsAEJSX = () => {
    const duration = (compSettings.totalFrames / compSettings.fps).toFixed(2);
    let jsx = `// Adobe After Effects Script Generated by Flex Studio\n`;
    jsx += `app.beginUndoGroup("Create ${compSettings.name}");\n`;
    jsx += `var comp = app.project.items.addComp("${compSettings.name}", ${compSettings.width}, ${compSettings.height}, 1, ${duration}, ${compSettings.fps});\n\n`;

    layers.forEach((layer, idx) => {
      jsx += `// Layer ${idx + 1}: ${layer.name}\n`;
      if (layer.kind === 'shape') {
        jsx += `var shapeLayer${idx} = comp.layers.addShape();\n`;
        jsx += `shapeLayer${idx}.name = "${layer.name}";\n`;
        jsx += `shapeLayer${idx}.transform.position.setValue([${compSettings.width / 2 + layer.position.x}, ${compSettings.height / 2 + layer.position.y}]);\n`;
        jsx += `shapeLayer${idx}.transform.scale.setValue([${layer.scale}, ${layer.scale}]);\n`;
        if (layer.animatingRotation) {
          jsx += `shapeLayer${idx}.transform.rotation.setValueAtTime(0, ${layer.rotation});\n`;
          jsx += `shapeLayer${idx}.transform.rotation.setValueAtTime(${duration}, ${layer.rotation + 360});\n`;
        }
      } else if (layer.kind === 'text') {
        jsx += `var textLayer${idx} = comp.layers.addText("${layer.text || 'TEXT'}");\n`;
        jsx += `textLayer${idx}.name = "${layer.name}";\n`;
        jsx += `textLayer${idx}.transform.position.setValue([${compSettings.width / 2 + layer.position.x}, ${compSettings.height / 2 + layer.position.y}]);\n`;
      }
      jsx += `\n`;
    });

    jsx += `app.endUndoGroup();\n`;

    const blob = new Blob([jsx], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${compSettings.name}.jsx`;
    link.click();
  };

  // Render Composition Settings Window
  const renderCompSettingsContent = (isInitial: boolean) => (
    <div className="w-full max-w-xl bg-slate-900/50 border border-slate-800/50 rounded-3xl p-6 sm:p-7 text-slate-200 flex flex-col gap-5 relative shadow-2xl">
      {/* Modal Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3.5 relative z-10">
        <div className="flex items-center gap-2.5 font-bold text-base text-violet-300">
          <span className="bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-lg font-mono text-xs border border-violet-500/30">
            Ae
          </span>
          <span>إعدادات الكومبوزيشن (Composition Settings)</span>
        </div>
        {!isInitial && (
          <button
            type="button"
            onClick={() => setShowCompSettingsModal(false)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Presets Quick Choices */}
      <div className="flex flex-col gap-2 relative z-10">
        <label className="text-xs text-slate-400 font-bold">قوالب أبعاد الإطارات الشائعة:</label>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setResolutionPreset(750, 750, 90, 30)}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-violet-600/20 border border-white/10 hover:border-violet-500/40 text-center flex flex-col gap-1 transition-all"
          >
            <span className="font-bold text-white text-xs">إطار بروفايل قياسي</span>
            <span className="text-[10px] text-slate-400 font-mono">750 × 750 px</span>
          </button>

          <button
            type="button"
            onClick={() => setResolutionPreset(512, 512, 90, 30)}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-violet-600/20 border border-white/10 hover:border-violet-500/40 text-center flex flex-col gap-1 transition-all"
          >
            <span className="font-bold text-white text-xs">مربع خفيف (512)</span>
            <span className="text-[10px] text-slate-400 font-mono">512 × 512 px</span>
          </button>

          <button
            type="button"
            onClick={() => setResolutionPreset(1080, 1080, 120, 60)}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-violet-600/20 border border-white/10 hover:border-violet-500/40 text-center flex flex-col gap-1 transition-all"
          >
            <span className="font-bold text-white text-xs">فائق الدقة 60 FPS</span>
            <span className="text-[10px] text-slate-400 font-mono">1080 × 1080 px</span>
          </button>
        </div>
      </div>

      {/* Inputs Form */}
      <div className="flex flex-col gap-3 text-xs relative z-10">
        {/* Name */}
        <div className="flex items-center justify-between gap-4">
          <label className="text-slate-300 w-32 font-medium">اسم الكومبوزيشن:</label>
          <input
            type="text"
            value={modalName}
            onChange={(e) => setModalName(e.target.value)}
            className="flex-1 bg-slate-800/40 border border-slate-700/50 px-3 py-2 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-violet-500/60"
          />
        </div>

        {/* Width & Height */}
        <div className="flex items-center justify-between gap-4">
          <label className="text-slate-300 w-32 font-medium">الأبعاد (العرض × الارتفاع):</label>
          <div className="flex-1 flex items-center gap-2">
            <input
              type="number"
              value={modalWidth}
              onChange={(e) => setModalWidth(Number(e.target.value))}
              className="w-full bg-slate-800/40 border border-slate-700/50 px-3 py-2 rounded-xl text-slate-100 text-xs font-mono focus:outline-none focus:border-violet-500/60"
              placeholder="Width"
            />
            <span className="text-slate-500">×</span>
            <input
              type="number"
              value={modalHeight}
              onChange={(e) => setModalHeight(Number(e.target.value))}
              className="w-full bg-slate-800/40 border border-slate-700/50 px-3 py-2 rounded-xl text-slate-100 text-xs font-mono focus:outline-none focus:border-violet-500/60"
              placeholder="Height"
            />
            <span className="text-slate-400 font-mono text-[11px]">px</span>
          </div>
        </div>

        {/* Frame Rate (FPS) */}
        <div className="flex items-center justify-between gap-4">
          <label className="text-slate-300 w-32 font-medium">معدل الفريمات (FPS):</label>
          <div className="flex-1 flex items-center gap-2">
            {[24, 30, 60].map(rate => (
              <button
                key={rate}
                type="button"
                onClick={() => handleFpsChange(rate)}
                className={`flex-1 py-1.5 rounded-lg font-mono text-xs transition-all border ${
                  modalFps === rate
                    ? 'bg-violet-600/30 border-violet-500/50 text-violet-200 font-bold'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                {rate} FPS
              </button>
            ))}
          </div>
        </div>

        {/* Total Frames (Direct Specification) */}
        <div className="flex items-center justify-between gap-4 p-3 bg-slate-800/30 rounded-2xl border border-slate-700/50">
          <div className="flex flex-col">
            <label className="text-slate-200 font-bold">عدد الفريمات بالضبط (Total Frames):</label>
            <span className="text-[10px] text-slate-400">حدد عدد فريمات الأنيميشن الكاملة مباشرة</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="1000"
              value={modalTotalFrames}
              onChange={(e) => handleTotalFramesChange(Number(e.target.value))}
              className="w-24 bg-slate-800/50 border border-slate-700/50 px-3 py-1.5 rounded-xl text-slate-200 text-sm font-mono font-bold text-center focus:outline-none focus:border-violet-500/60"
            />
            <span className="text-slate-400 font-mono text-[11px]">فريم</span>
          </div>
        </div>

        {/* Duration Equivalent */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <span>المدة الزمنية المقابلة:</span>
          <span className="font-mono text-slate-300 font-medium flex items-center gap-1.5">
            <span>{modalDurationSec} ثانية</span>
            <span className="text-slate-600">•</span>
            <span className="text-violet-300/90">{modalTotalFrames} فريم</span>
            <span className="text-slate-500 text-[10px]">(@ {modalFps} fps)</span>
          </span>
        </div>
      </div>

      {/* Modal Actions */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10 relative z-10">
        {!isInitial && (
          <button
            type="button"
            onClick={() => setShowCompSettingsModal(false)}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold transition-all"
          >
            إلغاء
          </button>
        )}
        <button
          type="button"
          onClick={handleCreateComposition}
          className="w-full sm:w-auto px-7 py-2.5 rounded-xl bg-violet-600/25 hover:bg-violet-600/35 border border-violet-500/40 hover:border-violet-400/60 text-violet-200 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm backdrop-blur-sm"
        >
          <Check size={16} />
          <span>تطبيق التعديلات</span>
        </button>
      </div>
    </div>
  );

  // When no project is loaded yet, show ONLY the popup window itself without black backdrop!
  if (!hasProject) {
    return (
      <div className="w-full flex items-center justify-center min-h-[640px] py-8 px-4 select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="w-full max-w-xl"
        >
          {renderCompSettingsContent(true)}
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-[1360px] mx-auto flex flex-col h-[calc(100vh-84px)] min-h-[720px] max-h-[860px] bg-slate-900/50 border border-slate-800/50 rounded-lg overflow-hidden shadow-2xl text-slate-200 select-none"
    >
      
      {/* ----------------- TOP AE MENU BAR & TOOLBAR ----------------- */}
      <div className="h-11 border-b border-slate-800/50 bg-slate-900/50 px-4 flex items-center justify-between gap-3 text-xs">
        {/* Left Side: Logo & AE Menu */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-bold text-violet-400">
            <span className="bg-violet-600/30 text-violet-300 px-1.5 py-0.5 rounded font-mono text-[11px] border border-violet-500/40">Ae</span>
            <span className="font-semibold tracking-wide text-slate-200">AFTER EFFECTS STUDIO</span>
          </div>

          <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>

          {/* Menus */}
          <div className="hidden md:flex items-center gap-1 text-slate-400">
            <button 
              onClick={() => setShowCompSettingsModal(true)}
              className="px-2 py-1 rounded hover:bg-white/5 hover:text-white transition-colors"
            >
              مشروع جديد (New Comp)
            </button>
            <button 
              onClick={() => setShowCompSettingsModal(true)}
              className="px-2 py-1 rounded hover:bg-white/5 hover:text-white transition-colors"
            >
              إعدادات الكومبوزيشن (Ctrl+K)
            </button>
          </div>
        </div>

        {/* Right Side: Export Action */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExportModalOpen(true)}
            disabled={!hasProject}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/40 text-xs font-bold transition-all disabled:opacity-40 active:scale-[0.98]"
          >
            <Download size={13} />
            <span>تصدير (Export)</span>
          </button>
        </div>
      </div>

      {/* ----------------- MAIN WORKSPACE (VIEWPORT & SIDEBARS) ----------------- */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT PANEL: Project & Layer Controls */}
        <div className="w-64 border-r border-slate-800/50 bg-slate-900/20 flex flex-col text-xs">
          {/* Panel Header */}
          <div className="p-2.5 border-b border-slate-800/60 flex items-center justify-between text-slate-400 font-bold">
            <div className="flex items-center gap-1.5">
              <Film size={13} className="text-violet-400" />
              <span>مشروع (Project)</span>
            </div>
            <button 
              onClick={() => setShowCompSettingsModal(true)}
              className="p-1 hover:text-white rounded"
              title="إعدادات الكومبوزيشن"
            >
              <Settings size={13} />
            </button>
          </div>

          {/* Project Info Card */}
          <div className="p-3 bg-slate-800/25 border-b border-slate-800/50 flex flex-col gap-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono">الاسم:</span>
              <span className="font-bold text-slate-200">{compSettings.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono">الأبعاد:</span>
              <span className="font-mono text-emerald-400">{compSettings.width} × {compSettings.height} px</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono">الفريمات:</span>
              <span className="font-mono text-cyan-400">{compSettings.totalFrames} f ({compSettings.fps} fps)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono">المدة:</span>
              <span className="font-mono text-amber-400">{(compSettings.totalFrames / compSettings.fps).toFixed(2)} ثانية</span>
            </div>
          </div>

          {/* Add Layer Quick Bar */}
          <div className="p-2 border-b border-slate-800/60 flex items-center justify-between">
            <span className="text-slate-400 font-bold text-[11px]">إضافة طبقة:</span>
            <div className="flex items-center gap-1.5">
              <label
                title="استيراد صورة كطبقة"
                className="p-1 px-2.5 rounded bg-slate-800/60 hover:bg-violet-600/30 text-slate-300 hover:text-white cursor-pointer flex items-center gap-1.5 text-[10px]"
              >
                <Upload size={11} className="text-emerald-400" />
                <span>صورة</span>
                <input type="file" accept="image/*" onChange={handleUploadAsset} className="hidden" />
              </label>
            </div>
          </div>

          {/* Layer List (Quick Selection & Drag Reorder) */}
          <div 
            className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-1"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
          >
            {layers.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500 gap-2">
                <Layers size={24} className="opacity-40" />
                <span>لا توجد طبقات بعد.</span>
                <span className="text-[10px]">اضغط على استيراد صورة للبدء في تصميم وتحريك إطارك.</span>
              </div>
            ) : (
              <>
                {layers.map((layer, idx) => {
                  const isDragging = draggedLayerIdx === idx;
                  const isDropTarget = dropTargetIdx === idx;

                  return (
                    <div
                      key={layer.id}
                      draggable={!layer.locked}
                      onDragStart={(e) => {
                        setDraggedLayerIdx(idx);
                        e.dataTransfer.setData('text/plain', String(idx));
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = 'move';
                        const rect = e.currentTarget.getBoundingClientRect();
                        const midY = rect.top + rect.height / 2;
                        const pos = e.clientY < midY ? 'above' : 'below';
                        if (dropTargetIdx !== idx || dropPosition !== pos) {
                          setDropTargetIdx(idx);
                          setDropPosition(pos);
                        }
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          if (dropTargetIdx === idx) {
                            setDropTargetIdx(null);
                            setDropPosition(null);
                          }
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (draggedLayerIdx !== null) {
                          let targetIndex = idx;
                          if (dropPosition === 'below') {
                            targetIndex = idx + 1;
                          }
                          if (draggedLayerIdx < targetIndex) {
                            targetIndex -= 1;
                          }
                          reorderLayers(draggedLayerIdx, targetIndex);
                        }
                        setDraggedLayerIdx(null);
                        setDropTargetIdx(null);
                        setDropPosition(null);
                      }}
                      onDragEnd={() => {
                        setDraggedLayerIdx(null);
                        setDropTargetIdx(null);
                        setDropPosition(null);
                      }}
                      onClick={() => setSelectedLayerId(layer.id)}
                      data-interactive="true"
                      className={`layer-row-item relative group flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-all border ${
                        isDragging
                          ? 'opacity-30 border-dashed border-cyan-400 bg-slate-800/40'
                          : selectedLayerId === layer.id
                            ? 'bg-violet-600/20 border-violet-500/40 text-violet-200 shadow-sm'
                            : 'bg-slate-800/25 border-transparent hover:bg-slate-800/40 text-slate-400'
                      }`}
                    >
                      {/* Visual Drop Indicators */}
                      {isDropTarget && dropPosition === 'above' && (
                        <div className="absolute -top-0.5 left-1 right-1 h-0.5 bg-cyan-400 rounded-full z-30 pointer-events-none"></div>
                      )}
                      {isDropTarget && dropPosition === 'below' && (
                        <div className="absolute -bottom-0.5 left-1 right-1 h-0.5 bg-cyan-400 rounded-full z-30 pointer-events-none"></div>
                      )}

                      <div className="flex items-center gap-1.5 truncate">
                        {/* Drag Handle Grip */}
                        <div 
                          className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-300 p-0.5 shrink-0"
                          title="اسحب لتغيير ترتيب الطبقة في مساحة العمل"
                        >
                          <GripVertical size={12} />
                        </div>

                        {/* Stacking Order Number */}
                        <span className="text-[10px] text-slate-500 font-mono w-3.5 text-center shrink-0">
                          {idx + 1}
                        </span>

                        {/* Thumbnail Image / Shape Icon */}
                        <div className="w-5 h-5 rounded bg-slate-950/80 border border-slate-700/60 overflow-hidden flex items-center justify-center shrink-0">
                          {layer.kind === 'image' && layer.imageSrc ? (
                            <img src={layer.imageSrc} alt="" className="w-full h-full object-contain pointer-events-none" />
                          ) : layer.kind === 'shape' ? (
                            <div className="w-2.5 h-2.5 rounded-full border border-amber-400 bg-amber-400/30" />
                          ) : (
                            <Layers size={10} className="text-slate-400" />
                          )}
                        </div>

                        {/* Visibility Toggle */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setLayers(prev => prev.map(l => l.id === layer.id ? { ...l, visible: !l.visible } : l));
                          }}
                          className="p-0.5 text-slate-500 hover:text-slate-200 shrink-0"
                          title={layer.visible ? 'إخفاء الطبقة' : 'إظهار الطبقة'}
                        >
                          {layer.visible ? <Eye size={12} /> : <EyeOff size={12} className="text-red-400" />}
                        </button>

                        <span className="truncate font-medium text-[11px] select-none">{layer.name}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateLayer(layer);
                          }}
                          title="مضاعفة الطبقة"
                          className="p-1 hover:text-white opacity-40 hover:opacity-100 transition-opacity"
                        >
                          <Copy size={11} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteLayer(layer.id);
                          }}
                          title="حذف الطبقة"
                          className="p-1 hover:text-red-400 opacity-40 hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Drop target at bottom of list */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dropTargetIdx !== layers.length - 1 || dropPosition !== 'below') {
                      setDropTargetIdx(layers.length - 1);
                      setDropPosition('below');
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedLayerIdx !== null) {
                      reorderLayers(draggedLayerIdx, layers.length - 1);
                    }
                    setDraggedLayerIdx(null);
                    setDropTargetIdx(null);
                    setDropPosition(null);
                  }}
                  className="h-3"
                />
              </>
            )}
          </div>
        </div>

        {/* CENTER VIEWPORT (Composition Monitor) */}
        <div className="flex-1 flex flex-col bg-transparent relative overflow-hidden">
          {/* Monitor Header Toolbar */}
          <div className="h-9 border-b border-slate-800/50 bg-slate-900/30 px-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-slate-300 font-bold bg-slate-800/50 px-2 py-0.5 rounded">
                {compSettings.name}
              </span>
              <span className="text-slate-500 text-[11px]">
                {Math.round(zoomLevel * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTool('select')}
                title="أداة التحديد / السهم (V)"
                className={`p-1.5 rounded transition-all ${activeTool === 'select' ? 'bg-violet-600/30 text-violet-300 border border-violet-500/40' : 'text-slate-500 hover:text-white'}`}
              >
                <MousePointer size={13} />
              </button>

              <button
                onClick={() => setActiveTool(activeTool === 'hand' ? 'select' : 'hand')}
                title="أداة اليد لتحريك العرض (H)"
                className={`p-1.5 rounded transition-all ${activeTool === 'hand' ? 'bg-violet-600/30 text-violet-300 border border-violet-500/40' : 'text-slate-500 hover:text-white'}`}
              >
                <Hand size={13} />
              </button>

              <button
                onClick={() => setShowTransparencyGrid(!showTransparencyGrid)}
                title="تبديل رقعة الشفافية (Transparency Grid)"
                className={`p-1.5 rounded transition-all ${showTransparencyGrid ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' : 'text-slate-500 hover:text-white'}`}
              >
                <Grid size={13} />
              </button>

              <button
                onClick={() => setShowSafeGuides(!showSafeGuides)}
                title="عرض خطوط الحماية الإرشادية (Safe Zones)"
                className={`p-1.5 rounded transition-all ${showSafeGuides ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-500 hover:text-white'}`}
              >
                <Crosshair size={13} />
              </button>

              <button
                onClick={() => setShowAvatarGuide(!showAvatarGuide)}
                title="عرض خط مساحة صورة الحساب (Avatar Guide)"
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-all ${showAvatarGuide ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-500 hover:text-white'}`}
              >
                <Shield size={12} />
                <span>دليل الأفاتار</span>
              </button>

              <div className="w-px h-3.5 bg-slate-800"></div>

              <button
                onClick={fitToView}
                title="ملاءمة لحجم الشاشة تلقائياً (Fit up to view)"
                className="px-2 py-0.5 rounded text-[11px] font-semibold bg-violet-600/20 text-violet-300 border border-violet-500/30 hover:bg-violet-600/30 transition-all flex items-center gap-1"
              >
                <span>ملاءمة</span>
                <span className="text-[10px] text-violet-400 font-mono">Fit</span>
              </button>

              <button
                onClick={() => setZoomLevel(prev => Math.max(0.25, Number((prev - 0.15).toFixed(2))))}
                className="p-1 hover:text-white text-slate-400"
                title="تصغير"
              >
                <ZoomOut size={13} />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="px-1.5 py-0.5 rounded text-[10px] text-slate-400 hover:text-white hover:bg-white/5"
              >
                100%
              </button>
              <button
                onClick={() => setZoomLevel(prev => Math.min(2.5, Number((prev + 0.15).toFixed(2))))}
                className="p-1 hover:text-white text-slate-400"
                title="تكبير"
              >
                <ZoomIn size={13} />
              </button>
            </div>
          </div>

          {/* Canvas Work Area Stage */}
          <div 
            ref={stageContainerRef} 
            className={`flex-1 flex items-center justify-center p-6 overflow-auto bg-transparent ${activeTool === 'hand' ? (isPanning ? 'cursor-grabbing select-none' : 'cursor-grab') : ''}`}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
            onMouseLeave={handleStageMouseUp}
          >
            <div 
              style={{
                transform: `scale(${zoomLevel})`,
                transition: 'transform 0.15s ease-out',
                width: compSettings.width,
                height: compSettings.height
              }}
              className="relative shadow-2xl border border-slate-700/60 rounded-lg overflow-hidden shrink-0 bg-black"
            >
              <canvas
                ref={canvasRef}
                width={compSettings.width}
                height={compSettings.height}
                onMouseDown={handleCanvasMouseDown}
                className={`w-full h-full block bg-black ${
                  activeTool === 'select'
                    ? (isDraggingLayer ? 'cursor-grabbing select-none' : (selectedLayerId ? 'cursor-move' : 'cursor-default'))
                    : ''
                }`}
              />
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Properties / Transform Inspector */}
        <div data-interactive="true" className="properties-inspector w-72 border-l border-slate-800/50 bg-slate-900/20 flex flex-col text-xs">
          <div className="p-2.5 border-b border-slate-800/60 flex items-center justify-between text-slate-400 font-bold">
            <div className="flex items-center gap-1.5">
              <Sliders size={13} className="text-violet-400" />
              <span>خصائص الطبقة (Properties)</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
            {selectedLayer ? (
              <>
                {/* Layer Name & Kind */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-slate-400">اسم الطبقة</label>
                  <input
                    type="text"
                    value={selectedLayer.name}
                    onChange={(e) => updateSelectedLayer({ name: e.target.value })}
                    className="w-full bg-slate-800/40 border border-slate-700/50 px-2.5 py-1.5 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-violet-500"
                  />
                </div>

                {/* Layer Stacking Order */}
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/60">
                  <div className="flex items-center justify-between text-slate-300 font-bold">
                    <span>ترتيب الظهور (Stacking Order)</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      #{layers.findIndex(l => l.id === selectedLayer.id) + 1} من {layers.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => bringLayerToFront(selectedLayer.id)}
                      disabled={layers[0]?.id === selectedLayer.id}
                      title="نقل للأمام تماماً (أعلى كل الطبقات)"
                      className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-slate-800/60 hover:bg-violet-600/30 text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors border border-slate-700/40 hover:border-violet-500/40 text-[11px]"
                    >
                      <ChevronsUp size={12} className="text-violet-400" />
                      <span>في المقدمة</span>
                    </button>
                    <button
                      onClick={() => moveLayerUp(selectedLayer.id)}
                      disabled={layers[0]?.id === selectedLayer.id}
                      title="تقديم خطوة واحدة للأمام"
                      className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-slate-800/60 hover:bg-violet-600/30 text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors border border-slate-700/40 hover:border-violet-500/40 text-[11px]"
                    >
                      <ArrowUp size={12} className="text-cyan-400" />
                      <span>خطوة للأمام</span>
                    </button>
                    <button
                      onClick={() => moveLayerDown(selectedLayer.id)}
                      disabled={layers[layers.length - 1]?.id === selectedLayer.id}
                      title="تأخير خطوة واحدة للخلف"
                      className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-slate-800/60 hover:bg-violet-600/30 text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors border border-slate-700/40 hover:border-violet-500/40 text-[11px]"
                    >
                      <ArrowDown size={12} className="text-amber-400" />
                      <span>خطوة للخلف</span>
                    </button>
                    <button
                      onClick={() => sendLayerToBack(selectedLayer.id)}
                      disabled={layers[layers.length - 1]?.id === selectedLayer.id}
                      title="نقل للخلفية تماماً (أسفل كل الطبقات)"
                      className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-slate-800/60 hover:bg-violet-600/30 text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors border border-slate-700/40 hover:border-violet-500/40 text-[11px]"
                    >
                      <ChevronsDown size={12} className="text-pink-400" />
                      <span>في الخلفية</span>
                    </button>
                  </div>
                </div>

                {/* Transform Section with After Effects Style Stopwatches & Keyframe Diamonds */}
                <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-800/60">
                  <div className="flex items-center justify-between text-slate-300 font-bold">
                    <span>التحويل (Transform)</span>
                    <div className="flex items-center gap-1 bg-slate-950/60 px-1.5 py-0.5 rounded border border-slate-800 text-[10px] text-slate-400 font-mono">
                      <button
                        onClick={goToPrevKeyframe}
                        title="الانتقال للمفتاح السابق (J)"
                        className="px-1 hover:text-cyan-300 transition-colors"
                      >
                        ◀
                      </button>
                      <button
                        onClick={() => addOrToggleKeyframeForLayer(selectedLayer.id)}
                        title="إضافة أو إزالة نقطة كي فريم (Diamond ◇) عند موضع الخط الحالي"
                        className="px-1 hover:text-amber-400 transition-colors"
                      >
                        {hasKeyframeAtCurrentFrame('rotation') || hasKeyframeAtCurrentFrame('position') || hasKeyframeAtCurrentFrame('scale') || hasKeyframeAtCurrentFrame('opacity') ? '◆' : '◇'}
                      </button>
                      <button
                        onClick={goToNextKeyframe}
                        title="الانتقال للمفتاح التالي (K)"
                        className="px-1 hover:text-cyan-300 transition-colors"
                      >
                        ▶
                      </button>
                    </div>
                  </div>

                  {/* Position */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-slate-400">
                      <button
                        onClick={() => toggleStopwatch('position')}
                        title="تفعيل/تعطيل التحريك بالساعة (Position Stopwatch)"
                        className={`p-1 rounded transition-colors ${selectedLayer.animatingPosition ? 'text-amber-400 bg-amber-500/20' : 'text-slate-600 hover:text-slate-400'}`}
                      >
                        <Clock size={12} />
                      </button>
                      {selectedLayer.animatingPosition && (
                        <button
                          onClick={() => toggleKeyframeAtCurrentFrame('position')}
                          title={hasKeyframeAtCurrentFrame('position') ? "إزالة نقطة الكي فريم في هذا الفريم" : "إضافة نقطة كي فريم في موضع الخط الحالي"}
                          className="p-0.5 rounded hover:bg-slate-800/60 transition-colors"
                        >
                          <div className={`w-2 h-2 rotate-45 border transition-colors ${
                            hasKeyframeAtCurrentFrame('position') ? 'bg-emerald-400 border-emerald-300' : 'border-slate-500 hover:border-emerald-400'
                          }`} />
                        </button>
                      )}
                      <span>الموضع (X, Y)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={Math.round(evaluateLayerAtFrame(selectedLayer, currentFrame).pos.x)}
                        onChange={(e) => {
                          const curY = evaluateLayerAtFrame(selectedLayer, currentFrame).pos.y;
                          updateLayerPropertyValue('position', { x: Number(e.target.value), y: curY });
                        }}
                        className="w-14 bg-slate-800/40 border border-slate-700/50 px-1.5 py-1 rounded text-right text-[11px] font-mono focus:border-cyan-500 focus:outline-none"
                      />
                      <input
                        type="number"
                        value={Math.round(evaluateLayerAtFrame(selectedLayer, currentFrame).pos.y)}
                        onChange={(e) => {
                          const curX = evaluateLayerAtFrame(selectedLayer, currentFrame).pos.x;
                          updateLayerPropertyValue('position', { x: curX, y: Number(e.target.value) });
                        }}
                        className="w-14 bg-slate-800/40 border border-slate-700/50 px-1.5 py-1 rounded text-right text-[11px] font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Scale */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-slate-400">
                      <button
                        onClick={() => toggleStopwatch('scale')}
                        title="تفعيل التحريك بالحجم (Scale Stopwatch)"
                        className={`p-1 rounded transition-colors ${selectedLayer.animatingScale ? 'text-amber-400 bg-amber-500/20' : 'text-slate-600 hover:text-slate-400'}`}
                      >
                        <Clock size={12} />
                      </button>
                      {selectedLayer.animatingScale && (
                        <button
                          onClick={() => toggleKeyframeAtCurrentFrame('scale')}
                          title={hasKeyframeAtCurrentFrame('scale') ? "إزالة نقطة الكي فريم في هذا الفريم" : "إضافة نقطة كي فريم في موضع الخط الحالي"}
                          className="p-0.5 rounded hover:bg-slate-800/60 transition-colors"
                        >
                          <div className={`w-2 h-2 rotate-45 border transition-colors ${
                            hasKeyframeAtCurrentFrame('scale') ? 'bg-cyan-400 border-cyan-300' : 'border-slate-500 hover:border-cyan-400'
                          }`} />
                        </button>
                      )}
                      <span>الحجم (Scale %)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={Math.round(evaluateLayerAtFrame(selectedLayer, currentFrame).scale)}
                        onChange={(e) => updateLayerPropertyValue('scale', Number(e.target.value))}
                        className="w-16 bg-slate-800/40 border border-slate-700/50 px-1.5 py-1 rounded text-right text-[11px] font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Rotation */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-slate-400">
                      <button
                        onClick={() => toggleStopwatch('rotation')}
                        title="تفعيل الدوران بالساعة (Rotation Stopwatch)"
                        className={`p-1 rounded transition-colors ${selectedLayer.animatingRotation ? 'text-amber-400 bg-amber-500/20' : 'text-slate-600 hover:text-slate-400'}`}
                      >
                        <Clock size={12} />
                      </button>
                      {selectedLayer.animatingRotation && (
                        <button
                          onClick={() => toggleKeyframeAtCurrentFrame('rotation')}
                          title={hasKeyframeAtCurrentFrame('rotation') ? "إزالة نقطة الكي فريم في هذا الفريم" : "إضافة نقطة كي فريم في موضع الخط الحالي"}
                          className="p-0.5 rounded hover:bg-slate-800/60 transition-colors"
                        >
                          <div className={`w-2 h-2 rotate-45 border transition-colors ${
                            hasKeyframeAtCurrentFrame('rotation') ? 'bg-amber-400 border-amber-300' : 'border-slate-500 hover:border-amber-400'
                          }`} />
                        </button>
                      )}
                      <span>الدوران (Rotation)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={Math.round(evaluateLayerAtFrame(selectedLayer, currentFrame).rotation)}
                        onChange={(e) => updateLayerPropertyValue('rotation', Number(e.target.value))}
                        className="w-16 bg-slate-800/40 border border-slate-700/50 px-1.5 py-1 rounded text-right text-[11px] font-mono focus:border-cyan-500 focus:outline-none"
                      />
                      <span className="text-slate-500 text-[10px]">°</span>
                    </div>
                  </div>

                  {/* Opacity */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-slate-400">
                      <button
                        onClick={() => toggleStopwatch('opacity')}
                        title="تفعيل الشفافية بالساعة"
                        className={`p-1 rounded transition-colors ${selectedLayer.animatingOpacity ? 'text-amber-400 bg-amber-500/20' : 'text-slate-600 hover:text-slate-400'}`}
                      >
                        <Clock size={12} />
                      </button>
                      {selectedLayer.animatingOpacity && (
                        <button
                          onClick={() => toggleKeyframeAtCurrentFrame('opacity')}
                          title={hasKeyframeAtCurrentFrame('opacity') ? "إزالة نقطة الكي فريم في هذا الفريم" : "إضافة نقطة كي فريم في موضع الخط الحالي"}
                          className="p-0.5 rounded hover:bg-slate-800/60 transition-colors"
                        >
                          <div className={`w-2 h-2 rotate-45 border transition-colors ${
                            hasKeyframeAtCurrentFrame('opacity') ? 'bg-purple-400 border-purple-300' : 'border-slate-500 hover:border-purple-400'
                          }`} />
                        </button>
                      )}
                      <span>الشفافية (Opacity)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={Math.round(evaluateLayerAtFrame(selectedLayer, currentFrame).opacity)}
                        onChange={(e) => updateLayerPropertyValue('opacity', Number(e.target.value))}
                        className="w-16 bg-slate-800/40 border border-slate-700/50 px-1.5 py-1 rounded text-right text-[11px] font-mono focus:border-cyan-500 focus:outline-none"
                      />
                      <span className="text-slate-500 text-[10px]">%</span>
                    </div>
                  </div>
                </div>

                {/* Specific Shape / Text Styling */}
                {selectedLayer.kind === 'shape' && (
                  <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-800/60">
                    <span className="text-slate-300 font-bold">محددات الإطار والشكل</span>
                    
                    {selectedLayer.shapeKind === 'ring' && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">نصف القطر الخارجي</span>
                          <input
                            type="number"
                            value={selectedLayer.outerRadius || 180}
                            onChange={(e) => updateSelectedLayer({ outerRadius: Number(e.target.value) })}
                            className="w-16 bg-slate-800/40 border border-slate-700/50 px-1.5 py-1 rounded text-right text-[11px] font-mono"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">نصف القطر الداخلي</span>
                          <input
                            type="number"
                            value={selectedLayer.innerRadius || 150}
                            onChange={(e) => updateSelectedLayer({ innerRadius: Number(e.target.value) })}
                            className="w-16 bg-slate-800/40 border border-slate-700/50 px-1.5 py-1 rounded text-right text-[11px] font-mono"
                          />
                        </div>
                      </>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">سماكة الخط (Stroke)</span>
                      <input
                        type="number"
                        value={selectedLayer.strokeWidth || 8}
                        onChange={(e) => updateSelectedLayer({ strokeWidth: Number(e.target.value) })}
                        className="w-16 bg-slate-800/40 border border-slate-700/50 px-1.5 py-1 rounded text-right text-[11px] font-mono"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">لون الإطار</span>
                      <input
                        type="color"
                        value={selectedLayer.strokeColor || '#f59e0b'}
                        onChange={(e) => updateSelectedLayer({ strokeColor: e.target.value })}
                        className="w-8 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">توهج النيون (Glow)</span>
                      <input
                        type="number"
                        min="0"
                        max="80"
                        value={selectedLayer.glowRadius || 0}
                        onChange={(e) => updateSelectedLayer({ glowRadius: Number(e.target.value) })}
                        className="w-16 bg-slate-800/40 border border-slate-700/50 px-1.5 py-1 rounded text-right text-[11px] font-mono"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">لون التوهج</span>
                      <input
                        type="color"
                        value={selectedLayer.glowColor || '#fbbf24'}
                        onChange={(e) => updateSelectedLayer({ glowColor: e.target.value })}
                        className="w-8 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {selectedLayer.kind === 'text' && (
                  <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-800/60">
                    <span className="text-slate-300 font-bold">خصائص النص</span>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400">المحتوى</label>
                      <input
                        type="text"
                        value={selectedLayer.text || ''}
                        onChange={(e) => updateSelectedLayer({ text: e.target.value })}
                        className="w-full bg-slate-800/40 border border-slate-700/50 px-2 py-1 rounded text-slate-200 text-xs"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">حجم الخط</span>
                      <input
                        type="number"
                        value={selectedLayer.fontSize || 32}
                        onChange={(e) => updateSelectedLayer({ fontSize: Number(e.target.value) })}
                        className="w-16 bg-slate-800/40 border border-slate-700/50 px-1.5 py-1 rounded text-right text-[11px] font-mono"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">لون النص</span>
                      <input
                        type="color"
                        value={selectedLayer.fontColor || '#ffffff'}
                        onChange={(e) => updateSelectedLayer({ fontColor: e.target.value })}
                        className="w-8 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 gap-2">
                <Sliders size={20} className="opacity-40" />
                <span>حدد طبقة من القائمة لتعديل خصائصها.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ----------------- BOTTOM AE TIMELINE & KEYFRAME SEQUENCER ----------------- */}
      <div className="h-56 border-t border-slate-800/50 bg-slate-900/30 flex flex-col text-xs">
        {/* Timeline Header & Transport Controls */}
        <div className="h-9 border-b border-slate-800/60 bg-slate-800/25 px-4 flex items-center justify-between">
          {/* Timecode & Frame counter */}
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <div className="flex items-center gap-1 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/50 text-cyan-300 font-bold">
              <span>{String(Math.floor(currentFrame / compSettings.fps)).padStart(2, '0')}:</span>
              <span>{String(currentFrame % compSettings.fps).padStart(2, '0')}</span>
            </div>
            <span className="text-slate-400">
              فريم: <strong className="text-emerald-400">{currentFrame}</strong> / {compSettings.totalFrames}
            </span>
          </div>

          {/* Transport Buttons & Keyframe Controls (Play, Pause, Step, J/K, Add Keyframe) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-800/60 p-0.5 rounded-lg border border-slate-700/60">
              <button
                onClick={() => setCurrentFrame(0)}
                title="إلى البداية (Home)"
                className="p-1 hover:text-white text-slate-400 hover:bg-slate-700/50 rounded"
              >
                <RotateCcw size={13} />
              </button>
              <button
                onClick={goToPrevKeyframe}
                title="الانتقال للمفتاح السابق (J)"
                className="px-1.5 py-0.5 hover:text-cyan-300 text-slate-400 hover:bg-slate-700/50 rounded font-mono text-[10px]"
              >
                ◀◀
              </button>
              <button
                onClick={() => setCurrentFrame(prev => Math.max(0, prev - 1))}
                title="فريم سابق"
                className="px-1.5 py-0.5 hover:text-white text-slate-400 hover:bg-slate-700/50 rounded font-mono text-[10px]"
              >
                ◀-1
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                title="تشغيل / إيقاف (Space)"
                className="px-3 py-1 rounded-md bg-violet-600/40 hover:bg-violet-600/50 text-violet-200 border border-violet-500/40 flex items-center gap-1 font-bold text-[11px] transition-all"
              >
                {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                <span>{isPlaying ? 'إيقاف' : 'تشغيل'}</span>
              </button>
              <button
                onClick={() => setCurrentFrame(prev => Math.min(compSettings.totalFrames, prev + 1))}
                title="فريم تالٍ"
                className="px-1.5 py-0.5 hover:text-white text-slate-400 hover:bg-slate-700/50 rounded font-mono text-[10px]"
              >
                +1▶
              </button>
              <button
                onClick={goToNextKeyframe}
                title="الانتقال للمفتاح التالي (K)"
                className="px-1.5 py-0.5 hover:text-cyan-300 text-slate-400 hover:bg-slate-700/50 rounded font-mono text-[10px]"
              >
                ▶▶
              </button>
            </div>

            {/* Prominent After Effects Keyframe Diamond Button at current playhead */}
            <button
              onClick={() => {
                if (selectedLayerId) {
                  addOrToggleKeyframeForLayer(selectedLayerId);
                }
              }}
              disabled={!selectedLayerId}
              title={
                !selectedLayerId 
                  ? "حدد طبقة لإضافة نقطة كي فريم" 
                  : (selectedLayer && (
                      hasKeyframeAtCurrentFrame('rotation', selectedLayer) ||
                      hasKeyframeAtCurrentFrame('position', selectedLayer) ||
                      hasKeyframeAtCurrentFrame('scale', selectedLayer) ||
                      hasKeyframeAtCurrentFrame('opacity', selectedLayer)
                    ))
                    ? "إزالة نقطة الكي فريم في هذا الفريم"
                    : "إضافة نقطة كي فريم (Diamond ◇) عند موضع الخط الحالي بالضبط"
              }
              className={`px-3 py-1 rounded-lg border flex items-center gap-1.5 font-bold text-[11px] transition-all ${
                selectedLayer && (
                  hasKeyframeAtCurrentFrame('rotation', selectedLayer) ||
                  hasKeyframeAtCurrentFrame('position', selectedLayer) ||
                  hasKeyframeAtCurrentFrame('scale', selectedLayer) ||
                  hasKeyframeAtCurrentFrame('opacity', selectedLayer)
                )
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-sm'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700 hover:text-white'
              } disabled:opacity-30 disabled:pointer-events-none active:scale-95`}
            >
              <div className={`w-2.5 h-2.5 rotate-45 border transition-all ${
                selectedLayer && (
                  hasKeyframeAtCurrentFrame('rotation', selectedLayer) ||
                  hasKeyframeAtCurrentFrame('position', selectedLayer) ||
                  hasKeyframeAtCurrentFrame('scale', selectedLayer) ||
                  hasKeyframeAtCurrentFrame('opacity', selectedLayer)
                )
                  ? 'bg-amber-400 border-amber-200 scale-110 shadow-sm'
                  : 'border-cyan-400 bg-transparent'
              }`} />
              <span>
                {selectedLayer && (
                  hasKeyframeAtCurrentFrame('rotation', selectedLayer) ||
                  hasKeyframeAtCurrentFrame('position', selectedLayer) ||
                  hasKeyframeAtCurrentFrame('scale', selectedLayer) ||
                  hasKeyframeAtCurrentFrame('opacity', selectedLayer)
                )
                  ? 'حذف نقطة كي فريم'
                  : 'إضافة نقطة كي فريم (◇)'}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <span>{compSettings.fps} FPS</span>
          </div>
        </div>

        {/* Timeline Tracks & Keyframe Ruler */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Layer Names & Keyframe Toggles */}
          <div className="w-64 border-r border-slate-800/60 bg-slate-900/20 overflow-y-auto flex flex-col">
            {/* Column Header */}
            <div className="h-6 px-3 border-b border-slate-800/60 bg-slate-800/40 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider shrink-0">
              <span className="flex items-center gap-1">
                <Layers size={11} className="text-violet-400" />
                <span>اسم الطبقة (Layer Name)</span>
              </span>
              <span>التحريك</span>
            </div>
            {layers.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-[11px]">
                لا توجد طبقات في التايم لاين
              </div>
            ) : (
              layers.map((layer, idx) => {
                const isDragging = draggedLayerIdx === idx;
                const isDropTarget = dropTargetIdx === idx;

                return (
                  <div 
                    key={layer.id}
                    draggable={!layer.locked}
                    onDragStart={(e) => {
                      setDraggedLayerIdx(idx);
                      e.dataTransfer.setData('text/plain', String(idx));
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = 'move';
                      const rect = e.currentTarget.getBoundingClientRect();
                      const midY = rect.top + rect.height / 2;
                      const pos = e.clientY < midY ? 'above' : 'below';
                      if (dropTargetIdx !== idx || dropPosition !== pos) {
                        setDropTargetIdx(idx);
                        setDropPosition(pos);
                      }
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        if (dropTargetIdx === idx) {
                          setDropTargetIdx(null);
                          setDropPosition(null);
                        }
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (draggedLayerIdx !== null) {
                        let targetIndex = idx;
                        if (dropPosition === 'below') {
                          targetIndex = idx + 1;
                        }
                        if (draggedLayerIdx < targetIndex) {
                          targetIndex -= 1;
                        }
                        reorderLayers(draggedLayerIdx, targetIndex);
                      }
                      setDraggedLayerIdx(null);
                      setDropTargetIdx(null);
                      setDropPosition(null);
                    }}
                    onDragEnd={() => {
                      setDraggedLayerIdx(null);
                      setDropTargetIdx(null);
                      setDropPosition(null);
                    }}
                    onClick={() => setSelectedLayerId(layer.id)}
                    data-interactive="true"
                    className={`layer-row-item relative h-8 px-2 border-b border-slate-800/40 flex items-center justify-between cursor-pointer text-[11px] transition-colors shrink-0 ${
                      isDragging
                        ? 'opacity-30 border-dashed border-cyan-400 bg-slate-800/40'
                        : selectedLayerId === layer.id
                          ? 'bg-violet-900/30 text-violet-200 font-bold border-l-2 border-l-violet-500'
                          : 'text-slate-400 hover:bg-slate-800/30'
                    }`}
                  >
                    {/* Visual Drop Indicators */}
                    {isDropTarget && dropPosition === 'above' && (
                      <div className="absolute -top-0.5 left-0 right-0 h-0.5 bg-cyan-400 z-30 pointer-events-none"></div>
                    )}
                    {isDropTarget && dropPosition === 'below' && (
                      <div className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-cyan-400 z-30 pointer-events-none"></div>
                    )}

                    <div className="flex items-center gap-1.5 truncate">
                      <div 
                        className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-300 p-0.5 shrink-0"
                        title="اسحب لتغيير ترتيب الطبقة"
                      >
                        <GripVertical size={11} />
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono w-3 text-center shrink-0">{idx + 1}</span>
                      <div className="w-4 h-4 rounded bg-slate-950 border border-slate-700/60 overflow-hidden flex items-center justify-center shrink-0">
                        {layer.kind === 'image' && layer.imageSrc ? (
                          <img src={layer.imageSrc} alt="" className="w-full h-full object-contain pointer-events-none" />
                        ) : layer.kind === 'shape' ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                        ) : (
                          <Layers size={9} className="text-slate-400" />
                        )}
                      </div>
                      <span className="truncate">{layer.name}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Add/Toggle Keyframe Diamond Button on this layer */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLayerId(layer.id);
                          addOrToggleKeyframeForLayer(layer.id);
                        }}
                        title={`إضافة/إزالة مفتاح كي فريم (◇) للطبقة عند فريم ${currentFrame}`}
                        className={`p-1 rounded transition-all hover:bg-slate-700/60 ${
                          hasKeyframeAtCurrentFrame('rotation', layer) ||
                          hasKeyframeAtCurrentFrame('position', layer) ||
                          hasKeyframeAtCurrentFrame('scale', layer) ||
                          hasKeyframeAtCurrentFrame('opacity', layer)
                            ? 'text-amber-400'
                            : 'text-slate-500 hover:text-cyan-400'
                        }`}
                      >
                        <div className={`w-2.5 h-2.5 rotate-45 border transition-all ${
                          hasKeyframeAtCurrentFrame('rotation', layer) ||
                          hasKeyframeAtCurrentFrame('position', layer) ||
                          hasKeyframeAtCurrentFrame('scale', layer) ||
                          hasKeyframeAtCurrentFrame('opacity', layer)
                            ? 'bg-amber-400 border-amber-200 scale-110 shadow-sm'
                            : 'border-current bg-transparent'
                        }`} />
                      </button>

                      {layer.animatingScale && (
                        <span className="text-[9px] px-1 bg-cyan-500/20 text-cyan-300 rounded font-mono border border-cyan-500/30">Scl</span>
                      )}
                      {layer.animatingPosition && (
                        <span className="text-[9px] px-1 bg-emerald-500/20 text-emerald-300 rounded font-mono border border-emerald-500/30">Pos</span>
                      )}
                      {layer.animatingOpacity && (
                        <span className="text-[9px] px-1 bg-purple-500/20 text-purple-300 rounded font-mono border border-purple-500/30">Op</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Time Ruler & Keyframe Track Canvas */}
          <div className="flex-1 flex flex-col overflow-x-auto relative bg-slate-900/20">
            {/* Frame Tick Ruler */}
            <div 
              ref={rulerRef}
              data-interactive="true"
              className="timeline-scrubber h-6 border-b border-slate-800/60 bg-slate-800/30 relative cursor-ew-resize select-none"
              onMouseDown={(e) => {
                setIsScrubbing(true);
                updateScrubFrame(e.clientX);
              }}
            >
              {/* Ticks every 5/10 frames */}
              {Array.from({ length: Math.ceil(compSettings.totalFrames / 5) + 1 }).map((_, i) => {
                const f = i * 5;
                if (f > compSettings.totalFrames) return null;
                const leftPct = (f / compSettings.totalFrames) * 100;
                const isMajor = f % 15 === 0;
                return (
                  <div
                    key={f}
                    style={{ left: `${leftPct}%` }}
                    className="absolute top-0 bottom-0 flex flex-col justify-between pointer-events-none"
                  >
                    <span className="text-[9px] text-slate-500 font-mono -translate-x-1/2">
                      {isMajor ? `${f}f` : ''}
                    </span>
                    <div className={`w-px ${isMajor ? 'h-2.5 bg-slate-500' : 'h-1.5 bg-slate-700'}`}></div>
                  </div>
                );
              })}

              {/* Blue Playhead / CTI Marker */}
              <div
                style={{ left: `${(currentFrame / compSettings.totalFrames) * 100}%` }}
                className="absolute top-0 bottom-0 w-2.5 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center"
              >
                <div className="w-2.5 h-2.5 bg-cyan-400 rotate-45 -mt-1"></div>
              </div>
            </div>

            {/* Layer Tracks & Diamond Keyframes */}
            <div className="flex-1 overflow-y-auto relative">
              {/* Playhead vertical guide line extending through tracks */}
              <div
                style={{ left: `${(currentFrame / compSettings.totalFrames) * 100}%` }}
                className="absolute top-0 bottom-0 w-px bg-cyan-400/70 z-10 pointer-events-none"
              ></div>

              {layers.map(layer => {
                const isSelected = selectedLayerId === layer.id;
                const hasKfHere = (
                  hasKeyframeAtCurrentFrame('rotation', layer) ||
                  hasKeyframeAtCurrentFrame('position', layer) ||
                  hasKeyframeAtCurrentFrame('scale', layer) ||
                  hasKeyframeAtCurrentFrame('opacity', layer)
                );

                return (
                  <div 
                    key={layer.id}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickX = e.clientX - rect.left;
                      const pct = Math.max(0, Math.min(1, clickX / rect.width));
                      const targetF = Math.round(pct * (compSettings.totalFrames - 1));
                      setCurrentFrame(targetF);
                      setSelectedLayerId(layer.id);
                    }}
                    className={`h-8 border-b border-slate-800/40 relative flex items-center transition-colors cursor-pointer ${
                      isSelected ? 'bg-violet-950/20' : 'hover:bg-slate-800/20'
                    }`}
                  >
                    {/* Interactive After Effects Keyframe Diamond at playhead position */}
                    {isSelected && (
                      <div
                        style={{ left: `${(currentFrame / compSettings.totalFrames) * 100}%` }}
                        className="absolute -translate-x-1/2 z-20 flex items-center justify-center pointer-events-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLayerId(layer.id);
                          addOrToggleKeyframeForLayer(layer.id);
                        }}
                        title={
                          hasKfHere
                            ? `حذف نقطة كي فريم عند فريم ${currentFrame}`
                            : `إضافة نقطة كي فريم (◇) عند فريم ${currentFrame} موضع هذا الخط بالضبط`
                        }
                      >
                        <div className={`w-3.5 h-3.5 rotate-45 flex items-center justify-center transition-all shadow-md ${
                          hasKfHere
                            ? 'bg-amber-400 border border-amber-100 ring-2 ring-amber-500/50 scale-110'
                            : 'bg-slate-900/90 border-2 border-cyan-400 hover:bg-cyan-500 hover:border-cyan-300 hover:scale-125'
                        }`}>
                          {!hasKfHere && (
                            <span className="text-[9px] font-black text-cyan-300 -rotate-45 leading-none select-none">+</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Keyframes for Position */}
                    {layer.animatingPosition && layer.positionKeyframes.map((kf, i) => (
                      <div
                        key={`pos-${i}`}
                        style={{ left: `${(kf.frame / compSettings.totalFrames) * 100}%` }}
                        title={`مفتاح موضع في فريم ${kf.frame} (${Math.round(kf.value.x)}, ${Math.round(kf.value.y)})`}
                        className="absolute w-2.5 h-2.5 bg-emerald-400 rotate-45 -translate-x-1/2 z-10 border border-slate-900 shadow-md cursor-pointer hover:scale-125 transition-transform"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentFrame(kf.frame);
                          setSelectedLayerId(layer.id);
                        }}
                      />
                    ))}

                    {/* Keyframes for Scale */}
                    {layer.animatingScale && layer.scaleKeyframes.map((kf, i) => (
                      <div
                        key={`scale-${i}`}
                        style={{ left: `${(kf.frame / compSettings.totalFrames) * 100}%` }}
                        title={`مفتاح حجم في فريم ${kf.frame} (${kf.value}%)`}
                        className="absolute w-2.5 h-2.5 bg-cyan-400 rotate-45 -translate-x-1/2 z-10 border border-slate-900 shadow-md cursor-pointer hover:scale-125 transition-transform"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentFrame(kf.frame);
                          setSelectedLayerId(layer.id);
                        }}
                      />
                    ))}

                    {/* Keyframes for Rotation */}
                    {layer.animatingRotation && layer.rotationKeyframes.map((kf, i) => (
                      <div
                        key={`rot-${i}`}
                        style={{ left: `${(kf.frame / compSettings.totalFrames) * 100}%` }}
                        title={`مفتاح دوران في فريم ${kf.frame} (${kf.value}°)`}
                        className="absolute w-2.5 h-2.5 bg-amber-400 rotate-45 -translate-x-1/2 z-10 border border-slate-900 shadow-md cursor-pointer hover:scale-125 transition-transform"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentFrame(kf.frame);
                          setSelectedLayerId(layer.id);
                        }}
                      />
                    ))}

                    {/* Keyframes for Opacity */}
                    {layer.animatingOpacity && layer.opacityKeyframes.map((kf, i) => (
                      <div
                        key={`op-${i}`}
                        style={{ left: `${(kf.frame / compSettings.totalFrames) * 100}%` }}
                        title={`مفتاح شفافية في فريم ${kf.frame} (${kf.value}%)`}
                        className="absolute w-2.5 h-2.5 bg-purple-400 rotate-45 -translate-x-1/2 z-10 border border-slate-900 shadow-md cursor-pointer hover:scale-125 transition-transform"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentFrame(kf.frame);
                          setSelectedLayerId(layer.id);
                        }}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ----------------- MODAL: COMPOSITION SETTINGS (Ctrl+K) ----------------- */}
      {showCompSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/30">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xl"
          >
            {renderCompSettingsContent(false)}
          </motion.div>
        </div>
      )}

      {/* ----------------- MODAL: EXPORT ENGINE ----------------- */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50">
          <div className="w-full max-w-md bg-slate-900/60 border border-slate-800/60 rounded-3xl shadow-2xl p-6 text-slate-200 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm text-violet-300">
                <Download size={16} />
                <span>تصدير الإطار (Export Queue)</span>
              </div>
              <button 
                onClick={() => setExportModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X size={16} />
              </button>
            </div>

            {exporting ? (
              <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
                <Loader2 size={32} className="animate-spin text-violet-400" />
                <span className="text-xs font-bold text-slate-200">{exportStatusText}</span>
                <div className="w-full bg-slate-800/60 rounded-full h-2 overflow-hidden border border-slate-700/50">
                  <div
                    style={{ width: `${exportProgress}%` }}
                    className="bg-violet-500 h-full transition-all duration-300"
                  ></div>
                </div>
                <span className="text-[11px] font-mono text-cyan-400">{exportProgress}%</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* SVGA Export Mode Selector */}
                <div className="p-2.5 rounded-2xl bg-slate-800/30 border border-slate-700/50 flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-slate-300">طريقة تصدير SVGA:</span>
                  <div className="grid grid-cols-2 gap-1.5 p-0.5 rounded-xl bg-slate-800/50 border border-slate-700/50">
                    <button
                      type="button"
                      onClick={() => setSvgaExportMode('pieces')}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 ${
                        svgaExportMode === 'pieces'
                          ? 'bg-violet-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>قطع عادي (Sprites)</span>
                      <span className="text-[8px] font-normal opacity-80">أصول منفصلة + Transforms</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSvgaExportMode('render')}
                      className={`py-1.5 px-2 rounded-md text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 ${
                        svgaExportMode === 'render'
                          ? 'bg-violet-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>رندر إطارات (Render)</span>
                      <span className="text-[8px] font-normal opacity-80">تسلسل صور متتالية</span>
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-tight">
                    {svgaExportMode === 'pieces'
                      ? '✨ وضع القطع العادي: يتم تصدير كل طبقة كعنصر مستقل شفاف وتطبيق مصفوفات التحريك والـ Keyframes عليه مباشرة (بدون رندر إطارات كاملة - حجم خفيف جداً وأداء عالي).'
                      : '🎞️ وضع الرندر الكامل: يتم رندرة كل فريم كصورة كاملة مسبقة الحساب (يولد حجماً أكبر).'}
                  </p>
                </div>

                {/* SVGA Option */}
                <button
                  onClick={exportAsSVGA}
                  className="p-3 rounded-xl bg-slate-800/40 hover:bg-violet-600/20 border border-violet-500/40 hover:border-violet-500/70 flex items-center justify-between text-left transition-all group"
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-white">ملف SVGA 2.0</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-violet-600/40 text-violet-300 border border-violet-500/50">
                        {svgaExportMode === 'pieces' ? 'قطع عادي (Sprites)' : 'رندر فريمات'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      {svgaExportMode === 'pieces'
                        ? 'تصدير كقطع مستقلة مع مصفوفات الحركة ومحاور التحريك (موصى به)'
                        : 'تصدير كرندر تسلسلي لجميع الفريمات'}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-violet-600/30 text-violet-300 text-[10px] font-mono font-bold border border-violet-500/40 group-hover:bg-violet-600 group-hover:text-white transition-all">
                    .SVGA
                  </span>
                </button>

                {/* APNG Option */}
                <button
                  onClick={exportAsAPNG}
                  className="p-3 rounded-xl bg-slate-800/40 hover:bg-emerald-600/20 border border-slate-700/60 hover:border-emerald-500/50 flex items-center justify-between text-left transition-all"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-xs text-white">صورة APNG متحركة وشفافة</span>
                    <span className="text-[10px] text-slate-400">أعلى دقة 24-bit مع شفافية ألفا نقية</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-600/30 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/40">
                    .PNG
                  </span>
                </button>

                {/* GIF Option */}
                <button
                  onClick={exportAsGIF}
                  className="p-3 rounded-xl bg-slate-800/40 hover:bg-amber-600/20 border border-slate-700/60 hover:border-amber-500/50 flex items-center justify-between text-left transition-all"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-xs text-white">صورة GIF متحركة شفافة</span>
                    <span className="text-[10px] text-slate-400">متوافقة مع كافة المواقع وتطبيقات الويب</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-amber-600/30 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/40">
                    .GIF
                  </span>
                </button>

                {/* After Effects Script Option */}
                <button
                  onClick={exportAsAEJSX}
                  className="p-3 rounded-xl bg-slate-800/40 hover:bg-blue-600/20 border border-slate-700/60 hover:border-blue-500/50 flex items-center justify-between text-left transition-all"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-xs text-white">سكربت Adobe After Effects (.jsx)</span>
                    <span className="text-[10px] text-slate-400">لفتح الكومبوزيشن والطبقات مباشرة داخل برنامج AE الحقيقي</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-blue-600/30 text-blue-300 text-[10px] font-mono font-bold border border-blue-500/40">
                    .JSX
                  </span>
                </button>

                {lastExportedSVGA && onOpenInViewer && (
                  <button
                    onClick={() => {
                      onOpenInViewer(lastExportedSVGA);
                      setExportModalOpen(false);
                    }}
                    className="mt-2 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <Eye size={14} />
                    <span>معاينة ملف الـ SVGA المصدّر في العارض مباشرة</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </motion.div>
  );
};
