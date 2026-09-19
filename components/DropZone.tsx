
import React, { useState } from 'react';
import { UploadCloud, FileType } from 'lucide-react';

interface DropZoneProps {
  onFilesSelect: (files: File[]) => void;
  acceptedExtension?: '.svga' | '.pag';
  title?: string;
  subtitle?: string;
}

export const DropZone: React.FC<DropZoneProps> = ({ 
  onFilesSelect, 
  acceptedExtension = '.svga',
  title = 'قم بسحب ملفات SVGA هنا',
  subtitle = 'أو انقر لاختيار ملفات من جهازك. يدعم العارض عرض عدة ملفات في نفس الوقت.'
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = (Array.from(e.dataTransfer.files) as File[]).filter(f => f.name.toLowerCase().endsWith(acceptedExtension));
    if (files.length > 0) {
      onFilesSelect(files);
    } else {
      alert(`يرجى اختيار ملفات صالحة بتنسيق (${acceptedExtension})`);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = (Array.from(e.target.files || []) as File[]).filter(f => f.name.toLowerCase().endsWith(acceptedExtension));
    if (files.length > 0) {
      onFilesSelect(files);
    }
  };

  return (
    <div 
      className={`relative min-h-[400px] flex flex-col items-center justify-center p-8 transition-all duration-300 border-2 border-dashed rounded-3xl cursor-pointer
        ${isDragging 
          ? 'bg-blue-600/10 border-blue-500 scale-[0.99]' 
          : 'bg-transparent border-slate-800 hover:border-slate-700 hover:bg-slate-800/20'
        }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => document.getElementById('file-input')?.click()}
    >
      <input 
        id="file-input" 
        type="file" 
        className="hidden" 
        accept={acceptedExtension}
        multiple
        onChange={handleFileInput}
      />
      
      <div className="bg-slate-800/40 p-6 rounded-full mb-6 group-hover:scale-110 transition-transform shadow-xl">
        <UploadCloud size={48} className="text-blue-500" />
      </div>
      
      <h2 className="text-2xl font-bold mb-2 text-white text-center">{title}</h2>
      <p className="text-slate-400 text-center mb-8 max-w-sm">
        {subtitle}
      </p>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-slate-800/30 px-4 py-2 rounded-xl text-xs text-slate-400">
          <FileType size={14} />
          <span>تنسيق مدعوم: {acceptedExtension}</span>
        </div>
      </div>

      <div className="absolute inset-0 -z-10 opacity-10 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 bg-blue-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-32 h-32 bg-indigo-500 rounded-full blur-3xl"></div>
      </div>
    </div>
  );
};
