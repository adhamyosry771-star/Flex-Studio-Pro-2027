
import React, { useState } from 'react';
import { User as UserIcon } from 'lucide-react';
import { useAuth } from './AuthContext';
import { normalizeDecoratedText } from '../utils';
import { motion } from 'motion/react';
import { UnderDevelopmentModal } from './UnderDevelopmentModal';

export type ViewType = 'viewer' | 'pag-viewer' | 'vab' | 'mp4-alpha' | 'apng-creator' | 'webp-creator' | 'mp3-converter' | 'after-effects' | 'converter' | 'format-converter' | 'image-editor' | 'matcher' | 'admin' | 'profile';

interface HeaderProps {
  currentView?: ViewType;
  setCurrentView?: (view: ViewType) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView = 'viewer', setCurrentView }) => {
  const { user, userData, logout, isAdmin, isOwner, isSubscribed, appSettings } = useAuth();
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    featureName: string;
    type: 'development' | 'maintenance';
    title?: string;
    description?: string;
  }>({
    isOpen: false,
    featureName: 'After Effects',
    type: 'development'
  });

  return (
    <header className="sticky top-0 z-50 bg-transparent">
      <div className="w-full max-w-[1600px] mx-auto px-2 sm:px-4 min-h-[3.5rem] py-2 lg:py-0 lg:h-14 flex flex-col lg:flex-row items-center justify-between gap-2 lg:gap-3">
        {/* Logo Section (Right in RTL) */}
        <div 
          onClick={() => setCurrentView?.('viewer')}
          className="flex items-center gap-2.5 group cursor-pointer shrink-0"
        >
          <div className="relative hidden sm:block">
            <div className="relative bg-blue-600/10 border border-blue-500/30 rounded-full transition-all duration-300 group-hover:border-blue-400/50 flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 overflow-hidden">
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
            </div>
          </div>
          
          <div className="flex flex-col items-center text-center" dir="ltr">
            <h1 className="font-black text-lg sm:text-xl tracking-tighter text-white leading-none flex items-center gap-1">
              Flex
              <span className="text-blue-500">Studio</span>
            </h1>
            <p className="text-[7.5px] sm:text-[8px] uppercase tracking-[0.35em] text-blue-400/60 font-black mt-0.5">Pro Edition</p>
          </div>
        </div>

        {/* Navigation (Center) - Strict single row without wrapping */}
        <div className="flex-1 min-w-0 max-w-full flex items-center justify-start lg:justify-center flex-nowrap overflow-x-auto no-scrollbar gap-1 sm:gap-1.5 py-1 px-1">
          {setCurrentView && (
            <>
              <button
                onClick={() => setCurrentView('viewer')}
                className={`shrink-0 whitespace-nowrap px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[9.5px] font-bold transition-all ${currentView === 'viewer' ? 'bg-blue-500/20 border border-blue-500/30 text-blue-300' : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent'}`}
              >
                عارض SVGA
              </button>
              <button
                onClick={() => setCurrentView('pag-viewer')}
                className={`shrink-0 whitespace-nowrap px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[9.5px] font-bold transition-all ${currentView === 'pag-viewer' ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300' : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent'}`}
              >
                عارض PAG
              </button>
              <button
                id="header-nav-vap-btn"
                onClick={() => {
                  if (!isOwner) {
                    setModalConfig({
                      isOpen: true,
                      featureName: 'VAP',
                      type: 'maintenance',
                      title: 'هذه الميزة في الصيانة الآن',
                      description: 'نعمل حالياً على صيانة وتحديث أداة ومحرر VAP لتقديم أداء فائق وتوافقية أفضل. ستكون الميزة متاحة لجميع المشتركين قريباً!'
                    });
                  } else {
                    setCurrentView?.('vab');
                  }
                }}
                className={`shrink-0 whitespace-nowrap px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[9.5px] font-bold transition-all ${currentView === 'vab' ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-300' : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent'}`}
              >
                VAP
              </button>
              <button
                onClick={() => setCurrentView('mp4-alpha')}
                className={`shrink-0 whitespace-nowrap px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[9.5px] font-bold transition-all ${currentView === 'mp4-alpha' ? 'bg-sky-500/20 border border-sky-500/30 text-sky-300' : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent'}`}
              >
                MP4 Alpha
              </button>
              <button
                onClick={() => setCurrentView('apng-creator')}
                className={`shrink-0 whitespace-nowrap px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[9.5px] font-bold transition-all ${currentView === 'apng-creator' ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300' : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent'}`}
              >
                صانع APNG
              </button>
              <button
                onClick={() => setCurrentView('webp-creator')}
                className={`shrink-0 whitespace-nowrap px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[9.5px] font-bold transition-all ${currentView === 'webp-creator' ? 'bg-teal-500/30 border border-teal-500/50 text-teal-200' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800/70 hover:text-slate-200 border border-transparent'}`}
              >
                صانع WEBP
              </button>
              <button
                onClick={() => setCurrentView('mp3-converter')}
                className={`shrink-0 whitespace-nowrap px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[9.5px] font-bold transition-all ${currentView === 'mp3-converter' ? 'bg-teal-500/30 border border-teal-500/50 text-teal-200' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800/70 hover:text-slate-200 border border-transparent'}`}
              >
                محول لMP3
              </button>
              <button
                id="header-nav-after-effects-btn"
                onClick={() => {
                  if (!isOwner) {
                    setModalConfig({
                      isOpen: true,
                      featureName: 'After Effects',
                      type: 'development',
                      title: 'هذه الميزة تحت التطوير حالياً',
                      description: 'نعمل حالياً على تطوير وتجهيز استوديو After Effects لتقديم تجربة تحريك وتعديل احترافية متكاملة. ستتاح الميزة لجميع المشتركين قريباً!'
                    });
                  } else {
                    setCurrentView?.('after-effects');
                  }
                }}
                className={`shrink-0 whitespace-nowrap px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[9.5px] font-bold transition-all ${currentView === 'after-effects' ? 'bg-violet-500/20 border border-violet-500/30 text-violet-300' : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent'}`}
              >
                After Effect
              </button>
              <button
                onClick={() => setCurrentView('format-converter')}
                className={`shrink-0 whitespace-nowrap px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[9.5px] font-bold transition-all ${currentView === 'format-converter' ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300' : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent'}`}
              >
                تحويل الصيغ
              </button>
              <button
                onClick={() => setCurrentView('converter')}
                className={`shrink-0 whitespace-nowrap px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[9.5px] font-bold transition-all ${currentView === 'converter' ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300' : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent'}`}
              >
                تحويل فيديو
              </button>
              <button
                onClick={() => setCurrentView('image-editor')}
                className={`shrink-0 whitespace-nowrap px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[9.5px] font-bold transition-all ${currentView === 'image-editor' ? 'bg-purple-500/20 border border-purple-500/30 text-purple-300' : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent'}`}
              >
                تعديل الصور
              </button>
              <button
                onClick={() => setCurrentView('matcher')}
                className={`shrink-0 whitespace-nowrap px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[9.5px] font-bold transition-all ${currentView === 'matcher' ? 'bg-pink-500/20 border border-pink-500/30 text-pink-300' : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent'}`}
              >
                تطابق الصور
              </button>
              {isAdmin && (
                <button
                  onClick={() => setCurrentView('admin')}
                  className={`shrink-0 whitespace-nowrap px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[9.5px] font-bold transition-all ${currentView === 'admin' ? 'bg-amber-500/20 border border-amber-500/30 text-amber-300' : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent'}`}
                >
                  لوحة التحكم
                </button>
              )}
            </>
          )}
        </div>

        {/* User Profile Section (Left in RTL) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {userData && (
            <div 
              onClick={() => setCurrentView?.('profile')}
              className={`flex items-center gap-3 px-4 py-2 bg-blue-600/10 border border-blue-500/20 rounded-2xl cursor-pointer group/profile transition-all hover:bg-blue-600/20 hover:border-blue-500/40 ${currentView === 'profile' ? 'bg-blue-600/25 border-blue-500/50' : ''}`}
            >
              <div className="flex flex-col items-start hidden sm:flex">
                <span className="text-[10px] font-bold text-white leading-none group-hover/profile:text-blue-400 transition-colors">{normalizeDecoratedText(userData.displayName) || 'مستخدم'}</span>
                <span className="text-[8px] text-slate-400 mt-1">{userData.email}</span>
              </div>
              <div className="relative">
                {userData.photoURL ? (
                  <img src={userData.photoURL} alt={normalizeDecoratedText(userData.displayName) || ''} className="w-8 h-8 rounded-full border border-blue-500/30 object-cover group-hover/profile:border-blue-400 transition-all" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-900/30 flex items-center justify-center text-blue-400 border border-blue-500/30 group-hover/profile:border-blue-400 transition-all">
                    <UserIcon size={14} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <UnderDevelopmentModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        featureName={modalConfig.featureName}
        type={modalConfig.type}
        title={modalConfig.title}
        description={modalConfig.description}
      />
    </header>
  );
};
