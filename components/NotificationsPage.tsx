
import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

interface NotificationItemProps {
  id: string;
  icon: string;
  title: string;
  desc: string;
  time: string;
  image?: string;
  isOfficial?: boolean;
  type?: string;
  senderUid?: string;
  senderName?: string;
  onRefresh?: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ id, icon, title, desc, time, image, isOfficial, type, senderUid, senderName }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const currentUser = auth.currentUser;
  
  const isMediaIcon = icon && (icon.startsWith('http') || icon.startsWith('data:'));
  
  const isVideo = (url: string) => {
    return url.match(/\.(mp4|webm|ogg|mov)$/) !== null || url.includes('video');
  };

  const handleCPAction = async (action: 'accept' | 'reject') => {
    if (!currentUser || isProcessing) return;
    setIsProcessing(true);
    try {
      if (action === 'accept') {
        // Link both users
        await updateDoc(doc(db, "users", currentUser.uid), { partnerUid: senderUid });
        await updateDoc(doc(db, "users", senderUid!), { partnerUid: currentUser.uid });
        
        // Notify sender
        await updateDoc(doc(db, "users", senderUid!), {
          lastNotification: `وافق ${currentUser.displayName} على طلب الارتباط!`
        });

        alert("مبروك! تم الارتباط بنجاح.");
      } else {
        // Refund 50,000,000 coins to sender
        await updateDoc(doc(db, "users", senderUid!), {
          coins: increment(50000000)
        });
        
        alert("تم رفض الطلب وإعادة الكوينز للمرسل.");
      }
      
      // Delete request notification
      await deleteDoc(doc(db, "users", currentUser.uid, "systemNotifications", id));
    } catch (e) {
      alert("خطأ في معالجة الطلب");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/5 rounded-[2.2rem] overflow-hidden flex flex-col hover:bg-white/10 transition-all animate-in fade-in group h-auto">
      {image && (
        <div className="w-full h-40 overflow-hidden relative">
          <img src={image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a0b2e]/60 to-transparent"></div>
        </div>
      )}
      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 overflow-hidden shadow-lg ${isOfficial ? 'bg-purple-600/20 text-purple-400' : 'bg-blue-600/20 text-blue-400'} border border-white/5`}>
            {isMediaIcon ? (
              isVideo(icon) ? (
                <video src={icon} autoPlay loop muted playsInline className="w-full h-full object-cover" />
              ) : (
                <img src={icon} className="w-full h-full object-cover" alt="Icon" />
              )
            ) : (
              <i className={`fas ${icon}`}></i>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-[14px] font-black text-white truncate pr-2">{title}</h4>
              <span className="text-[8px] font-black text-white/20 uppercase tracking-tighter flex-shrink-0">{time}</span>
            </div>
            <p className="text-[12px] text-white/50 leading-relaxed font-medium whitespace-pre-wrap break-words">
              {desc}
            </p>
          </div>
        </div>

        {type === 'cp_request' && (
          <div className="flex gap-3 mt-2 animate-in slide-in-from-bottom-1">
            <button 
              onClick={() => handleCPAction('accept')} 
              disabled={isProcessing}
              className="flex-1 bg-rose-600 py-3 rounded-xl text-[11px] font-black text-white shadow-lg active:scale-95 transition-all border border-rose-500/20"
            >
              {isProcessing ? <i className="fas fa-spinner animate-spin"></i> : 'موافقه'}
            </button>
            <button 
              onClick={() => handleCPAction('reject')} 
              disabled={isProcessing}
              className="flex-1 bg-white/5 py-3 rounded-xl text-[11px] font-black text-white border border-white/10 active:scale-95 transition-all"
            >
              {isProcessing ? <i className="fas fa-spinner animate-spin"></i> : 'رفض'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

interface NotificationsPageProps {
  onBack: () => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'official' | 'system'>('official');
  const [officialMsgs, setOfficialMsgs] = useState<any[]>([]);
  const [systemMsgs, setSystemMsgs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentUser = auth.currentUser;

  useEffect(() => {
    // جلب الرسائل الرسمية العامة
    const officialQ = query(collection(db, "officialNotifications"), orderBy("createdAt", "desc"));
    const unsubOfficial = onSnapshot(officialQ, (snap) => {
      setOfficialMsgs(snap.docs.map(doc => {
        const data = doc.data();
        let timeStr = 'الآن';
        if (data.createdAt) {
          const date = data.createdAt.toDate();
          timeStr = date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' });
        }
        return { id: doc.id, ...data, time: timeStr };
      }));
      setIsLoading(false);
    });

    // جلب رسائل النظام الخاصة بالمستخدم
    let unsubSystem: any;
    if (currentUser) {
      const systemQ = query(collection(db, "users", currentUser.uid, "systemNotifications"), orderBy("createdAt", "desc"));
      unsubSystem = onSnapshot(systemQ, (snap) => {
        setSystemMsgs(snap.docs.map(doc => {
          const data = doc.data();
          let timeStr = 'الآن';
          if (data.createdAt) {
            const date = data.createdAt.toDate();
            timeStr = date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
          }
          return { id: doc.id, ...data, time: timeStr };
        }));
      });
    }

    return () => {
      unsubOfficial();
      if (unsubSystem) unsubSystem();
    };
  }, [currentUser]);

  return (
    <div className="flex-1 flex flex-col bg-[#1a0b2e] overflow-hidden">
      <header className="px-5 py-4 flex items-center gap-4 bg-[#1a0b2e]/90 backdrop-blur-md sticky top-0 z-20 border-b border-white/5">
        <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white active:scale-90 transition-all">
          <i className="fas fa-arrow-right"></i>
        </button>
        <h2 className="text-xl font-black text-white tracking-tight">التنبيهات</h2>
      </header>

      <div className="px-5 py-6">
        <div className="bg-white/5 p-1.5 rounded-[1.8rem] flex items-center border border-white/5">
          <button 
            onClick={() => setActiveTab('official')}
            className={`flex-1 py-3.5 rounded-[1.4rem] text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'official' ? 'bg-purple-600 text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
          >
            <i className="fas fa-crown text-[10px]"></i>
            الرسائل الرسمية
          </button>
          <button 
            onClick={() => setActiveTab('system')}
            className={`flex-1 py-3.5 rounded-[1.4rem] text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'system' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
          >
            <i className="fas fa-microchip text-[10px]"></i>
            رسائل النظام
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-5 pb-10 space-y-5 scrollbar-hide">
        {isLoading ? (
          <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div></div>
        ) : activeTab === 'official' ? (
          officialMsgs.length > 0 ? (
            officialMsgs.map((msg) => (
              <NotificationItem key={msg.id} {...msg} isOfficial />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 opacity-20">
              <i className="fas fa-bell-slash text-5xl mb-4"></i>
              <p className="text-xs font-black uppercase tracking-widest">لا توجد رسائل رسمية</p>
            </div>
          )
        ) : (
          systemMsgs.length > 0 ? (
            systemMsgs.map((msg) => (
              <NotificationItem key={msg.id} {...msg} />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 opacity-20">
              <i className="fas fa-robot text-5xl mb-4"></i>
              <p className="text-xs font-black uppercase tracking-widest">لا توجد رسائل نظام</p>
            </div>
          )
        )}
      </main>
    </div>
  );
};
