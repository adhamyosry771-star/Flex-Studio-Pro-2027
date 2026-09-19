
import React, { useState, useCallback, useEffect } from 'react';
import { Header, ViewType } from './components/Header';
import { SVGAViewer } from './components/SVGAViewer';
import { PAGViewer } from './components/PAGViewer';
import { VABViewer } from './components/VABViewer';
import { VAPCreator } from './components/VAPCreator';
import { MP4AlphaCreator } from './components/MP4AlphaCreator';
import { DropZone } from './components/DropZone';
import { VideoToSVGA } from './components/VideoToSVGA';
import { ImageMatcher } from './components/ImageMatcher';
import { ImageEditor } from './components/ImageEditor';
import { FormatConverter } from './components/FormatConverter';
import { APNGCreator } from './components/APNGCreator';
import { AfterEffectsStudio } from './components/AfterEffectsStudio';
import { AuthProvider, useAuth, isUserAdminOrOwner } from './components/AuthContext';
import { UnderDevelopmentModal } from './components/UnderDevelopmentModal';
import { Login } from './components/Login';
import { AdminDashboard } from './components/AdminDashboard';
import { ProfilePage } from './components/ProfilePage';
import { DynamicBackground } from './components/DynamicBackground';
import { SVGAFileInfo, SVGAFileExtended } from './types';
import { FolderUp, History, Info, Loader2, ShieldAlert, LogOut, Ticket, MessageCircle, X, CheckCircle2, Trash2, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getHistoryItems, saveHistoryItem, deleteHistoryItem, clearUserHistory } from './components/HistoryDB';

const SubscriptionModal: React.FC<{ isOpen: boolean; onClose: () => void; mode?: 'activate' | 'extend' }> = ({ isOpen, onClose, mode = 'activate' }) => {
  const { activateCode } = useAuth();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleActivate = async () => {
    if (!code.trim()) return;
    setIsLoading(true);
    setError('');
    try {
      await activateCode(code);
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setCode('');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'فشل تفعيل الكود');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const isExtend = mode === 'extend';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/80"
      ></motion.div>
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative max-w-md w-full bg-slate-900/60 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
        dir="rtl"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2"></div>
        
        <button onClick={onClose} className="absolute top-6 left-6 text-slate-500 hover:text-white transition-colors">
          <X size={20} />
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 mx-auto mb-4 border border-blue-500/20">
            <Ticket size={32} />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">
            {isExtend ? 'تمديد الاشتراك' : 'تفعيل الاشتراك'}
          </h2>
          <p className="text-slate-400 text-xs">
            {isExtend 
              ? 'يمكنك تمديد الاشتراك الخاص بك للحصول على فترة استخدام أكبر.' 
              : 'لا يمكنك استخدام خدمات الموقع بدون اشتراك نشط.'}
          </p>
        </div>

        {success ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-10 text-center"
          >
            <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-4" />
            <p className="text-emerald-400 font-black">تم {isExtend ? 'تمديد' : 'تفعيل'} الاشتراك بنجاح!</p>
          </motion.div>
        ) : (
          <div className="space-y-6">
            <div className="relative flex items-center group">
              <Ticket className="absolute right-4 text-slate-500 group-focus-within:text-blue-400 transition-colors pointer-events-none z-10" size={18} />
              <input 
                type="text" 
                placeholder="أدخل كود التفعيل هنا" 
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-slate-800/30 border border-slate-700/50 rounded-2xl py-4 pr-12 pl-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all text-sm font-mono uppercase tracking-widest"
              />
            </div>

            {error && (
              <p className="text-red-400 text-[10px] font-bold text-center bg-red-500/10 py-2 rounded-lg border border-red-500/10">{error}</p>
            )}

            <button 
              onClick={handleActivate}
              disabled={isLoading || !code.trim()}
              className="w-full py-4 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-full font-black text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Ticket size={18} />}
              {isExtend ? 'تمديد الاشتراك الآن' : 'تفعيل الكود الآن'}
            </button>

            <div className="pt-6 border-t border-slate-800">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest text-center mb-4">أو تواصل معنا للاشتراك</p>
              <a 
                href="https://wa.me/201027833873" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full py-4 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 border border-emerald-500/20 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-3 group"
              >
                <MessageCircle size={20} className="group-hover:rotate-12 transition-transform" />
                تواصل عبر واتساب
              </a>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { user, loading, isBanned, isAdmin, isOwner, isSubscribed, logout, userData, appSettings } = useAuth();
  const [currentFiles, setCurrentFiles] = useState<SVGAFileExtended[]>([]);
  const [currentPAGFiles, setCurrentPAGFiles] = useState<SVGAFileExtended[]>([]);
  const [history, setHistory] = useState<SVGAFileExtended[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>('viewer');
  const [vabInitialFile, setVabInitialFile] = useState<File | null>(null);
  const [showSubModal, setShowSubModal] = useState(false);
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
  const [subModalMode, setSubModalMode] = useState<'activate' | 'extend'>('activate');

  // Load history from IndexedDB when user changes
  useEffect(() => {
    if (!user?.uid) {
      setHistory([]);
      return;
    }

    const loadHistory = async () => {
      try {
        const items = await getHistoryItems(user.uid);
        const mappedItems: SVGAFileExtended[] = items.map(item => {
          const file = new File([item.fileData], item.name, { type: item.type, lastModified: item.lastModified });
          return {
            name: item.name,
            size: item.size,
            type: item.type,
            lastModified: item.lastModified,
            url: URL.createObjectURL(item.fileData),
            rawFile: file
          };
        });
        setHistory(mappedItems);
      } catch (err) {
        console.error('Failed to load history from IndexedDB', err);
      }
    };

    loadHistory();
  }, [user?.uid]);

  // Redirect to SVGA Viewer ('viewer') on login / registration
  useEffect(() => {
    if (user?.uid) {
      setCurrentView('viewer');
    }
  }, [user?.uid]);

  // Control selection, copy, and cut permissions depending on user identity
  useEffect(() => {
    const isAllowedToCopy = isUserAdminOrOwner(user?.email);

    if (isAllowedToCopy) {
      document.body.classList.add('allow-select');
      document.body.classList.remove('disable-select');
    } else {
      document.body.classList.add('disable-select');
      document.body.classList.remove('allow-select');
    }

    const handleCopyCut = (e: ClipboardEvent) => {
      if (isAllowedToCopy) return;

      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
    };

    const handleSelectStart = (e: Event) => {
      if (isAllowedToCopy) return;

      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
    };

    document.addEventListener('copy', handleCopyCut);
    document.addEventListener('cut', handleCopyCut);
    document.addEventListener('selectstart', handleSelectStart);

    return () => {
      document.removeEventListener('copy', handleCopyCut);
      document.removeEventListener('cut', handleCopyCut);
      document.removeEventListener('selectstart', handleSelectStart);
      document.body.classList.remove('allow-select', 'disable-select');
    };
  }, [user?.email]);

  const handleViewChange = (view: any) => {
    if (view === 'after-effects' && !isOwner) {
      setModalConfig({
        isOpen: true,
        featureName: 'After Effects',
        type: 'development',
        title: 'هذه الميزة تحت التطوير حالياً',
        description: 'نعمل حالياً على تطوير وتجهيز استوديو After Effects لتقديم تجربة تحريك وتعديل احترافية متكاملة. ستتاح الميزة لجميع المشتركين قريباً!'
      });
      return;
    }
    if (view === 'vab' && !isOwner) {
      setModalConfig({
        isOpen: true,
        featureName: 'VAP',
        type: 'maintenance',
        title: 'هذه الميزة في الصيانة الآن',
        description: 'نعمل حالياً على صيانة وتحديث أداة ومحرر VAP لتقديم أداء فائق وتوافقية أفضل. ستكون الميزة متاحة لجميع المشتركين قريباً!'
      });
      return;
    }
    setCurrentView(view);
  };

  const handlePremiumClickCapture = (e: React.MouseEvent) => {
    if (!isSubscribed && !isAdmin) {
      const target = e.target as HTMLElement;
      const interactive = target.closest('button, input, select, textarea, [role="button"], a, .cursor-pointer');
      if (interactive) {
        e.preventDefault();
        e.stopPropagation();
        setSubModalMode('activate');
        setShowSubModal(true);
      }
    }
  };

  const renderPremiumOverlay = () => {
    return (
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md rounded-3xl p-6 text-center border border-slate-800/40">
        <div className="w-16 h-16 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mb-4 animate-pulse">
          <Lock size={28} />
        </div>
        <h3 className="text-lg font-black text-white mb-2">هذه الميزة مخصصة للمشتركين فقط</h3>
        <p className="text-slate-400 text-xs sm:text-sm max-w-sm mb-6 leading-relaxed">
          يرجى تفعيل اشتراكك لتتمكن من استخدام هذه الأداة الاحترافية والوصول إلى كافة الميزات.
        </p>
        <button 
          onClick={() => {
            setSubModalMode('activate');
            setShowSubModal(true);
          }}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm rounded-full shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all active:scale-95 cursor-pointer"
        >
          اشترك الآن لتفعيل الحساب
        </button>
      </div>
    );
  };

  const handleFilesUpload = useCallback((files: File[]) => {
    if (!isSubscribed && !isAdmin) {
      setSubModalMode('activate');
      setShowSubModal(true);
      return;
    }
    const newFilesInfo: SVGAFileExtended[] = files.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      url: URL.createObjectURL(file),
      rawFile: file
    }));
    
    setCurrentFiles(prev => [...prev, ...newFilesInfo]);
    
    if (user?.uid) {
      const saveAndReload = async () => {
        try {
          for (const file of files) {
            await saveHistoryItem(user.uid, file, file.name, file.size, file.type, file.lastModified);
          }
          const items = await getHistoryItems(user.uid);
          const mappedItems: SVGAFileExtended[] = items.map(item => {
            const fileObj = new File([item.fileData], item.name, { type: item.type, lastModified: item.lastModified });
            return {
              name: item.name,
              size: item.size,
              type: item.type,
              lastModified: item.lastModified,
              url: URL.createObjectURL(item.fileData),
              rawFile: fileObj
            };
          });
          setHistory(mappedItems);
        } catch (err) {
          console.error('Failed to save history items to DB', err);
        }
      };
      saveAndReload();
    } else {
      setHistory(prev => {
        const newNames = newFilesInfo.map(f => f.name);
        const filtered = prev.filter(p => !newNames.includes(p.name));
        return [...newFilesInfo, ...filtered].slice(0, 20);
      });
    }
  }, [isSubscribed, isAdmin, user?.uid]);

  const handlePAGFilesUpload = useCallback((files: File[]) => {
    if (!isSubscribed && !isAdmin) {
      setSubModalMode('activate');
      setShowSubModal(true);
      return;
    }
    const newFilesInfo: SVGAFileExtended[] = files.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      url: URL.createObjectURL(file),
      rawFile: file
    }));
    
    setCurrentPAGFiles(prev => [...prev, ...newFilesInfo]);
    
    if (user?.uid) {
      const saveAndReload = async () => {
        try {
          for (const file of files) {
            await saveHistoryItem(user.uid, file, file.name, file.size, file.type, file.lastModified);
          }
          const items = await getHistoryItems(user.uid);
          const mappedItems: SVGAFileExtended[] = items.map(item => {
            const fileObj = new File([item.fileData], item.name, { type: item.type, lastModified: item.lastModified });
            return {
              name: item.name,
              size: item.size,
              type: item.type,
              lastModified: item.lastModified,
              url: URL.createObjectURL(item.fileData),
              rawFile: fileObj
            };
          });
          setHistory(mappedItems);
        } catch (err) {
          console.error('Failed to save history items to DB', err);
        }
      };
      saveAndReload();
    } else {
      setHistory(prev => {
        const newNames = newFilesInfo.map(f => f.name);
        const filtered = prev.filter(p => !newNames.includes(p.name));
        return [...newFilesInfo, ...filtered].slice(0, 20);
      });
    }
  }, [isSubscribed, isAdmin, user?.uid]);

  const handlePAGHistoryClick = (item: SVGAFileExtended) => {
    setCurrentPAGFiles(prev => {
      if (prev.find(p => p.name === item.name)) return prev;
      return [...prev, item];
    });
  };

  const handleDeleteHistoryItem = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    if (!user?.uid) return;
    try {
      await deleteHistoryItem(user.uid, name);
      setHistory(prev => prev.filter(item => item.name !== name));
    } catch (err) {
      console.error('Failed to delete history item', err);
    }
  };

  const handleClearHistory = async () => {
    if (!user?.uid) return;
    if (window.confirm('هل أنت متأكد من رغبتك في مسح السجل بالكامل؟')) {
      try {
        await clearUserHistory(user.uid);
        setHistory([]);
      } catch (err) {
        console.error('Failed to clear history', err);
      }
    }
  };

  const handleHistoryClick = (item: SVGAFileExtended) => {
    setCurrentFiles(prev => {
      if (prev.find(p => p.name === item.name)) return prev;
      return [...prev, item];
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="text-blue-500 animate-spin" size={40} />
        <p className="text-slate-500 text-sm font-bold tracking-widest uppercase">جاري التحميل...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (isBanned) {
    return <Login banInfo={userData} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-right relative" dir="rtl">
      {/* Dynamic Background */}
      <DynamicBackground url={appSettings?.mainBgURL} overlayOpacity={0.72} />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Header currentView={currentView} setCurrentView={handleViewChange} />
        
        <main className={`flex-1 ${currentView === 'after-effects' ? 'w-full px-2 sm:px-4 py-2' : 'container mx-auto px-4 py-8'}`}>
          <AnimatePresence mode="wait">
            {currentView === 'profile' ? (
              <motion.div key="profile" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
                <ProfilePage onBack={() => setCurrentView('viewer')} onActivateClick={() => {
                  setSubModalMode('extend');
                  setShowSubModal(true);
                }} />
              </motion.div>
            ) : currentView === 'admin' ? (
              <motion.div key="admin" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                <AdminDashboard />
              </motion.div>
            ) : currentView === 'vab' ? (
              isOwner ? (
                <motion.div key="vab" className="relative w-full" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <VAPCreator />
                </motion.div>
              ) : null
            ) : currentView === 'mp4-alpha' ? (
              <motion.div key="mp4-alpha" className="relative w-full" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onClickCapture={handlePremiumClickCapture}>
                <MP4AlphaCreator 
                  onOpenInVabViewer={(file) => {
                    if (!isOwner) {
                      setModalConfig({
                        isOpen: true,
                        featureName: 'VAP',
                        type: 'maintenance',
                        title: 'هذه الميزة في الصيانة الآن',
                        description: 'نعمل حالياً على صيانة وتحديث أداة ومحرر VAP لتقديم أداء فائق وتوافقية أفضل. ستكون الميزة متاحة لجميع المشتركين قريباً!'
                      });
                      return;
                    }
                    setVabInitialFile(file);
                    setCurrentView('vab');
                  }} 
                />
              </motion.div>
            ) : currentView === 'converter' ? (
              <motion.div key="converter" className="relative w-full" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onClickCapture={handlePremiumClickCapture}>
                <VideoToSVGA />
              </motion.div>
            ) : currentView === 'apng-creator' ? (
              <motion.div key="apng-creator" className="relative w-full" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onClickCapture={handlePremiumClickCapture}>
                <APNGCreator />
              </motion.div>
            ) : currentView === 'after-effects' ? (
              isOwner ? (
                <motion.div key="after-effects" className="relative w-full" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onClickCapture={handlePremiumClickCapture}>
                  <AfterEffectsStudio 
                    onOpenInViewer={(file) => {
                      setCurrentFiles([file]);
                      setCurrentView('viewer');
                    }} 
                  />
                </motion.div>
              ) : null
            ) : currentView === 'format-converter' ? (
              <motion.div key="format-converter" className="relative w-full" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onClickCapture={handlePremiumClickCapture}>
                <FormatConverter />
              </motion.div>
            ) : currentView === 'image-editor' ? (
              <motion.div key="image-editor" className="relative w-full" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onClickCapture={handlePremiumClickCapture}>
                <ImageEditor />
              </motion.div>
            ) : currentView === 'matcher' ? (
              <motion.div key="matcher" className="relative w-full" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onClickCapture={handlePremiumClickCapture}>
                <ImageMatcher />
              </motion.div>
            ) : currentView === 'pag-viewer' ? (
              <motion.div key="pag-viewer" className="relative w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClickCapture={handlePremiumClickCapture}>
                {currentPAGFiles.length === 0 ? (
                  <div className="flex flex-col lg:flex-row gap-8">
                    <div className="flex-1">
                      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative">
                        <DropZone 
                          acceptedExtension=".pag"
                          title="قم بسحب ملفات PAG هنا"
                          subtitle="أو انقر لاختيار ملفات من جهازك. يدعم العارض عرض عدة ملفات في نفس الوقت."
                          onFilesSelect={handlePAGFilesUpload} 
                        />
                      </div>
                    </div>
      
                    <div className="w-full lg:w-80">
                      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 h-[315px] flex flex-col">
                        <div className="flex items-center justify-between mb-6 shrink-0">
                           <div className="flex items-center gap-2 text-blue-400">
                            <History size={20} />
                            <h2 className="font-bold text-lg">سجل ملفات PAG</h2>
                          </div>
                        </div>
      
                        {history.filter(item => item.name.toLowerCase().endsWith('.pag')).length > 0 ? (
                          <div dir="ltr" className="flex-1 flex flex-col overflow-y-auto pl-1 history-scrollbar">
                            <div dir="rtl" className="flex flex-col gap-3">
                              {history.filter(item => item.name.toLowerCase().endsWith('.pag')).map((item, idx) => (
                                <div key={`${item.name}-${idx}`} className="relative group">
                                  <button
                                    onClick={() => handlePAGHistoryClick(item)}
                                    className="w-full flex items-center gap-3 p-3 rounded-full border border-transparent bg-slate-800/40 hover:border-slate-700 text-slate-300 transition-all text-right"
                                  >
                                    <div className="bg-slate-800 p-2 rounded-full shrink-0">
                                      <FolderUp size={16} className="text-blue-400" />
                                    </div>
                                    <div className="flex-1 min-w-0 text-right">
                                      <p className="text-sm font-medium truncate">{item.name}</p>
                                      <p className="text-[10px] text-slate-500">{formatSize(item.size)}</p>
                                    </div>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-10">
                            <History size={40} className="mb-4 opacity-20 shrink-0" />
                            <p className="text-xs">السجل فارغ</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-8">
                    <div className={`grid gap-8 ${currentPAGFiles.length === 1 ? 'grid-cols-1' : currentPAGFiles.length === 2 ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'}`}>
                      {currentPAGFiles.map((file, idx) => (
                        <div key={`${file.name}-${idx}`} className="flex flex-col gap-4">
                          <PAGViewer 
                            file={file} 
                            onClear={() => setCurrentPAGFiles(prev => prev.filter(f => f !== file))} 
                            originalFile={file.rawFile}
                          />
      
                          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-[10px] text-slate-500 mb-1 uppercase">اسم الملف</p>
                                <p className="text-xs font-bold truncate text-white" title={file.name}>{file.name}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-500 mb-1 uppercase">حجم البيانات</p>
                                <p className="text-xs font-bold text-white">{formatSize(file.size)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div key="viewer" className="relative w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClickCapture={handlePremiumClickCapture}>
                {currentFiles.length === 0 ? (
                  <div className="flex flex-col lg:flex-row gap-8">
                    <div className="flex-1">
                      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative">
                        <DropZone onFilesSelect={handleFilesUpload} />
                      </div>
                    </div>
      
                    <div className="w-full lg:w-80">
                      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 h-[315px] flex flex-col">
                        <div className="flex items-center justify-between mb-6 shrink-0">
                          <div className="flex items-center gap-2 text-blue-400">
                            <History size={20} />
                            <h2 className="font-bold text-lg">السجل</h2>
                          </div>
                        </div>
      
                        {history.filter(item => item.name.toLowerCase().endsWith('.svga')).length > 0 ? (
                          <div dir="ltr" className="flex-1 flex flex-col overflow-y-auto pl-1 history-scrollbar">
                            <div dir="rtl" className="flex flex-col gap-3">
                              {history.filter(item => item.name.toLowerCase().endsWith('.svga')).map((item, idx) => (
                                <div key={`${item.name}-${idx}`} className="relative group">
                                  <button
                                    onClick={() => handleHistoryClick(item)}
                                    className="w-full flex items-center gap-3 p-3 rounded-full border border-transparent bg-slate-800/40 hover:border-slate-700 text-slate-300 transition-all text-right"
                                  >
                                    <div className="bg-slate-800 p-2 rounded-full shrink-0">
                                      <FolderUp size={16} className="text-blue-400" />
                                    </div>
                                    <div className="flex-1 min-w-0 text-right">
                                      <p className="text-sm font-medium truncate">{item.name}</p>
                                      <p className="text-[10px] text-slate-500">{formatSize(item.size)}</p>
                                    </div>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-10">
                            <History size={40} className="mb-4 opacity-20 shrink-0" />
                            <p className="text-xs">السجل فارغ</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-8">
                    <div className={`grid gap-8 ${currentFiles.length === 1 ? 'grid-cols-1' : currentFiles.length === 2 ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'}`}>
                      {currentFiles.map((file, idx) => (
                        <div key={`${file.name}-${idx}`} className="flex flex-col gap-4">
                          <SVGAViewer 
                            file={file} 
                            onClear={() => setCurrentFiles(prev => prev.filter(f => f !== file))} 
                            originalFile={file.rawFile}
                          />
      
                          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-[10px] text-slate-500 mb-1 uppercase">اسم الملف</p>
                                <p className="text-xs font-bold truncate text-white" title={file.name}>{file.name}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-500 mb-1 uppercase">حجم البيانات</p>
                                <p className="text-xs font-bold text-white">{formatSize(file.size)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
  
        <SubscriptionModal isOpen={showSubModal} onClose={() => setShowSubModal(false)} mode={subModalMode} />
        <UnderDevelopmentModal
          isOpen={modalConfig.isOpen}
          onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
          featureName={modalConfig.featureName}
          type={modalConfig.type}
          title={modalConfig.title}
          description={modalConfig.description}
        />
  
        <footer className="py-8 text-center">
           <p className="text-xs text-slate-600 font-medium">تم التطوير بواسطة فليكس - Flex Studio Pro 2026</p>
        </footer>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
