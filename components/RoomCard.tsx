
import React, { useState, useEffect } from 'react';
import { Room } from '../types';
import { db } from '../firebase';
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

interface RoomCardProps {
  room: Room;
  onClick: (room: Room) => void;
}

export const RoomCard: React.FC<RoomCardProps> = ({ room, onClick }) => {
  const [design, setDesign] = useState<any>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "design"), (snap) => {
      if (snap.exists()) setDesign(snap.data());
    });
    return unsub;
  }, []);

  return (
    <div 
      onClick={() => onClick(room)}
      className="relative rounded-2xl overflow-hidden cursor-pointer transform transition-all active:scale-95 border border-white/5 group shadow-2xl bg-[#0d051a] aspect-[1/1.1]"
    >
      {/* صورة الروم تملأ المربع بالكامل */}
      <img src={room.coverImage} alt={room.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
      
      {/* تدرج لوني لجعل النصوص واضحة */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30"></div>
      
      {/* بيانات الغرفة في الأسفل */}
      <div className="absolute bottom-0 left-0 right-0 p-4 flex flex-col gap-1 z-10">
        <h3 className="font-black text-[12px] text-white leading-tight truncate drop-shadow-lg">
          {room.title}
        </h3>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-5 h-5 rounded-full border border-white/20 overflow-hidden shadow-lg">
              <img src={room.owner.avatar} className="w-full h-full object-cover" />
            </div>
            <span className="text-[9px] text-white/80 font-bold truncate opacity-90">
              {room.owner.name}
            </span>
          </div>
          {/* عرض أيقونة الموجات (Wave Room) مباشرة بحجم متناسق (5x5) بدون حاوية دائرية */}
          <div className="flex items-center justify-center overflow-hidden">
            {design?.waveRoomIcon ? (
              <img src={design.waveRoomIcon} className="w-5 h-5 object-contain drop-shadow-lg" alt="wave" />
            ) : (
              <i className="fas fa-volume-up text-[8px] text-purple-300 drop-shadow-md"></i>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
