// src/components/CoffeeLoader.jsx — "Brewing coffee… 42%" loading screen
import React, { useEffect, useState } from 'react';

const CSS = `
@keyframes cl-steam{0%{opacity:0;transform:translateY(6px)}50%{opacity:.8}100%{opacity:0;transform:translateY(-8px)}}
@keyframes cl-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.cl-steam{animation:cl-steam 2s ease-in-out infinite}
.cl-rise{animation:cl-rise .35s ease-out both}
@media (prefers-reduced-motion:reduce){.cl-steam,.cl-rise{animation:none}.cl-steam{opacity:.5}}
`;

/* Fake-but-honest progress: climbs quickly, slows near 96%, and never claims 100% until the page replaces it */
function useProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setP((v) => Math.min(96, v + Math.max(0.25, (96 - v) * 0.05))), 100);
    return () => clearInterval(id);
  }, []);
  return p;
}

function Bean({ filled }) {
  return (
    <svg width="12" height="18" viewBox="0 0 12 18" aria-hidden="true" className="shrink-0 -rotate-[20deg]">
      <ellipse cx="6" cy="9" rx="4.6" ry="7.4" fill={filled ? '#4a2c1a' : '#ffffff'} stroke="#3b2418" strokeWidth="1.2" />
      <path d="M6 2.5c-2 2.4 2 4.6 0 7s2 4.4 0 6" fill="none" stroke={filled ? '#d9b99b' : '#3b2418'} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function Cup({ progress }) {
  // coffee surface moves from the cup bottom (y=84) up to near the rim (y=36)
  const y = 84 - 48 * (progress / 100);
  return (
    <svg viewBox="0 0 140 110" className="h-32 w-40" aria-hidden="true">
      <defs>
        <clipPath id="cl-cup">
          <path d="M26 32h66v28a33 33 0 0 1-33 33 33 33 0 0 1-33-33z" />
        </clipPath>
      </defs>

      {[48, 59, 70].map((x, i) => (
        <path key={x} className="cl-steam" style={{ animationDelay: `${i * 0.45}s` }} d={`M${x} 26c-4-5 4-8 0-14`}
          fill="none" stroke="#b9a99b" strokeWidth="2.4" strokeLinecap="round" />
      ))}

      <ellipse cx="59" cy="98" rx="46" ry="6" fill="#efeae4" />
      <path d="M92 40h6a11 11 0 0 1 0 22h-8" fill="none" stroke="#3b2418" strokeWidth="2.6" strokeLinecap="round" />

      <g clipPath="url(#cl-cup)">
        <rect x="20" y="30" width="78" height="66" fill="#faf8f5" />
        <rect x="20" y={y} width="78" height="70" fill="#6b4226" style={{ transition: 'y .2s linear' }} />
        <rect x="20" y={y} width="78" height="3" fill="#8a5a38" style={{ transition: 'y .2s linear' }} />
      </g>
      <path d="M26 32h66v28a33 33 0 0 1-33 33 33 33 0 0 1-33-33z" fill="none" stroke="#3b2418" strokeWidth="2.6" strokeLinejoin="round" />
      <ellipse cx="59" cy="32" rx="33" ry="3.4" fill="none" stroke="#3b2418" strokeWidth="2.2" />

      <path d="M14 78c0-14 12-20 20-18-1 14-9 24-20 18z" fill="#2f5d3a" />
      <path d="M16 76c6-6 12-10 16-13" fill="none" stroke="#9bc4a0" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

export default function CoffeeLoader({ fullScreen = true, title = 'Brewing coffee', message = 'Please wait a moment, we are preparing the best for you.' }) {
  const progress = useProgress();
  const whole = Math.floor(progress);

  return (
    <div role="status" className={`cl-rise flex flex-col items-center justify-center gap-5 bg-white px-6 text-center ${fullScreen ? 'min-h-screen' : 'min-h-[70vh]'}`}>
      <style>{CSS}</style>
      <span className="sr-only">Loading…</span>

      <Cup progress={progress} />

      <div aria-hidden="true" className="relative flex h-9 w-72 max-w-full items-center overflow-hidden rounded-full border-[3px] border-[#3b2418] bg-white">
        <div className="absolute inset-y-0 left-0 bg-[#e8d5c3]" style={{ width: `${progress}%`, transition: 'width .2s linear' }} />
        <div className="relative flex w-full justify-between px-3">
          {Array.from({ length: 10 }, (_, i) => <Bean key={i} filled={progress >= (i + 1) * 10 - 5} />)}
        </div>
      </div>

      <div aria-hidden="true">
        <p className="text-lg font-extrabold tracking-wide text-[#3b2418]">{title.toUpperCase()}… {whole}%</p>
        <p className="mt-1 max-w-xs text-xs text-stone-500">{message}</p>
      </div>
    </div>
  );
}