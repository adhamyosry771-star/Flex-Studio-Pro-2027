
import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, Timestamp, addDoc, serverTimestamp, getDocs, where, orderBy, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuth } from './AuthContext';
import { Users, ShieldAlert, Clock, Trash2, UserCheck, ShieldOff, Search, Calendar, LayoutDashboard, User as UserIcon, Ticket, Plus, Copy, Check, ExternalLink, MessageCircle, Palette, Save, Globe, Image as ImageIcon, X, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { normalizeDecoratedText } from '../utils';

interface UserData {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: string;
  status: string;
  lastLogin: any;
  createdAt: any;
  banUntil?: any;
  password?: string;
  subscriptionActive?: boolean;
  subscriptionExpires?: any;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

interface SubscriptionCode {
  id: string;
  code: string;
  duration: 'day' | 'week' | 'month' | 'year';
  isUsed: boolean;
  usedBy?: string;
  createdAt: any;
}

export const AdminDashboard: React.FC = () => {
  const { user, isAdmin, appSettings, updateAppSettings } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [codes, setCodes] = useState<SubscriptionCode[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'codes' | 'design'>('users');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [codeDuration, setCodeDuration] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Design Settings State
  const [logoURL, setLogoURL] = useState(appSettings?.logoURL || '');
  const [loginBgURL, setLoginBgURL] = useState(appSettings?.loginBgURL || '');
  const [mainBgURL, setMainBgURL] = useState(appSettings?.mainBgURL || '');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // User Photo Update State
  const [editingPhotoUid, setEditingPhotoUid] = useState<string | null>(null);
  const [newPhotoURL, setNewPhotoURL] = useState('');
  const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);
  const [showPasswordMap, setShowPasswordMap] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    if (appSettings) {
      setLogoURL(appSettings.logoURL || '');
      setLoginBgURL(appSettings.loginBgURL || '');
      setMainBgURL(appSettings.mainBgURL || '');
    }
  }, [appSettings]);

  useEffect(() => {
    if (!isAdmin) return;

    const usersUnsubscribe = onSnapshot(query(collection(db, 'users')), (snapshot) => {
      const usersData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          uid: doc.id,
          ...data
        } as UserData;
      });
      setUsers(usersData);
      setLoading(false);
    });

    const codesUnsubscribe = onSnapshot(query(collection(db, 'subscriptionCodes')), (snapshot) => {
      const codesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubscriptionCode));
      setCodes(codesData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    });

    return () => {
      usersUnsubscribe();
      codesUnsubscribe();
    };
  }, [isAdmin]);

  const handleUpdateUserPhoto = async (uid: string) => {
    if (!newPhotoURL.trim()) return;
    setIsUpdatingPhoto(true);
    try {
      await updateDoc(doc(db, 'users', uid), {
        photoURL: newPhotoURL
      });
      setEditingPhotoUid(null);
      setNewPhotoURL('');
    } catch (error) {
      console.error("Error updating user photo:", error);
      alert("حدث خطأ أثناء تحديث الصورة");
    } finally {
      setIsUpdatingPhoto(false);
    }
  };

  const generateCode = async () => {
    setIsGenerating(true);
    try {
      const newCode = Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      await addDoc(collection(db, 'subscriptionCodes'), {
        code: newCode,
        duration: codeDuration,
        isUsed: false,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error generating code:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const deleteCode = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الكود؟')) {
      try {
        await deleteDoc(doc(db, 'subscriptionCodes', id));
      } catch (error) {
        console.error("Error deleting code:", error);
      }
    }
  };

  const handleBan = async (userId: string, duration: 'day' | 'week' | 'year' | 'permanent') => {
    const userRef = doc(db, 'users', userId);
    try {
      let banUntil: Date | null = null;
      
      const now = new Date();
      if (duration === 'day') banUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      else if (duration === 'week') banUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      else if (duration === 'year') banUntil = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      
      await updateDoc(userRef, {
        status: 'banned',
        banUntil: banUntil ? Timestamp.fromDate(banUntil) : null
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleUnban = async (userId: string) => {
    const userRef = doc(db, 'users', userId);
    try {
      await updateDoc(userRef, {
        status: 'active',
        banUntil: null
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleDelete = async (userId: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المستخدم نهائياً؟')) {
      try {
        await deleteDoc(doc(db, 'users', userId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
      }
    }
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <ShieldOff size={64} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">غير مصرح لك بالدخول</h1>
          <p className="text-slate-400 mt-2">هذه الصفحة مخصصة للمسؤولين فقط.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] shadow-2xl p-6 md:p-10 text-right max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-600/20 rounded-xl border border-blue-500/30">
                <LayoutDashboard className="text-blue-400" size={24} />
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight">لوحة التحكم</h1>
            </div>
            <p className="text-slate-400 text-sm">إدارة المستخدمين ومراقبة نشاط المنصة</p>
          </div>

          <div className="relative group w-full md:w-80">
            <div className="flex items-center bg-slate-900/40 border border-slate-800 rounded-full px-5 focus-within:border-blue-500/50 transition-all">
              <Search className="text-slate-500 group-focus-within:text-blue-400 transition-colors shrink-0" size={18} />
              <input 
                type="text" 
                placeholder="البحث عن مستخدم..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent border-none py-3 pr-3 pl-0 text-white placeholder:text-slate-600 focus:outline-none text-sm"
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4 mb-8 bg-slate-900/30 p-1.5 rounded-full border border-slate-800/50 w-fit">
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-6 py-2.5 rounded-full text-xs font-black transition-all flex items-center gap-2 border ${activeTab === 'users' ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            <Users size={16} />
            إدارة المستخدمين
          </button>
          <button 
            onClick={() => setActiveTab('codes')}
            className={`px-6 py-2.5 rounded-full text-xs font-black transition-all flex items-center gap-2 border ${activeTab === 'codes' ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            <Ticket size={16} />
            أكواد التفعيل
          </button>
          <button 
            onClick={() => setActiveTab('design')}
            className={`px-6 py-2.5 rounded-full text-xs font-black transition-all flex items-center gap-2 border ${activeTab === 'design' ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            <Palette size={16} />
            التصميم
          </button>
        </div>

        {activeTab === 'users' ? (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'إجمالي المستخدمين', value: users.length, icon: Users, color: 'blue' },
                { label: 'المستخدمين النشطين', value: users.filter(u => u.status === 'active').length, icon: UserCheck, color: 'emerald' },
                { label: 'المحظورين', value: users.filter(u => u.status === 'banned').length, icon: ShieldAlert, color: 'red' },
                { label: 'المسؤولين', value: users.filter(u => u.role === 'admin').length, icon: Clock, color: 'indigo' },
              ].map((stat, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={i} 
                  className="bg-slate-900/30 border border-slate-800 p-6 rounded-3xl"
                >
                  <div className={`w-12 h-12 rounded-full bg-${stat.color}-500/10 flex items-center justify-center text-${stat.color}-400 mb-4`}>
                    <stat.icon size={24} />
                  </div>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">{stat.label}</p>
                  <p className="text-3xl font-black text-white">{stat.value}</p>
                </motion.div>
              ))}
            </div>

            {/* Users Table */}
            <div className="bg-slate-900/30 border border-slate-800 rounded-[3rem] shadow-2xl mb-20">
              <div className="overflow-x-auto rounded-[3rem] pb-32">
                <table className="w-full text-right">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-800/20">
                      <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">المستخدم</th>
                      <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">الدور</th>
                      <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">الحالة</th>
                      <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">آخر ظهور</th>
                      <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredUsers.map((u) => (
                      <tr key={u.uid} className="hover:bg-slate-800/20 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0">
                              {u.photoURL ? (
                                <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-500">
                                  <UserIcon size={20} />
                                </div>
                              )}
                            </div>
                            <div className="min-0">
                              <p className="text-sm font-bold text-white truncate">{normalizeDecoratedText(u.displayName) || 'مستخدم'}</p>
                              <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                              <div className="text-[10px] text-yellow-500/80 mt-1 flex items-center gap-1.5 font-mono">
                                <span>كلمة المرور: </span>
                                {u.password ? (
                                  <>
                                    <span>{showPasswordMap[u.uid] ? u.password : '••••••••'}</span>
                                    <button 
                                      type="button"
                                      onClick={() => setShowPasswordMap(prev => ({ ...prev, [u.uid]: !prev[u.uid] }))} 
                                      className="text-slate-500 hover:text-white transition-colors p-0.5 cursor-pointer flex items-center"
                                    >
                                      {showPasswordMap[u.uid] ? <EyeOff size={12} /> : <Eye size={12} />}
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-slate-600 italic text-[9px]">غير متوفرة</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {(() => {
                            const isUserSubscribed = u.role === 'admin' || (u.subscriptionActive && u.subscriptionExpires && new Date(u.subscriptionExpires.toDate ? u.subscriptionExpires.toDate() : u.subscriptionExpires) > new Date());
                            return (
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                                u.role === 'admin' 
                                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                                  : isUserSubscribed 
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                                    : 'bg-slate-800 text-slate-400 border border-slate-700/50'
                              }`}>
                                {u.role === 'admin' ? 'مسؤول' : isUserSubscribed ? 'عضو مميز' : 'عضو عادي'}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${u.status === 'active' ? 'text-emerald-400' : 'text-red-400'}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></div>
                              {u.status === 'active' ? 'نشط' : 'محظور'}
                            </span>
                            {u.status === 'banned' && u.banUntil && (
                              <p className="text-[9px] text-slate-500">حتى: {u.banUntil.toDate().toLocaleDateString('ar-EG-u-nu-latn')}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-slate-400">
                            <Calendar size={14} />
                            <span className="text-xs">{u.lastLogin?.toDate ? u.lastLogin.toDate().toLocaleString('ar-EG-u-nu-latn') : 'غير معروف'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => {
                                setEditingPhotoUid(editingPhotoUid === u.uid ? null : u.uid);
                                setNewPhotoURL(u.photoURL || '');
                              }}
                              className={`p-2 rounded-full transition-all border ${editingPhotoUid === u.uid ? 'bg-blue-500/20 border-blue-500/40 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'bg-blue-500/10 border-transparent text-blue-400 hover:bg-blue-500/20'}`}
                              title="تغيير صورة المستخدم"
                            >
                              <ImageIcon size={18} />
                            </button>

                            {u.status === 'active' ? (
                              <div className="relative group/menu">
                                <button className="p-2 bg-red-500/10 text-red-400 rounded-full hover:bg-red-500/20 transition-all">
                                  <ShieldAlert size={18} />
                                </button>
                                <div className="absolute left-0 top-full mt-2 hidden group-hover/menu:flex flex-col bg-slate-900/90 border border-slate-800 rounded-2xl p-2 shadow-2xl z-[100] w-32">
                                  <button onClick={() => handleBan(u.uid, 'day')} className="text-[10px] p-2 hover:bg-slate-800 rounded-xl text-right text-slate-300">يوم واحد</button>
                                  <button onClick={() => handleBan(u.uid, 'week')} className="text-[10px] p-2 hover:bg-slate-800 rounded-xl text-right text-slate-300">أسبوع</button>
                                  <button onClick={() => handleBan(u.uid, 'year')} className="text-[10px] p-2 hover:bg-slate-800 rounded-xl text-right text-slate-300">سنة</button>
                                  <button onClick={() => handleBan(u.uid, 'permanent')} className="text-[10px] p-2 hover:bg-red-500/20 text-red-400 rounded-xl text-right">حظر دائم</button>
                                </div>
                              </div>
                            ) : (
                              <button 
                                onClick={() => handleUnban(u.uid)}
                                className="p-2 bg-emerald-500/10 text-emerald-400 rounded-full hover:bg-emerald-500/20 transition-all"
                                title="إلغاء الحظر"
                              >
                                <UserCheck size={18} />
                              </button>
                            )}
                            <button 
                              onClick={() => handleDelete(u.uid)}
                              className="p-2 bg-slate-800/50 text-slate-400 rounded-full hover:bg-red-500/20 hover:text-red-400 transition-all"
                              title="حذف المستخدم"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>

                          <AnimatePresence>
                            {editingPhotoUid === u.uid && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-4 p-4 bg-slate-950/50 border border-slate-800 rounded-2xl flex flex-col gap-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">رابط الصورة الجديد</span>
                                    <button onClick={() => setEditingPhotoUid(null)} className="text-slate-500 hover:text-white">
                                      <X size={14} />
                                    </button>
                                  </div>
                                  <div className="flex gap-2">
                                    <input 
                                      type="url" 
                                      value={newPhotoURL}
                                      onChange={(e) => setNewPhotoURL(e.target.value)}
                                      placeholder="https://example.com/photo.jpg"
                                      className="flex-1 bg-slate-900 border border-slate-800 rounded-full px-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                                    />
                                    <button 
                                      onClick={() => handleUpdateUserPhoto(u.uid)}
                                      disabled={isUpdatingPhoto}
                                      className="px-4 py-2 bg-blue-600 text-white rounded-full text-[10px] font-bold hover:bg-blue-500 transition-all disabled:opacity-50"
                                    >
                                      {isUpdatingPhoto ? <Clock className="animate-spin" size={14} /> : 'حفظ'}
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {filteredUsers.length === 0 && (
                <div className="py-20 text-center">
                  <Users size={48} className="text-slate-800 mx-auto mb-4" />
                  <p className="text-slate-500">لم يتم العثور على مستخدمين</p>
                </div>
              )}
            </div>
          </>
        ) : activeTab === 'codes' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Code Generator */}
            <div className="lg:col-span-1">
              <div className="bg-slate-900/30 border border-slate-800 p-8 rounded-[3rem] sticky top-24">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-600/20 rounded-full border border-blue-500/30">
                    <Plus className="text-blue-400" size={20} />
                  </div>
                  <h2 className="text-xl font-black text-white">توليد كود جديد</h2>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">مدة الاشتراك</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'day', label: 'يوم' },
                        { id: 'week', label: 'أسبوع' },
                        { id: 'month', label: 'شهر' },
                        { id: 'year', label: 'سنة' },
                      ].map((d) => (
                        <button
                          key={d.id}
                          onClick={() => setCodeDuration(d.id as any)}
                          className={`py-3 rounded-full text-xs font-bold transition-all border ${codeDuration === d.id ? 'bg-blue-600/20 border-blue-500/50 text-blue-400 backdrop-blur-md' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={generateCode}
                    disabled={isGenerating}
                    className="w-full py-4 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-full font-black text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                  >
                    {isGenerating ? <Clock className="animate-spin" size={18} /> : <Ticket size={18} />}
                    توليد كود التفعيل
                  </button>
                </div>
              </div>
            </div>

            {/* Codes List */}
            <div className="lg:col-span-2">
              <div className="bg-slate-900/30 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-slate-800 bg-slate-800/20 flex items-center justify-between">
                  <h2 className="text-lg font-black text-white">الأكواد المولدة</h2>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-4 py-1.5 rounded-full border border-slate-700">{codes.length} كود</span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-800/10">
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">الكود</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">المدة</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">الحالة</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {codes.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <code className="bg-slate-800 px-3 py-1.5 rounded-xl text-xs font-mono text-blue-400 border border-slate-700">{c.code}</code>
                              <button 
                                onClick={() => copyToClipboard(c.code)}
                                className="p-1.5 text-slate-500 hover:text-white transition-colors"
                              >
                                {copiedCode === c.code ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs text-slate-300 font-bold">
                              {c.duration === 'day' ? 'يوم' : c.duration === 'week' ? 'أسبوع' : c.duration === 'month' ? 'شهر' : 'سنة'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {c.isUsed ? (
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                  <div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div>
                                  تم الاستخدام
                                </span>
                                <p className="text-[8px] text-slate-600 truncate max-w-[100px]">بواسطة: {c.usedBy}</p>
                              </div>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                                متاح
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <button 
                              onClick={() => deleteCode(c.id)}
                              className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {codes.length === 0 && (
                  <div className="py-20 text-center">
                    <Ticket size={48} className="text-slate-800 mx-auto mb-4" />
                    <p className="text-slate-500">لا توجد أكواد مولدة بعد</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/30 border border-slate-800 p-8 rounded-[3rem] shadow-2xl"
            >
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 bg-blue-600/20 rounded-full border border-blue-500/30">
                    <Palette className="text-blue-400" size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">إعدادات التصميم</h2>
                    <p className="text-slate-500 text-xs mt-1">تخصيص مظهر المنصة لجميع المستخدمين</p>
                  </div>
                </div>

              <div className="space-y-8">
                {/* Logo URL Input */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">رابط صورة الأيقونة</label>
                    <span className="text-[10px] text-blue-400 font-bold">تغيير شعار الهيدر</span>
                  </div>
                  
                  <div className="group">
                    <div className="flex items-center bg-slate-950/50 border border-slate-800 rounded-full px-4 focus-within:border-blue-500/50 transition-all">
                      <ImageIcon className="text-slate-500 group-focus-within:text-blue-400 transition-colors shrink-0" size={18} />
                      <input 
                        type="url" 
                        placeholder="https://example.com/logo.png" 
                        value={logoURL}
                        onChange={(e) => setLogoURL(e.target.value)}
                        className="flex-1 bg-transparent border-none py-4 pr-3 pl-0 text-white placeholder:text-slate-600 focus:outline-none text-sm"
                      />
                    </div>
                  </div>
                  
                  <p className="text-[9px] text-slate-500 leading-relaxed">
                    * سيتم استبدال أيقونة "Flex Studio" في الهيدر بالصورة التي تضع رابطها هنا. يفضل استخدام صور شفافة (PNG) وبمقاسات مربعة.
                  </p>
                </div>

                {/* Background URLs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">خلفية صفحة الدخول</label>
                    <div className="group">
                      <div className="flex items-center bg-slate-950/50 border border-slate-800 rounded-full px-4 focus-within:border-blue-500/50 transition-all">
                        <ImageIcon className="text-slate-500 group-focus-within:text-blue-400 transition-colors shrink-0" size={18} />
                        <input 
                          type="url" 
                          placeholder="رابط صورة أو فيديو (mp4)" 
                          value={loginBgURL}
                          onChange={(e) => setLoginBgURL(e.target.value)}
                          className="flex-1 bg-transparent border-none py-4 pr-3 pl-0 text-white placeholder:text-slate-600 focus:outline-none text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">خلفية الموقع الرئيسية</label>
                    <div className="group">
                      <div className="flex items-center bg-slate-950/50 border border-slate-800 rounded-full px-4 focus-within:border-blue-500/50 transition-all">
                        <ImageIcon className="text-slate-500 group-focus-within:text-blue-400 transition-colors shrink-0" size={18} />
                        <input 
                          type="url" 
                          placeholder="رابط صورة أو فيديو (mp4)" 
                          value={mainBgURL}
                          onChange={(e) => setMainBgURL(e.target.value)}
                          className="flex-1 bg-transparent border-none py-4 pr-3 pl-0 text-white placeholder:text-slate-600 focus:outline-none text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[9px] text-slate-500 leading-relaxed">
                  * يمكنك وضع رابط لصورة أو فيديو (بصيغة mp4). سيتم عرض الخلفية بشكل كامل مع طبقة حماية سوداء فخمة لضمان وضوح المحتوى.
                </p>

                {/* Preview Section */}
                <div className="p-6 bg-slate-950/50 rounded-3xl border border-slate-800/50">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">معاينة الشعار الجديد</p>
                  <div className="flex items-center gap-4 p-4 bg-slate-900/50 rounded-2xl border border-slate-800 w-fit">
                    <div className="w-10 h-10 rounded-full bg-blue-600/10 border border-blue-500/30 flex items-center justify-center overflow-hidden">
                      {logoURL ? (
                        <img src={logoURL} alt="Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/40?text=Error')} />
                      ) : (
                        <Globe className="text-blue-500/50" size={20} />
                      )}
                    </div>
                    <div className="flex flex-col" dir="ltr">
                      <span className="text-sm font-black text-white">Flex <span className="text-blue-500">Studio</span></span>
                      <span className="text-[7px] text-blue-400/60 font-black uppercase">Pro Edition</span>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <button
                  onClick={async () => {
                    setIsSavingSettings(true);
                    try {
                      await updateAppSettings({ logoURL, loginBgURL, mainBgURL });
                      alert('تم حفظ إعدادات التصميم بنجاح!');
                    } catch (error) {
                      console.error(error);
                      alert('فشل حفظ الإعدادات');
                    } finally {
                      setIsSavingSettings(false);
                    }
                  }}
                  disabled={isSavingSettings}
                  className="w-full py-4 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-full font-black text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                >
                  {isSavingSettings ? <Clock className="animate-spin" size={18} /> : <Save size={18} />}
                  حفظ تغييرات التصميم
                </button>
              </div>
            </motion.div>
          </div>
        )}
    </div>
  );
};
