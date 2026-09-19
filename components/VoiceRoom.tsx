
import React, { useState, useEffect, useRef } from 'react';
import { Room, Gift, ChatMessage } from '../types';
import { GIFTS as STATIC_GIFTS } from '../constants';
import { auth, db } from '../firebase';
import { doc, onSnapshot, updateDoc, getDocs, collection, query, where, orderBy, addDoc, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { normalizeDecoratedText } from '../utils';

interface VoiceRoomProps {
  room: Room & { roomBackground?: string; roomIdDisplay?: string; description?: string; micCount?: number };
  onLeave: () => void;
  onMinimize: () => void;
  onOpenWallet?: () => void;
  micStates: any[];
  setMicStates: React.Dispatch<React.SetStateAction<any[]>>;
  isMicMuted: boolean;
  setIsMicMuted: React.Dispatch<React.SetStateAction<boolean>>;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

interface UserOnMic {
  uid: string;
  displayName: string;
  photoURL: string;
  customId?: string;
  currentFrame?: string | null;
  animatedAvatar?: string | null;
}

type GiftTab = 'normal' | 'cp' | 'famous' | 'country' | 'vip' | 'birthday';
type SelectionMode = 'manual' | 'all-room' | 'all-mic';

export const VoiceRoom: React.FC<VoiceRoomProps> = ({ 
  room: initialRoom, onLeave, onMinimize, onOpenWallet, 
  micStates, setMicStates, isMicMuted, setIsMicMuted,
  messages, setMessages
}) => {
  const [currentRoom, setCurrentRoom] = useState(initialRoom);
  const [inputText, setInputText] = useState('');
  const [showGifts, setShowGifts] = useState(false);
  const [showEmojiMenu, setShowEmojiMenu] = useState(false);
  const [showExtraMenu, setShowExtraMenu] = useState(false); 
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showUserData, setShowUserData] = useState(false); 
  const [showRoomSettings, setShowRoomSettings] = useState(false);
  const [isRoomMuted, setIsRoomMuted] = useState(false); 
  const [showJoinMessage, setShowJoinMessage] = useState(false);
  const [showJoinVideo, setShowJoinVideo] = useState(false);
  
  // وقت الدخول لفلترة الرسائل القديمة
  const [joinTime] = useState(Timestamp.now());

  // نظام تأثير الهدية المطور
  const [activeGiftEffect, setActiveGiftEffect] = useState<{url: string, id: number} | null>(null);
  const [isGiftMinimized, setIsGiftMinimized] = useState(false);
  const [giftPos, setGiftPos] = useState({ x: 20, y: 150 });
  const isDraggingGift = useRef(false);
  const dragGiftOffset = useRef({ x: 0, y: 0 });
  const giftMoveThreshold = useRef(false);

  const [isEffectsEnabled, setIsEffectsEnabled] = useState(() => {
    return localStorage.getItem('effects_enabled') !== 'false';
  });

  const [isEntryMinimized, setIsEntryMinimized] = useState(false);
  const [entryPos, setEntryPos] = useState({ x: 20, y: 100 });
  const isDraggingEntry = useRef(false);
  const dragEntryOffset = useRef({ x: 0, y: 0 });
  const entryMoveThreshold = useRef(false);

  const [selectedMicIndex, setSelectedMicIndex] = useState<number | null>(null);
  const [showMicActions, setShowMicActions] = useState(false);
  
  const [giftTab, setGiftTab] = useState<GiftTab>('normal');
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null); 
  const [ownerData, setOwnerData] = useState<any>(null);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [userDataPopupBadges, setUserDataPopupBadges] = useState<any[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [selectionMode, setSelectionMode] = useState<SelectionMode>('manual');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [showSelectionMenu, setShowSelectionMenu] = useState(false);

  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [showQuantityMenu, setShowQuantityMenu] = useState(false);
  const quantities = [1, 7, 38, 66, 188, 520, 1314];

  const [designSettings, setDesignSettings] = useState<any>(null);
  const [dynamicEmojis, setDynamicEmojis] = useState<any[]>([]);
  const [dynamicGifts, setDynamicGifts] = useState<Gift[]>([]);

  const [editRoomTitle, setEditRoomTitle] = useState(currentRoom.title);
  const [editRoomDescription, setEditRoomDescription] = useState(currentRoom.description || '');
  const [editRoomCover, setEditRoomCover] = useState(currentRoom.coverImage);
  const [editRoomBg, setEditRoomBg] = useState(currentRoom.roomBackground || '');
  const [editMicCount, setEditMicCount] = useState(currentRoom.micCount || 10);
  const [availableBgs, setAvailableBgs] = useState<any[]>([]);
  const [isUpdatingRoom, setIsUpdatingRoom] = useState(false);
  const [showBgSelector, setShowBgSelector] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const user = auth.currentUser;
  const isRoomOwner = user?.uid === currentRoom.owner?.uid;

  const isVideoUrl = (url?: string) => {
    if (!url) return false;
    return url.match(/\.(mp4|webm|ogg|mov)$/) !== null || url.includes('video');
  };

  // مستمع للرسائل الحية مع فلترة للرسائل القديمة
  useEffect(() => {
    const q = query(
      collection(db, "rooms", currentRoom.id, "chat"),
      where("createdAt", ">", joinTime),
      orderBy("createdAt", "asc")
    );
    
    const unsub = onSnapshot(q, (snap) => {
      const liveMsgs = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      setMessages(liveMsgs);
    });
    
    return () => unsub();
  }, [currentRoom.id, joinTime]);

  useEffect(() => {
    localStorage.setItem('effects_enabled', isEffectsEnabled.toString());
  }, [isEffectsEnabled]);

  useEffect(() => {
    setShowJoinMessage(true);
    if (currentUserData?.currentEntry && isEffectsEnabled) {
      setShowJoinVideo(true);
      setIsEntryMinimized(false); 
    }
    const msgTimer = setTimeout(() => {
      setShowJoinMessage(false);
    }, 4000);
    return () => clearTimeout(msgTimer);
  }, [currentUserData?.currentEntry]); 

  const handleEntryPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isEntryMinimized) return;
    isDraggingEntry.current = true;
    entryMoveThreshold.current = false;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragEntryOffset.current = { x: clientX - entryPos.x, y: clientY - entryPos.y };
  };

  const handleGiftPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isGiftMinimized) return;
    isDraggingGift.current = true;
    giftMoveThreshold.current = false;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragGiftOffset.current = { x: clientX - giftPos.x, y: clientY - giftPos.y };
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;

      if (isDraggingEntry.current) {
        entryMoveThreshold.current = true;
        const nextX = Math.min(Math.max(10, clientX - dragEntryOffset.current.x), window.innerWidth - 130);
        const nextY = Math.min(Math.max(10, clientY - dragEntryOffset.current.y), window.innerHeight - 230);
        setEntryPos({ x: nextX, y: nextY });
      }

      if (isDraggingGift.current) {
        giftMoveThreshold.current = true;
        const nextX = Math.min(Math.max(10, clientX - dragGiftOffset.current.x), window.innerWidth - 130);
        const nextY = Math.min(Math.max(10, clientY - dragGiftOffset.current.y), window.innerHeight - 230);
        setGiftPos({ x: nextX, y: nextY });
      }
    };

    const handleUp = () => { 
      isDraggingEntry.current = false; 
      isDraggingGift.current = false;
    };

    window.addEventListener('mousemove', handleMove, { passive: false });
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [entryPos, giftPos]);

  const toggleEntryMode = () => {
    if (entryMoveThreshold.current) return;
    setIsEntryMinimized(!isEntryMinimized);
  };

  const toggleGiftMode = () => {
    if (giftMoveThreshold.current) return;
    setIsGiftMinimized(!isGiftMinimized);
  };

  useEffect(() => {
    const unsubRoom = onSnapshot(doc(db, "rooms", currentRoom.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as any;
        setCurrentRoom(prev => ({ ...prev, ...data }));
        if (!showRoomSettings) {
          setEditRoomTitle(data.title);
          setEditRoomDescription(data.description || '');
          setEditRoomCover(data.coverImage);
          setEditRoomBg(data.roomBackground || '');
          setEditMicCount(data.micCount || 10);
        }
      }
    });
    return () => unsubRoom();
  }, [currentRoom.id, showRoomSettings]);

  useEffect(() => {
    if (currentRoom.owner?.uid) {
      const unsub = onSnapshot(doc(db, "users", currentRoom.owner.uid), (docSnap) => {
        if (docSnap.exists()) setOwnerData(docSnap.data());
      });
      return unsub;
    }
  }, [currentRoom.owner?.uid]);

  useEffect(() => {
    if (user) {
      const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
        if (docSnap.exists()) setCurrentUserData(docSnap.data());
      });
      return unsub;
    }
  }, [user]);

  useEffect(() => {
    let unsub: any;
    if (showUserData && user) {
      const q = query(collection(db, "users", user.uid, "badges"), orderBy("createdAt", "desc"));
      unsub = onSnapshot(q, (snap) => {
        setUserDataPopupBadges(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
    }
    return () => { if (unsub) unsub(); };
  }, [showUserData, user]);

  useEffect(() => {
    const unsubDesign = onSnapshot(doc(db, "settings", "design"), (docSnap) => {
      if (docSnap.exists()) setDesignSettings(docSnap.data());
    });
    const unsubEmojis = onSnapshot(query(collection(db, "emojis"), orderBy("createdAt", "desc")), (snap) => {
      setDynamicEmojis(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubGifts = onSnapshot(query(collection(db, "gifts"), orderBy("createdAt", "desc")), (snap) => {
      if (snap.empty) {
        setDynamicGifts(STATIC_GIFTS as any);
      } else {
        setDynamicGifts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
      }
    });
    return () => {
      unsubDesign(); unsubEmojis(); unsubGifts();
    };
  }, []);

  useEffect(() => {
    if (showRoomSettings) {
      const fetchAllBgs = async () => {
        const publicSnapshot = await getDocs(collection(db, "roomBackgrounds"));
        const publicBgs = publicSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        let ownedBgs: any[] = [];
        if (user) {
          const inventorySnapshot = await getDocs(query(collection(db, "users", user.uid, "inventory"), where("type", "==", "background"), where("isEquipped", "==", true)));
          const now = new Date();
          ownedBgs = inventorySnapshot.docs.map(doc => {
            const data = doc.data();
            let remainingDays = 0;
            if (data.expiresAt) {
              const exp = data.expiresAt.toDate();
              const diff = exp.getTime() - now.getTime();
              remainingDays = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
            }
            return { id: doc.id, imageUrl: data.imageUrl || data.videoUrl, videoUrl: data.videoUrl || null, name: data.name, isOwned: true, remainingDays };
          });
        }
        const combined = [...publicBgs];
        ownedBgs.forEach(obg => { if (!combined.some(c => c.imageUrl === obg.imageUrl)) combined.push(obg); });
        setAvailableBgs(combined);
      };
      fetchAllBgs();
    }
  }, [showRoomSettings, user]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (inputText === '') return; 
    
    try {
      await addDoc(collection(db, "rooms", currentRoom.id, "chat"), {
        userId: user?.uid || 'anonymous',
        userName: currentUserData?.displayName || 'مستخدم',
        text: inputText,
        type: 'text',
        createdAt: serverTimestamp()
      });
      setInputText('');
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const handleSendGift = async () => {
    if (!selectedGiftId) return alert("يرجى اختيار هدية أولاً");
    if (selectedUserIds.size === 0) return alert("يرجى اختيار شخص واحد على الأقل لإرسال الهدية");
    
    const gift = dynamicGifts.find(g => g.id === selectedGiftId);
    if (!gift) return;

    const totalRecipients = selectedUserIds.size;
    const giftValue = gift.price * selectedQuantity;
    const totalCost = giftValue * totalRecipients;

    if ((currentUserData?.coins || 0) < totalCost) {
      return alert("رصيدك غير كافٍ لإرسال الهدية");
    }

    try {
      await updateDoc(doc(db, "users", user!.uid), {
        coins: currentUserData.coins - totalCost
      });

      setMicStates(prev => prev.map(mic => {
        if (mic?.user && selectedUserIds.has(mic.user.uid)) {
          return {
            ...mic,
            receivedCoins: (mic.receivedCoins || 0) + giftValue
          };
        }
        return mic;
      }));

      const recipientNames = Array.from(selectedUserIds).map(uid => {
        const p = allPresentUsers.find(u => u.uid === uid);
        return p?.displayName || "مستخدم";
      }).join('، ');

      const giftMsg = {
        userId: user!.uid,
        userName: currentUserData?.displayName || 'أنا',
        text: `أرسل ${selectedQuantity} ${gift.name} إلى ${recipientNames}`, 
        type: 'gift',
        giftName: gift.name,
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, "rooms", currentRoom.id, "chat"), giftMsg);

      if (isEffectsEnabled && gift.animation) {
        setIsGiftMinimized(false); 
        setActiveGiftEffect({ url: gift.animation, id: Date.now() });
      }

      setShowGifts(false);
      setSelectedUserIds(new Set());
      setSelectedGiftId(null);
      setSelectedQuantity(1);

    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء إرسال الهدية");
    }
  };

  const sendGifEmoji = (url: string) => {
    const myMicIndex = micStates.findIndex(m => m?.user?.uid === user?.uid);
    if (myMicIndex !== -1) {
      const timestampedUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
      const newMicStates = [...micStates];
      newMicStates[myMicIndex] = { ...newMicStates[myMicIndex], activeEmoji: timestampedUrl };
      setMicStates(newMicStates);
      setTimeout(() => {
        setMicStates(prev => {
          const updated = [...prev];
          if (updated[myMicIndex]) updated[myMicIndex] = { ...updated[myMicIndex], activeEmoji: null };
          return updated;
        });
      }, 2500);
    }
    setShowEmojiMenu(false);
  };

  const handleUpdateRoomSettings = async () => {
    if (!editRoomTitle.trim()) return alert("يرجى إدخل اسم للغرفة");
    setIsUpdatingRoom(true);
    try {
      await updateDoc(doc(db, "rooms", currentRoom.id), { title: editRoomTitle, description: editRoomDescription, coverImage: editRoomCover, roomBackground: editRoomBg, micCount: editMicCount });
      setShowRoomSettings(false);
    } catch (err) { alert("حدث خطأ أثناء التحديث"); } finally { setIsUpdatingRoom(false); }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setEditRoomCover(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const toggleUserSelection = (uid: string) => {
    if (selectionMode !== 'manual') return; 
    const newSelected = new Set(selectedUserIds);
    if (newSelected.has(uid)) newSelected.delete(uid); else newSelected.add(uid);
    setSelectedUserIds(newSelected);
  };

  const handleSelectionMode = (mode: SelectionMode) => {
    setSelectionMode(mode);
    setShowSelectionMenu(false);
    if (mode === 'all-room') {
      const allIds = allPresentUsers.map(u => u.uid).filter(Boolean);
      setSelectedUserIds(new Set(allIds));
    } else if (mode === 'all-mic') {
      const micIds = usersOnMics.map(u => u.uid).filter(Boolean);
      setSelectedUserIds(new Set(micIds));
    } else { setSelectedUserIds(new Set()); }
  };

  const handleMicClick = (index: number) => {
    if (!isRoomOwner && micStates[index]?.user?.uid !== user?.uid) {
      if (micStates[index]?.status === 'open' && !micStates[index]?.user) takeMic(index);
      return;
    }
    setSelectedMicIndex(index); setShowMicActions(true);
  };

  const takeMic = (index: number) => {
    const newMicStates = [...micStates];
    newMicStates.forEach(m => { if (m?.user?.uid === user?.uid) { m.user = null; m.receivedCoins = 0; } });
    newMicStates[index] = { 
      ...newMicStates[index], 
      user: currentUserData || { uid: user?.uid, photoURL: user?.photoURL, displayName: user?.displayName, customId: currentUserData?.customId || user?.uid.substring(0,8), currentFrame: currentUserData?.currentFrame || null, animatedAvatar: currentUserData?.animatedAvatar || null }, 
      status: 'occupied',
      receivedCoins: 0 
    };
    setMicStates(newMicStates); setIsMicMuted(false); setShowMicActions(false);
  };

  const toggleLockMic = (index: number) => {
    const newMicStates = [...micStates];
    const currentStatus = newMicStates[index]?.status;
    newMicStates[index] = { ...newMicStates[index], status: currentStatus === 'locked' ? 'open' : 'locked', user: null, receivedCoins: 0 };
    setMicStates(newMicStates); setShowMicActions(false);
  };

  const leaveMic = (index: number) => {
    const newMicStates = [...micStates];
    newMicStates[index] = { ...newMicStates[index], user: null, status: 'open', receivedCoins: 0 }; 
    setMicStates(newMicStates); setIsMicMuted(true); setShowMicActions(false);
  };

  const allPresentUsers: any[] = [];
  if (currentUserData || user) allPresentUsers.push(currentUserData || { uid: user?.uid, displayName: user?.displayName, photoURL: user?.photoURL, customId: user?.uid.substring(0,8), animatedAvatar: currentUserData?.animatedAvatar || null });
  micStates.forEach(mic => { if (mic?.user && !allPresentUsers.find(p => p.uid === mic.user.uid)) allPresentUsers.push(mic.user); });

  const usersOnMics: UserOnMic[] = micStates.map(mic => mic?.user).filter((u): u is UserOnMic => u !== null && u !== undefined);
  const displayId = ownerData?.customId || currentRoom.roomIdDisplay || currentRoom.owner?.customId || currentRoom.id.substring(0,6);
  const userIsOnMic = micStates.some(m => m?.user?.uid === user?.uid);
  const profileCustomId = currentUserData?.customId || user?.uid.substring(0, 8);
  const profileCustomIdIcon = currentUserData?.customIdIcon;
  const pIdX = currentUserData?.idOffsetX ?? 28;
  const pIdY = currentUserData?.idOffsetY ?? 0.5;
  const ownerCustomIdIcon = ownerData?.customIdIcon;
  const idX = ownerData?.idOffsetX ?? 28;
  const idY = ownerData?.idOffsetY ?? 0.5;
  const activeMicCount = currentRoom.micCount || 10;
  const displayedMics = micStates.slice(0, activeMicCount);
  const micSizeClass = activeMicCount === 15 ? 'w-[51px] h-[51px] sm:w-[57px] sm:h-[57px]' : activeMicCount === 10 ? 'w-[53px] h-[53px] sm:w-[63px] sm:h-[63px]' : 'w-[60px] h-[60px] sm:w-[70px] sm:h-[70px]';
  const micGapClass = activeMicCount === 15 ? 'gap-y-4 gap-x-1 py-3' : 'gap-y-6 gap-x-1 py-6';
  const nameContainerWidth = activeMicCount === 15 ? 'w-[48px]' : 'w-[52px]';
  const nameTextSize = activeMicCount === 15 ? 'text-[9px]' : 'text-[9.5px]';
  const roomTitle = currentRoom.title || 'الغرفة';
  const roomBg = currentRoom.roomBackground || currentRoom.coverImage;
  const filteredGifts = dynamicGifts.filter(g => (g as any).tab === giftTab || (! (g as any).tab && giftTab === 'normal'));

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col overflow-hidden w-full h-full animate-in fade-in duration-300" dir="rtl">
      
      {/* عرض تأثير الهدية المطور */}
      {activeGiftEffect && (
        <div 
          key={activeGiftEffect.id} 
          onMouseDown={isGiftMinimized ? handleGiftPointerDown : undefined}
          onTouchStart={isGiftMinimized ? handleGiftPointerDown : undefined}
          onClick={toggleGiftMode}
          className={`fixed z-[9998] transition-transform duration-500 ease-out cursor-pointer pointer-events-auto flex items-center justify-center ${isGiftMinimized ? 'w-[120px] h-[200px] rounded-3xl border border-white/20 bg-black/30 shadow-2xl overflow-hidden backdrop-blur-sm animate-in slide-in-from-right touch-none' : 'inset-0 bg-transparent animate-in fade-in'}`}
          style={isGiftMinimized ? { transform: `translate(${giftPos.x}px, ${giftPos.y}px)`, top: 0, left: 0 } : {}}
        >
           <div className={`w-full h-full relative flex items-center justify-center ${isGiftMinimized ? 'after:absolute after:inset-0 after:bg-gradient-to-t after:from-black/20 after:to-transparent pointer-events-none' : ''}`}>
             {isVideoUrl(activeGiftEffect.url) ? (
               <video src={activeGiftEffect.url} autoPlay playsInline onEnded={() => setActiveGiftEffect(null)} className="w-full h-full object-cover bg-transparent" />
             ) : (
               <img 
                 src={activeGiftEffect.url} 
                 className={`transition-all duration-300 ${isGiftMinimized ? 'w-full h-full object-cover' : 'max-w-[60%] max-h-[40%] object-contain'}`} 
                 onLoad={() => {
                    if (!isGiftMinimized) {
                      setTimeout(() => {
                        setActiveGiftEffect(null);
                      }, 5500);
                    }
                 }} 
                 alt="Gift Effect" 
               />
             )}
             {isGiftMinimized && (
               <div className="absolute top-2 right-2"><div className="w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-[10px] text-white backdrop-blur-sm border border-white/10"><i className="fas fa-expand"></i></div></div>
             )}
           </div>
        </div>
      )}

      {showJoinVideo && currentUserData?.currentEntry && (
        <div 
          className={`fixed z-[9999] transition-transform duration-300 ease-out shadow-2xl overflow-hidden cursor-pointer touch-none ${isEntryMinimized ? 'w-[120px] h-[200px] rounded-3xl border border-white/20 bg-black/40' : 'inset-0 bg-black'}`} 
          style={isEntryMinimized ? { transform: `translate(${entryPos.x}px, ${entryPos.y}px)`, top: 0, left: 0 } : {}} 
          onMouseDown={handleEntryPointerDown} 
          onTouchStart={handleEntryPointerDown} 
          onClick={toggleEntryMode}
        >
          <video src={currentUserData.currentEntry} autoPlay playsInline onEnded={() => setShowJoinVideo(false)} className="w-full h-full object-cover pointer-events-none" />
          {isEntryMinimized && (
            <div className="absolute top-2 right-2"><div className="w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-[10px] text-white backdrop-blur-sm border border-white/10"><i className="fas fa-expand"></i></div></div>
          )}
        </div>
      )}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {isVideoUrl(roomBg) ? <video src={roomBg} autoPlay loop muted playsInline className="w-full h-full object-cover opacity-80" /> : <img src={roomBg} className="w-full h-full object-cover opacity-80" alt="" />}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90"></div>
      </div>
      <div className="relative z-10 flex flex-col h-full w-full max-w-md mx-auto font-['Cairo']">
        <div className="p-4 flex items-center justify-between overflow-visible">
          <div className="flex items-center">
            <div className="flex items-center gap-2.5 bg-black/60 border-y border-l border-white/10 rounded-l-full rounded-r-none pr-1.5 pl-6 py-1 shadow-2xl relative -mr-4 min-w-[140px] max-w-[220px] transition-all duration-300">
              <div className="w-11 h-11 rounded-lg overflow-hidden border border-white/10 shadow-lg flex-shrink-0">
                <img src={currentRoom.coverImage} className="w-full h-full object-cover" alt="Room" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <h2 className="font-black text-[12px] text-white leading-tight break-words">{roomTitle}</h2>
                {ownerCustomIdIcon ? (
                  <div className="relative w-[70px] h-[22px] flex items-center bg-contain bg-center bg-no-repeat mt-0.5 flex-shrink-0" style={{ backgroundImage: `url(${ownerCustomIdIcon})` }}><span className="text-[7px] font-black text-white tracking-widest text-center w-full block drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" style={{ paddingLeft: `${(idX * 70) / 90}px`, paddingTop: `${(idY * 22) / 28}px` }}>{displayId}</span></div>
                ) : <span className={`text-[8px] font-black tracking-tighter ${displayId === 'OFFICIAL' ? 'text-blue-400' : 'text-white/40'}`}>ID: {displayId}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowParticipants(true)} className="h-8 px-3 rounded-full bg-black/60 border border-white/10 flex items-center gap-1.5 active:scale-95 transition-all shadow-lg">
              <i className="fas fa-users text-white text-[10px]"></i>
              <span className="text-[10px] font-black text-white">{currentRoom.participantsCount}</span>
            </button>
            <button onClick={() => setShowExitDialog(true)} className="w-8 h-8 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-white active:scale-95 shadow-lg">
              <i className="fas fa-ellipsis-h text-xs"></i>
            </button>
          </div>
        </div>
        <div className={`grid grid-cols-5 px-2 transition-all duration-500 ${micGapClass}`}>
          {displayedMics.map((mic, i) => {
            const displayName = mic?.user ? normalizeDecoratedText(mic.user.displayName) : (i + 1).toString();
            const isLongName = displayName.length > 7;
            const coins = mic?.receivedCoins || 0;
            
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <button onClick={() => handleMicClick(i)} className={`${micSizeClass} flex items-center justify-center relative transition-all duration-300 active:scale-90`}>
                  {mic?.user ? (
                    <div className="w-full h-full relative flex items-center justify-center animate-in zoom-in duration-200">
                      <div className="w-full h-full rounded-full overflow-hidden border border-white/10 bg-black/20 relative z-10 shadow-lg">
                        {mic.user.animatedAvatar ? (
                          isVideoUrl(mic.user.animatedAvatar) ? (
                            <video src={mic.user.animatedAvatar} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                          ) : (
                            <img src={mic.user.animatedAvatar} className="w-full h-full object-cover" alt={mic.user.displayName} />
                          )
                        ) : (
                          <img src={mic.user.photoURL || "https://picsum.photos/100"} className="w-full h-full object-cover" alt={mic.user.displayName} />
                        )}
                      </div>
                      {mic.user.currentFrame && <img src={mic.user.currentFrame} className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20 scale-125" alt="frame" />}
                      {mic.user.uid === user?.uid && !isMicMuted && <div className="absolute inset-0 z-0 pointer-events-none"><div className="w-full h-full rounded-full border-[3px] border-purple-400 animate-ping opacity-40"></div></div>}
                      {mic.activeEmoji && <div className="absolute inset-[-10%] z-50 flex items-center justify-center pointer-events-none animate-in zoom-in duration-300"><img src={mic.activeEmoji} className="w-full h-full object-contain" alt="reaction" /></div>}
                    </div>
                  ) : <div className="w-full h-full flex items-center justify-center animate-in fade-in duration-200">{mic?.status === 'locked' ? (designSettings?.micLockedIcon ? <img src={designSettings.micLockedIcon} className="w-full h-full object-contain" alt="locked" /> : <i className={`fas fa-lock text-white/20 ${activeMicCount === 15 ? 'text-sm' : 'text-xl'}`}></i>) : (designSettings?.micOpenIcon ? <img src={designSettings.micOpenIcon} className="w-full h-full object-contain" alt="open" /> : <i className={`fas fa-microphone text-white/20 ${activeMicCount === 15 ? 'text-lg' : 'text-2xl'}`}></i>)}</div>}
                </button>
                
                <div className="flex flex-col items-center gap-0.5">
                  <div className={`${nameContainerWidth} h-4 px-1.5 py-0.5 rounded-full backdrop-blur-sm border shadow-sm flex justify-center items-center overflow-hidden relative ${mic?.user ? 'bg-black/40 border-white/10' : 'bg-black/20 border-white/5'}`}>
                    {isLongName ? (
                      <div className="flex animate-marquee-infinite">
                        <span className={`font-black text-white/90 whitespace-nowrap px-4 ${nameTextSize}`}>{displayName}</span>
                        <span className={`font-black text-white/90 whitespace-nowrap px-4 ${nameTextSize}`}>{displayName}</span>
                      </div>
                    ) : (
                      <span className={`font-black text-white/90 text-center ${nameTextSize}`}>{displayName}</span>
                    )}
                  </div>
                  
                  {mic?.user && (
                    <div className={`min-w-[28px] max-w-[48px] w-fit h-3.5 bg-black/40 backdrop-blur-md rounded-full border border-yellow-500/20 flex items-center justify-center gap-1 px-1.5 shadow-inner animate-in slide-in-from-top-1 duration-300`}>
                      <i className="fas fa-gift text-[6px] text-yellow-500"></i>
                      <span className="text-[7.5px] font-black text-yellow-400 tracking-tighter whitespace-nowrap overflow-hidden">
                        {coins > 999999 ? `${(coins/1000000).toFixed(1)}M` : coins.toLocaleString('ar-EG')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide relative">
          <div className="flex flex-col gap-2 w-full animate-in fade-in duration-500">
            <div className="bg-black/40 rounded-lg p-2 px-3 relative overflow-hidden flex items-center justify-start min-h-[32px] max-w-[85%]"><p className="text-[9px] font-black text-white/80 leading-tight tracking-wide text-right">مرحبا بك في يلا جيمز برجاء الالتزام بقواعد التطبيق والدردشه بشكل لائق يليق بالمجتمع في حال المخالفه سيتم حظر الحساب</p></div>
            {currentRoom.description && <div className="bg-black/50 rounded-lg p-2.5 px-4 relative overflow-hidden flex flex-col items-start justify-center min-h-[32px] w-fit max-w-[85%]"><span className="text-[7px] font-black text-white/40 mb-1 uppercase tracking-tighter">إشعار الغرفة</span><p className="text-[10px] font-black text-yellow-400 leading-normal tracking-wide text-right whitespace-pre-wrap break-words w-full">{currentRoom.description}</p></div>}
          </div>
          {messages.map(msg => (
            <div key={msg.id} className="flex flex-col items-start gap-1 animate-in slide-in-from-right duration-300">
              <span className="font-black text-[10px] text-purple-300/80 mr-2">{msg.userId === user?.uid || msg.userId === 'me' ? 'أنا' : msg.userName}</span>
              <div className={`bg-black/20 backdrop-blur-sm px-3 py-2 rounded-xl max-w-[85%] shadow-sm overflow-hidden ${msg.type === 'gift' ? 'border border-yellow-500/30 bg-yellow-500/5' : ''}`}>
                {msg.image ? <img src={msg.image} className="max-w-full max-h-32 object-contain rounded-lg" alt="emoji" /> : <span className={`text-[12px] leading-tight ${msg.type === 'gift' ? 'text-yellow-400 font-black' : 'text-white/95'}`}>{msg.text}</span>}
              </div>
            </div>
          ))}
          {showJoinMessage && <div className="flex flex-col items-start animate-in fade-in slide-in-from-bottom duration-500"><div className="bg-purple-600/30 backdrop-blur-md border border-purple-500/20 px-4 py-1.5 rounded-full shadow-lg"><p className="text-[10px] font-black text-white">مرحباً بـ <span className="text-yellow-400">{currentUserData?.displayName || user?.displayName || 'مستخدم جديد'}</span> لقد دخل الغرفة</p></div></div>}
          <div ref={chatEndRef} />
        </div>
        <div className="px-3 pb-6 flex items-center gap-2 mt-auto relative">
          {userIsOnMic && <button onClick={() => setIsMicMuted(!isMicMuted)} className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 transition-all bg-white/10 text-white shadow-lg active:scale-90 overflow-hidden flex-shrink-0"><i className={`fas ${!isMicMuted ? 'fa-microphone' : 'fa-microphone-slash'} text-sm ${isMicMuted ? 'text-white/30' : 'text-purple-400'}`}></i></button>}
          <div className="flex-1 h-10 flex items-center gap-2">
            <div className="flex-1 h-full relative">
              <form onSubmit={handleSendMessage} className="h-full flex items-center">
                <div className="flex-1 h-full relative">
                  <input value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="تفاعل مع الجميع..." className="w-full h-full bg-white/10 backdrop-blur-md border border-white/10 rounded-full px-11 pr-11 pl-11 text-[11px] text-white outline-none placeholder:text-white/30 shadow-lg" />
                  <button type="submit" className={`absolute left-1 top-1 bottom-1 aspect-square rounded-full flex items-center justify-center transition-all duration-500 border border-white/5 ${inputText !== '' ? 'bg-purple-500/30 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'bg-white/5 text-white/10 opacity-40 pointer-events-none'}`}><i className="fas fa-paper-plane text-[10px]"></i></button>
                  <button type="button" onClick={() => setShowEmojiMenu(true)} className="absolute right-1 top-1 bottom-1 aspect-square rounded-full flex items-center justify-center transition-all duration-300 border border-white/5 active:scale-90 bg-white/5 text-white/40"><i className="fas fa-smile text-[12px]"></i></button>
                </div>
              </form>
            </div>
          </div>
          <button onClick={() => setShowGifts(true)} className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center shadow-xl active:scale-90 transition-transform flex-shrink-0"><i className="fas fa-gift text-white text-sm"></i></button>
          <button onClick={() => setShowExtraMenu(true)} className="w-10 h-10 rounded-full bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center active:scale-90 transition-transform relative group flex-shrink-0"><div className="grid grid-cols-2 gap-[3px] p-2"><div className="w-[6px] h-[6px] rounded-[1px] bg-white opacity-80 group-hover:opacity-100 transition-opacity"></div><div className="w-[6px] h-[6px] rounded-[1px] bg-white opacity-80 group-hover:opacity-100 transition-opacity"></div><div className="w-[6px] h-[6px] rounded-[1px] bg-white opacity-80 group-hover:opacity-100 transition-opacity"></div><div className="w-[6px] h-[6px] rounded-[1px] bg-white opacity-80 group-hover:opacity-100 transition-opacity"></div></div></button>
        </div>
      </div>
      
      {showEmojiMenu && (
        <><div className="fixed inset-0 z-[700] bg-black/10 animate-in fade-in" onClick={() => setShowEmojiMenu(false)}></div><div className="fixed bottom-0 left-0 right-0 max-md bg-black/70 border-t border-white/10 animate-slide-up h-[350px] flex flex-col overflow-hidden rounded-t-[1.5rem] shadow-2xl mx-auto z-[710]"><div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mt-4 mb-2 flex-shrink-0"></div><div className="flex-1 overflow-y-auto p-4 scrollbar-hide"><div className="space-y-6">{dynamicEmojis.length > 0 ? (<div><div className="grid grid-cols-4 gap-3">{dynamicEmojis.map((emoji) => (<button key={emoji.id} onClick={() => sendGifEmoji(emoji.imageUrl)} className="aspect-square flex items-center justify-center bg-white/5 rounded-xl transition-all active:scale-90 overflow-hidden border border-white/5"><img src={emoji.imageUrl} className="w-full h-full object-contain" alt="GIF" /></button>))}</div></div>) : (<div className="flex flex-col items-center justify-center py-20 opacity-20"><i className="fas fa-smile text-4xl mb-2"></i><p className="text-[10px] font-black uppercase">لا توجد إيموجيات حالياً</p></div>)}</div></div></div></>
      )}

      {showExtraMenu && (
        <><div className="fixed inset-0 z-[105] bg-black/10 animate-in fade-in" onClick={() => setShowExtraMenu(false)}></div><div className="fixed bottom-0 left-0 right-0 max-md mx-auto z-[110] bg-black/60 backdrop-blur-2px border-t border-white/10 animate-slide-up h-[50%] flex flex-col overflow-hidden rounded-t-[1.5rem] shadow-2xl"><div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mt-4 flex-shrink-0"></div><div className="p-8 grid grid-cols-4 gap-y-8 gap-x-4 flex-1 overflow-y-auto scrollbar-hide mt-4">
          {isRoomOwner && (
            <button onClick={() => { setShowRoomSettings(true); setShowExtraMenu(false); }} className="flex flex-col items-center gap-3 active:scale-90 transition-transform"><div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/80"><i className="fas fa-cog text-xl"></i></div><span className="text-[10px] font-black text-white/60">الإعدادات</span></button>
          )}
          <button className="flex flex-col items-center gap-3 active:scale-90 transition-transform"><div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/80"><i className="fas fa-gamepad text-xl"></i></div><span className="text-[10px] font-black text-white/60">الألعاب</span></button><button className="flex flex-col items-center gap-3 active:scale-90 transition-transform"><div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/80"><i className="fas fa-music text-xl"></i></div><span className="text-[10px] font-black text-white/60">الموسيقى</span></button><button onClick={() => setIsEffectsEnabled(!isEffectsEnabled)} className="flex flex-col items-center gap-3 active:scale-90 transition-transform"><div className={`w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center transition-all relative ${isEffectsEnabled ? 'text-white/80' : 'text-white/20'}`}><i className="fas fa-wand-magic-sparkles text-xl"></i>{!isEffectsEnabled && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="w-8 h-0.5 bg-white/40 rotate-45 rounded-full"></div></div>}</div><span className={`text-[10px] font-black ${isEffectsEnabled ? 'text-white/60' : 'text-white/20'}`}>المؤثرات</span></button><button onClick={() => setIsRoomMuted(!isRoomMuted)} className="flex flex-col items-center gap-3 active:scale-90 transition-transform"><div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/80"><i className={`fas ${isRoomMuted ? 'fa-volume-xmark' : 'fa-volume-high'} text-xl`}></i></div><span className="text-[10px] font-black text-white/60">كتم الغرفة</span></button><button className="flex flex-col items-center gap-3 active:scale-90 transition-transform"><div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/80"><i className="fas fa-share-alt text-xl"></i></div><span className="text-[10px] font-black text-white/60">مشاركة</span></button><button className="flex flex-col items-center gap-3 active:scale-90 transition-transform"><div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/80"><i className="fas fa-info-circle text-xl"></i></div><span className="text-[10px] font-black text-white/60">إبلاغ</span></button></div></div></>
      )}

      {showRoomSettings && (
        <div className="fixed inset-0 z-[600] bg-[#1a0b2e] flex flex-col animate-in slide-in-from-bottom duration-300" dir="rtl"><header className="p-4 flex items-center justify-between border-b border-white/5 bg-[#0d051a]"><button onClick={() => setShowRoomSettings(false)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white active:scale-90 transition-all"><i className="fas fa-times"></i></button><h2 className="text-sm font-black text-white">إعدادات الغرفة</h2><button onClick={handleUpdateRoomSettings} disabled={isUpdatingRoom} className="px-4 py-2 rounded-xl bg-purple-600/10 text-purple-400 text-sm font-black active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50">{isUpdatingRoom && <i className="fas fa-circle-notch animate-spin text-[10px]"></i>}<span>حفظ</span></button></header><div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">{!showBgSelector ? (<><div className="flex flex-col items-center gap-4"><label className="text-[10px] font-black text-purple-400 uppercase tracking-widest">صورة الغرفة</label><button onClick={() => coverInputRef.current?.click()} className="relative w-32 h-32 rounded-[2.5rem] bg-white/5 border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden transition-all group-hover:bg-white/10"><img src={editRoomCover} className="w-full h-full object-cover" alt="Room Cover" /><div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"><i className="fas fa-camera text-white"></i></div></button><input type="file" ref={coverInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} /></div><div className="space-y-2"><label className="text-[10px] font-black text-purple-400 uppercase tracking-widest mr-2">اسم الغرفة</label><input type="text" value={editRoomTitle} onChange={(e) => setEditRoomTitle(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm text-white outline-none focus:border-purple-500/40 transition-all shadow-inner" placeholder="اسم الغرفة..." /></div><div className="space-y-2"><label className="text-[10px] font-black text-purple-400 uppercase tracking-widest mr-2">وصف الغرفة</label><textarea value={editRoomDescription} onChange={(e) => setEditRoomDescription(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-sm text-white outline-none h-32 focus:border-purple-500/40 transition-all shadow-inner" placeholder="اكتب وصفاً أو ترحيباً خاصاً لزوار غرفتك..." /></div><div className="space-y-3"><label className="text-[10px] font-black text-purple-400 uppercase tracking-widest mr-2">عدد الميكروفونات</label><div className="grid grid-cols-3 gap-3">{[5, 10, 15].map((count) => (<button key={count} onClick={() => setEditMicCount(count)} className={`py-3 rounded-2xl font-black text-xs transition-all border ${editMicCount === count ? 'bg-purple-600 text-white border-purple-500 shadow-lg scale-95' : 'bg-white/5 text-white/40 border-white/10'}`}>{count} ميك</button>))}</div></div><div className="space-y-4"><label className="text-[10px] font-black text-purple-400 uppercase tracking-widest mr-2">خلفية الغرفة</label><button onClick={() => setShowBgSelector(true)} className="w-full flex items-center justify-between p-5 bg-white/5 border border-white/10 rounded-[1.5rem] group active:scale-95 transition-all"><div className="flex items-center gap-4"><div className="w-10 h-14 rounded-lg overflow-hidden border border-white/20 bg-black/40">{isVideoUrl(editRoomBg) ? <video src={editRoomBg} muted className="w-full h-full object-cover" /> : <img src={editRoomBg || editRoomCover} className="w-full h-full object-cover" />}</div><span className="text-sm font-black text-white">اختر خلفية للغرفة</span></div><i className="fas fa-chevron-left text-purple-400"></i></button></div></>) : (<div className="space-y-6 animate-in slide-in-from-left"><div className="flex items-center gap-3"><button onClick={() => setShowBgSelector(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white"><i className="fas fa-arrow-right text-xs"></i></button><span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">اختر الخلفية المفضلة</span></div><div className="grid grid-cols-3 gap-3">{availableBgs.map((bg) => (<div key={bg.id} onClick={() => { setEditRoomBg(bg.imageUrl); setShowBgSelector(false); }} className={`relative aspect-[9/16] rounded-2xl overflow-hidden cursor-pointer border-2 transition-all ${editRoomBg === bg.imageUrl ? 'border-purple-500 scale-95 shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'border-transparent opacity-60'}`}>{isVideoUrl(bg.imageUrl) ? <video src={bg.imageUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" /> : <img src={bg.imageUrl} className="w-full h-full object-cover" alt="Background" />}{bg.remainingDays !== undefined && (<div className="absolute top-2 right-2 bg-white/10 backdrop-blur-md border border-white/20 text-white text-[8px] font-black px-2 py-0.5 rounded-lg shadow-xl z-20 flex items-center gap-0.5"><span className="text-purple-300">{bg.remainingDays}</span><span className="opacity-80">يوم</span></div>)}{editRoomBg === bg.imageUrl && <div className="absolute inset-0 bg-purple-600/20 flex items-center justify-center"><i className="fas fa-check-circle text-white text-xl"></i></div>}</div>))}</div></div>)}</div></div>
      )}

      {showExitDialog && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/80 animate-in fade-in backdrop-blur-sm" onClick={() => setShowExitDialog(false)}><div className="flex flex-row items-center gap-10"><div className="flex flex-col items-center gap-3"><button onClick={() => { setShowExitDialog(false); onMinimize(); }} className="w-20 h-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white active:scale-90"><i className="fas fa-compress-alt text-3xl"></i></button><span className="text-white font-black text-[12px]">احتفاظ</span></div><div className="flex flex-col items-center gap-3"><button onClick={onLeave} className="w-20 h-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-red-500 active:scale-90"><i className="fas fa-sign-out-alt text-3xl"></i></button><span className="text-white font-black text-[12px]">خروج</span></div></div></div>
      )}
      
      {showParticipants && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-6 animate-in fade-in" onClick={() => setShowParticipants(false)}><div className="w-full max-w-[300px] bg-[#1a0b2e]/85 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}><div className="p-5 border-b border-white/5 flex justify-between items-center"><h3 className="text-white font-black text-sm">المتواجدون ({allPresentUsers.length})</h3><button onClick={() => setShowParticipants(false)} className="text-white/40"><i className="fas fa-times text-xs"></i></button></div><div className="max-h-[380px] overflow-y-auto p-3 space-y-2 scrollbar-hide">{allPresentUsers.map((u, idx) => (<div key={u.uid || idx} className="flex items-center gap-3 p-2 rounded-2xl bg-white/5 border border-white/5"><div className="w-11 h-11 relative flex-shrink-0">
          {u.animatedAvatar ? (
            isVideoUrl(u.animatedAvatar) ? (
              <video src={u.animatedAvatar} autoPlay loop muted playsInline className="w-full h-full rounded-full object-cover border border-white/10" />
            ) : (
              <img src={u.animatedAvatar} className="w-full h-full rounded-full object-cover border border-white/10" />
            )
          ) : (
            <img src={u.photoURL || "https://picsum.photos/100"} className="w-full h-full rounded-full object-cover border border-white/10" />
          )}
          {u.currentFrame && <img src={u.currentFrame} className="absolute inset-0 w-full h-full object-contain scale-110 z-10" />}</div><div className="flex-1 min-w-0"><span className="text-white font-bold text-[11px] truncate block">{normalizeDecoratedText(u.displayName)}</span><span className="text-purple-400 text-[8px] font-black">ID: {u.customId || u.uid?.substring(0,8)}</span></div></div>))}</div></div></div>
      )}
      
      {showMicActions && selectedMicIndex !== null && (
        <div className="fixed inset-0 z-[250] flex items-end justify-center bg-black/40 animate-in fade-in" onClick={() => setShowMicActions(false)}><div className="w-full max-md bg-black/40 rounded-t-[1.5rem] p-6 pb-10 space-y-4 animate-slide-up border-t border-white/10" onClick={e => e.stopPropagation()}><div className="flex flex-col items-center mb-4"><div className="w-12 h-1.5 bg-white/20 rounded-full mb-6"></div><h3 className="text-white font-black text-lg text-center">تحكم المايك {selectedMicIndex + 1}</h3></div><div className="grid grid-cols-1 gap-3">{micStates[selectedMicIndex]?.user?.uid === user?.uid ? (<><button onClick={() => leaveMic(selectedMicIndex)} className="w-full py-4 bg-red-500/20 text-red-400 rounded-2xl font-black flex items-center justify-center gap-3 border border-red-500/20 active:scale-95 transition-all"><i className="fas fa-sign-out-alt"></i> مغادرة المايك</button><button onClick={() => { setShowMicActions(false); setShowUserData(true); }} className="w-full py-4 bg-blue-600/20 text-blue-400 rounded-2xl font-black flex items-center justify-center gap-3 border border-blue-500/20 active:scale-95 transition-all"><i className="fas fa-id-card"></i> عرض البيانات</button></>) : (<button onClick={() => takeMic(selectedMicIndex)} className="w-full py-4 bg-purple-600/20 text-purple-400 border border-purple-500/20 rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all">أخذ المايك</button>)}{isRoomOwner && micStates[selectedMicIndex]?.user?.uid !== user?.uid && (<button onClick={() => toggleLockMic(selectedMicIndex)} className={`w-full py-4 rounded-2xl font-black flex items-center justify-center gap-3 border transition-all active:scale-95 ${micStates[selectedMicIndex]?.status === 'locked' ? 'bg-white/10 text-white border-white/20' : 'bg-white/5 text-white/80 border-white/10'}`}><i className={`fas ${micStates[selectedMicIndex]?.status === 'locked' ? 'fa-lock-open' : 'fa-lock'}`}></i>{micStates[selectedMicIndex]?.status === 'locked' ? 'فتح المايك' : 'قفل المايك'}</button>)}<button onClick={() => setShowMicActions(false)} className="w-full py-4 bg-white/5 text-white/40 rounded-2xl font-black active:scale-95 transition-all">إلغاء</button></div></div></div>
      )}

      {showUserData && (
        <><div className="fixed inset-0 z-[350] bg-black/10" onClick={() => setShowUserData(false)}></div><div className="fixed bottom-0 left-0 right-0 max-md mx-auto z-[400] bg-black/60 backdrop-blur-2px border-t border-white/10 rounded-t-[1.5rem] animate-slide-up overflow-visible h-[68%] shadow-2xl"><div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/10 rounded-full"></div><div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
          <div className="relative w-28 h-28 flex items-center justify-center">
            {currentUserData?.animatedAvatar ? (
              isVideoUrl(currentUserData.animatedAvatar) ? (
                <video src={currentUserData.animatedAvatar} autoPlay loop muted playsInline className="w-24 h-24 rounded-full object-cover border-4 border-black/20 shadow-2xl bg-slate-900" />
              ) : (
                <img src={currentUserData.animatedAvatar} className="w-24 h-24 rounded-full object-cover border-4 border-black/20 shadow-2xl bg-slate-900" alt="Profile" />
              )
            ) : (
              <img src={currentUserData?.photoURL || user?.photoURL || "https://picsum.photos/200"} className="w-24 h-24 rounded-full object-cover border-4 border-black/20 shadow-2xl" alt="Profile" />
            )}
            {(currentUserData?.currentFrame || currentUserData?.currentFrame) && (<img src={currentUserData?.currentFrame} className="absolute inset-0 w-full h-full object-contain z-10 scale-125" alt="frame" />)}
          </div>
        </div><div className="pt-20 px-8 flex flex-col items-center h-full overflow-y-auto scrollbar-hide pb-12"><h3 className="text-2xl font-black text-white drop-shadow-lg mb-2">{normalizeDecoratedText(currentUserData?.displayName || user?.displayName)}</h3><div className="mb-4">{profileCustomIdIcon ? (<div className="relative w-[90px] h-[28px] flex items-center bg-contain bg-center bg-no-repeat animate-in zoom-in duration-300" style={{ backgroundImage: `url(${profileCustomIdIcon})` }}><span className="text-[10px] font-black text-white tracking-widest text-center w-full block drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" style={{ paddingLeft: `${pIdX}px`, paddingTop: `${pIdY}px` }}>{profileCustomId}</span></div>) : (<span className={`text-[11px] font-black w-fit ${profileCustomId === 'OFFICIAL' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' : 'text-purple-300 bg-white/5 border-white/5'} px-3 py-1 rounded-xl border tracking-wider`}>ID: {profileCustomId}</span>)}</div><div className="w-full space-y-8"><div className="flex items-center justify-center gap-12 py-5 border-y border-white/10"><div className="flex flex-col items-center gap-1"><span className="text-xl font-black text-white">0</span><span className="text-[11px] text-white/40 font-bold uppercase tracking-widest">متابعين</span></div><div className="flex flex-col items-center gap-1"><span className="text-xl font-black text-white">0</span><span className="text-[11px] text-white/40 font-bold uppercase tracking-widest">متابعة</span></div></div><div className="bg-black/20 p-6 rounded-[2.5rem] border border-white/5 space-y-4 shadow-inner">
          <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] text-center">الأوسمة والجوائز</p>
          <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-hide px-2">
            {userDataPopupBadges.length > 0 ? (
              userDataPopupBadges.map(badge => (
                <div key={badge.id} className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-white/5 rounded-xl border border-white/5 overflow-hidden transition-all duration-500 shadow-lg">
                   <img src={badge.imageUrl} className="w-full h-full object-contain scale-110 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" alt="Badge" />
                </div>
              ))
            ) : (
              <div className="w-full text-center py-4">
                 <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">لا توجد شارات حالياً</p>
              </div>
            )}
          </div>
        </div></div></div></div></>
      )}

      {showGifts && (
        <>
          <div className="fixed inset-0 z-[700] bg-black/10 animate-in fade-in" onClick={() => setShowGifts(false)}></div>
          <div className="fixed bottom-0 left-0 right-0 max-md bg-black/70 border-t border-white/10 animate-slide-up h-[400px] flex flex-col overflow-hidden rounded-t-[1.5rem] shadow-2xl mx-auto z-[710]">
            <div className="px-5 pt-4 flex items-center justify-between relative">
              <div className="flex items-center -space-x-2 overflow-visible">
                {usersOnMics.length > 0 ? (
                  usersOnMics.slice(0, 5).map((u, i) => (
                    <button 
                      key={u.uid || i} 
                      onClick={() => toggleUserSelection(u.uid)} 
                      className={`w-9 h-9 rounded-full relative flex items-center justify-center bg-purple-900 shadow-md transition-all active:scale-90 ${selectedUserIds.has(u.uid) ? 'ring-2 ring-purple-500' : ''}`}
                    >
                      {selectedUserIds.has(u.uid) && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 rounded-full animate-in zoom-in duration-200">
                           <div className="w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center border border-white/20 shadow-lg">
                              <i className="fas fa-check text-[8px] text-white"></i>
                           </div>
                        </div>
                      )}
                      {u.animatedAvatar ? (
                        isVideoUrl(u.animatedAvatar) ? (
                          <video src={u.animatedAvatar} autoPlay loop muted playsInline className="w-full h-full rounded-full object-cover z-10" />
                        ) : (
                          <img src={u.animatedAvatar} className="w-full h-full rounded-full object-cover z-10" />
                        )
                      ) : (
                        <img src={u.photoURL || "https://picsum.photos/50"} className="w-full h-full rounded-full object-cover z-10" />
                      )}
                    </button>
                  ))
                ) : <div className="text-[10px] text-white/40 font-black pr-2">لا يوجد أحد على المايك</div>}
              </div>
              <div className="relative">
                <button onClick={() => setShowSelectionMenu(!showSelectionMenu)} className="w-9 h-9 rounded-full bg-[#1a0b2e]/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/60 active:scale-95"><i className={`fas fa-chevron-down text-[12px] ${showSelectionMenu ? 'rotate-180' : ''}`}></i></button>
                {showSelectionMenu && (
                  <div className="absolute top-full left-0 mt-2 w-32 bg-[#0d051a]/90 border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50 animate-in zoom-in duration-200">
                    <button onClick={() => handleSelectionMode('manual')} className="w-full py-3 px-4 text-right text-[10px] font-black text-white border-b border-white/5 flex items-center justify-between"><span>تحديد</span>{selectionMode === 'manual' && <i className="fas fa-check text-purple-400 text-[8px]"></i>}</button>
                    <button onClick={() => handleSelectionMode('all-room')} className="w-full py-3 px-4 text-right text-[10px] font-black text-white border-b border-white/5 flex items-center justify-between"><div className="flex items-center gap-2"><i className="fas fa-home text-[10px] opacity-60"></i><span>كل الغرفة</span></div>{selectionMode === 'all-room' && <i className="fas fa-check text-purple-400 text-[8px]"></i>}</button>
                    <button onClick={() => handleSelectionMode('all-mic')} className="w-full py-3 px-4 text-right text-[10px] font-black text-white flex items-center justify-between"><div className="flex items-center gap-2"><i className="fas fa-microphone text-[10px] opacity-60"></i><span>كل المايك</span></div>{selectionMode === 'all-mic' && <i className="fas fa-check text-purple-400 text-[8px]"></i>}</button>
                  </div>
                )}
              </div>
            </div>
            <div className="px-4 mt-3 pb-2">
              <div className="flex items-center justify-between w-full px-1 border-b border-white/10">
                {['normal', 'cp', 'famous', 'country', 'vip', 'birthday'].map((tab) => (
                   <button key={tab} onClick={() => setGiftTab(tab as GiftTab)} className={`relative flex-1 flex flex-col items-center text-[10px] font-black pb-1.5 ${giftTab === tab ? 'text-purple-400' : 'text-white/40'}`}>
                    {tab === 'normal' ? 'عادية' : tab === 'cp' ? 'CP' : tab === 'famous' ? 'مشاهير' : tab === 'country' ? 'دولة' : tab === 'vip' ? 'VIP' : 'ميلاد'}
                    {giftTab === tab && <div className="absolute bottom-0 w-6 h-0.5 bg-purple-400 rounded-full"></div>}
                   </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pt-1 scrollbar-hide">
              <div className="grid grid-cols-4 gap-2">
                {filteredGifts.map(gift => {
                  const isLongGiftName = gift.name.length > 8;
                  return (
                    <button 
                      key={gift.id} 
                      onClick={() => setSelectedGiftId(gift.id)} 
                      className={`flex flex-col items-center justify-center p-1 py-3 rounded-2xl transition-all duration-300 h-[92px] border relative ${
                        selectedGiftId === gift.id 
                        ? 'bg-purple-600/20 border-purple-500/50' 
                        : 'bg-white/5 border-white/5'
                      }`}
                    >
                      {selectedGiftId === gift.id && (
                        <div className="absolute inset-0 rounded-2xl border border-white/10 pointer-events-none"></div>
                      )}
                      <div className={`text-2xl mb-2 transition-transform duration-300 ${selectedGiftId === gift.id ? 'scale-110' : ''}`}>
                        {gift.icon.startsWith('http') ? <img src={gift.icon} className="w-8 h-8 object-contain" /> : gift.icon}
                      </div>
                      <div className="w-full overflow-hidden h-4 flex items-center justify-center mb-0.5 px-1 relative" style={{ maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)' }}>
                        {isLongGiftName ? (
                          <div className="flex animate-marquee-infinite">
                            <span className="text-[10px] text-white font-bold whitespace-nowrap pr-8">{gift.name}</span>
                            <span className="text-[10px] text-white font-bold whitespace-nowrap pr-8">{gift.name}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-white font-bold truncate text-center">{gift.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`text-[10px] font-black transition-colors ${selectedGiftId === gift.id ? 'text-yellow-400' : 'text-yellow-500/80'}`}>{gift.price}</span>
                        <i className="fas fa-coins text-yellow-500 text-[8px]"></i>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="px-6 h-20 bg-black/40 border-t border-white/10 flex items-center justify-between py-2.5 overflow-visible">
              <button onClick={() => { setShowGifts(false); if(onOpenWallet) onOpenWallet(); }} className="flex items-center gap-2 bg-white/10 rounded-full h-9 px-4 border border-white/10 transition-all active:scale-95">
                <div className="flex flex-row-reverse items-center gap-2"><span className="text-[13px] text-white font-black">{(currentUserData?.coins || 0).toLocaleString('ar-EG')}</span><i className="fas fa-coins text-yellow-500 text-[10px]"></i></div>
              </button>
              <div className="flex items-center h-9 w-[131px] relative overflow-visible">
                 <div className="flex items-center h-full w-full rounded-full border border-[#2d1252]/60 overflow-hidden shadow-lg">
                    <div className="basis-1/2 h-full relative bg-[#2d1252]/30">
                       <button onClick={(e) => { e.stopPropagation(); if (selectedGiftId) { setShowQuantityMenu(!showQuantityMenu); } }} className="w-full h-full flex items-center justify-center gap-1 transition-all active:scale-95">
                         <i className={`fas fa-chevron-up text-[7px] text-white/60 ${showQuantityMenu ? 'rotate-180' : ''}`}></i>
                         <span className="text-[9px] font-black text-white/90">x{selectedQuantity}</span>
                       </button>
                       {showQuantityMenu && (
                         <div className="absolute bottom-[calc(100%+12px)] left-0 w-[131px] bg-[#0d051a]/90 border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-[150] animate-in zoom-in duration-200 origin-bottom">
                           <div className="flex flex-col max-h-48 overflow-y-auto scrollbar-hide">
                            {quantities.map((q) => (<button key={q} onClick={(e) => { e.stopPropagation(); setSelectedQuantity(q); setShowQuantityMenu(false); }} className={`w-full py-3 px-4 text-center text-[10px] font-black border-b border-white/5 last:border-0 ${selectedQuantity === q ? 'bg-purple-600/30 text-white' : 'text-white/60 hover:bg-white/5'}`}>x{q}</button>))}
                           </div>
                         </div>
                       )}
                    </div>
                    <button onClick={handleSendGift} className="basis-1/2 h-full bg-[#2d1252]/85 text-white text-[9.5px] font-black active:bg-[#3d1a6e] border-r border-[#2d1252]/60 transition-all active:scale-95">إرسال</button>
                 </div>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        .animate-slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); } 
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } } 
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        
        @keyframes marquee-infinite {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee-infinite {
          display: flex;
          width: fit-content;
          animation: marquee-infinite 6s linear infinite;
        }
      `}</style>
    </div>
  );
};
