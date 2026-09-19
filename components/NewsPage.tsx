
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const NewsPage: React.FC = () => {
  const [news, setNews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const newsQ = query(collection(db, "news"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(newsQ, (snap) => {
      setNews(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    });
    return unsub;
  }, []);

  if (isLoading) return <div className="flex-1 flex items-center justify-center bg-[#1a0b2e]"><div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 bg-[#1a0b2e]">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-black text-white tracking-tight">آخر الأخبار</h2>
        <div className="bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
          <span className="text-[10px] text-purple-400 font-black uppercase">عالم يلا</span>
        </div>
      </div>

      {news.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-20">
          <i className="fas fa-newspaper text-5xl mb-4"></i>
          <p className="text-sm font-bold">لا توجد أخبار حالياً</p>
        </div>
      ) : news.map(item => (
        <div key={item.id} className="bg-white/5 border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl hover:bg-white/10 transition-all cursor-pointer group">
          {/* تم تقليل الارتفاع من h-48 إلى h-[11.2rem] تقريباً بنسبة 7% */}
          <div className="h-[11rem] overflow-hidden relative">
            <img src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="" />
            <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-xl text-[9px] text-white font-black border border-white/10">
              {item.time || "جديد"}
            </div>
          </div>
          {/* تم تقليل الحشوة p-6 إلى p-5 لتقليل الطول الكلي للمستطيل */}
          <div className="p-5">
            <h3 className="font-black text-base mb-1.5 text-white leading-tight group-hover:text-purple-300 transition-colors">{item.title}</h3>
            <p className="text-[11px] text-purple-200/50 leading-relaxed font-bold line-clamp-2">{item.desc}</p>
          </div>
        </div>
      ))}
      <div className="h-10"></div>
    </div>
  );
};
