
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const CPAdmin: React.FC = () => {
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const bgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "cp_config"), (snap) => {
      if (snap.exists()) {
        setBackgroundUrl(snap.data().backgroundUrl || null);
      }
    });
    return unsub;
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setBackgroundUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const isVideoUrl = (url: string | null) => {
    if (!url) return false;
    return url.match(/\.(mp4|webm|ogg|mov)$/) !== null || url.includes('video');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, "settings", "cp_config"), {
        backgroundUrl: backgroundUrl
      }, { merge: true });
      alert("تم حفظ خلفية صفحة CP بنجاح");
    } catch (e) {
      alert("حدث خطأ أثناء الحفظ");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/10 space-y-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-600/20 flex items-center justify-center text-rose-500 border border-rose-500/20">
            <i className="fas fa-heart text-xl"></i>
          </div>
          <div>
            <h3 className="text-sm font-black text-white">إعدادات الـ CP</h3>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">تخصيص مظهر صفحة الارتباط</p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest block mr-2">خلفية صفحة الـ CP</label>
          
          <div className="relative aspect-video rounded-3xl overflow-hidden bg-black/40 border-2 border-dashed border-white/10 flex flex-col items-center justify-center group">
            {backgroundUrl ? (
              isVideoUrl(backgroundUrl) ? (
                <video src={backgroundUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
              ) : (
                <img src={backgroundUrl} className="w-full h-full object-cover" />
              )
            ) : (
              <div className="flex flex-col items-center gap-2 opacity-20">
                <i className="fas fa-image text-4xl text-white"></i>
                <p className="text-[10px] font-black text-white uppercase tracking-widest">اختر صورة أو فيديو</p>
              </div>
            )}
            
            <button 
              onClick={() => bgInputRef.current?.click()}
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-sm"
            >
              <i className="fas fa-camera text-white text-2xl"></i>
            </button>
          </div>
          
          <input 
            type="file" 
            ref={bgInputRef} 
            className="hidden" 
            accept="image/*,video/*" 
            onChange={handleImageSelect} 
          />

          <div className="space-y-2">
            <label className="text-[9px] font-black text-white/30 uppercase mr-2 tracking-widest">أو ضع رابط مباشر</label>
            <input 
              type="text" 
              value={backgroundUrl || ''} 
              onChange={e => setBackgroundUrl(e.target.value)} 
              placeholder="https://..." 
              className="w-full bg-white/5 border border-white/10 p-3.5 rounded-2xl text-[10px] text-white outline-none font-mono focus:border-rose-500/40" 
            />
          </div>
        </div>

        <button 
          onClick={handleSave} 
          disabled={isSaving}
          className="w-full bg-gradient-to-r from-rose-600 to-pink-600 py-4 rounded-2xl font-black text-xs text-white shadow-xl active:scale-95 transition-all border border-white/10"
        >
          {isSaving ? <i className="fas fa-spinner animate-spin"></i> : <span>حفظ الخلفية الجديدة</span>}
        </button>
      </div>
    </div>
  );
};

export default CPAdmin;
