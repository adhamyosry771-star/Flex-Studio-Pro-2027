
import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { LogIn, Sparkles, ShieldCheck, Zap, Mail, Lock, User as UserIcon, ArrowRight, AlertCircle, Loader2, ShieldAlert, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DynamicBackground } from './DynamicBackground';

interface LoginProps {
  banInfo?: any;
}

export const Login: React.FC<LoginProps> = ({ banInfo }) => {
  const { loginWithEmail, signupWithEmail, logout, appSettings } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isSignup) {
        if (!name) throw new Error('يرجى إدخال الاسم');
        await signupWithEmail(email, password, name);
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err: any) {
      let msg = 'حدث خطأ ما، يرجى المحاولة لاحقاً';
      if (err.code === 'auth/user-not-found') msg = 'المستخدم غير موجود';
      if (err.code === 'auth/wrong-password') msg = 'كلمة المرور غير صحيحة';
      if (err.code === 'auth/email-already-in-use') msg = 'البريد الإلكتروني مستخدم بالفعل';
      if (err.code === 'auth/invalid-email') msg = 'البريد الإلكتروني غير صالح';
      if (err.code === 'auth/weak-password') msg = 'كلمة المرور ضعيفة جداً';
      if (err.code === 'auth/unauthorized-domain') {
        msg = 'هذا النطاق غير مصرح به. يرجى إضافة الروابط التالية في Firebase Console (Authentication > Settings > Authorized domains): \n 1. ais-dev-xuikx6qoswp5tssoqiyhos-75015451145.europe-west2.run.app \n 2. ais-pre-xuikx6qoswp5tssoqiyhos-75015451145.europe-west2.run.app';
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 overflow-hidden relative font-sans" dir="rtl">
      {/* Dynamic Background */}
      <DynamicBackground url={appSettings?.loginBgURL} overlayOpacity={0.7} />

      {/* Background Decorations (Fallback/Extra) */}
      {!appSettings?.loginBgURL && (
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]"></div>
        </div>
      )}

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-md w-full bg-slate-900/70 border border-slate-800/50 rounded-[2.5rem] p-6 md:p-10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] relative z-10"
      >
        <div className="text-center mb-8">
          <motion.div 
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-[1.5rem] bg-blue-600/10 border border-blue-500/30 mb-6 shadow-2xl shadow-blue-600/10 relative group backdrop-blur-xl overflow-hidden"
          >
            {appSettings?.logoURL && (
              <img src={appSettings.logoURL} alt="Logo" className="w-full h-full object-cover" />
            )}
            {/* Shimmer Sheen Light Effect */}
            <motion.div
              initial={{ x: '-150%' }}
              animate={{ x: '150%' }}
              transition={{
                repeat: Infinity,
                repeatType: 'loop',
                duration: 2.2,
                ease: "easeInOut",
                repeatDelay: 1.5
              }}
              className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-20 pointer-events-none z-10"
            />
          </motion.div>
          <div className="flex flex-col items-center mb-4" dir="ltr">
            <h1 className="text-4xl font-black tracking-tighter text-white leading-none flex items-center gap-1">
              Flex <span className="text-blue-500">Studio</span>
            </h1>
            <span className="text-[10px] font-black text-blue-500/80 tracking-[0.4em] uppercase mt-2">Pro Edition</span>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed max-w-xs mx-auto">
            {isSignup ? 'أنشئ حسابك الجديد للبدء في عالم الإبداع' : 'مرحباً بك مجدداً، سجل دخولك للمتابعة'}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {banInfo ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-8 p-6 bg-red-500/10 border border-red-500/20 rounded-[2rem] text-center relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
              <ShieldAlert className="text-red-500 mx-auto mb-4" size={32} />
              <h2 className="text-lg font-black text-white mb-2">عذراً، لقد تم حظر حسابك</h2>
              <p className="text-slate-400 text-[10px] leading-relaxed mb-4">
                لا يمكنك تسجيل الدخول إلى المنصة في الوقت الحالي بسبب مخالفة القوانين.
              </p>
              
              {banInfo.banUntil ? (
                <div className="bg-slate-950/50 rounded-xl p-3 border border-red-500/10 mb-4">
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">تاريخ انتهاء الحظر</p>
                  <p className="text-xs font-bold text-red-400">
                    {banInfo.banUntil.toDate().toLocaleString('ar-EG', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              ) : (
                <div className="bg-slate-950/50 rounded-xl p-3 border border-red-500/10 mb-4">
                  <p className="text-xs font-bold text-red-400">هذا الحظر دائم</p>
                </div>
              )}

              <button 
                onClick={logout}
                className="w-full py-3 bg-slate-800 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 group/btn"
              >
                <LogOut size={14} className="group-hover/btn:rotate-180 transition-transform" />
                تسجيل الخروج للمحاولة بحساب آخر
              </button>
            </motion.div>
          ) : error ? (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-bold"
            >
              <AlertCircle size={18} />
              {error}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {!banInfo && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div className="group">
                <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl px-4 focus-within:border-blue-500/50 transition-all duration-300">
                  <UserIcon className="text-slate-500 group-focus-within:text-blue-400 transition-colors shrink-0" size={18} />
                  <input 
                    type="text" 
                    placeholder="الاسم الكامل" 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="flex-1 bg-transparent !bg-transparent border-none py-4 pr-3 pl-0 text-white placeholder-slate-500 focus:outline-none text-sm"
                  />
                </div>
              </div>
            )}
            
            <div className="group">
              <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-4 focus-within:border-blue-500/50 transition-all duration-300">
                <Mail className="text-slate-500 group-focus-within:text-blue-400 transition-colors shrink-0" size={18} />
                <input 
                  type="email" 
                  placeholder="البريد الإلكتروني" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-transparent !bg-transparent border-none py-4 pr-3 pl-0 text-white placeholder-slate-500 focus:outline-none text-sm"
                />
              </div>
            </div>

            <div className="group">
              <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-4 focus-within:border-blue-500/50 transition-all duration-300">
                <Lock className="text-slate-500 group-focus-within:text-blue-400 transition-colors shrink-0" size={18} />
                <input 
                  type="password" 
                  placeholder="كلمة المرور" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 bg-transparent !bg-transparent border-none py-4 pr-3 pl-0 text-white placeholder-slate-500 focus:outline-none text-sm"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full group relative flex items-center justify-center gap-3 py-4 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl font-black text-base transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  {isSignup ? 'إنشاء حساب' : 'تسجيل الدخول'}
                  <ArrowRight size={18} className="group-hover:translate-x-[-4px] transition-transform" />
                </>
              )}
            </button>
          </form>
        )}

        {!banInfo && (
          <div className="mt-6 text-center">
            <button 
              onClick={() => { setIsSignup(!isSignup); setError(''); }}
              className="text-xs text-slate-400 hover:text-blue-400 transition-colors font-medium"
            >
              {isSignup ? 'لديك حساب بالفعل؟ سجل دخولك' : 'ليس لديك حساب؟ أنشئ حساباً جديداً'}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

