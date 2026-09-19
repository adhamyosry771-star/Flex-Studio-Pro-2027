import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Clock, Layers, Download, Wrench, RefreshCw, ShieldCheck } from 'lucide-react';

export interface UnderDevelopmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
  type?: 'development' | 'maintenance';
  title?: string;
  description?: string;
}

export const UnderDevelopmentModal: React.FC<UnderDevelopmentModalProps> = ({
  isOpen,
  onClose,
  featureName = 'After Effects',
  type = 'development',
  title,
  description
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const isMaintenance = type === 'maintenance';
  const modalTitle = title || (isMaintenance ? 'هذه الميزة في الصيانة الآن' : 'هذه الميزة تحت التطوير حالياً');
  const modalDescription = description || (
    isMaintenance
      ? `نعمل حالياً على صيانة وتحديث أداة ${featureName} لتقديم أداء فائق وتوافقية أفضل. ستعود الميزة للعمل لجميع المشتركين قريباً!`
      : `نعمل حالياً على تطوير وتجهيز استوديو ${featureName} لتقديم تجربة تحريك وتعديل احترافية متكاملة. ستتاح الميزة لجميع المشتركين قريباً!`
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          id="under-dev-modal-wrapper"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 select-none"
          dir="rtl"
        >
          {/* Subtle Transparent Backdrop - Allows what's behind to be seen clearly */}
          <motion.div
            id="under-dev-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm cursor-pointer"
          />

          {/* Modal Container - Transparent Glass like SubscriptionModal */}
          <motion.div
            id="under-dev-modal-card"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-md w-full bg-slate-900/60 border border-slate-800/80 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl backdrop-blur-md overflow-hidden text-center"
          >
            {/* Close Button */}
            <button
              id="under-dev-modal-close-btn"
              type="button"
              onClick={onClose}
              aria-label="إغلاق النافذة"
              className="absolute top-6 left-6 text-slate-500 hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            {/* Clean Icon Container like SubscriptionModal */}
            <div className="w-14 h-14 bg-violet-600/10 rounded-2xl flex items-center justify-center text-violet-400 mx-auto mb-4 border border-violet-500/20">
              {isMaintenance ? <Wrench size={28} /> : <Clock size={28} />}
            </div>

            {/* Title */}
            <h2 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">
              {modalTitle}
            </h2>

            {/* Description */}
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6 font-normal">
              {modalDescription}
            </p>

            {/* Feature Highlights Grid */}
            <div className="space-y-2.5 mb-6 text-right">
              {isMaintenance ? (
                <>
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                    <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
                      <RefreshCw size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-white leading-snug">تحديث وتحسين المحرك</h4>
                      <p className="text-[11px] text-slate-400 leading-none mt-0.5">رفع كفاءة المعالجة وتقليل استهلاك موارد الجهاز</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                    <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
                      <ShieldCheck size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-white leading-snug">فحص استقرار التوافقية</h4>
                      <p className="text-[11px] text-slate-400 leading-none mt-0.5">ضمان التوافق الأفضل مع أنظمة التشغيل والمتصفحات</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                    <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
                      <Layers size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-white leading-snug">تحريك إطارات Keyframes متقدم</h4>
                      <p className="text-[11px] text-slate-400 leading-none mt-0.5">تحكم احترافي بالمسارات ونقاط الارتكاز والشفافية</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                    <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
                      <Download size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-white leading-snug">تصدير مباشر متكامل</h4>
                      <p className="text-[11px] text-slate-400 leading-none mt-0.5">تصدير متوافق مع كافة صيغ المنصة</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Action Button */}
            <button
              id="under-dev-modal-confirm-btn"
              type="button"
              onClick={onClose}
              className="w-full py-3 px-6 rounded-2xl font-bold text-xs sm:text-sm text-violet-300 hover:text-violet-200 bg-violet-600/10 hover:bg-violet-600/20 border border-violet-500/20 hover:border-violet-500/35 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>حسناً، فهمت ذلك</span>
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
