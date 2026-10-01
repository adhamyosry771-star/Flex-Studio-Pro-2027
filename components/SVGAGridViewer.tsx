import React, { useRef, useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  LayoutGrid, 
  UploadCloud,
  Download,
  Loader2
} from 'lucide-react';
import JSZip from 'jszip';
import { SVGAFileExtended } from '../types';
import { SVGAGridCard } from './SVGAGridCard';

interface SVGAGridViewerProps {
  files: SVGAFileExtended[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (file: SVGAFileExtended) => void;
  onRenameFile?: (file: SVGAFileExtended, newName: string) => void;
  onClearAll: () => void;
}

export const SVGAGridViewer: React.FC<SVGAGridViewerProps> = ({
  files,
  onAddFiles,
  onRemoveFile,
  onRenameFile,
  onClearAll,
}) => {
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [selectedFileNames, setSelectedFileNames] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep selected names in sync with available files
  useEffect(() => {
    setSelectedFileNames(prev => {
      const existingNames = new Set(files.map(f => f.name));
      const next = new Set<string>();
      for (const name of prev) {
        if (existingNames.has(name)) next.add(name);
      }
      return next;
    });
  }, [files]);

  const handleToggleSelect = (file: SVGAFileExtended) => {
    setSelectedFileNames(prev => {
      const next = new Set(prev);
      if (next.has(file.name)) {
        next.delete(file.name);
      } else {
        next.add(file.name);
      }
      return next;
    });
  };

  const handleRename = (file: SVGAFileExtended, newName: string) => {
    // If the file was selected, update its selected name key
    if (selectedFileNames.has(file.name)) {
      setSelectedFileNames(prev => {
        const next = new Set(prev);
        next.delete(file.name);
        next.add(newName);
        return next;
      });
    }
    onRenameFile?.(file, newName);
  };

  const handleDownloadSelected = async () => {
    const selectedList = files.filter(f => selectedFileNames.has(f.name));
    if (selectedList.length === 0 || isDownloading) return;

    try {
      setIsDownloading(true);
      const zip = new JSZip();

      for (const file of selectedList) {
        const baseName = file.name.replace(/\.svga$/i, '').trim() || 'animation';
        // Create dedicated folder for this frame
        const folder = zip.folder(baseName);
        if (!folder) continue;

        // 1. Add .svga file to the folder
        let arrayBuffer: ArrayBuffer;
        if (file.rawFile) {
          arrayBuffer = await file.rawFile.arrayBuffer();
        } else {
          const res = await fetch(file.url);
          if (!res.ok) throw new Error(`تعذر تحميل الملف: ${file.name}`);
          arrayBuffer = await res.arrayBuffer();
        }
        folder.file(`${baseName}.svga`, arrayBuffer);

        // 2. Capture .png image of the frame from the live player canvas
        const cardContainer = document.querySelector(`[data-card-file="${file.name}"]`);
        const canvas = cardContainer?.querySelector('canvas') as HTMLCanvasElement | null;
        if (canvas) {
          try {
            const dataUrl = canvas.toDataURL('image/png');
            const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
            folder.file(`${baseName}.png`, base64Data, { base64: true });
          } catch (canvasErr) {
            console.warn("Could not capture canvas data URL:", canvasErr);
          }
        }
      }

      // Generate the ZIP file
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      // Trigger browser download
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `svga_frames_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (err: any) {
      console.error("Error creating zip package:", err);
      alert("حدث خطأ أثناء تحميل الملفات المضغوطة: " + (err.message || ''));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = (Array.from(e.target.files || []) as File[]).filter(f => 
      f.name.toLowerCase().endsWith('.svga')
    );
    if (selected.length > 0) {
      onAddFiles(selected);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const dropped = (Array.from(e.dataTransfer.files) as File[]).filter(f => 
      f.name.toLowerCase().endsWith('.svga')
    );
    if (dropped.length > 0) {
      onAddFiles(dropped);
    }
  };

  return (
    <div 
      className="flex flex-col gap-6 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      dir="rtl"
    >
      {/* Hidden file input for adding files via the 'إضافة إطار' card */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".svga"
        multiple
        onChange={handleFileInput}
      />

      {/* Drag Overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-[120] bg-blue-950/70 backdrop-blur-md flex flex-col items-center justify-center p-8 pointer-events-none border-4 border-dashed border-blue-500 m-4 rounded-[3rem]">
          <div className="w-20 h-20 rounded-full bg-blue-600/30 flex items-center justify-center text-blue-400 animate-bounce mb-4 border border-blue-500/50">
            <UploadCloud size={40} />
          </div>
          <h2 className="text-2xl font-black text-white mb-1">أفلت ملفات الـ SVGA هنا</h2>
          <p className="text-blue-300 text-xs font-medium">سيتم إضافتها إلى شبكة المربعات الشفافة</p>
        </div>
      )}

      {/* Clean Minimalist Header */}
      <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-3xl p-5 shadow-2xl flex items-center justify-between gap-4">
        {/* Title & Instructions */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
            <LayoutGrid size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white">المعاينة الجماعية</h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
                {files.length} إطارات
              </span>
              {selectedFileNames.size > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-scale-in">
                  محدد {selectedFileNames.size}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              انقر نقراً مزدوجاً على أي إطار لتحديده • انقر على اسم الإطار لإعادة تسميته
            </p>
          </div>
        </div>

        {/* Actions: Download Button (appears when frames are selected) + Clear All Button */}
        <div className="flex items-center gap-2 shrink-0">
          {selectedFileNames.size > 0 && (
            <button
              onClick={handleDownloadSelected}
              disabled={isDownloading}
              className="h-10 px-3.5 rounded-2xl bg-blue-600/20 hover:bg-blue-600/30 active:scale-95 text-blue-400 font-bold text-xs transition-all cursor-pointer flex items-center gap-2 border border-blue-500/30 hover:border-blue-500/50 disabled:opacity-50"
              title="تحميل الإطارات المحددة في ملف مضغوط (كل إطار في مجلد خاص)"
            >
              {isDownloading ? (
                <Loader2 size={16} className="animate-spin text-blue-400" />
              ) : (
                <Download size={16} className="text-blue-400" />
              )}
              <span>تحميل المحدد ({selectedFileNames.size})</span>
            </button>
          )}

          {/* Clear All Button: Icon Only */}
          <button
            onClick={onClearAll}
            className="w-10 h-10 rounded-2xl bg-slate-800/60 hover:bg-red-500/20 border border-slate-700/50 hover:border-red-500/30 text-slate-400 hover:text-red-300 transition-all active:scale-95 cursor-pointer flex items-center justify-center shadow-md shrink-0"
            title="مسح الكل والعودة لمربع الاختيار"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Clean Transparent Square Boxes Grid - 5 boxes per row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-5 gap-4 sm:gap-5">
        {files.map((file, idx) => (
          <SVGAGridCard
            key={`${file.name}-${file.lastModified}-${idx}`}
            file={file}
            onRemove={() => onRemoveFile(file)}
            isSelected={selectedFileNames.has(file.name)}
            onToggleSelect={() => handleToggleSelect(file)}
            onRename={(newName) => handleRename(file, newName)}
          />
        ))}

        {/* Add More Files Card */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="group relative aspect-square rounded-[2rem] border-2 border-dashed border-slate-800/90 hover:border-blue-500/60 bg-slate-950/25 hover:bg-blue-600/10 transition-all duration-300 flex flex-col items-center justify-center p-4 text-center cursor-pointer shadow-lg hover:scale-[1.02]"
        >
          <div className="w-11 h-11 rounded-2xl bg-slate-800/60 group-hover:bg-blue-600/20 border border-slate-700/50 group-hover:border-blue-500/40 text-slate-400 group-hover:text-blue-400 flex items-center justify-center transition-all duration-300 mb-2 group-hover:scale-110">
            <Plus size={22} />
          </div>
          <h3 className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
            إضافة إطار
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            انقر أو اسحب ملفات
          </p>
        </div>
      </div>
    </div>
  );
};
