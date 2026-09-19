
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { 
  doc, updateDoc, collection, query, limit, deleteDoc, addDoc, 
  serverTimestamp, orderBy, onSnapshot, setDoc, deleteField,
  collectionGroup, where, getDocs, getDoc, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import CPAdmin from './CPAdmin';
import { normalizeDecoratedText } from '../utils';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isOfficialAdmin: boolean;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose, isOfficialAdmin }) => {
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [searchId, setSearchId] = useState('');
  const [showPasswordMap, setShowPasswordMap] = useState<{[key: string]: boolean}>({});
  const [allBanners, setAllBanners] = useState<any[]>([]);
  const [allRoomBgs, setAllRoomBgs] = useState<any[]>([]);
  const [allNews, setAllNews] = useState<any[]>([]);
  const [allRooms, setAllRooms] = useState<any[]>([]);
  const [allOfficialMsgs, setAllOfficialMsgs] = useState<any[]>([]);
  const [allEmojis, setAllEmojis] = useState<any[]>([]);
  const [allGifts, setAllGifts] = useState<any[]>([]);
  const [adminTab, setAdminTab] = useState<'users' | 'news' | 'banners' | 'bgs' | 'rooms' | 'design' | 'messages' | 'store' | 'emojis' | 'gifts' | 'support' | 'cp'>('users');
  
  const [showChargePopup, setShowChargePopup] = useState<string | null>(null);
  const [showDeductPopup, setShowDeductPopup] = useState<string | null>(null);
  const [showIdPopup, setShowIdPopup] = useState<string | null>(null);
  const [showBanPopup, setShowBanPopup] = useState<string | null>(null);
  const [showGrantPopup, setShowGrantPopup] = useState<string | null>(null);
  const [showGrantAnimatedPopup, setShowGrantAnimatedPopup] = useState<string | null>(null);
  const [showBadgesPopup, setShowBadgesPopup] = useState<string | null>(null);
  const [showRoomCoverPopup, setShowRoomCoverPopup] = useState<string | null>(null);

  const [userInventory, setUserInventory] = useState<any[]>([]);
  const [userBadges, setUserBadges] = useState<any[]>([]);
  
  const [chargeAmount, setChargeAmount] = useState('');
  const [deductAmount, setDeductAmount] = useState('');
  
  const [newCustomId, setNewCustomId] = useState('');
  const [newCustomIdIcon, setNewCustomIdIcon] = useState<string | null>(null);
  const [idOffsetX, setIdOffsetX] = useState(28); 
  const [idOffsetY, setIdOffsetY] = useState(0.5); 

  const [badgeUrl, setBadgeUrl] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  const [msgTitle, setMsgTitle] = useState('');
  const [msgDesc, setMsgDesc] = useState('');
  const [msgImage, setMsgImage] = useState<string | null>(null);

  const [newsTitle, setNewsTitle] = useState('');
  const [newsDesc, setNewsDesc] = useState('');
  const [newsImage, setNewsImage] = useState<string | null>(null);
  
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerImage, setBannerImage] = useState<string | null>(null);

  const [roomBgImage, setRoomBgImage] = useState<string | null>(null);
  const [loginBgImage, setLoginBgImage] = useState<string | null>(null);
  const [loginLogoImage, setLoginLogoImage] = useState<string | null>(null);

  const [micOpenIcon, setMicOpenIcon] = useState<string | null>(null);
  const [micLockedIcon, setMicLockedIcon] = useState<string | null>(null);
  const [waveRoomIcon, setWaveRoomIcon] = useState<string | null>(null);

  const [emojiUrl, setEmojiUrl] = useState('');

  // Gift States
  const [giftName, setGiftName] = useState('');
  const [giftPrice, setGiftPrice] = useState('');
  const [giftIcon, setGiftIcon] = useState('');
  const [giftAnimation, setGiftAnimation] = useState('');
  const [giftCategory, setGiftCategory] = useState('normal');

  // Grant States
  const [grantType, setGrantType] = useState<'frame' | 'entry' | 'background'>('frame');
  const [grantName, setGrantName] = useState('');
  const [grantUrl, setGrantUrl] = useState('');
  const [grantPreview, setGrantPreview] = useState<string | null>(null);
  const [grantDuration, setGrantDuration] = useState('7');

  // Grant Animated Avatar States
  const [animatedUrl, setAnimatedUrl] = useState('');

  // Room Cover State
  const [animatedRoomCoverUrl, setAnimatedRoomCoverUrl] = useState('');

  const [storeSection, setStoreSection] = useState<'frames' | 'entries' | 'backgrounds'>('frames');
  
  const [frameName, setFrameName] = useState('');
  const [frameUrl, setFrameUrl] = useState('');
  const [framePrice, setFramePrice] = useState('');
  const [frameDuration, setFrameDuration] = useState('7');
  const [storeFrames, setStoreFrames] = useState<any[]>([]);

  const [entryName, setEntryName] = useState('');
  const [entryVideoUrl, setEntryVideoUrl] = useState('');
  const [entryPreviewImage, setEntryPreviewImage] = useState<string | null>(null);
  const [entryPrice, setEntryPrice] = useState('');
  const [entryDuration, setEntryDuration] = useState('7');
  const [storeEntries, setStoreEntries] = useState<any[]>([]);

  const [storeBgName, setStoreBgName] = useState('');
  const [storeBgImage, setStoreBgImage] = useState<string | null>(null);
  const [storeBgPrice, setStoreBgPrice] = useState('');
  const [storeBgDuration, setStoreBgDuration] = useState('7');
  const [storeBackgrounds, setStoreBackgrounds] = useState<any[]>([]);

  // Support State
  const [supportChats, setSupportChats] = useState<any[]>([]);
  const [selectedSupportChatId, setSelectedSupportChatId] = useState<string | null>(null);
  const [supportMessages, setSupportMessages] = useState<any[]>([]);
  const [adminSupportReply, setAdminSupportReply] = useState('');
  const adminSupportScrollRef = useRef<HTMLDivElement>(null);

  const newsInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const roomBgInputRef = useRef<HTMLInputElement>(null);
  const loginBgInputRef = useRef<HTMLInputElement>(null);
  const loginLogoInputRef = useRef<HTMLInputElement>(null);
  const entryPreviewInputRef = useRef<HTMLInputElement>(null);
  const storeBgInputRef = useRef<HTMLInputElement>(null);
  const grantPreviewInputRef = useRef<HTMLInputElement>(null);

  // Added missing refs
  const micOpenInputRef = useRef<HTMLInputElement>(null);
  const micLockedInputRef = useRef<HTMLInputElement>(null);
  const waveRoomInputRef = useRef<HTMLInputElement>(null);
  const msgImageRef = useRef<HTMLInputElement>(null);
  const idIconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const unsubUsers = onSnapshot(query(collection(db, "users"), limit(500)), (snap) => {
      setAllUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubNews = onSnapshot(query(collection(db, "news"), orderBy("createdAt", "desc")), (snap) => {
      setAllNews(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubBanners = onSnapshot(query(collection(db, "banners"), orderBy("createdAt", "desc")), (snap) => {
      setAllBanners(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubBgs = onSnapshot(query(collection(db, "roomBackgrounds"), orderBy("createdAt", "desc")), (snap) => {
      setAllRoomBgs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubRooms = onSnapshot(query(collection(db, "rooms"), orderBy("createdAt", "desc")), (snap) => {
      setAllRooms(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubOfficialMsgs = onSnapshot(query(collection(db, "officialNotifications"), orderBy("createdAt", "desc")), (snap) => {
      setAllOfficialMsgs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubEmojis = onSnapshot(query(collection(db, "emojis"), orderBy("createdAt", "desc")), (snap) => {
      setAllEmojis(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubGifts = onSnapshot(query(collection(db, "gifts"), orderBy("createdAt", "desc")), (snap) => {
      setAllGifts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubStoreFrames = onSnapshot(query(collection(db, "storeFrames"), orderBy("createdAt", "desc")), (snap) => {
      setStoreFrames(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubStoreEntries = onSnapshot(query(collection(db, "storeEntries"), orderBy("createdAt", "desc")), (snap) => {
      setStoreEntries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubStoreBgs = onSnapshot(query(collection(db, "storeBackgrounds"), orderBy("createdAt", "desc")), (snap) => {
      setStoreBackgrounds(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubSupport = onSnapshot(query(collection(db, "supportChats"), orderBy("lastTimestamp", "desc")), (snap) => {
      setSupportChats(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubAppearance = onSnapshot(doc(db, "settings", "appearance"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setLoginBgImage(data.loginBackground || null);
        setLoginLogoImage(data.loginLogo || null);
      }
    });

    const unsubDesign = onSnapshot(doc(db, "settings", "design"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setMicOpenIcon(data.micOpenIcon || null);
        setMicLockedIcon(data.micLockedIcon || null);
        setWaveRoomIcon(data.waveRoomIcon || null);
      }
    });

    return () => {
      unsubUsers(); unsubNews(); unsubBanners(); unsubBgs(); unsubRooms(); unsubDesign(); unsubOfficialMsgs(); unsubAppearance(); unsubStoreFrames(); unsubStoreEntries(); unsubStoreBgs(); unsubEmojis(); unsubGifts(); unsubSupport();
    };
  }, [isOpen]);

  useEffect(() => {
    let unsub: any;
    if (selectedSupportChatId) {
      const q = query(collection(db, "supportChats", selectedSupportChatId, "messages"), orderBy("createdAt", "asc"));
      unsub = onSnapshot(q, (snap) => {
        setSupportMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setTimeout(() => adminSupportScrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      });
      updateDoc(doc(db, "supportChats", selectedSupportChatId), { unreadByAdmin: false });
    }
    return () => { if (unsub) unsub(); };
  }, [selectedSupportChatId]);

  useEffect(() => {
    let unsub: any;
    if (showGrantPopup) {
      unsub = onSnapshot(query(collection(db, "users", showGrantPopup, "inventory"), orderBy("purchasedAt", "desc")), (snap) => {
        setUserInventory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
    }
    return () => { if (unsub) unsub(); };
  }, [showGrantPopup]);

  useEffect(() => {
    let unsub: any;
    if (showBadgesPopup) {
      unsub = onSnapshot(query(collection(db, "users", showBadgesPopup, "badges"), orderBy("createdAt", "desc")), (snap) => {
        setUserBadges(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
    }
    return () => { if (unsub) unsub(); };
  }, [showBadgesPopup]);

  const handleGiveBadge = async () => {
    if (!showBadgesPopup || !badgeUrl.trim()) return alert("يرجى إدخل رابط الشارة");
    setIsPublishing(true);
    try {
      await addDoc(collection(db, "users", showBadgesPopup, "badges"), {
        imageUrl: badgeUrl.trim(),
        createdAt: serverTimestamp()
      });
      setBadgeUrl('');
      alert("تم منح الشارة للمستخدم بنجاح");
    } catch (e) {
      alert("حدث خطأ");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRemoveBadge = async (badgeId: string) => {
    if (!showBadgesPopup) return;
    if (confirm("هل تريد حذف هذه الشارة من بروفايل المستخدم؟")) {
      await deleteDoc(doc(db, "users", showBadgesPopup, "badges", badgeId));
      alert("تم حذف الشارة");
    }
  };

  const cleanupInventoryAndUsers = async (itemId: string, type: 'frame' | 'entry' | 'background', itemUrl: string) => {
    try {
      const inventoryQuery = query(collectionGroup(db, "inventory"), where("itemId", "==", itemId));
      const snap = await getDocs(inventoryQuery);
      
      const promises = snap.docs.map(async (invDoc) => {
        const userDocRef = invDoc.ref.parent.parent;
        if (userDocRef) {
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const updates: any = {};
            
            if (type === 'frame' && userData.currentFrame === itemUrl) {
              updates.currentFrame = null;
            }
            if (type === 'entry' && userData.currentEntry === itemUrl) {
              updates.currentEntry = null;
            }
            if (type === 'background' && userData.currentRoomBackground === itemUrl) {
              updates.currentRoomBackground = null;
            }
            
            if (Object.keys(updates).length > 0) {
              await updateDoc(userDocRef, updates);
            }
          }
        }
        await deleteDoc(invDoc.ref);
      });
      
      await Promise.all(promises);
    } catch (err) {
      console.error("Error during global inventory cleanup:", err);
    }
  };

  const isVideoUrl = (url: string | null) => {
    if (!url) return false;
    return url.match(/\.(mp4|webm|ogg|mov)$/) !== null || url.includes('video');
  };

  const handlePublishGift = async () => {
    if (!giftName || !giftPrice || !giftIcon) return alert("يرجى ملأ البيانات الأساسية للهدايا");
    setIsPublishing(true);
    try {
      await addDoc(collection(db, "gifts"), {
        name: giftName,
        price: parseInt(giftPrice),
        icon: giftIcon,
        animation: giftAnimation || null,
        tab: giftCategory,
        createdAt: serverTimestamp()
      });
      setGiftName('');
      setGiftPrice('');
      setGiftIcon('');
      setGiftAnimation('');
      setGiftCategory('normal');
      alert("تم نشر الهدية بنجاح في صندوق الهدايا");
    } catch (e) {
      alert("خطأ في النشر");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleGrantItem = async () => {
    if (!showGrantPopup || !grantName || !grantUrl || !grantDuration) return alert("يرجى ملأ البيانات الأساسية");
    if (grantType === 'entry' && !grantPreview) return alert("يرجى اختيار صورة معاينة للدخولية");
    
    setIsPublishing(true);
    try {
      const purchasedAt = new Date();
      const expiresAt = new Date(purchasedAt.getTime() + parseInt(grantDuration) * 24 * 60 * 60 * 1000);

      const itemData: any = {
        name: grantName,
        type: grantType,
        purchasedAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
        isEquipped: grantType === 'background',
        grantedByAdmin: true
      };

      if (grantType === 'frame') {
        itemData.imageUrl = grantUrl;
      } else if (grantType === 'background') {
        if (isVideoUrl(grantUrl)) {
          itemData.videoUrl = grantUrl;
          itemData.imageUrl = grantUrl;
        } else {
          itemData.imageUrl = grantUrl;
        }
      } else {
        itemData.videoUrl = grantUrl;
        itemData.previewImage = grantPreview;
      }

      await addDoc(collection(db, "users", showGrantPopup, "inventory"), itemData);
      
      await addDoc(collection(db, "users", showGrantPopup, "systemNotifications"), {
        title: "هدية خاصة من الإدارة",
        desc: `لقد منحتك الإدارة ${grantType === 'frame' ? 'إطاراً' : grantType === 'background' ? 'خلفية غرفه مخصصة' : 'دخولية'} مميزة باسم "${grantName}" لمدة ${grantDuration} أيام. تفقدها الآن في إعدادات الغرفة!`,
        icon: grantType === 'frame' ? 'fa-id-badge' : grantType === 'background' ? 'fa-image' : 'fa-door-open',
        createdAt: serverTimestamp()
      });

      setGrantName('');
      setGrantUrl('');
      setGrantPreview(null);
      alert("تم منح العنصر للمستخدم بنجاح");
      setShowGrantPopup(null);
    } catch (e) {
      alert("حدث خطأ");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleGrantAnimatedAvatar = async () => {
    if (!showGrantAnimatedPopup) return;
    setIsPublishing(true);
    try {
      const updates: any = {};
      if (animatedUrl.trim()) {
        updates.animatedAvatar = animatedUrl.trim();
      } else {
        updates.animatedAvatar = deleteField();
      }

      await updateDoc(doc(db, "users", showGrantAnimatedPopup), updates);
      
      if (animatedUrl.trim()) {
        await addDoc(collection(db, "users", showGrantAnimatedPopup, "systemNotifications"), {
          title: "صورة متحركة مميزة",
          desc: "لقد تم منحك صوره متحركه مميزة لبروفايلك من قبل الإدارة! استمتع بمظهرك الجديد.",
          icon: "fa-image",
          createdAt: serverTimestamp()
        });
      }

      setShowGrantAnimatedPopup(null);
      setAnimatedUrl('');
      alert(updates.animatedAvatar ? "تم منح الصورة المتحركة بنجاح" : "تم حذف الصورة المتحركة");
    } catch (e) {
      alert("حدث خطأ");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSetAnimatedRoomCover = async () => {
    if (!showRoomCoverPopup || !animatedRoomCoverUrl.trim()) return alert("يرجى إدخال رابط الصورة المتحركة");
    setIsPublishing(true);
    try {
      const room = allRooms.find(r => r.id === showRoomCoverPopup);
      if (!room) return;

      await updateDoc(doc(db, "rooms", showRoomCoverPopup), {
        coverImage: animatedRoomCoverUrl.trim()
      });

      if (room.owner?.uid) {
        await addDoc(collection(db, "users", room.owner.uid, "systemNotifications"), {
          title: "تحديث غلاف الغرفة",
          desc: `لقد قامت الإدارة بمنح غرفتك "${room.title}" غلافاً متحركاً مميزاً وحصرياً. تفقد مظهر غرفتك الجديد الآن!`,
          icon: "fa-image",
          createdAt: serverTimestamp()
        });
      }

      setShowRoomCoverPopup(null);
      setAnimatedRoomCoverUrl('');
      alert("تم تحديث غلاف الغرفة وإرسال تنبيه للمالك");
    } catch (e) {
      alert("حدث خطأ أثناء التحديث");
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePublishFrame = async () => {
    if (!frameName || !frameUrl || !framePrice || !frameDuration) return alert("يرجى ملأ كافة البيانات");
    setIsPublishing(true);
    try {
      await addDoc(collection(db, "storeFrames"), {
        name: frameName,
        imageUrl: frameUrl,
        price: parseInt(framePrice),
        durationDays: parseInt(frameDuration),
        createdAt: serverTimestamp()
      });
      setFrameName('');
      setFrameUrl('');
      setFramePrice('');
      setFrameDuration('7');
      alert("تم نشر الإطار في المتجر بنجاح");
    } catch (e) {
      alert("حدث خطأ أثناء النشر");
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePublishEntry = async () => {
    if (!entryName || !entryVideoUrl || !entryPreviewImage || !entryPrice || !entryDuration) return alert("يرجى ملأ كافة البيانات");
    setIsPublishing(true);
    try {
      await addDoc(collection(db, "storeEntries"), {
        name: entryName,
        videoUrl: entryVideoUrl,
        previewImage: entryPreviewImage,
        price: parseInt(entryPrice),
        durationDays: parseInt(entryDuration),
        createdAt: serverTimestamp()
      });
      setEntryName('');
      setEntryVideoUrl('');
      setEntryPreviewImage(null);
      setEntryPrice('');
      setEntryDuration('7');
      alert("تم نشر الدخولية في المتجر بنجاح");
    } catch (e) {
      alert("حدث خطأ أثناء النشر");
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePublishStoreBg = async () => {
    if (!storeBgName || !storeBgImage || !storeBgPrice || !storeBgDuration) return alert("يرجى ملأ كافة البيانات");
    setIsPublishing(true);
    try {
      await addDoc(collection(db, "storeBackgrounds"), {
        name: storeBgName,
        imageUrl: storeBgImage,
        price: parseInt(storeBgPrice),
        durationDays: parseInt(storeBgDuration),
        createdAt: serverTimestamp()
      });
      setStoreBgName('');
      setStoreBgImage(null);
      setStoreBgPrice('');
      setStoreBgDuration('7');
      alert("تم نشر الخلفية في المتجر بنجاح");
    } catch (e) {
      alert("حدث خطأ أثناء النشر");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUserUpdate = async (userId: string, data: any) => {
    try {
      await updateDoc(doc(db, "users", userId), data);
      return true;
    } catch (e) { 
      alert("خطأ في التحديث"); 
      return false;
    }
  };

  const handleChargeSubmit = async () => {
    if (!showChargePopup || !chargeAmount) return;
    const targetUser = allUsers.find(u => u.id === showChargePopup);
    if (targetUser) {
      const amountNum = parseInt(chargeAmount);
      const success = await handleUserUpdate(showChargePopup, { 
        coins: (targetUser.coins || 0) + amountNum 
      });
      if (success) { 
        await addDoc(collection(db, "users", showChargePopup, "systemNotifications"), {
          title: "تم شحن محفظتك",
          desc: `تم شحن ${amountNum.toLocaleString('ar-EG')} كوينز لك من قبل الإدارة. استمتع بالألعاب!`,
          icon: 'fa-coins',
          createdAt: serverTimestamp()
        });
        setShowChargePopup(null); 
        setChargeAmount(''); 
      }
    }
  };

  const handleDeductSubmit = async () => {
    if (!showDeductPopup || !deductAmount) return;
    const targetUser = allUsers.find(u => u.id === showDeductPopup);
    if (targetUser) {
      const amountNum = parseInt(deductAmount);
      if ((targetUser.coins || 0) < amountNum) {
        alert("رصيد المستخدم غير كافٍ للخصم");
        return;
      }
      const success = await handleUserUpdate(showDeductPopup, { 
        coins: (targetUser.coins || 0) - amountNum 
      });
      if (success) { 
        await addDoc(collection(db, "users", showDeductPopup, "systemNotifications"), {
          title: "تم سحب رصيد",
          desc: `تم سحب ${amountNum.toLocaleString('ar-EG')} كوينز من حسابك من قبل الإدارة.`,
          icon: 'fa-minus-circle',
          createdAt: serverTimestamp()
        });
        setShowDeductPopup(null); 
        setDeductAmount(''); 
        alert("تم خصم الرصيد بنجاح");
      }
    }
  };

  const handleIdUpdateSubmit = async () => {
    if (!showIdPopup || !newCustomId) return;
    const data: any = { 
      customId: newCustomId,
      idOffsetX: idOffsetX,
      idOffsetY: idOffsetY
    };
    if (newCustomIdIcon) {
      data.customIdIcon = newCustomIdIcon;
    } else {
      data.customIdIcon = deleteField();
    }
    
    const success = await handleUserUpdate(showIdPopup, data);
    if (success) { 
      try {
        await addDoc(collection(db, "users", showIdPopup, "systemNotifications"), {
          title: "تهنئة بالهوية الجديدة",
          desc: `مبروك تم حصولك على ID مميز وحصري من الإدارة. رقم هويتك الجديد هو: ${newCustomId}`,
          icon: 'fa-id-badge',
          createdAt: serverTimestamp()
        });
      } catch (err) {
        console.error("Failed to send notification:", err);
      }

      setShowIdPopup(null); 
      setNewCustomId(''); 
      setNewCustomIdIcon(null);
      alert("تم تحديث الـ ID وإرسال رسالة تهنئة للمستخدم");
    }
  };

  const handleBanSubmit = async (days: number | 'permanent') => {
    if (!showBanPopup) return;
    let banUntil = days === 'permanent' ? '2099-01-01T00:00:00Z' : new Date(Date.now() + days * 86400000).toISOString();
    if (await handleUserUpdate(showBanPopup, { banUntil })) {
      setShowBanPopup(null);
      alert("تم الحظر بنجاح");
    }
  };

  const handleAdminSupportReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupportChatId || !adminSupportReply.trim()) return;

    try {
      await addDoc(collection(db, "supportChats", selectedSupportChatId, "messages"), {
        senderId: "SUPPORT_AGENT",
        text: adminSupportReply.trim(),
        createdAt: serverTimestamp()
      });
      
      await updateDoc(doc(db, "supportChats", selectedSupportChatId), {
        lastMessage: adminSupportReply.trim(),
        lastTimestamp: serverTimestamp(),
        unreadByAdmin: false,
        unreadByUser: true
      });
      
      setAdminSupportReply('');
    } catch (e) { alert("خطأ في الرد"); }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setter(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const saveDesignSettings = async () => {
    try {
      await setDoc(doc(db, "settings", "design"), {
        micOpenIcon,
        micLockedIcon,
        waveRoomIcon
      }, { merge: true });
      alert("تم حفظ إعدادات التصميم");
    } catch (e) {
      alert("خطأ في الحفظ");
    }
  };

  const handleSaveLoginSettings = async () => {
    try {
      await setDoc(doc(db, "settings", "appearance"), {
        loginBackground: loginBgImage,
        loginLogo: loginLogoImage
      }, { merge: true });
      alert("تم تحديث إعدادات صفحة تسجيل الدخول بنجاح");
    } catch (e) {
      alert("خطأ أثناء الحفظ");
    }
  };

  const handlePublishEmoji = async () => {
    if (!emojiUrl.trim()) return alert("يرجى إدخال رابط الـ Emoji أولاً");
    setIsPublishing(true);
    try {
      await addDoc(collection(db, "emojis"), {
        imageUrl: emojiUrl.trim(),
        createdAt: serverTimestamp()
      });
      setEmojiUrl('');
      alert("تم نشر الإيموجي بنجاح");
    } catch (e) {
      alert("خطأ في النشر");
    } finally {
      setIsPublishing(false);
    }
  };

  const filteredUsers = searchId.trim() 
    ? allUsers.filter(u => u.customId?.toLowerCase().includes(searchId.toLowerCase()))
    : allUsers;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] bg-[#1a0b2e] flex flex-col animate-in slide-in-from-bottom" dir="rtl">
      <input type="file" ref={newsInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageSelect(e, setNewsImage)} />
      <input type="file" ref={bannerInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageSelect(e, setBannerImage)} />
      <input type="file" ref={roomBgInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageSelect(e, setRoomBgImage)} />
      <input type="file" ref={loginBgInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageSelect(e, setLoginBgImage)} />
      <input type="file" ref={loginLogoInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageSelect(e, setLoginLogoImage)} />
      <input type="file" ref={entryPreviewInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageSelect(e, setEntryPreviewImage)} />
      <input type="file" ref={storeBgInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageSelect(e, setStoreBgImage)} />
      <input type="file" ref={grantPreviewInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageSelect(e, setGrantPreview)} />
      
      <input type="file" ref={micOpenInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageSelect(e, setMicOpenIcon)} />
      <input type="file" ref={micLockedInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageSelect(e, setMicLockedIcon)} />
      <input type="file" ref={waveRoomInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageSelect(e, setWaveRoomIcon)} />
      <input type="file" ref={msgImageRef} className="hidden" accept="image/*" onChange={(e) => handleImageSelect(e, setMsgImage)} />
      <input type="file" ref={idIconInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageSelect(e, setNewCustomIdIcon)} />

      {!selectedSupportChatId && (
        <header className="p-4 border-b border-white/10 flex flex-col bg-[#0d051a] sticky top-0 z-50">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white font-black text-lg">لوحة المسؤول</h2>
            <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white"><i className="fas fa-times"></i></button>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {[
              {id: 'users', label: 'المستخدمين'},
              {id: 'support', label: 'محادثات الدعم'},
              {id: 'rooms', label: 'الغرف'},
              {id: 'news', label: 'الأخبار'},
              {id: 'banners', label: 'البنرات'},
              {id: 'bgs', label: 'خلفيات مجانية'},
              {id: 'store', label: 'المتجر'},
              {id: 'emojis', label: 'إيموجي'},
              {id: 'gifts', label: 'الهدايا'},
              {id: 'cp', label: 'CP'},
              {id: 'design', label: 'التصميم'},
              {id: 'messages', label: 'الرسائل'}
            ].map((tab) => (
              <button key={tab.id} onClick={() => setAdminTab(tab.id as any)} className={`flex-shrink-0 px-4 py-2 text-[10px] font-black rounded-xl transition-all uppercase relative ${adminTab === tab.id ? 'bg-purple-600 text-white shadow-lg' : 'bg-white/5 text-purple-300/60'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </header>
      )}

      <div className={`flex-1 ${selectedSupportChatId ? '' : 'overflow-y-auto p-4 space-y-6 pb-20'}`}>
        {adminTab === 'cp' && <CPAdmin />}
        
        {adminTab === 'support' && (
          <div className="h-full flex flex-col animate-in fade-in">
            {!selectedSupportChatId ? (
              <div className="space-y-4">
                <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest px-1">طلبات الدعم الفني</p>
                {supportChats.length === 0 ? (
                  <div className="text-center py-20 opacity-20"><i className="fas fa-headset text-4xl mb-2"></i><p className="text-xs font-bold">لا توجد محادثات حالياً</p></div>
                ) : supportChats.map(chat => (
                  <button 
                    key={chat.id} 
                    onClick={() => setSelectedSupportChatId(chat.id)}
                    className="w-full bg-white/5 p-4 rounded-[2rem] border border-white/10 flex items-center gap-4 active:scale-[0.98] transition-all hover:bg-white/10 text-right relative overflow-hidden h-auto"
                  >
                    <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 flex-shrink-0 shadow-lg relative">
                      <img src={chat.userPhoto} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-black text-sm text-white">{chat.userName}</span>
                      </div>
                      <p className={`text-[11px] font-bold leading-tight break-words whitespace-pre-wrap ${chat.unreadByAdmin ? 'text-white' : 'text-white/40'}`}>
                        {chat.lastMessage}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                       {chat.unreadByAdmin && (
                          <span className="w-1.5 h-1.5 bg-red-800 rounded-full"></span>
                       )}
                       <i className="fas fa-chevron-left text-[10px] text-white/10"></i>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="fixed inset-0 z-[600] flex flex-col h-full bg-[#1a0b2e] animate-in slide-in-from-left">
                <header className="p-5 border-b border-white/10 flex justify-between items-center bg-[#0d051a]">
                  <div className="flex items-center gap-3">
                    <img src={supportChats.find(c => c.id === selectedSupportChatId)?.userPhoto} className="w-11 h-11 rounded-2xl object-cover border border-white/10" />
                    <div>
                      <h4 className="text-white font-black text-sm">{supportChats.find(c => c.id === selectedSupportChatId)?.userName}</h4>
                      <p className="text-[8px] text-emerald-400 font-bold uppercase tracking-widest">محادثة الدعم المباشرة</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedSupportChatId(null)} className="w-10 h-10 rounded-xl bg-white/5 text-white flex items-center justify-center border border-white/10 active:scale-95 transition-all"><i className="fas fa-times"></i></button>
                </header>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide bg-black/20">
                  {supportMessages.map(msg => {
                    const isFromMe = msg.senderId === "SUPPORT_AGENT";
                    return (
                      <div key={msg.id} className={`flex items-start gap-3 ${isFromMe ? 'flex-row-reverse' : ''} animate-in fade-in`}>
                        <div className="w-9 h-9 rounded-2xl overflow-hidden border border-white/10 flex-shrink-0 shadow-lg">
                          {isFromMe ? (
                            <div className="w-full h-full bg-emerald-600 flex items-center justify-center text-white"><i className="fas fa-headset text-lg"></i></div>
                          ) : (
                            <img src={supportChats.find(c => c.id === selectedSupportChatId)?.userPhoto || "https://picsum.photos/100"} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className={`max-w-[75%] flex flex-col ${isFromMe ? 'items-end' : 'items-start'}`}>
                          <span className="text-[8px] font-black text-white/20 mb-1">{isFromMe ? 'أنا (الدعم الفني)' : 'المستخدم'}</span>
                          <div className={`px-4 py-3 rounded-2xl text-[12px] font-bold shadow-xl break-words whitespace-pre-wrap ${isFromMe ? 'bg-purple-600 text-white rounded-tr-none' : 'bg-white/10 text-white border border-white/10 rounded-tl-none'}`}>
                            {msg.text}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={adminSupportScrollRef} />
                </div>

                <form onSubmit={handleAdminSupportReply} className="p-4 pb-6 bg-[#0d051a] border-t border-white/10">
                  <div className="relative flex items-center gap-3">
                    <textarea 
                      value={adminSupportReply} 
                      onChange={e => setAdminSupportReply(e.target.value)}
                      placeholder="اكتب رد الإدارة هنا..." 
                      className="flex-1 bg-white/5 border border-white/10 rounded-[1.8rem] py-3.5 pr-6 pl-14 text-xs text-white outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all shadow-inner h-14 resize-none" 
                    />
                    <button 
                      type="submit" 
                      disabled={!adminSupportReply.trim()}
                      className="w-11 h-11 rounded-full bg-purple-600/30 backdrop-blur-md border border-purple-500/20 text-white flex items-center justify-center shadow-lg active:scale-90 transition-all disabled:opacity-30 flex-shrink-0"
                    >
                      <i className="fas fa-paper-plane text-xs"></i>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {adminTab === 'users' && (
          <div className="space-y-4">
            <div className="relative mb-4">
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-300/30 text-xs"><i className="fas fa-search"></i></span>
              <input type="text" value={searchId} onChange={(e) => setSearchId(e.target.value)} placeholder="بحث بواسطة الـ ID..." className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pr-10 pl-4 text-xs text-white outline-none focus:border-purple-500/40 shadow-inner" />
            </div>
            {filteredUsers.map(u => (
              <div key={u.id} className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-3 animate-in fade-in duration-300">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10">
                      <img src={u.animatedAvatar || u.photoURL} className="w-10 h-10 rounded-full object-cover border border-white/10" />
                    </div>
                    <div>
                      <p className="text-xs font-black">{normalizeDecoratedText(u.displayName)}</p>
                      <p className={`text-[9px] ${u.banUntil ? 'text-red-500 font-black' : 'text-purple-400'}`}>ID: {u.customId}</p>
                      <p className="text-[9px] text-white/50 mt-0.5 flex items-center gap-1">
                        <i className="fas fa-envelope text-[8px]"></i>
                        <span>{u.email || 'لا يوجد بريد'}</span>
                      </p>
                      <p className="text-[9px] text-yellow-500/80 mt-0.5 flex items-center gap-1.5 font-mono">
                        <i className="fas fa-key text-[8px]"></i>
                        {u.password ? (
                          <>
                            <span>{showPasswordMap[u.id] ? u.password : '••••••••'}</span>
                            <button 
                              type="button"
                              onClick={() => setShowPasswordMap(prev => ({ ...prev, [u.id]: !prev[u.id] }))} 
                              className="text-white/40 hover:text-white transition-colors p-0.5"
                            >
                              <i className={`fas ${showPasswordMap[u.id] ? 'fa-eye-slash' : 'fa-eye'} text-[8px]`}></i>
                            </button>
                          </>
                        ) : (
                          <span className="text-white/30 italic">غير متوفرة</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1"><i className="fas fa-coins text-yellow-500 text-[9px]"></i><span className="text-xs font-bold">{u.coins || 0}</span></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { setShowChargePopup(u.id); setChargeAmount(''); }} className="bg-green-600/20 text-green-400 text-[10px] py-2 rounded-xl border border-green-600/30 font-black">شحن</button>
                  <button onClick={() => { setShowDeductPopup(u.id); setDeductAmount(''); }} className="bg-orange-600/20 text-orange-400 text-[10px] py-2 rounded-xl border border-orange-600/30 font-black">خصم</button>
                  <button onClick={() => { 
                    setShowIdPopup(u.id); 
                    setNewCustomId(u.customId || ''); 
                    setNewCustomIdIcon(u.customIdIcon || null);
                    setIdOffsetX(u.idOffsetX ?? 28);
                    setIdOffsetY(u.idOffsetY ?? 0.5);
                  }} className="bg-blue-600/20 text-blue-400 text-[10px] py-2 rounded-xl border border-blue-600/30 font-black">تعديل ID</button>
                  <button onClick={() => setShowBanPopup(u.id)} className="bg-red-600/20 text-red-400 text-[10px] py-2 rounded-xl border border-red-600/30 font-black">حظر</button>
                  <button onClick={() => { setShowBadgesPopup(u.id); setBadgeUrl(''); }} className="bg-emerald-600/20 text-emerald-400 text-[10px] py-2 rounded-xl border border-emerald-600/30 font-black">شارات</button>
                  <button onClick={() => { setShowGrantPopup(u.id); }} className="bg-purple-600/20 text-purple-400 text-[10px] py-2 rounded-xl border border-purple-600/30 font-black">منح مخصص</button>
                  <button onClick={() => { setShowGrantAnimatedPopup(u.id); setAnimatedUrl(u.animatedAvatar || ''); }} className="bg-pink-600/20 text-pink-400 text-[10px] py-2 rounded-xl border border-pink-600/30 font-black">منح صورة متحركة</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {adminTab === 'rooms' && (
          <div className="space-y-4">
            <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest px-1">إدارة الغرف النشطة ({allRooms.length})</p>
            {allRooms.length === 0 ? (
              <div className="text-center py-20 opacity-20"><i className="fas fa-door-closed text-4xl mb-2"></i><p className="text-xs font-bold">لا توجد غرف نشطة</p></div>
            ) : allRooms.map(room => (
              <div key={room.id} className="bg-white/5 rounded-2xl border border-white/10 flex items-stretch gap-4 animate-in fade-in duration-300 overflow-hidden h-24">
                <div className="w-24 h-full flex-shrink-0 bg-black/40">
                  {isVideoUrl(room.coverImage) ? (
                    <video src={room.coverImage} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                  ) : (
                    <img src={room.coverImage} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 py-3 flex flex-col justify-center min-w-0">
                  <p className="text-xs font-black text-white truncate">{room.title}</p>
                  <p className="text-[9px] text-purple-400 font-bold">ID: {room.roomIdDisplay || room.id.substring(0,8)}</p>
                  <p className="text-[8px] text-white/40 mt-1 truncate">بواسطة: {room.owner?.name}</p>
                </div>
                <div className="flex items-center gap-2 px-3">
                  <div className="bg-white/5 px-2 py-1 rounded-lg border border-white/5 flex items-center gap-1 flex-shrink-0">
                    <i className="fas fa-users text-[8px] text-purple-400"></i>
                    <span className="text-[10px] font-black text-white">{room.participantsCount || 0}</span>
                  </div>
                  <button 
                    onClick={() => { setShowRoomCoverPopup(room.id); setAnimatedRoomCoverUrl(room.coverImage || ''); }}
                    className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-600/30 flex items-center justify-center active:scale-90 transition-all flex-shrink-0"
                    title="غلاف متحرك"
                  >
                    <i className="fas fa-magic text-xs"></i>
                  </button>
                  <button 
                    onClick={async () => {
                      if(confirm(`هل تريد حقاً حذف غرفة "${room.title}" نهائياً؟`)) {
                        await deleteDoc(doc(db, "rooms", room.id));
                        alert("تم حذف الغرفة");
                      }
                    }} 
                    className="w-9 h-9 rounded-xl bg-red-600/20 text-red-500 border border-red-600/30 flex items-center justify-center active:scale-90 transition-all flex-shrink-0"
                  >
                    <i className="fas fa-trash-alt text-xs"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {adminTab === 'gifts' && (
          <div className="space-y-6">
            <div className="bg-white/5 p-5 rounded-[2.5rem] border border-white/10 space-y-4 shadow-2xl">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <i className="fas fa-gift text-purple-400"></i>
                إضافة هدية جديدة
              </h3>
              
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-purple-400/60 uppercase mr-2 tracking-widest">اسم الهدية</label>
                  <input value={giftName} onChange={e => setGiftName(e.target.value)} placeholder="مثلاً: وردة، سيارة..." className="w-full bg-white/5 border border-white/10 p-3.5 rounded-2xl text-xs text-white outline-none focus:border-purple-500/40" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-purple-400/60 uppercase mr-2 tracking-widest">سعر الهدية (كوينز)</label>
                  <input type="number" value={giftPrice} onChange={e => setGiftPrice(e.target.value)} placeholder="100" className="w-full bg-white/5 border border-white/10 p-3.5 rounded-2xl text-xs text-white outline-none focus:border-purple-500/40" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-purple-400/60 uppercase mr-2 tracking-widest">رابط الأيقونة (PNG/Emoji)</label>
                  <input value={giftIcon} onChange={e => setGiftIcon(e.target.value)} placeholder="رابط صورة الهدية أو إيموجي..." className="w-full bg-white/5 border border-white/10 p-3.5 rounded-2xl text-[10px] text-white outline-none focus:border-purple-500/40 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-purple-400/60 uppercase mr-2 tracking-widest">رابط الأنيميشن (Gif/Mp4 - اختياري)</label>
                  <input value={giftAnimation} onChange={e => setGiftAnimation(e.target.value)} placeholder="رابط GIF أو فيديو الهدية..." className="w-full bg-white/5 border border-white/10 p-3.5 rounded-2xl text-[10px] text-white outline-none focus:border-purple-500/40 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-purple-400/60 uppercase mr-2 tracking-widest">القسم في صندوق الهدايا</label>
                  <select 
                    value={giftCategory} 
                    onChange={e => setGiftCategory(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 p-3.5 rounded-2xl text-xs text-white outline-none focus:border-purple-500/40"
                  >
                    <option value="normal">عادية</option>
                    <option value="cp">CP</option>
                    <option value="famous">مشاهير</option>
                    <option value="country">دولة</option>
                    <option value="vip">VIP</option>
                    <option value="birthday">ميلاد</option>
                  </select>
                </div>
              </div>

              <button 
                onClick={handlePublishGift}
                disabled={isPublishing}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 py-4 rounded-2xl font-black text-xs text-white shadow-xl active:scale-95 transition-all border border-white/10"
              >
                {isPublishing ? <i className="fas fa-spinner animate-spin"></i> : <span>نشر الهدية الآن</span>}
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest px-1">الهدايا الحالية ({allGifts.length})</p>
              <div className="grid grid-cols-2 gap-3">
                {allGifts.map(gift => (
                  <div key={gift.id} className="bg-white/5 p-4 rounded-3xl border border-white/5 flex flex-col items-center gap-2 relative group">
                    <div className="text-3xl mb-1">
                      {gift.icon.startsWith('http') ? (
                        <img src={gift.icon} className="w-10 h-10 object-contain" />
                      ) : gift.icon}
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-black text-white truncate w-24">{gift.name}</p>
                      <p className="text-[8px] text-yellow-500 font-bold">{gift.price} كوينز</p>
                      <span className="text-[7px] text-white/30 uppercase">{gift.tab}</span>
                    </div>
                    <button 
                      onClick={async () => {
                        if(confirm("حذف هذه الهدية؟")) {
                          await deleteDoc(doc(db, "gifts", gift.id));
                        }
                      }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-red-600/20 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <i className="fas fa-trash-alt text-[10px]"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {adminTab === 'emojis' && (
          <div className="space-y-6">
            <div className="bg-white/5 p-5 rounded-[2.5rem] border border-white/10 space-y-4 shadow-2xl">
              <h3 className="text-sm font-black text-white">إضافة GIF Emoji جديد</h3>
              <p className="text-[10px] text-purple-400/60 font-bold uppercase tracking-widest">ستظهر هذه الإيموجيات في قائمة الإيموجي داخل الغرف</p>
              
              <div className="space-y-2">
                <label className="text-[9px] font-black text-purple-400/60 uppercase mr-2 tracking-widest">رابط الإيموجي (URL)</label>
                <input 
                  type="text"
                  value={emojiUrl}
                  onChange={(e) => setEmojiUrl(e.target.value)}
                  placeholder="ضع رابط الـ GIF هنا (مثلاً: https://...)"
                  className="w-full bg-white/5 border border-white/10 py-4 px-6 rounded-2xl text-[10px] text-white outline-none focus:border-purple-500/40 transition-all shadow-inner font-mono" 
                />
              </div>

              {emojiUrl.trim() && (
                <div className="w-full aspect-square bg-black/40 rounded-3xl border border-white/10 flex flex-col items-center justify-center overflow-hidden">
                   <img 
                    src={emojiUrl} 
                    className="w-full h-full object-contain" 
                    alt="Emoji Preview" 
                   />
                   <p className="text-[8px] text-white/20 mt-2 font-black uppercase tracking-widest">معاينة الإيموجي</p>
                </div>
              )}

              <button 
                onClick={handlePublishEmoji}
                disabled={isPublishing}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 py-4 rounded-2xl font-black text-xs text-white shadow-xl active:scale-95 transition-all border border-white/10 flex items-center justify-center gap-3"
              >
                {isPublishing ? <i className="fas fa-spinner animate-spin"></i> : <><i className="fas fa-upload"></i><span>نشر الإيموجي الآن</span></>}
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest px-1">الإيموجيات الحالية ({allEmojis.length})</p>
              <div className="grid grid-cols-4 gap-3">
                {allEmojis.map(emoji => (
                  <div key={emoji.id} className="relative aspect-square bg-white/5 rounded-2xl border border-white/5 flex items-center justify-center p-2 group overflow-hidden shadow-lg">
                    <img src={emoji.imageUrl} className="w-full h-full object-contain" />
                    <button 
                      onClick={async () => {
                        if(confirm("هل تريد حذف هذا الإيموجي؟")) {
                          await deleteDoc(doc(db, "emojis", emoji.id));
                          alert("تم الحذف");
                        }
                      }}
                      className="absolute inset-0 bg-red-600/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[2px]"
                    >
                      <i className="fas fa-trash text-white"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {adminTab === 'store' && (
          <div className="space-y-6">
            <div className="bg-purple-600/10 p-5 rounded-[2rem] border border-purple-500/20 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-600 flex items-center justify-center text-white shadow-lg">
                <i className="fas fa-store text-xl"></i>
              </div>
              <div>
                <h3 className="text-sm font-black text-white">إدارة المتجر</h3>
                <p className="text-[10px] text-purple-300/60 font-bold">التحكم في محتوى المتجر العام</p>
              </div>
            </div>

            <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/5">
              {[
                {id: 'frames', label: 'الإطارات', icon: 'fa-id-badge'},
                {id: 'entries', label: 'الدخوليات', icon: 'fa-door-open'},
                {id: 'backgrounds', label: 'الخلفيات'}
              ].map(sec => (
                <button 
                  key={sec.id}
                  onClick={() => setStoreSection(sec.id as any)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black transition-all ${storeSection === sec.id ? 'bg-purple-600 text-white shadow-lg' : 'text-white/30'}`}
                >
                  <i className={`fas ${sec.icon}`}></i>
                  <span>{sec.label}</span>
                </button>
              ))}
            </div>

            {storeSection === 'frames' && (
              <div className="space-y-6">
                <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/10 space-y-5">
                   <h4 className="text-xs font-black text-white flex items-center gap-2 mb-2">
                     <i className="fas fa-plus-circle text-purple-400"></i>
                     إضافة إطار جديد للمتجر
                   </h4>
                   
                   <div className="flex flex-col items-center justify-center py-4 bg-black/20 rounded-3xl border border-white/5 relative overflow-hidden h-40">
                      <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 to-transparent"></div>
                      <div className="w-24 h-24 relative flex items-center justify-center z-10">
                        <div className="w-[70%] h-[70%] rounded-full overflow-hidden border-2 border-white/10 bg-purple-900/40">
                          <img src="https://picsum.photos/100" className="w-full h-full object-cover opacity-30 grayscale" alt="preview" />
                        </div>
                        {frameUrl && (
                          <img src={frameUrl} className="absolute inset-0 w-full h-full object-contain animate-pulse" alt="frame preview" />
                        )}
                      </div>
                      <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em] mt-3">معاينة حية للإطار</p>
                   </div>

                   <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-purple-400/60 uppercase mr-2">اسم الإطار</label>
                        <input value={frameName} onChange={e => setFrameName(e.target.value)} placeholder="مثلاً: التاج الذهبي..." className="w-full bg-white/5 border border-white/10 p-3.5 rounded-2xl text-xs text-white outline-none focus:border-purple-500/40" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-purple-400/60 uppercase mr-2">رابط صورة العرض (PNG)</label>
                        <input value={frameUrl} onChange={e => setFrameUrl(e.target.value)} placeholder="https://..." className="w-full bg-white/5 border border-white/10 p-3.5 rounded-2xl text-xs text-white outline-none focus:border-purple-500/40" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-purple-400/60 uppercase mr-2">سعر الإطار</label>
                          <input type="number" value={framePrice} onChange={e => setFramePrice(e.target.value)} placeholder="5000" className="w-full bg-white/5 border border-white/10 p-3.5 rounded-2xl text-xs text-white outline-none focus:border-purple-500/40" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-purple-400/60 uppercase mr-2">المدة (بالأيام)</label>
                          <input type="number" value={frameDuration} onChange={e => setFrameDuration(e.target.value)} placeholder="7" className="w-full bg-white/5 border border-white/10 p-3.5 rounded-2xl text-xs text-white outline-none focus:border-purple-500/40" />
                        </div>
                      </div>
                   </div>

                   <button 
                     onClick={handlePublishFrame}
                     disabled={isPublishing}
                     className="w-full bg-gradient-to-r from-purple-600 to-pink-600 py-4 rounded-2xl font-black text-xs text-white shadow-xl active:scale-95 transition-all border border-white/10 flex items-center justify-center gap-3"
                   >
                     {isPublishing ? <i className="fas fa-spinner animate-spin"></i> : <><i className="fas fa-rocket"></i><span>نشر في المتجر الآن</span></>}
                   </button>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest px-1">الإطارات الحالية ({storeFrames.length})</p>
                  <div className="grid grid-cols-2 gap-3">
                    {storeFrames.map(f => (
                      <div key={f.id} className="bg-white/5 p-4 rounded-3xl border border-white/5 flex flex-col items-center gap-3 relative group">
                        <div className="w-16 h-16 relative flex items-center justify-center">
                          <div className="w-[70%] h-[70%] rounded-full bg-white/5 border border-white/10"></div>
                          <img src={f.imageUrl} className="absolute inset-0 w-full h-full object-contain" />
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-black text-white truncate w-24">{f.name}</p>
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-[11px] font-bold text-yellow-500">{f.price}</span>
                            <i className="fas fa-coins text-[8px] text-yellow-500"></i>
                          </div>
                        </div>
                        <button 
                          onClick={async () => { 
                            if(confirm("حذف الإطار؟ سيتم حذفه من كافة حقائب المستخدمين أيضاً.")) {
                              await cleanupInventoryAndUsers(f.id, 'frame', f.imageUrl);
                              await deleteDoc(doc(db, "storeFrames", f.id));
                              alert("تم الحذف بنجاح.");
                            } 
                          }}
                          className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-red-600/20 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <i className="fas fa-trash-alt text-[10px]"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {storeSection === 'entries' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/10 space-y-6 shadow-2xl">
                   <h4 className="text-sm font-black text-white flex items-center gap-2 mb-2">
                     <i className="fas fa-plus-circle text-purple-400"></i>
                     إضافة دخولية جديدة للمتجر
                   </h4>
                   
                   <div className="flex flex-col items-center justify-center py-4 bg-black/40 rounded-3xl border border-white/5 relative overflow-hidden h-[320px] shadow-inner">
                      {entryVideoUrl ? (
                        <div className="w-full h-full relative group">
                          {entryVideoUrl.toLowerCase().includes('.svga') ? (
                             <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-indigo-900/20 backdrop-blur-sm">
                               <div className="w-20 h-20 rounded-full bg-indigo-500/20 flex items-center justify-center animate-bounce">
                                 <i className="fas fa-magic text-3xl text-indigo-400"></i>
                               </div>
                               <div className="text-center space-y-1">
                                 <p className="text-[11px] font-black text-white">تم اكتشاف ملف SVGA بنجاح</p>
                                 <p className="text-[9px] text-white/50 leading-relaxed px-8">ستظهر المعاينة الكاملة والحركة بعد النشر.</p>
                               </div>
                             </div>
                           ) : (
                             <video src={entryVideoUrl} autoPlay loop playsInline className="w-full h-full object-contain" />
                           )}
                        </div>
                      ) : entryPreviewImage ? (
                        <img src={entryPreviewImage} className="w-full h-full object-cover" alt="preview" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 opacity-20">
                          <i className="fas fa-film text-4xl text-white"></i>
                          <p className="text-[10px] font-black text-white uppercase tracking-[0.2em]">سيظهر الفيديو هنا عند وضع الرابط</p>
                        </div>
                      )}
                      
                      <button onClick={() => entryPreviewInputRef.current?.click()} className="absolute bottom-4 right-4 w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-xl active:scale-90 transition-transform z-20 border border-white/10">
                        <i className="fas fa-camera text-sm"></i>
                      </button>
                   </div>

                   <div className="space-y-5">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-purple-400/60 uppercase mr-2 tracking-widest">اسم الدخولية</label>
                        <input value={entryName} onChange={e => setEntryName(e.target.value)} placeholder="مثلاً: دخول الملك..." className="w-full bg-white/5 border border-white/10 py-4 px-6 rounded-2xl text-xs text-white outline-none focus:border-purple-500/40 transition-all shadow-inner" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-purple-400/60 uppercase mr-2 tracking-widest">رابط الدخولية (MP4 أو SVGA)</label>
                        <input value={entryVideoUrl} onChange={e => setEntryVideoUrl(e.target.value)} placeholder="ضع رابط الفيديو أو ملف SVGA هنا للمعاينة..." className="w-full bg-white/5 border border-white/10 py-4 px-6 rounded-2xl text-[10px] text-white outline-none focus:border-purple-500/40 transition-all shadow-inner font-mono" />
                      </div>
                      <div className="grid grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-purple-400/60 uppercase mr-2 tracking-widest">سعر الدخولية</label>
                          <input type="number" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} placeholder="10000" className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-xs text-white outline-none focus:border-purple-500/40 transition-all shadow-inner" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-purple-400/60 uppercase mr-2 tracking-widest">المدة (بالأيام)</label>
                          <input type="number" value={entryDuration} onChange={e => setEntryDuration(e.target.value)} placeholder="7" className="w-full bg-white/5 border border-white/10 py-4 px-6 rounded-2xl text-xs text-white outline-none focus:border-purple-500/40 transition-all shadow-inner" />
                        </div>
                      </div>
                   </div>

                   <button onClick={handlePublishEntry} disabled={isPublishing} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 py-5 rounded-2xl font-black text-xs text-white shadow-xl active:scale-95 transition-all border border-white/10 flex items-center justify-center gap-3 mt-4">
                     {isPublishing ? <i className="fas fa-spinner animate-spin"></i> : <><i className="fas fa-rocket"></i><span>نشر الدخولية الآن</span></>}
                   </button>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest px-1">الدخوليات الحالية ({storeEntries.length})</p>
                  <div className="grid grid-cols-2 gap-4">
                    {storeEntries.map(e => (
                      <div key={e.id} className="bg-white/5 p-4 rounded-3xl border border-white/5 flex flex-col items-center gap-3 relative group overflow-hidden shadow-xl">
                        <div className="w-full aspect-square rounded-2xl overflow-hidden bg-black/40 border border-white/5 shadow-inner relative">
                          <img src={e.previewImage} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="preview" />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <i className="fas fa-play text-white opacity-40 text-2xl"></i>
                          </div>
                        </div>
                        <div className="text-center w-full">
                          <p className="text-[11px] font-black text-white truncate w-full">{e.name}</p>
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-[11px] font-bold text-yellow-500">{e.price}</span>
                            <i className="fas fa-coins text-[8px] text-yellow-500"></i>
                          </div>
                        </div>
                        <button onClick={async () => { 
                            if(confirm("حذف الدخولية؟")) {
                              await cleanupInventoryAndUsers(e.id, 'entry', e.videoUrl);
                              await deleteDoc(doc(db, "storeEntries", e.id));
                              alert("تم الحذف بنجاح.");
                            } 
                          }} className="absolute top-2 right-2 w-8 h-8 rounded-xl bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg active:scale-90">
                          <i className="fas fa-trash-alt text-[10px]"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {storeSection === 'backgrounds' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/10 space-y-6 shadow-2xl">
                   <h4 className="text-sm font-black text-white flex items-center gap-2 mb-2">
                     <i className="fas fa-plus-circle text-purple-400"></i>
                     إضافة خلفية جديدة للمتجر
                   </h4>
                   
                   <div className="flex flex-col items-center justify-center py-4 bg-black/40 rounded-3xl border border-white/5 relative overflow-hidden h-[450px] shadow-inner">
                      {storeBgImage ? (
                        <img src={storeBgImage} className="w-full h-full object-cover" alt="bg preview" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 opacity-20">
                          <i className="fas fa-image text-4xl text-white"></i>
                          <p className="text-[10px] font-black text-white uppercase tracking-[0.2em]">اختر صورة الخلفية للمعاينة</p>
                        </div>
                      )}
                      
                      <button onClick={() => storeBgInputRef.current?.click()} className="absolute bottom-4 right-4 w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-xl active:scale-90 transition-transform z-20 border border-white/10">
                        <i className="fas fa-camera text-sm"></i>
                      </button>
                   </div>

                   <div className="space-y-5">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-purple-400/60 uppercase mr-2 tracking-widest">اسم الخلفية</label>
                        <input value={storeBgName} onChange={e => setStoreBgName(e.target.value)} placeholder="مثلاً: خلفية القمر..." className="w-full bg-white/5 border border-white/10 py-4 px-6 rounded-2xl text-xs text-white outline-none focus:border-purple-500/40 transition-all shadow-inner" />
                      </div>
                      <div className="grid grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-purple-400/60 uppercase mr-2 tracking-widest">سعر الخلفية</label>
                          <input type="number" value={storeBgPrice} onChange={e => setStoreBgPrice(e.target.value)} placeholder="20000" className="w-full bg-white/5 border border-white/10 rounded-2xl text-xs text-white outline-none focus:border-purple-500/40 transition-all shadow-inner" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-purple-400/60 uppercase mr-2 tracking-widest">المدة (بالأيام)</label>
                          <input type="number" value={storeBgDuration} onChange={e => setStoreBgDuration(e.target.value)} placeholder="7" className="w-full bg-white/5 border border-white/10 rounded-2xl text-xs text-white outline-none focus:border-purple-500/40 transition-all shadow-inner" />
                        </div>
                      </div>
                   </div>

                   <button onClick={handlePublishStoreBg} disabled={isPublishing} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 py-5 rounded-2xl font-black text-xs text-white shadow-xl active:scale-95 transition-all border border-white/10 flex items-center justify-center gap-3 mt-4">
                     {isPublishing ? <i className="fas fa-spinner animate-spin"></i> : <><i className="fas fa-rocket"></i><span>نشر الخلفية الآن</span></>}
                   </button>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest px-1">خلفيات المتجر الحالية ({storeBackgrounds.length})</p>
                  <div className="grid grid-cols-2 gap-4">
                    {storeBackgrounds.map(bg => (
                      <div key={bg.id} className="bg-white/5 p-3 rounded-[2rem] border border-white/5 flex flex-col gap-3 relative group overflow-hidden shadow-xl">
                        <div className="w-full aspect-[9/16] rounded-2xl overflow-hidden bg-black/40 border border-white/5 shadow-inner">
                          <img src={bg.imageUrl} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-col items-center gap-1.5">
                          <p className="text-[12px] font-black text-white truncate w-full text-center">{bg.name}</p>
                          <div className="flex items-center justify-center gap-1.5 py-0.5">
                            <span className="text-[11px] font-black text-yellow-500">{(bg.price || 0).toLocaleString('ar-EG')}</span>
                            <i className="fas fa-coins text-[8px] text-yellow-500"></i>
                          </div>
                        </div>
                        <button onClick={async () => { 
                            if(confirm("هل تريد حذف هذه خلفية؟")) {
                              await cleanupInventoryAndUsers(bg.id, 'background', bg.imageUrl);
                              await deleteDoc(doc(db, "storeBackgrounds", bg.id));
                              alert("تم الحذف بنجاح.");
                            } 
                          }} className="absolute top-2 right-2 w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg active:scale-90">
                          <i className="fas fa-trash-alt text-[10px]"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {adminTab === 'messages' && (
          <div className="space-y-6">
            <div className="bg-white/5 p-5 rounded-[2.5rem] border border-white/10 space-y-4 shadow-2xl">
              <h3 className="text-sm font-black text-white mb-2">إرسال رسالة رسمية جديدة</h3>
              <div className="space-y-1.5"><label className="text-[9px] font-black text-purple-400/60 uppercase mr-2">عنوان الرسالة</label><input value={msgTitle} onChange={e => setMsgTitle(e.target.value)} placeholder="مثلاً: صيانة طارئة..." className="w-full bg-white/5 border border-white/10 p-3.5 rounded-2xl text-xs text-white outline-none focus:border-purple-500/40 shadow-inner" /></div>
              <div className="space-y-1.5"><label className="text-[9px] font-black text-purple-400/60 uppercase mr-2">محتوى الرسالة</label><textarea value={msgDesc} onChange={e => setMsgDesc(e.target.value)} placeholder="اكتب التفاصيل..." className="w-full bg-white/5 border border-white/10 p-3.5 rounded-2xl text-xs text-white outline-none h-24 focus:border-purple-500/40 shadow-inner" /></div>
              <div className="space-y-1.5"><label className="text-[9px] font-black text-purple-400/60 uppercase mr-2">صورة الرسالة (اختياري)</label><button onClick={() => msgImageRef.current?.click()} className="w-full aspect-video bg-white/5 rounded-[2rem] flex flex-col items-center justify-center border-2 border-dashed border-white/10 overflow-hidden group hover:bg-white/10 transition-all">{msgImage ? <img src={msgImage} className="w-full h-full object-cover" /> : <div className="flex flex-col items-center gap-2 opacity-20 group-hover:opacity-40 transition-opacity"><i className="fas fa-image text-3xl"></i><span className="text-[10px] font-black">اختر صورة</span></div>}</button></div>
              <button onClick={async () => {
                  if (!msgTitle || !msgDesc) return alert("يرجى ملأ العنوان والوصف");
                  await addDoc(collection(db, "officialNotifications"), { title: msgTitle, desc: msgDesc, image: msgImage || null, icon: 'fa-bullhorn', createdAt: serverTimestamp() });
                  setMsgTitle(''); setMsgDesc(''); setMsgImage(null); alert("تم الإرسال");
                }} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 py-4 rounded-2xl font-black text-xs text-white shadow-xl active:scale-95 transition-all mt-4 border border-white/10">بث الرسالة الآن</button>
            </div>
          </div>
        )}

        {adminTab === 'news' && (
          <div className="space-y-4">
            <div className="bg-white/5 p-4 rounded-2xl space-y-3">
              <input value={newsTitle} onChange={e => setNewsTitle(e.target.value)} placeholder="العنوان" className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-xs text-white outline-none" />
              <textarea value={newsDesc} onChange={e => setNewsDesc(e.target.value)} placeholder="الوصف" className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-xs text-white outline-none h-20" />
              <button onClick={() => newsInputRef.current?.click()} className="w-full bg-white/10 py-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 text-white">{newsImage ? <i className="fas fa-check text-green-500"></i> : <i className="fas fa-image"></i>} اختر صورة</button>
              <button onClick={async () => {
                if (!newsTitle || !newsImage) return alert("أكمل البيانات");
                await addDoc(collection(db, "news"), { title: newsTitle, desc: newsDesc, image: newsImage, createdAt: serverTimestamp() });
                setNewsTitle(''); setNewsDesc(''); setNewsImage(null); alert("تم الإضافة");
              }} className="w-full bg-purple-600 py-3 rounded-xl text-xs font-black shadow-lg text-white">إضافة الخبر</button>
            </div>
          </div>
        )}

        {adminTab === 'banners' && (
          <div className="space-y-6">
             <div className="bg-white/5 p-4 rounded-2xl space-y-3">
                <input value={bannerTitle} onChange={e => setBannerTitle(e.target.value)} placeholder="عنوان البنر" className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-xs text-white outline-none" />
                <button onClick={() => bannerInputRef.current?.click()} className="w-full aspect-video bg-white/5 rounded-2xl flex items-center justify-center border-2 border-dashed border-white/10 overflow-hidden">{bannerImage ? <img src={bannerImage} className="w-full h-full object-cover" /> : <i className="fas fa-plus text-2xl opacity-20 text-white"></i>}</button>
                <button onClick={async () => {
                  if (!bannerImage) return alert("اختر صورة");
                  await addDoc(collection(db, "banners"), { title: bannerTitle, imageUrl: bannerImage, createdAt: serverTimestamp() });
                  setBannerTitle(''); setBannerImage(null); alert("تم الإضافة");
                }} className="w-full bg-purple-600 py-3 rounded-xl text-xs font-black shadow-lg text-white">إضافة البنر</button>
             </div>
             <div className="space-y-4">
              <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest px-1">البنرات الحالية ({allBanners.length})</p>
              <div className="grid grid-cols-1 gap-4">{allBanners.map(banner => (
                  <div key={banner.id} className="relative aspect-video rounded-2xl overflow-hidden bg-white/5 border border-white/5 group shadow-xl"><img src={banner.imageUrl} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-4 flex flex-col justify-end"><p className="text-xs font-black text-white">{banner.title}</p></div><button onClick={async () => { if(confirm("حذف؟")) await deleteDoc(doc(db, "banners", banner.id)); }} className="absolute top-2 right-2 w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg active:scale-90"><i className="fas fa-trash-alt text-[10px]"></i></button></div>
                ))}</div>
            </div>
          </div>
        )}

        {adminTab === 'bgs' && (
          <div className="space-y-8">
            <div className="bg-white/5 p-4 rounded-2xl space-y-3 border border-white/5 shadow-xl">
              <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2">إضافة خلفية غرفة مجانية</p>
              <button onClick={() => roomBgInputRef.current?.click()} className="w-full aspect-[9/16] bg-white/5 rounded-2xl flex items-center justify-center border-2 border-dashed border-white/10 overflow-hidden group">{roomBgImage ? <img src={roomBgImage} className="w-full h-full object-cover" /> : <i className="fas fa-plus text-2xl opacity-20 text-white group-hover:opacity-40 transition-opacity"></i>}</button>
              <button onClick={async () => {
                if (!roomBgImage) return alert("اختر صورة");
                await addDoc(collection(db, "roomBackgrounds"), { imageUrl: roomBgImage, createdAt: serverTimestamp() });
                setRoomBgImage(null); alert("تم الإضافة");
              }} className="w-full bg-purple-600 py-3 rounded-xl text-xs font-black text-white shadow-lg active:scale-95 transition-transform">إضافة الخلفية للغرف</button>
            </div>
            <div className="space-y-4">
              <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest px-1">الخلفيات المجانية الحالية ({allRoomBgs.length})</p>
              <div className="grid grid-cols-3 gap-2">{allRoomBgs.map(bg => (
                  <div key={bg.id} className="relative aspect-[9/16] rounded-xl overflow-hidden bg-white/5 border border-white/5 group shadow-lg">{isVideoUrl(bg.imageUrl) ? <video src={bg.imageUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" /> : <img src={bg.imageUrl} className="w-full h-full object-cover" />}<button onClick={async () => { if(confirm("حذف؟")) await deleteDoc(doc(db, "roomBackgrounds", bg.id)); }} className="absolute top-1 right-1 w-6 h-6 rounded-lg bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm shadow-lg active:scale-90"><i className="fas fa-trash-alt text-[10px]"></i></button></div>
                ))}</div>
            </div>
          </div>
        )}

        {adminTab === 'design' && (
          <div className="space-y-6">
            <div className="bg-white/5 p-5 rounded-[2rem] border border-white/10 space-y-6 shadow-2xl">
              <div className="flex justify-between items-center"><p className="text-[10px] font-black text-purple-400 uppercase tracking-widest">تخصيص أيقونات الميكروفونات والكروت</p></div>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2"><label className="text-[9px] font-bold text-white/40 mr-2 uppercase tracking-tighter">أيقونة المايك المفتوح</label><button onClick={() => micOpenInputRef.current?.click()} className="w-full h-16 bg-black/40 rounded-2xl border-2 border-dashed border-white/5 flex items-center justify-center overflow-hidden transition-all hover:bg-black/60">{micOpenIcon ? <img src={micOpenIcon} className="h-10 w-10 object-contain" /> : <i className="fas fa-plus text-white/20"></i>}</button></div>
                <div className="space-y-2"><label className="text-[9px] font-bold text-white/40 mr-2 uppercase tracking-tighter">أيقونة المايك المغلق (Lock)</label><button onClick={() => micLockedInputRef.current?.click()} className="w-full h-16 bg-black/40 rounded-2xl border-2 border-dashed border-white/5 flex items-center justify-center overflow-hidden transition-all hover:bg-black/60">{micLockedIcon ? <img src={micLockedIcon} className="h-10 w-10 object-contain" /> : <i className="fas fa-plus text-white/20"></i>}</button></div>
                
                {/* Wave Room Feature */}
                <div className="space-y-2 pt-4 border-t border-white/5">
                  <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest mr-2">Wave room (أيقونة الموجات الصوتية)</label>
                  <div className="space-y-3">
                    <button onClick={() => waveRoomInputRef.current?.click()} className="w-full h-16 bg-black/40 rounded-2xl border-2 border-dashed border-white/5 flex items-center justify-center overflow-hidden transition-all hover:bg-black/60">
                      {waveRoomIcon ? <img src={waveRoomIcon} className="h-full object-contain" alt="wave" /> : <div className="flex flex-col items-center opacity-20"><i className="fas fa-wave-square mb-1"></i><span className="text-[8px] font-black uppercase">اختر الأيقونة</span></div>}
                    </button>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-white/20 ml-2 uppercase">أو ضع رابط الموجات هنا</label>
                      <input 
                        type="text" 
                        value={waveRoomIcon || ''} 
                        onChange={e => setWaveRoomIcon(e.target.value)} 
                        placeholder="https://..." 
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-[10px] text-white outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={saveDesignSettings} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 py-4 rounded-2xl font-black text-xs text-white shadow-xl active:scale-95 transition-transform border border-white/10">حفظ التغييرات</button>
            </div>
          </div>
        )}
      </div>

      {showChargePopup && (
        <div className="fixed inset-0 z-[700] bg-black/60 backdrop-blur-md flex items-center justify-center p-6"><div className="bg-[#1a0b2e] w-full max-w-[280px] rounded-[2rem] border border-white/10 p-6 shadow-2xl flex flex-col gap-4"><h4 className="text-sm font-black text-white text-center">شحن كوينز</h4><input type="number" value={chargeAmount} onChange={e => setChargeAmount(e.target.value)} placeholder="الكمية..." className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-xs text-white outline-none text-center" /><div className="flex gap-2"><button onClick={handleChargeSubmit} className="flex-1 bg-green-600 py-3 rounded-xl text-[10px] font-black text-white">تأكيد</button><button onClick={() => setShowChargePopup(null)} className="flex-1 bg-white/5 py-3 rounded-xl text-[10px] font-black text-white border border-white/10">إلغاء</button></div></div></div>
      )}

      {showDeductPopup && (
        <div className="fixed inset-0 z-[700] bg-black/60 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setShowDeductPopup(null)}>
          <div className="bg-[#1a0b2e] w-full max-w-[280px] rounded-[2.5rem] border border-white/10 p-6 shadow-2xl flex flex-col gap-5" onClick={e => e.stopPropagation()}>
            <h4 className="text-sm font-black text-white text-center">خصم كوينز</h4>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-orange-400/60 mr-2 uppercase tracking-widest">عدد الكوينز المراد خصمها</label>
              <input type="number" value={deductAmount} onChange={e => setDeductAmount(e.target.value)} placeholder="المبلغ..." className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 text-xs text-white outline-none text-center shadow-inner" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleDeductSubmit} className="flex-1 bg-orange-600 py-3.5 rounded-xl text-[11px] font-black text-white shadow-lg active:scale-95 transition-all">سحب الرصيد</button>
              <button onClick={() => { setShowDeductPopup(null); setDeductAmount(''); }} className="flex-1 bg-white/5 py-3.5 rounded-xl text-[11px] font-black text-white border border-white/10 active:scale-95 transition-all">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {showIdPopup && (
        <div className="fixed inset-0 z-[700] bg-black/60 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setShowIdPopup(null)}>
          <div className="bg-[#1a0b2e] w-full max-w-[340px] rounded-[2.5rem] border border-white/10 p-6 shadow-2xl flex flex-col gap-5 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <h4 className="text-sm font-black text-white text-center">تعديل وتصميم الـ ID</h4>
            
            <div className="bg-black/40 rounded-3xl border border-white/5 p-4 flex flex-col items-center justify-center relative overflow-hidden h-36">
               <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent"></div>
               {newCustomIdIcon ? (
                 <div className="relative w-[120px] h-[36px] flex items-center bg-contain bg-center bg-no-repeat transition-all" style={{ backgroundImage: `url(${newCustomIdIcon})` }}>
                    <span className="text-[11px] font-black text-white tracking-widest text-center w-full block drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" 
                          style={{ paddingLeft: `${idOffsetX}px`, paddingTop: `${idOffsetY}px` }}>
                      {newCustomId || 'ID PREVIEW'}
                    </span>
                 </div>
               ) : (
                 <span className="text-blue-400 font-black text-sm px-4 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20">{newCustomId || 'ID PREVIEW'}</span>
               )}
               <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em] mt-3">معاينة حية للمظهر</p>
            </div>

            <div className="space-y-4">
               <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-purple-400/60 mr-1 uppercase">النص المكتوب (ID)</label>
                  <input type="text" value={newCustomId} onChange={e => setNewCustomId(e.target.value)} placeholder="ادخل النص هنا..." className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-xs text-white outline-none font-black shadow-inner" />
               </div>

               <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-purple-400/60 mr-1 uppercase">رابط أيقونة الـ ID (PNG)</label>
                  <div className="flex gap-2">
                    <input type="text" value={newCustomIdIcon || ''} onChange={e => setNewCustomIdIcon(e.target.value)} placeholder="رابط مباشر للصورة..." className="flex-1 bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-[10px] text-white outline-none font-mono" />
                    <button onClick={() => idIconInputRef.current?.click()} className="w-11 h-11 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white/40 active:scale-90"><i className="fas fa-camera"></i></button>
                  </div>
               </div>

               {newCustomIdIcon && (
                 <div className="space-y-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                    <label className="text-[9px] font-black text-white/30 uppercase block text-center mb-1">تحديد موضع النص بالأسهم</label>
                    <div className="flex flex-col items-center gap-2">
                       <button onClick={() => setIdOffsetY(prev => prev - 0.5)} className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center active:bg-purple-600 transition-colors"><i className="fas fa-chevron-up text-xs"></i></button>
                       <div className="flex gap-6">
                          <button onClick={() => setIdOffsetX(prev => prev - 0.5)} className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center active:bg-purple-600 transition-colors"><i className="fas fa-chevron-right text-xs"></i></button>
                          <button onClick={() => setIdOffsetX(prev => prev + 0.5)} className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center active:bg-purple-600 transition-colors"><i className="fas fa-chevron-left text-xs"></i></button>
                       </div>
                       <button onClick={() => setIdOffsetY(prev => prev + 0.5)} className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center active:bg-purple-600 transition-colors"><i className="fas fa-chevron-down text-xs"></i></button>
                    </div>
                    <div className="flex justify-between mt-2 px-2">
                       <span className="text-[8px] font-bold text-purple-400/60">X: {idOffsetX}</span>
                       <span className="text-[8px] font-bold text-purple-400/60">Y: {idOffsetY}</span>
                    </div>
                 </div>
               )}
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={handleIdUpdateSubmit} className="flex-1 bg-blue-600 py-4 rounded-2xl text-[11px] font-black text-white shadow-lg active:scale-95 transition-all">حفظ وتطبق</button>
              <button onClick={() => { setShowIdPopup(null); setNewCustomIdIcon(null); }} className="flex-1 bg-white/5 py-4 rounded-2xl text-[11px] font-black text-white border border-white/10 active:scale-95 transition-all">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {showGrantPopup && (
        <div className="fixed inset-0 z-[700] bg-black/60 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setShowGrantPopup(null)}>
          <div className="bg-[#1a0b2e] w-full max-w-[340px] rounded-[2.5rem] border border-white/10 p-6 shadow-2xl flex flex-col gap-5 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <h4 className="text-sm font-black text-white text-center">منح عنصر مخصص للمستخدم</h4>
            
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {['frame', 'entry', 'background'].map((t) => (
                  <button key={t} onClick={() => setGrantType(t as any)} className={`py-2 rounded-xl text-[10px] font-black transition-all border ${grantType === t ? 'bg-purple-600 text-white border-purple-500' : 'bg-white/5 text-white/30 border-white/10'}`}>
                    {t === 'frame' ? 'إطار' : t === 'entry' ? 'دخولية' : 'خلفية'}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-purple-400/60 uppercase mr-1">اسم العنصر</label>
                <input type="text" value={grantName} onChange={e => setGrantName(e.target.value)} placeholder="مثلاً: التاج الملكي..." className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-xs text-white outline-none shadow-inner" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-purple-400/60 uppercase mr-1">رابط الملف (Gif/Mp4)</label>
                <input type="text" value={grantUrl} onChange={e => setGrantUrl(e.target.value)} placeholder="https://..." className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-[10px] text-white outline-none font-mono shadow-inner" />
              </div>

              {grantType === 'entry' && (
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-purple-400/60 uppercase mr-1">صورة معاينة الدخولية</label>
                  <div className="flex gap-2">
                    <input type="text" value={grantPreview || ''} onChange={e => setGrantPreview(e.target.value)} placeholder="رابط صورة PNG..." className="flex-1 bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-[10px] text-white outline-none font-mono" />
                    <button onClick={() => grantPreviewInputRef.current?.click()} className="w-11 h-11 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white/40 active:scale-90"><i className="fas fa-camera"></i></button>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-purple-400/60 uppercase mr-1">المدة (بالأيام)</label>
                <input type="number" value={grantDuration} onChange={e => setGrantDuration(e.target.value)} placeholder="7" className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-xs text-white outline-none shadow-inner" />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                onClick={handleGrantItem} 
                disabled={isPublishing}
                className="flex-1 bg-purple-600 py-4 rounded-2xl text-[11px] font-black text-white shadow-lg active:scale-95 transition-all"
              >
                {isPublishing ? <i className="fas fa-spinner animate-spin"></i> : 'منح العنصر الآن'}
              </button>
              <button onClick={() => setShowGrantPopup(null)} className="flex-1 bg-white/5 py-4 rounded-2xl text-[11px] font-black text-white border border-white/10 active:scale-95 transition-all">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {showGrantAnimatedPopup && (
        <div className="fixed inset-0 z-[700] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in" onClick={() => setShowGrantAnimatedPopup(null)}>
          <div className="bg-[#1a0b2e] w-full max-w-[300px] rounded-[2rem] border border-white/10 p-5 shadow-2xl flex flex-col gap-3" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-12 h-12 bg-pink-500/20 rounded-2xl flex items-center justify-center text-pink-500 mx-auto mb-2 border border-pink-500/20 shadow-lg"><i className="fas fa-image text-xl"></i></div>
              <h4 className="text-sm font-black text-white">إدارة الصورة المتحركة</h4>
              <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest">تظهر على المايك والبروفايل</p>
            </div>
            
            <div className="space-y-2">
              <div className="w-full h-32 rounded-2xl bg-black/40 border border-white/10 overflow-hidden flex flex-col items-center justify-center relative">
                {animatedUrl.trim() ? (
                  isVideoUrl(animatedUrl) ? (
                    <video src={animatedUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                  ) : (
                    <img src={animatedUrl} className="w-full h-full object-cover" />
                  )
                ) : (
                  <div className="opacity-20 flex flex-col items-center gap-1">
                    <i className="fas fa-image text-2xl"></i>
                    <p className="text-[8px] font-black uppercase">معاينة حية</p>
                  </div>
                )}
              </div>
              
              <div className="space-y-1">
                <label className="text-[8px] font-black text-pink-400/60 mr-1 uppercase">رابط الصورة (GIF/MP4)</label>
                <input type="text" value={animatedUrl} onChange={e => setAnimatedUrl(e.target.value)} placeholder="ضع الرابط هنا..." className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-[10px] text-white outline-none font-mono shadow-inner" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <button onClick={handleGrantAnimatedAvatar} disabled={isPublishing} className="w-full bg-pink-600 py-3 rounded-xl text-[10px] font-black text-white shadow-lg active:scale-95 transition-all">
                {isPublishing ? <i className="fas fa-spinner animate-spin"></i> : (animatedUrl.trim() ? 'حفظ وتحديث' : 'منح الآن')}
              </button>
              {allUsers.find(u => u.id === showGrantAnimatedPopup)?.animatedAvatar && (
                <button 
                  onClick={() => { setAnimatedUrl(''); setTimeout(handleGrantAnimatedAvatar, 100); }} 
                  disabled={isPublishing} 
                  className="w-full bg-red-600/20 text-red-400 py-2.5 rounded-xl text-[10px] font-black border border-red-600/30 active:scale-95 transition-all"
                >
                  حذف الصورة الحالية
                </button>
              )}
              <button onClick={() => setShowGrantAnimatedPopup(null)} className="w-full bg-white/5 py-2 rounded-xl text-[10px] font-black text-white border border-white/10 active:scale-95 transition-all">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {showRoomCoverPopup && (
        <div className="fixed inset-0 z-[700] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in" onClick={() => setShowRoomCoverPopup(null)}>
          <div className="bg-[#1a0b2e] w-full max-w-[300px] rounded-[2rem] border border-white/10 p-5 shadow-2xl flex flex-col gap-3" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-500/20 rounded-2xl flex items-center justify-center text-purple-500 mx-auto mb-2 border border-purple-500/20 shadow-lg"><i className="fas fa-magic text-xl"></i></div>
              <h4 className="text-sm font-black text-white">غلاف الغرفة المتحرك</h4>
              <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest">تغيير مظهر الغرفة العام</p>
            </div>
            
            <div className="space-y-2">
              <div className="w-full h-32 rounded-2xl bg-black/40 border border-white/10 overflow-hidden flex flex-col items-center justify-center relative">
                {animatedRoomCoverUrl.trim() ? (
                  isVideoUrl(animatedRoomCoverUrl) ? (
                    <video src={animatedRoomCoverUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                  ) : (
                    <img src={animatedRoomCoverUrl} className="w-full h-full object-cover" />
                  )
                ) : (
                  <div className="opacity-20 flex flex-col items-center gap-1">
                    <i className="fas fa-film text-2xl"></i>
                    <p className="text-[8px] font-black uppercase">معاينة الغلاف</p>
                  </div>
                )}
              </div>
              
              <div className="space-y-1">
                <label className="text-[8px] font-black text-purple-400/60 mr-1 uppercase">رابط الغلاف (GIF/MP4)</label>
                <input type="text" value={animatedRoomCoverUrl} onChange={e => setAnimatedRoomCoverUrl(e.target.value)} placeholder="ضع رابط الغلاف هنا..." className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-[10px] text-white outline-none font-mono shadow-inner" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <button onClick={handleSetAnimatedRoomCover} disabled={isPublishing} className="w-full bg-purple-600 py-3 rounded-xl text-[10px] font-black text-white shadow-lg active:scale-95 transition-all">
                {isPublishing ? <i className="fas fa-spinner animate-spin"></i> : 'تحديث غلاف الغرفة'}
              </button>
              <button onClick={() => setShowRoomCoverPopup(null)} className="w-full bg-white/5 py-2 rounded-xl text-[10px] font-black text-white border border-white/10 active:scale-95 transition-all">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {showBanPopup && (
        <div className="fixed inset-0 z-[700] bg-black/60 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setShowBanPopup(null)}>
          <div className="bg-[#1a0b2e] w-full max-w-[300px] rounded-[2rem] border border-white/10 p-6 shadow-2xl flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <h4 className="text-sm font-black text-white text-center">حظر المستخدم</h4>
            <div className="grid grid-cols-1 gap-2">
              <button onClick={() => handleBanSubmit(1)} className="w-full py-3 bg-white/5 text-white text-[11px] font-black rounded-xl border border-white/10">حظر لمدة يوم</button>
              <button onClick={() => handleBanSubmit(7)} className="w-full py-3 bg-white/5 text-white text-[11px] font-black rounded-xl border border-white/10">حظر لمدة أسبوع</button>
              <button onClick={() => handleBanSubmit(30)} className="w-full py-3 bg-white/5 text-white text-[11px] font-black rounded-xl border border-white/10">حظر لمدة شهر</button>
              <button onClick={() => handleBanSubmit('permanent')} className="w-full py-3 bg-red-600/20 text-red-500 text-[11px] font-black rounded-xl border border-red-600/30">حظر نهائي</button>
              <button onClick={() => handleUserUpdate(showBanPopup!, { banUntil: deleteField() }).then(() => { setShowBanPopup(null); alert("تم فك الحظر"); })} className="w-full py-3 bg-green-600/20 text-green-400 text-[11px] font-black rounded-xl border border-green-600/30">فك الحظر</button>
            </div>
            <button onClick={() => setShowBanPopup(null)} className="w-full py-2 text-[10px] font-black text-white/30">إلغاء</button>
          </div>
        </div>
      )}

      {showBadgesPopup && (
        <div className="fixed inset-0 z-[700] bg-black/60 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowBadgesPopup(null)}>
          <div className="bg-[#1a0b2e] w-full max-w-[380px] max-h-[80vh] rounded-[2.5rem] border border-white/10 p-6 shadow-2xl flex flex-col gap-6 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <h4 className="text-sm font-black text-white">إدارة شارات المستخدم</h4>
              <p className="text-[9px] text-white/30 uppercase tracking-widest mt-1">تظهر في بروفايل المستخدم</p>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={badgeUrl} 
                  onChange={e => setBadgeUrl(e.target.value)} 
                  placeholder="رابط الشارة (PNG)..." 
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-[10px] text-white outline-none font-mono"
                />
                <button 
                  onClick={handleGiveBadge}
                  disabled={isPublishing}
                  className="px-4 bg-emerald-600 rounded-xl text-[10px] font-black text-white shadow-lg disabled:opacity-50"
                >
                  {isPublishing ? <i className="fas fa-spinner animate-spin"></i> : 'منح'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2 scrollbar-hide">
              <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2">الشارات الحالية ({userBadges.length})</p>
              <div className="grid grid-cols-4 gap-3">
                {userBadges.map(badge => (
                  <div key={badge.id} className="relative aspect-square bg-white/5 rounded-xl border border-white/5 p-2 flex items-center justify-center group overflow-hidden">
                    <img src={badge.imageUrl} className="w-full h-full object-contain" />
                    <button 
                      onClick={() => handleRemoveBadge(badge.id)}
                      className="absolute inset-0 bg-red-600/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all"
                    >
                      <i className="fas fa-trash text-white text-xs"></i>
                    </button>
                  </div>
                ))}
                {userBadges.length === 0 && (
                  <div className="col-span-4 text-center py-6 opacity-20">
                    <p className="text-[10px] font-bold">لا توجد شارات لدى المستخدم</p>
                  </div>
                )}
              </div>
            </div>

            <button onClick={() => setShowBadgesPopup(null)} className="w-full py-3 bg-white/5 text-white/40 rounded-xl text-[10px] font-black border border-white/10">إغلاق</button>
          </div>
        </div>
      )}

      <style>{`
        .animate-pulse-slow { animation: pulse 2s infinite ease-in-out; }
        @keyframes pulse { 0%, 100% { transform: scale(1.1); } 50% { transform: scale(1.15); } }
      `}</style>
    </div>
  );
};
