import React from 'react';

export const SnapTripLogo = ({ className = "w-10 h-10", withText = false }: { className?: string; withText?: boolean }) => (
  <div className="flex items-center gap-2">
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="snap_gradient" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" /> {/* Blue-600 */}
          <stop offset="1" stopColor="#4F46E5" /> {/* Indigo-600 */}
        </linearGradient>
        <filter id="shadow" x="-10" y="-10" width="120" height="120" filterUnits="userSpaceOnUse">
           <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.15"/>
        </filter>
      </defs>
      
      {/* Background Container */}
      <rect x="5" y="5" width="90" height="90" rx="24" fill="url(#snap_gradient)" filter="url(#shadow)" />
      
      {/* Camera Lens Element (Subtle) */}
      <circle cx="50" cy="50" r="32" stroke="white" strokeWidth="4" strokeOpacity="0.2" />
      <circle cx="50" cy="50" r="24" stroke="white" strokeWidth="2" strokeOpacity="0.1" />

      {/* Paper Plane Icon */}
      <path 
        d="M50 32L68 68L50 60L32 68L50 32Z" 
        fill="white" 
        stroke="white" 
        strokeWidth="4" 
        strokeLinejoin="round"
      />
      
      {/* Sparkle (AI Magic) */}
      <path 
        d="M78 22L81 29L88 32L81 35L78 42L75 35L68 32L75 29L78 22Z" 
        fill="#FCD34D" 
      />
    </svg>
    {withText && (
      <div className="flex flex-col">
        <span className="font-bold text-xl text-slate-800 tracking-tight leading-none">SnapTrip</span>
        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest leading-none mt-0.5">AI Travel Log</span>
      </div>
    )}
  </div>
);