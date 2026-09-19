
import { Gift, Room } from './types';

export const GIFTS: Gift[] = [
  { id: '1', name: 'وردة', price: 10, icon: '🌹' },
  { id: '2', name: 'ألماس', price: 100, icon: '💎' },
  { id: '3', name: 'سيارة', price: 5000, icon: '🏎️' },
  { id: '4', name: 'صاروخ', price: 9999, icon: '🚀' },
  { id: '5', name: 'قلب', price: 50, icon: '💖' },
  { id: '6', name: 'تاج', price: 1000, icon: '👑' },
];

export const MOCK_ROOMS: Room[] = [
  {
    id: 'r1',
    title: 'سهرة الألعاب 🎮',
    owner: { id: 'u1', name: 'أحمد', avatar: 'https://picsum.photos/200?random=1', level: 25 },
    participantsCount: 156,
    tags: ['ألعاب', 'عربي'],
    coverImage: 'https://picsum.photos/400/200?random=10'
  },
  {
    id: 'r2',
    title: 'أغاني ووناسة 🎵',
    owner: { id: 'u2', name: 'سارة', avatar: 'https://picsum.photos/200?random=2', level: 42, vip: true },
    participantsCount: 890,
    tags: ['موسيقى', 'حفلة'],
    coverImage: 'https://picsum.photos/400/200?random=11'
  },
  {
    id: 'r3',
    title: 'دردشة آخر الليل 🌙',
    owner: { id: 'u3', name: 'عمر', avatar: 'https://picsum.photos/200?random=3', level: 12 },
    participantsCount: 45,
    tags: ['هدوء', 'سوالف'],
    coverImage: 'https://picsum.photos/400/200?random=12'
  }
];
