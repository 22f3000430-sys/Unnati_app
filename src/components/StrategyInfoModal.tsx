import React, { useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';
import type { TailRoomPolicy } from '../types/seating.ts';
import { TAIL_STRATEGY_DETAILS } from '../utils/tailStrategyMeta.ts';

interface StrategyInfoModalProps {
  open: boolean;
  activePolicy: TailRoomPolicy;
  onClose: () => void;
  onSelectPolicy?: (policy: TailRoomPolicy) => void;
}

export const StrategyInfoModal: React.FC<StrategyInfoModalProps> = ({
  open,
  activePolicy,
  onClose,
  onSelectPolicy,
}) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#091211]/70 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="strategy-info-title"
    >
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-xl border border-[#D8D4CA] dark:border-[#243936] bg-white dark:bg-[#111D1B] text-[#111C1B] dark:text-[#EDF4F2] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E2DFD7] dark:border-[#213331] bg-[#FAF9F5] dark:bg-[#0D1615] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="h-5 w-5 text-[#0F766E] dark:text-teal-400 shrink-0" />
            <div>
              <h3 id="strategy-info-title" className="text-base font-semibold">
                Tail-Room Strategy Guide (UP Board Rules)
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Rooms with &lt;22 students or &lt;60% fill prioritize single-room next-floor consolidation and never split into 2 rooms (strict 2 invigilators per room).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Strategy Info"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white dark:hover:bg-[#182725] hover:text-[#111C1B] dark:hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#ECEAE4] dark:divide-[#1D2E2C] px-6 py-2">
          {TAIL_STRATEGY_DETAILS.map((item) => {
            const isActive = item.id === activePolicy;
            return (
              <div
                key={item.id}
                className={`py-4 space-y-2 ${
                  isActive ? 'bg-teal-50/45 dark:bg-teal-950/20 -mx-6 px-6' : ''
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
                      {item.label}
                    </span>
                    {isActive && (
                      <span className="text-xs font-semibold text-[#0F766E] dark:text-teal-400">
                        · Active
                      </span>
                    )}
                  </div>
                  {onSelectPolicy && !isActive && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectPolicy(item.id);
                        onClose();
                      }}
                      className="rounded-md border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#142321] px-2.5 py-1 text-xs font-semibold text-[#0F766E] dark:text-teal-300 hover:bg-[#FAF9F5] dark:hover:bg-[#182725] cursor-pointer"
                    >
                      Use Strategy
                    </button>
                  )}
                </div>

                <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                  {item.summary}
                </p>

                <div className="grid grid-cols-1 gap-2 pt-1 text-[11px] sm:grid-cols-3 text-slate-600 dark:text-slate-300">
                  <div>
                    <span className="font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
                      Engine Behavior:{' '}
                    </span>
                    {item.howItWorks}
                  </div>
                  <div>
                    <span className="font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
                      Room &amp; Duty Effect:{' '}
                    </span>
                    {item.roomAndInvigilatorImpact}
                  </div>
                  <div>
                    <span className="font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
                      Separation Norm:{' '}
                    </span>
                    {item.separationRule}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end border-t border-[#E2DFD7] dark:border-[#213331] bg-[#FAF9F5] dark:bg-[#0D1615] px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#0F766E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#115E59] cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
