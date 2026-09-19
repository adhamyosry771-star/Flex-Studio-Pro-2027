
import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

interface SetupProfileProps {
  onComplete: () => void;
}

export const SetupProfile: React.FC<SetupProfileProps> = ({ onComplete }) => {
  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [birthDate, setBirthDate] = useState({ day: '', month: '', year: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i);

  const generateRandomID = () => Math.floor(10000000 + Math.random() * 90000000).toString();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert("يرجى اختيار صورة أقل من 1 ميجابايت");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName || !gender || !birthDate.day || !birthDate.month || !birthDate.year) {
      alert("يرجى إكمال جميع البيانات");
      return;
    }

    setIsLoading(true);
    try {
      const user = auth.currentUser;
      if (user) {
        const randomID = generateRandomID();
        const userData = {
          uid: user.uid,
          customId: randomID,
          displayName,
          gender,
          birthDate: `${birthDate.year}-${birthDate.month}-${birthDate.day}`,
          photoURL: imagePreview || `https://api.dicebear.com/7.x/avataaars/svg?seed=${randomID}`,
          level: 1,
          coins: 0,
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, "users", user.uid), userData, { merge: true });
        await updateProfile(user, {
          displayName: displayName,
          photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${randomID}`
        });
        onComplete();
      }
    } catch (error) {
      alert("حدث خطأ في حفظ البيانات");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen max-w-md mx-auto bg-[#1a0b2e] text-purple-50 p-6 flex flex-col items-center justify-center overflow-hidden relative" dir="rtl">
      {/* عناصر تزيين الخلفية */}
      <div className="absolute top-[-5%] right-[-10%] w-64 h-64 bg-purple-600/10 rounded-full blur-[80px]"></div>
      <div className="absolute bottom-[-5%] left-[-10%] w-64 h-64 bg-pink-600/10 rounded-full blur-[80px]"></div>

      <div className="w-full space-y-8 relative z-10">
        <div className="text-center">
          <h2 className="text-2xl font-black text-white drop-shadow-lg">إكمال البيانات</h2>
          <p className="text-purple-400/60 text-[10px] font-black mt-2 uppercase tracking-[0.3em]">عالم الترفيه ينتظرك</p>
        </div>

        <div className="flex flex-col items-center gap-4">
          <label className="relative cursor-pointer group">
            <div className="w-28 h-28 rounded-full bg-white/5 border-4 border-white/10 shadow-2xl flex items-center justify-center overflow-hidden transition-all group-hover:scale-105 group-hover:border-purple-500/50">
              {imagePreview ? (
                <img src={imagePreview} className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center text-purple-300/30">
                  <i className="fas fa-camera text-3xl mb-1"></i>
                  <span className="text-[10px] font-black uppercase tracking-widest">صورة</span>
                </div>
              )}
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            <div className="absolute bottom-1 right-1 bg-gradient-to-tr from-purple-600 to-pink-500 w-9 h-9 rounded-full flex items-center justify-center border-4 border-[#1a0b2e] text-white text-xs shadow-lg">
              <i className="fas fa-plus"></i>
            </div>
          </label>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest mr-2">الاسم المستعار</label>
            <input 
              type="text" 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm text-white outline-none focus:border-purple-500/40 transition-all shadow-inner placeholder:text-white/20"
              placeholder="اكتب اسمك هنا..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest mr-2">تاريخ الميلاد</label>
            <div className="grid grid-cols-3 gap-2">
              <select 
                value={birthDate.day}
                onChange={(e) => setBirthDate({...birthDate, day: e.target.value})}
                className="bg-white/5 border border-white/10 rounded-xl py-3.5 px-2 outline-none text-xs text-purple-100 shadow-sm appearance-none text-center cursor-pointer focus:border-purple-500/40"
              >
                <option value="" disabled className="bg-[#1a0b2e]">اليوم</option>
                {days.map(d => <option key={d} value={d} className="bg-[#1a0b2e]">{d}</option>)}
              </select>
              <select 
                value={birthDate.month}
                onChange={(e) => setBirthDate({...birthDate, month: e.target.value})}
                className="bg-white/5 border border-white/10 rounded-xl py-3.5 px-2 outline-none text-xs text-purple-100 shadow-sm appearance-none text-center cursor-pointer focus:border-purple-500/40"
              >
                <option value="" disabled className="bg-[#1a0b2e]">الشهر</option>
                {months.map(m => <option key={m} value={m} className="bg-[#1a0b2e]">{m}</option>)}
              </select>
              <select 
                value={birthDate.year}
                onChange={(e) => setBirthDate({...birthDate, year: e.target.value})}
                className="bg-white/5 border border-white/10 rounded-xl py-3.5 px-2 outline-none text-xs text-purple-100 shadow-sm appearance-none text-center cursor-pointer focus:border-purple-500/40"
              >
                <option value="" disabled className="bg-[#1a0b2e]">السنة</option>
                {years.map(y => <option key={y} value={y} className="bg-[#1a0b2e]">{y}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest mr-2">الجنس</label>
            <div className="grid grid-cols-2 gap-4">
              <button 
                type="button"
                onClick={() => setGender('male')}
                className={`py-4 rounded-2xl border-2 flex items-center justify-center gap-3 transition-all ${gender === 'male' ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-white/5 border-white/10 text-white/40'}`}
              >
                <i className="fas fa-mars text-lg"></i>
                <span className="text-sm font-black">ذكر</span>
              </button>
              <button 
                type="button"
                onClick={() => setGender('female')}
                className={`py-4 rounded-2xl border-2 flex items-center justify-center gap-3 transition-all ${gender === 'female' ? 'bg-pink-600/20 border-pink-500 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.3)]' : 'bg-white/5 border-white/10 text-white/40'}`}
              >
                <i className="fas fa-venus text-lg"></i>
                <span className="text-sm font-black">أنثى</span>
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 py-4 rounded-2xl font-black text-white shadow-xl active:scale-95 transition-all mt-4 border border-white/10"
          >
            {isLoading ? <i className="fas fa-circle-notch animate-spin"></i> : 'ابدأ استكشاف يلا جيمز'}
          </button>
        </form>
      </div>
    </div>
  );
};
