import React from 'react';

interface UnnatiLogoProps {
  size?: 'sm' | 'md' | 'lg';
  tone?: 'dark-bg' | 'light-bg';
  showSubtitle?: boolean;
}

export const UnnatiLogo: React.FC<UnnatiLogoProps> = ({
  size = 'md',
  tone = 'dark-bg',
  showSubtitle = true,
}) => {
  const boxSize =
    size === 'lg' ? 'h-11 w-11' : size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const titleClass =
    tone === 'dark-bg'
      ? 'text-white'
      : 'text-[#111C1B] dark:text-[#EDF4F2]';
  const subClass =
    tone === 'dark-bg'
      ? 'text-teal-200/70'
      : 'text-slate-500 dark:text-slate-400';

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div
        className={`${boxSize} shrink-0 rounded-lg border border-teal-500/40 bg-[#0F766E] p-1 shadow-xs flex items-center justify-center`}
      >
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full"
          aria-hidden="true"
        >
          {/* 3x3 Desk Grid Subtle Matrix */}
          <rect x="6" y="7" width="4" height="4" rx="1" fill="#99F6E4" fillOpacity="0.35" />
          <rect x="18" y="7" width="4" height="4" rx="1" fill="#99F6E4" fillOpacity="0.35" />
          <rect x="30" y="7" width="4" height="4" rx="1" fill="#99F6E4" fillOpacity="0.35" />

          {/* Architectural 'U' Crest Pillar */}
          <path
            d="M10 13V23C10 28.5228 14.4772 33 20 33C25.5228 33 30 28.5228 30 23V13H25V23C25 25.7614 22.7614 28 20 28C17.2386 28 15 25.7614 15 23V13H10Z"
            fill="#FAF9F5"
          />

          {/* Ascending Unnati Progress Chevron */}
          <path
            d="M14.5 17.5L20 11L25.5 17.5H22.2V23.5H17.8V17.5H14.5Z"
            fill="#F59E0B"
          />
        </svg>
      </div>

      <div className="min-w-0 leading-tight">
        <div
          className={`font-semibold tracking-tight truncate ${
            size === 'lg' ? 'text-base' : 'text-sm'
          } ${titleClass}`}
        >
          Unnati Exam App
        </div>
        {showSubtitle && (
          <div className={`text-[11px] truncate ${subClass}`}>
            Board &amp; Pre-Board Center
          </div>
        )}
      </div>
    </div>
  );
};
