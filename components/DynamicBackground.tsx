
import React from 'react';

interface DynamicBackgroundProps {
  url?: string;
  overlayOpacity?: number;
}

export const DynamicBackground: React.FC<DynamicBackgroundProps> = ({ url, overlayOpacity = 0.72 }) => {
  const cleanUrl = url ? url.split('?')[0].split('#')[0].toLowerCase() : '';
  const isVideo = url ? (
    cleanUrl.endsWith('.mp4') || 
    cleanUrl.endsWith('.webm') || 
    cleanUrl.endsWith('.ogg') || 
    cleanUrl.endsWith('.mov') ||
    url.toLowerCase().includes('.mp4') ||
    url.toLowerCase().includes('.webm')
  ) : false;

  const videoType = cleanUrl.endsWith('.webm') ? 'video/webm' : 'video/mp4';

  return (
    <div 
      className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-slate-950 isolate"
      style={{ 
        backgroundColor: '#020617',
        transform: 'translate3d(0, 0, 0)',
        WebkitTransform: 'translate3d(0, 0, 0)'
      }}
    >
      {url && (
        isVideo ? (
          <video
            autoPlay
            loop
            muted
            playsInline
            // @ts-ignore
            webkit-playsinline="true"
            disablePictureInPicture
            src={url}
            className="absolute inset-0 w-full h-full object-cover z-[1] pointer-events-none"
            style={{
              transform: 'translate3d(0, 0, 0)',
              WebkitTransform: 'translate3d(0, 0, 0)'
            }}
          >
            <source src={url} type={videoType} />
          </video>
        ) : (
          <img 
            src={url} 
            alt="" 
            className="absolute inset-0 w-full h-full object-cover z-[1] pointer-events-none"
            referrerPolicy="no-referrer"
            style={{
              transform: 'translate3d(0, 0, 0)',
              WebkitTransform: 'translate3d(0, 0, 0)'
            }}
          />
        )
      )}
      
      {/* 1. Primary Solid Dark Overlay - exactly original color and opacity */}
      <div 
        className="absolute inset-0 z-[10] pointer-events-none" 
        style={{ 
          opacity: overlayOpacity,
          backgroundColor: '#020617',
          backdropFilter: 'blur(0.5px)',
          WebkitBackdropFilter: 'blur(0.5px)',
          transform: 'translate3d(0, 0, 1px)',
          WebkitTransform: 'translate3d(0, 0, 1px)'
        }}
      />
      
      {/* 2. Secondary Depth Gradient - restored to exact original values */}
      <div 
        className="absolute inset-0 z-[20] pointer-events-none bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/30"
        style={{
          transform: 'translate3d(0, 0, 2px)',
          WebkitTransform: 'translate3d(0, 0, 2px)'
        }}
      />
    </div>
  );
};
