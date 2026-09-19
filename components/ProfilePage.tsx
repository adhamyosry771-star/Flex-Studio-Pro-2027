
import React from 'react';
import { useAuth, isUserAdminOrOwner } from './AuthContext';
import { User as UserIcon, Mail, Shield, Calendar, LogOut, ArrowRight, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { normalizeDecoratedText } from '../utils';

interface ProfilePageProps {
  onBack: () => void;
  onActivateClick: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onBack, onActivateClick }) => {
  const { userData, logout, isSubscribed } = useAuth();

  const formatDate = (date: any) => {
    if (!date) return 'غير معروف';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const isCodeActive = userData?.role === 'admin' || (userData?.subscriptionActive && userData?.subscriptionExpires && new Date(userData.subscriptionExpires.toDate ? userData.subscriptionExpires.toDate() : userData.subscriptionExpires) > new Date());

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full"
      >
        {/* Back Button */}
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6 group"
        >
          <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          <span className="text-sm font-bold">العودة للرئيسية</span>
        </button>

        {/* Profile Card */}
        <div className="relative">
          <div className="relative bg-slate-900/30 border border-slate-800/50 rounded-[3rem] overflow-hidden shadow-2xl">
            {/* Profile Info */}
            <div className="px-8 py-10">
              <div className="flex flex-col md:flex-row items-center md:items-end gap-6 mb-8">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full bg-slate-800 border border-slate-700 overflow-hidden shadow-2xl relative z-10 flex items-center justify-center transition-all">
                    {userData?.photoURL ? (
                      <img src={userData.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500">
                        <UserIcon size={48} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 text-center md:text-right md:mb-4">
                  <h1 className="text-3xl font-black text-white tracking-tight mb-1">
                    {normalizeDecoratedText(userData?.displayName) || 'مستخدم'}
                  </h1>
                  <div className={`flex items-center justify-center md:justify-start gap-2 font-bold text-xs uppercase tracking-widest ${
                    userData?.role === 'admin' 
                      ? 'text-amber-400' 
                      : isCodeActive 
                        ? 'text-blue-400' 
                        : 'text-slate-400'
                  }`}>
                    <Shield size={14} />
                    <span>
                      {userData?.role === 'admin' 
                        ? 'مسؤول النظام' 
                        : isCodeActive 
                          ? 'عضو مميز' 
                          : 'عضو عادي'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                <div className="bg-slate-800/30 border border-slate-800/50 rounded-3xl p-5 flex items-center gap-4 group transition-all">
                  <div className="p-3 bg-blue-500/10 rounded-full text-blue-400">
                    <Mail size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">البريد الإلكتروني</p>
                    <p className="text-sm text-white font-medium">{userData?.email}</p>
                  </div>
                </div>

                <div className="bg-slate-800/30 border border-slate-800/50 rounded-3xl p-5 flex items-center gap-4 group transition-all">
                  <div className="p-3 bg-blue-500/10 rounded-full text-blue-400">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">تاريخ الانضمام</p>
                    <p className="text-sm text-white font-medium">{formatDate(userData?.createdAt)}</p>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    if (isUserAdminOrOwner(userData?.email)) {
                      return;
                    }
                    onActivateClick();
                  }}
                  className={`bg-slate-800/30 border border-slate-800/50 rounded-3xl p-5 flex items-center gap-4 group transition-all text-right ${
                    isUserAdminOrOwner(userData?.email)
                      ? 'cursor-default'
                      : 'hover:bg-blue-500/5 hover:border-blue-500/30'
                  }`}
                >
                  <div className={`p-3 rounded-full transition-transform ${
                    userData?.role === 'admin'
                      ? 'bg-amber-500/10 text-amber-400'
                      : isCodeActive
                        ? 'bg-blue-500/10 text-blue-400 group-hover:scale-110'
                        : 'bg-slate-700/50 text-slate-400 group-hover:scale-110'
                  }`}>
                    <Zap size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">حالة العضوية</p>
                    {userData?.role === 'admin' ? (
                      <p className="text-sm text-amber-400 font-bold">مسؤول النظام (دائم)</p>
                    ) : isCodeActive ? (
                      <div className="flex flex-col">
                        <p className="text-sm text-blue-400 font-bold">عضو مميز (مفعل)</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">ينتهي في: {formatDate(userData.subscriptionExpires)}</p>
                        <p className="text-[8px] text-blue-400 mt-1 font-bold">اضغط لتمديد الكود</p>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <p className="text-sm text-slate-400 font-bold">عضو عادي (غير مفعل)</p>
                        <p className="text-[8px] text-blue-400 mt-1 font-bold">اضغط لتفعيل كود جديد</p>
                      </div>
                    )}
                  </div>
                </button>

                <div className="bg-slate-800/30 border border-slate-800/50 rounded-3xl p-5 flex items-center gap-4 group transition-all">
                  <div className="p-3 bg-blue-500/10 rounded-full text-blue-400">
                    <Shield size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">معرف المستخدم</p>
                    <p className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">{userData?.uid}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={logout}
                  className="flex-1 flex items-center justify-center gap-3 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-full font-black transition-all active:scale-[0.98]"
                >
                  <LogOut size={20} />
                  تسجيل الخروج من الحساب
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
