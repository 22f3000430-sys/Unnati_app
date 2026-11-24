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
        <div className="flex items-center justify-between border-b border-[#E2DFD7] dark:border-[#213331] bg-[#FAF9F5] dark:bg-[#0D1615] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="h-5 w-5 text-[#0F766E] dark:text-teal-400 shrink-0" />
            <div>
              <h3 id="strategy-info-title" className="text-base font-semibold">
                Tail-Room Strategy Comparison
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Rooms &lt;22 or &lt;60% prioritize same-class best-fit sizing &amp; single-room moves — never split into 2 rooms (2 invigilators/room).
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

        <div className="flex-1 overflow-y-auto">
          <table className="min-w-full divide-y divide-[#ECEAE4] dark:divide-[#1D2E2C] text-xs">
            <thead className="bg-[#FAF9F5] dark:bg-[#0D1615] text-left font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2.5">Strategy</th>
                <th className="px-4 py-2.5">Class &amp; Gender</th>
                <th className="px-4 py-2.5">What It Does</th>
                <th className="px-4 py-2.5 text-right">Select</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F0EB] dark:divide-[#182725]">
              {TAIL_STRATEGY_DETAILS.map((item) => {
                const isActive = item.id === activePolicy;
                return (
                  <tr
                    key={item.id}
                    className={
                      isActive
                        ? 'bg-teal-50/55 dark:bg-teal-950/25'
                        : 'hover:bg-[#FAF9F5] dark:hover:bg-[#162624]'
                    }
                  >
                    <td className="px-4 py-3 align-top font-semibold text-[#111C1B] dark:text-[#EDF4F2] whitespace-nowrap">
                      <div>{item.shortLabel}</div>
                      {isActive && (
                        <span className="text-[11px] font-semibold text-[#0F766E] dark:text-teal-400">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-600 dark:text-slate-300">
                      {item.separationRule}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700 dark:text-slate-200 leading-relaxed">
                      <div>{item.summary}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {item.roomAndInvigilatorImpact}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                      {onSelectPolicy && !isActive ? (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectPolicy(item.id);
                            onClose();
                          }}
                          className="rounded-md border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#142321] px-2.5 py-1 text-xs font-semibold text-[#0F766E] dark:text-teal-300 hover:bg-[#FAF9F5] dark:hover:bg-[#182725] cursor-pointer"
                        >
                          Use
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end border-t border-[#E2DFD7] dark:border-[#213331] bg-[#FAF9F5] dark:bg-[#0D1615] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#0F766E] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#115E59] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
