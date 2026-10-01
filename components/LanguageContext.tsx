import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'ar' | 'en';

// Comprehensive dictionary for all pages and components
export const phraseDictionary: Record<string, string> = {
  // Navigation & Header
  'عارض SVGA': 'SVGA Viewer',
  'عارض PAG': 'PAG Viewer',
  'محرر VAP': 'VAP Editor',
  'VAP': 'VAP Editor',
  'After Effects': 'After Effects Studio',
  'After Effect': 'After Effects',
  'MP4 Alpha': 'Transparent MP4',
  'MP4 شفاف': 'Transparent MP4',
  'صانع APNG': 'APNG Creator',
  'صانع WEBP': 'WebP Creator',
  'صانع WebP': 'WebP Creator',
  'محول لMP3': 'MP3 Converter',
  'صوت MP3': 'MP3 Audio',
  'تحويل إلى SVGA': 'Video to SVGA',
  'تحويل فيديو': 'Video to SVGA',
  'تحويل الصيغ': 'Format Converter',
  'محول الصيغ': 'Format Converter',
  'تعديل الصور': 'Image Editor',
  'محرر الصور': 'Image Editor',
  'تطابق الصور': 'Image Matcher',
  'مطابقة الصور': 'Image Matcher',
  'لوحة التحكم': 'Admin Panel',
  'الإدارة': 'Admin Panel',
  'الملف الشخصي': 'Profile',
  'مستخدم': 'User',

  // Profile Page
  'العودة للرئيسية': 'Back to Home',
  'مسؤول النظام': 'System Admin',
  'عضو مميز': 'VIP Member',
  'عضو عادي': 'Regular Member',
  'البريد الإلكتروني': 'Email Address',
  'تاريخ الانضمام': 'Join Date',
  'حالة العضوية': 'Membership Status',
  'مسؤول النظام (دائم)': 'System Admin (Permanent)',
  'عضو مميز (مفعل)': 'VIP Member (Active)',
  'عضو عادي (غير مفعل)': 'Regular Member (Inactive)',
  'ينتهي في: ': 'Expires on: ',
  'اضغط لتمديد الكود': 'Click to extend subscription',
  'اضغط لتفعيل كود جديد': 'Click to activate code',
  'معرف المستخدم': 'User ID',
  'تسجيل الخروج من الحساب': 'Sign Out of Account',
  'غير معروف': 'Unknown',
  'لغة التطبيق': 'App Language',
  'اختر لغة الواجهة المفضلة': 'Choose preferred interface language',
  'العربية': 'العربية',
  'الإنجليزية': 'English',

  // Viewer & DropZone
  'قم بسحب ملفات SVGA هنا': 'Drag & drop SVGA files here',
  'قم بسحب ملفات PAG هنا': 'Drag & drop PAG files here',
  'أو انقر لاختيار ملفات من جهازك. يدعم العارض عرض عدة ملفات في نفس الوقت.': 'Or click to choose files from your device. Supports viewing multiple files simultaneously.',
  'السجل': 'History',
  'سجل ملفات PAG': 'PAG Files History',
  'سجل ملفات SVGA': 'SVGA Files History',
  'السجل فارغ': 'History is empty',
  'اسم الملف': 'File Name',
  'حجم البيانات': 'Data Size',
  'إغلاق الملف': 'Close File',
  'تحميل ملف SVGA (يتضمن التعديلات)': 'Download SVGA (with edits)',
  'تحميل ملف PAG': 'Download PAG File',
  'تصدير جميع قطع الإطار / الدخولية وحفظها في مجلد ZIP': 'Export all pieces/sprites to ZIP',
  'تصدير وتحميل جميع قطع الإطار / الدخولية في مجلد مضغوط ZIP': 'Export all pieces/sprites to ZIP',
  'عرض كامل دون قص أو إخفاء (احتواء تلقائي)': 'Fit to view (Contain)',
  'عرض بالحجم الأصلي الحقيقي 100%': 'Actual 100% size',
  'تصغير العرض': 'Zoom Out',
  'تكبير العرض': 'Zoom In',
  'إيقاف مؤقت': 'Pause',
  'تشغيل الأنيميشن': 'Play',
  'إعادة تشغيل': 'Restart',
  'ربط نسبة العرض إلى الارتفاع (مفعّل)': 'Lock aspect ratio (On)',
  'فك ربط نسبة العرض إلى الارتفاع': 'Unlock aspect ratio',
  'إعادة ضبط حجم الإطار إلى الأصلي': 'Reset dimensions to original',
  'إعادة إظهار الصورة في الإطار': 'Unhide image in frame',
  'حذف / إخفاء الصورة من الإطار': 'Hide / delete image from frame',
  'استعادة الصورة الأصلية وحذف الاستبدال': 'Restore original image',
  'استبدال الصورة (يأخذ نفس حجم ومكان الصورة السابقة)': 'Replace Image (matches dimensions and position)',
  'تحميل القطعة': 'Download piece',
  'استعادة الصورة الأصلية للملف وحذف التعديل': 'Restore original file image',
  'ملء الإطار بالكامل بنفس حجم ومكان الصورة السابقة دون أي فراغات': 'Fill frame completely',
  'يحتوي الصورة بالكامل داخل حدود الإطار الأصلي': 'Fit image inside bounds',
  'يطابق العرض والارتفاع السابق بالضبط 100%': 'Exact dimensions 100%',
  'إعادة ضبط الحجم إلى 100% والموضع للمنتصف': 'Reset scale to 100% and center',

  // After Effects Studio
  'مشروع جديد': 'New Project',
  'فتح مشروع': 'Open Project',
  'حفظ المشروع': 'Save Project',
  'تصدير': 'Export',
  'إعدادات التركيب': 'Composition Settings',
  'إضافة طبقة': 'Add Layer',
  'صورة': 'Image',
  'شكل': 'Shape',
  'نص': 'Text',
  'التحويل (Transform)': 'Transform',
  'الموضع (X, Y)': 'Position (X, Y)',
  'الحجم (Scale %)': 'Scale (%)',
  'الدوران (Rotation)': 'Rotation',
  'الشفافية (Opacity)': 'Opacity',
  'ترتيب الظهور (Stacking Order)': 'Stacking Order',
  'في المقدمة': 'Bring to Front',
  'للأمام': 'Move Up',
  'للخلف': 'Move Down',
  'في الخلفية': 'Send to Back',
  'اسم الطبقة': 'Layer Name',
  'قطعة مدمجة كقناع (Alpha Matte)': 'Masked Piece (Alpha Matte)',
  'إزالة الدمج (فك ارتباط الطبقة وجعلها حرة)': 'Remove Mask (Detach Layer)',
  'مدمجة داخل:': 'Masked inside:',
  'طبقة إضافية مدمجة (Alpha Matte)': 'Attached Masked Layer (Alpha Matte)',
  'إضافة قطعة مدمجة': 'Add Masked Piece',
  'القطع المدمجة داخل هذه الطبقة:': 'Masked pieces in this layer:',
  'تحديد والتحريك ➔': 'Select & Animate ➔',
  'تحريك ➔': 'Animate ➔',
  'محددات الإطار والشكل': 'Frame & Shape Options',
  'نصف القطر الخارجي': 'Outer Radius',
  'نصف القطر الداخلي': 'Inner Radius',
  'سماكة الخط (Stroke)': 'Stroke Width',
  'لون الإطار': 'Stroke Color',
  'توهج النيون (Glow)': 'Neon Glow',
  'لون التوهج': 'Glow Color',
  'خصائص النص': 'Text Properties',
  'المحتوى': 'Content',
  'حجم الخط': 'Font Size',
  'لون النص': 'Font Color',
  'تصدير SVGA': 'Export SVGA',
  'تصدير GIF': 'Export GIF',
  'تصدير MP4': 'Export MP4',
  'قطع عادي (Sprites)': 'Pieces (Sprites)',
  'رندر فريمات': 'Render Frames',
  'رندر إطارات': 'Render Frames',
  'تصدير كقطع مستقلة مع مصفوفات الحركة ومحاور التحريك (موصى به)': 'Export as separate sprites with motion transforms (Recommended)',
  'تصدير كرندر تسلسلي لجميع الفريمات': 'Sequential full-frame rendering',
  'تنبيه بخصوص القطع المدمجة (اللمعة والقناع):': 'Notice on Masked Pieces (Shine & Alpha Matte):',
  'الطبقات': 'Layers',
  'التايم لاين': 'Timeline',
  'إيقاف': 'Pause',
  'تشغيل': 'Play',
  'إعادة': 'Reset',
  'فريم': 'Frame',
  'ثانية': 'Sec',

  // Tools & Converters
  'تحويل فيديو إلى SVGA': 'Convert Video to SVGA',
  'اختر ملف فيديو': 'Select Video File',
  'اختر الملف': 'Select File',
  'رفع ملف': 'Upload File',
  'تحويل الآن': 'Convert Now',
  'جاري التحويل...': 'Converting...',
  'تم التحويل بنجاح!': 'Converted Successfully!',
  'تحميل الملف': 'Download File',
  'تحميل النتيجة': 'Download Result',
  'إلغاء': 'Cancel',
  'موافق': 'OK',
  'إغلاق': 'Close',
  'حفظ': 'Save',
  'حذف': 'Delete',
  'تأكيد': 'Confirm',
  'تطبيق': 'Apply',
  'بحث': 'Search',
  'تنزيل': 'Download',
  'تعديل': 'Edit',
  'إعادة تعيين': 'Reset',

  // Modals & Maintenance
  'هذه الميزة في الصيانة الآن': 'Feature Under Maintenance',
  'نعمل حالياً على صيانة وتحديث أداة ومحرر VAP لتقديم أداء فائق وتوافقية أفضل. ستكون الميزة متاحة لجميع المشتركين قريباً!': 'We are currently maintaining and upgrading the VAP Editor for superior performance and compatibility. It will be available for all subscribers soon!',
  'تفعيل الاشتراك': 'Activate Subscription',
  'تمديد الاشتراك': 'Extend Subscription',
  'أدخل كود التفعيل': 'Enter Activation Code',
  'كود التفعيل': 'Activation Code',
  'تفعيل': 'Activate',
  'تمديد': 'Extend'
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (keyOrText: string, fallback?: string) => string;
  isRtl: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    if (saved === 'en' || saved === 'ar') return saved;
    return 'ar';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  };

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  // Universal translation function
  const t = (keyOrText: string, fallback?: string): string => {
    if (!keyOrText) return '';
    if (language === 'en') {
      // 1. Direct dictionary match
      if (phraseDictionary[keyOrText]) {
        return phraseDictionary[keyOrText];
      }
      // 2. Trimmed match
      const trimmed = keyOrText.trim();
      if (phraseDictionary[trimmed]) {
        return phraseDictionary[trimmed];
      }
      // 3. Explicit fallback provided
      if (fallback !== undefined) {
        return fallback;
      }
      return keyOrText;
    }

    // Arabic
    return keyOrText;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t, isRtl: language === 'ar' }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
