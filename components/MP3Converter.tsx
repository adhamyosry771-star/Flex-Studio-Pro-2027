import React, { useState, useRef, useEffect } from 'react';
import { 
  Music, 
  Upload, 
  Play, 
  Pause, 
  Download, 
  FileVideo, 
  Volume2, 
  Sliders, 
  Clock, 
  Trash2, 
  FileAudio, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Loader2
} from 'lucide-react';
import { Mp3Encoder } from '@breezystack/lamejs';

interface AudioSettings {
  bitrate: 128 | 192 | 256 | 320;
  channels: 'stereo' | 'mono';
  sampleRate: 44100 | 48000;
  volume: number; // 0.5 to 2.0 (1.0 = 100%)
  trimEnabled: boolean;
  trimStart: number;
  trimEnd: number;
}

export const MP3Converter: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Audio & Conversion Settings
  const [settings, setSettings] = useState<AudioSettings>({
    bitrate: 192,
    channels: 'stereo',
    sampleRate: 44100,
    volume: 1.0,
    trimEnabled: false,
    trimStart: 0,
    trimEnd: 0
  });

  // Processing state
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');
  const [errorText, setErrorText] = useState<string>('');

  // Result state
  const [mp3Blob, setMp3Blob] = useState<Blob | null>(null);
  const [mp3Url, setMp3Url] = useState<string | null>(null);
  const [mp3Duration, setMp3Duration] = useState<number>(0);

  // Audio Playback
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up Object URLs on unmount
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (mp3Url) URL.revokeObjectURL(mp3Url);
    };
  }, [videoUrl, mp3Url]);

  // Audio time update
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setAudioCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleAudioEnded = () => {
    setIsPlayingAudio(false);
    setAudioCurrentTime(0);
  };

  const toggleAudioPlay = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setAudioCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  // Format seconds to mm:ss
  const formatTime = (secs: number): string => {
    if (!secs || isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Format file size
  const formatSize = (bytes: number): string => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  // Handle File Selection
  const handleFile = (file: File) => {
    setErrorText('');
    setMp3Blob(null);
    if (mp3Url) {
      URL.revokeObjectURL(mp3Url);
      setMp3Url(null);
    }

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }

    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(url);

    // Read metadata via temporary video element
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.onloadedmetadata = () => {
      const dur = tempVideo.duration || 0;
      setVideoDuration(dur);
      setSettings(prev => ({
        ...prev,
        trimStart: 0,
        trimEnd: Math.round(dur)
      }));
    };
    tempVideo.onerror = () => {
      // It might be an audio file or container without visual stream
      setVideoDuration(0);
    };
    tempVideo.src = url;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // ---------------------------------------------------------------------------
  // Convert Video to MP3 using Web Audio API + lamejs
  // ---------------------------------------------------------------------------
  const convertToMP3 = async () => {
    if (!videoFile) return;

    setIsConverting(true);
    setProgress(5);
    setStatusText('جاري قراءة ملف الفيديو واستخراج المسار الصوتي...');
    setErrorText('');

    try {
      // 1. Read file as ArrayBuffer
      const arrayBuffer = await videoFile.arrayBuffer();
      setProgress(20);
      setStatusText('جاري فك تشفير البيانات الصوتية عبر Web Audio...');

      // 2. Decode audio via AudioContext
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioContextClass({
        sampleRate: settings.sampleRate
      });

      let audioBuffer: AudioBuffer;
      try {
        const decodeBuffer = arrayBuffer.slice(0);
        audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
          const res = audioCtx.decodeAudioData(decodeBuffer, resolve, reject);
          if (res && typeof res.then === 'function') {
            res.then(resolve).catch(reject);
          }
        });
      } catch {
        throw new Error('تعذر العثور على مسار صوتي صالح داخل هذا الفيديو أو صيغة الملف غير مدعومة.');
      }

      setProgress(40);
      setStatusText('جاري معالجة قنوات الصوت وضبط التردد...');

      const totalChannels = audioBuffer.numberOfChannels;
      const targetChannels = settings.channels === 'mono' ? 1 : Math.min(2, totalChannels);
      const sampleRate = audioBuffer.sampleRate;
      
      // Calculate start and end sample frames if trimmed
      let startSample = 0;
      let endSample = audioBuffer.length;
      if (settings.trimEnabled && settings.trimEnd > settings.trimStart) {
        startSample = Math.max(0, Math.floor(settings.trimStart * sampleRate));
        endSample = Math.min(audioBuffer.length, Math.floor(settings.trimEnd * sampleRate));
      }
      const numSamples = endSample - startSample;

      if (numSamples <= 0) {
        throw new Error('نطاق تقليم الصوت غير صالح، يرجى التحقق من أوقات البداية والنهاية.');
      }

      // Convert Float32 to Int16 with optional volume boost
      const volume = settings.volume;
      const leftFloat = audioBuffer.getChannelData(0);
      const rightFloat = totalChannels > 1 ? audioBuffer.getChannelData(1) : leftFloat;

      const leftInt16 = new Int16Array(numSamples);
      const rightInt16 = targetChannels === 2 ? new Int16Array(numSamples) : null;

      for (let i = 0; i < numSamples; i++) {
        const srcIdx = startSample + i;
        
        let l = leftFloat[srcIdx] * volume;
        l = Math.max(-1, Math.min(1, l));
        leftInt16[i] = l < 0 ? l * 0x8000 : l * 0x7FFF;

        if (rightInt16) {
          let r = rightFloat[srcIdx] * volume;
          r = Math.max(-1, Math.min(1, r));
          rightInt16[i] = r < 0 ? r * 0x8000 : r * 0x7FFF;
        }
      }

      setProgress(60);
      setStatusText(`جاري تشفير ملف MP3 بمعدل بت ${settings.bitrate} kbps...`);

      // 3. Encode with Mp3Encoder
      const encoder = new Mp3Encoder(targetChannels, sampleRate, settings.bitrate);
      const mp3DataParts: Uint8Array[] = [];
      const blockSize = 1152; // LAME standard mp3 frame size

      for (let i = 0; i < numSamples; i += blockSize) {
        const leftChunk = leftInt16.subarray(i, i + blockSize);
        let mp3buf: Uint8Array | Int8Array;

        if (targetChannels === 2 && rightInt16) {
          const rightChunk = rightInt16.subarray(i, i + blockSize);
          mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
        } else {
          mp3buf = encoder.encodeBuffer(leftChunk);
        }

        if (mp3buf.length > 0) {
          mp3DataParts.push(new Uint8Array(mp3buf.buffer, mp3buf.byteOffset, mp3buf.length));
        }

        // Update progress smoothly
        if (i % (blockSize * 20) === 0) {
          const encProgress = 60 + Math.round((i / numSamples) * 35);
          setProgress(encProgress);
        }
      }

      // Flush remaining data
      const endBuf = encoder.flush();
      if (endBuf.length > 0) {
        mp3DataParts.push(new Uint8Array(endBuf.buffer, endBuf.byteOffset, endBuf.length));
      }

      setProgress(98);
      setStatusText('جاري إنشاء ملف MP3 النهائي...');

      const blob = new Blob(mp3DataParts, { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);

      setMp3Blob(blob);
      setMp3Url(url);
      setMp3Duration(numSamples / sampleRate);
      setProgress(100);
      setStatusText('تم استخراج وتشفير ملف MP3 بنجاح!');
      await audioCtx.close();
    } catch (err: unknown) {
      console.error('MP3 Conversion Error:', err);
      const msg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء استخراج الصوت وتشفيره.';
      setErrorText(msg);
    } finally {
      setIsConverting(false);
    }
  };

  // Download converted MP3
  const handleDownload = () => {
    if (!mp3Blob || !videoFile) return;
    const a = document.createElement('a');
    a.href = mp3Url || URL.createObjectURL(mp3Blob);
    const baseName = videoFile.name.replace(/\.[^/.]+$/, "");
    a.download = `${baseName}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Reset all
  const handleReset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (mp3Url) URL.revokeObjectURL(mp3Url);
    setVideoFile(null);
    setVideoUrl(null);
    setVideoDuration(0);
    setMp3Blob(null);
    setMp3Url(null);
    setMp3Duration(0);
    setErrorText('');
    setStatusText('');
    setProgress(0);
    setIsPlayingAudio(false);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8" dir="rtl">
      
      {/* Header Info */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center justify-center gap-3">
          <Music size={28} className="text-teal-400" />
          <span>محول الفيديو إلى صوت MP3</span>
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm max-w-xl mx-auto">
          استخراج الصوت النقي من أي ملف فيديو بصيغة MP3 قياسية وعالية الجودة محلياً في متصفحك مع الحفاظ التام على الخصوصية والسرعة الفائقة.
        </p>
      </div>

      {/* Main Container */}
      {!videoFile ? (
        /* Upload Area */
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-10 sm:p-16 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-4 ${
            isDragOver 
              ? 'border-teal-500 bg-teal-500/10' 
              : 'border-slate-800 hover:border-teal-500/40 bg-slate-900/40 hover:bg-slate-900/60'
          }`}
        >
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFile(e.target.files[0]);
              }
            }}
            accept="video/*,audio/*,.mp4,.webm,.mov,.mkv,.avi,.flv,.m4v,.3gp,.wav"
            className="hidden"
          />

          <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Upload size={32} />
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-black text-white">انقر هنا لاختيار ملف فيديو أو اسحبه إلى هنا</h3>
            <p className="text-xs text-slate-400">يدعم كافة صيغ الفيديو: MP4, WebM, MOV, MKV, AVI, FLV وغيرها</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {['MP4', 'WEBM', 'MOV', 'MKV', 'AVI', 'FLV'].map((fmt) => (
              <span key={fmt} className="px-2.5 py-1 rounded-full bg-slate-800/60 border border-slate-700/50 text-[11px] font-mono text-slate-300">
                {fmt}
              </span>
            ))}
          </div>
        </div>
      ) : (
        /* Video Loaded Layout: 2 Columns */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Video Preview & Audio Player (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Video Card */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                <div className="flex items-center gap-2 text-teal-400">
                  <FileVideo size={18} />
                  <span className="text-sm font-black text-white truncate max-w-[280px] sm:max-w-md">
                    {videoFile.name}
                  </span>
                </div>
                <button
                  onClick={handleReset}
                  className="p-1.5 rounded-xl bg-slate-800/60 hover:bg-red-500/20 text-slate-400 hover:text-red-300 border border-slate-700/50 hover:border-red-500/40 transition-colors"
                  title="إلغاء واختيار فيديو آخر"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Video Player */}
              <div className="w-full aspect-video rounded-2xl bg-black overflow-hidden border border-slate-800 relative flex items-center justify-center">
                {videoUrl && (
                  <video 
                    ref={videoPreviewRef}
                    src={videoUrl} 
                    controls 
                    className="w-full h-full object-contain"
                  />
                )}
              </div>

              {/* Video Metadata Stats */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800/60">
                  <span className="text-slate-400 block text-[10px]">حجم الفيديو</span>
                  <span className="font-mono text-white font-bold">{formatSize(videoFile.size)}</span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800/60">
                  <span className="text-slate-400 block text-[10px]">مدة العرض</span>
                  <span className="font-mono text-teal-400 font-bold">{formatTime(videoDuration)}</span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800/60">
                  <span className="text-slate-400 block text-[10px]">النوع</span>
                  <span className="font-mono text-white font-bold truncate">{videoFile.type || 'video/mp4'}</span>
                </div>
              </div>
            </div>

            {/* Converted Audio Player (Shows when conversion is done) */}
            {mp3Url && (
              <div className="bg-slate-900/60 border border-emerald-500/30 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <FileAudio size={20} />
                    <h3 className="text-sm font-black text-white">معاينة ملف الـ MP3 المستخرج</h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                    جاهز للتحميل
                  </span>
                </div>

                <audio 
                  ref={audioRef}
                  src={mp3Url}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleAudioEnded}
                  className="hidden"
                />

                {/* Custom Audio Player Bar */}
                <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex items-center gap-4">
                  <button
                    onClick={toggleAudioPlay}
                    className="w-12 h-12 rounded-2xl bg-teal-500/20 hover:bg-teal-500/30 active:bg-teal-500/35 border border-teal-500/40 text-teal-300 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                  >
                    {isPlayingAudio ? <Pause size={20} /> : <Play size={20} className="translate-x-[-1px]" />}
                  </button>

                  <div className="flex-1 space-y-2" dir="ltr">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>{formatTime(audioCurrentTime)}</span>
                      <span>{formatTime(mp3Duration)}</span>
                    </div>

                    {/* Visible Translucent Track Bar */}
                    <div className="relative flex items-center h-5 w-full group">
                      {/* Track Background & Border */}
                      <div className="w-full h-2 rounded-full bg-slate-800/80 border border-slate-700/60 overflow-hidden relative pointer-events-none">
                        {/* Active Progress Fill */}
                        <div 
                          className="h-full bg-teal-500/45 rounded-full transition-all duration-75"
                          style={{ width: `${mp3Duration ? Math.min(100, Math.max(0, (audioCurrentTime / mp3Duration) * 100)) : 0}%` }}
                        />
                      </div>

                      {/* Native Range Input */}
                      <input 
                        type="range"
                        min={0}
                        max={mp3Duration || 1}
                        step={0.1}
                        value={audioCurrentTime}
                        onChange={handleSeek}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />

                      {/* Movement Dot Walking on Track */}
                      <div 
                        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-teal-400 border-2 border-slate-950 shadow-none pointer-events-none -translate-x-1/2 transition-transform group-hover:scale-110"
                        style={{ left: `${mp3Duration ? Math.min(100, Math.max(0, (audioCurrentTime / mp3Duration) * 100)) : 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Download Button */}
                <div className="pt-2">
                  <button
                    onClick={handleDownload}
                    className="w-full py-4 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 active:bg-emerald-500/35 border border-emerald-500/40 hover:border-emerald-500/60 text-emerald-300 font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download size={18} className="text-emerald-400" />
                    <span>تحميل ملف MP3 الآن ({mp3Blob ? formatSize(mp3Blob.size) : ''})</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Audio & Quality Settings (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Audio Settings Panel */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-800/60 pb-3 text-teal-400">
                <Sliders size={18} />
                <h3 className="text-sm font-black text-white">إعدادات جودة الصوت والصيغة</h3>
              </div>

              {/* Bitrate Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 block">معدل البت / الجودة (Bitrate):</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 128, label: '128 kbps', desc: 'حجم اقتصادي' },
                    { value: 192, label: '192 kbps', desc: 'متوازن (موصى به)' },
                    { value: 256, label: '256 kbps', desc: 'جودة عالية' },
                    { value: 320, label: '320 kbps', desc: 'أقصى نقاء Ultra' }
                  ].map((item) => (
                    <button
                      key={item.value}
                      onClick={() => setSettings(prev => ({ ...prev, bitrate: item.value as AudioSettings['bitrate'] }))}
                      className={`p-2.5 rounded-xl text-right transition-colors border cursor-pointer ${
                        settings.bitrate === item.value
                          ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                          : 'bg-slate-800/50 text-slate-400 border-transparent hover:bg-slate-800/70 hover:text-slate-200'
                      }`}
                    >
                      <span className="block text-xs font-mono font-bold">{item.label}</span>
                      <span className="block text-[10px] text-slate-500">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Audio Channels */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 block">قنوات الصوت:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, channels: 'stereo' }))}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-colors border text-center cursor-pointer ${
                      settings.channels === 'stereo'
                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                        : 'bg-slate-800/50 text-slate-400 border-transparent hover:bg-slate-800/70 hover:text-slate-200'
                    }`}
                  >
                    ستيريو (Stereo 2ch)
                  </button>
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, channels: 'mono' }))}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-colors border text-center cursor-pointer ${
                      settings.channels === 'mono'
                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                        : 'bg-slate-800/50 text-slate-400 border-transparent hover:bg-slate-800/70 hover:text-slate-200'
                    }`}
                  >
                    مونو (Mono 1ch)
                  </button>
                </div>
              </div>

              {/* Sample Rate */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 block">معدل العينة (Sample Rate):</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, sampleRate: 44100 }))}
                    className={`py-2 px-3 rounded-xl text-xs font-mono font-bold transition-colors border text-center cursor-pointer ${
                      settings.sampleRate === 44100
                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                        : 'bg-slate-800/50 text-slate-400 border-transparent hover:bg-slate-800/70 hover:text-slate-200'
                    }`}
                  >
                    44,100 Hz (CD)
                  </button>
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, sampleRate: 48000 }))}
                    className={`py-2 px-3 rounded-xl text-xs font-mono font-bold transition-colors border text-center cursor-pointer ${
                      settings.sampleRate === 48000
                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                        : 'bg-slate-800/50 text-slate-400 border-transparent hover:bg-slate-800/70 hover:text-slate-200'
                    }`}
                  >
                    48,000 Hz (Studio)
                  </button>
                </div>
              </div>

              {/* Volume Gain Slider */}
              <div className="space-y-2 pt-2 border-t border-slate-800/60">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Volume2 size={15} className="text-teal-400" />
                    مستوى وتضخيم الصوت:
                  </span>
                  <span className="text-teal-400 font-mono">{Math.round(settings.volume * 100)}%</span>
                </div>

                {/* Visible Translucent Track Bar */}
                <div className="relative flex items-center h-5 w-full group" dir="ltr">
                  {/* Track Background & Border */}
                  <div className="w-full h-2 rounded-full bg-slate-800/80 border border-slate-700/60 overflow-hidden relative pointer-events-none">
                    {/* Active Progress Fill */}
                    <div 
                      className="h-full bg-teal-500/45 rounded-full transition-all duration-75"
                      style={{ width: `${Math.min(100, Math.max(0, ((settings.volume - 0.5) / 1.5) * 100))}%` }}
                    />
                  </div>

                  {/* Native Range Input */}
                  <input 
                    type="range"
                    min={0.5}
                    max={2.0}
                    step={0.05}
                    value={settings.volume}
                    onChange={(e) => setSettings(prev => ({ ...prev, volume: parseFloat(e.target.value) }))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />

                  {/* Movement Dot Walking on Track */}
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-teal-400 border-2 border-slate-950 shadow-none pointer-events-none -translate-x-1/2 transition-transform group-hover:scale-110"
                    style={{ left: `${Math.min(100, Math.max(0, ((settings.volume - 0.5) / 1.5) * 100))}%` }}
                  />
                </div>
              </div>

              {/* Audio Trim Option */}
              <div className="space-y-3 pt-2 border-t border-slate-800/60">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={settings.trimEnabled}
                    onChange={(e) => setSettings(prev => ({ ...prev, trimEnabled: e.target.checked }))}
                    className="w-4 h-4 rounded text-teal-500 accent-teal-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-300 block flex items-center gap-1.5">
                      <Clock size={14} className="text-teal-400" />
                      تقليم / قص جزء محدد من الصوت
                    </span>
                    <span className="text-[10px] text-slate-500">استخراج مقطع زمني معين بدلاً من الفيديو كاملاً</span>
                  </div>
                </label>

                {settings.trimEnabled && (
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold block">وقت البداية (ثواني):</label>
                      <input 
                        type="number"
                        min={0}
                        max={settings.trimEnd}
                        value={settings.trimStart}
                        onChange={(e) => setSettings(prev => ({ ...prev, trimStart: Math.max(0, parseFloat(e.target.value) || 0) }))}
                        className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-2 py-1.5 text-xs text-white font-mono text-center outline-none focus:border-teal-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold block">وقت النهاية (ثواني):</label>
                      <input 
                        type="number"
                        min={settings.trimStart}
                        max={videoDuration || 9999}
                        value={settings.trimEnd}
                        onChange={(e) => setSettings(prev => ({ ...prev, trimEnd: parseFloat(e.target.value) || 0 }))}
                        className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-2 py-1.5 text-xs text-white font-mono text-center outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Progress / Status Display */}
            {isConverting && (
              <div className="bg-slate-900/60 border border-teal-500/30 rounded-3xl p-5 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-teal-300 flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-teal-400" />
                    {statusText}
                  </span>
                  <span className="text-white font-mono">{progress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-teal-500 transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorText && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3 text-red-300 text-xs">
                <AlertCircle size={18} className="shrink-0 text-red-400" />
                <span>{errorText}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={convertToMP3}
                disabled={isConverting}
                className="w-full py-4 rounded-2xl bg-teal-500/20 hover:bg-teal-500/30 active:bg-teal-500/35 border border-teal-500/40 hover:border-teal-500/60 text-teal-300 font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
              >
                {isConverting ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-teal-400" />
                    <span>جاري التحويل والاستخراج...</span>
                  </>
                ) : (
                  <>
                    <Music size={18} className="text-teal-400" />
                    <span>بدء استخراج وتحويل الصوت إلى MP3</span>
                  </>
                )}
              </button>

              {mp3Blob && (
                <button
                  onClick={handleReset}
                  className="w-full py-3 rounded-2xl bg-slate-800/40 hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-slate-700/40 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw size={15} />
                  <span>تحويل فيديو آخر</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
