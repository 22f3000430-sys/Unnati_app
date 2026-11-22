import React from 'react';
import { AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';

export interface DialogState {
  open: boolean;
  type: 'info' | 'error' | 'confirm';
  title: string;
  message: string;
  onConfirm?: () => void;
}

interface DialogModalProps {
  dialog: DialogState;
  onClose: () => void;
}

export const DialogModal: React.FC<DialogModalProps> = ({ dialog, onClose }) => {
  if (!dialog.open) return null;

  const icon =
    dialog.type === 'error' ? (
      <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 shrink-0" />
    ) : dialog.type === 'confirm' ? (
      <HelpCircle className="h-6 w-6 text-[#0F766E] dark:text-teal-400 shrink-0" />
    ) : (
      <CheckCircle2 className="h-6 w-6 text-emerald-700 dark:text-emerald-400 shrink-0" />
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#091211]/65 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#111D1B] p-6 shadow-xl border border-[#E2DFD7] dark:border-[#243936] text-[#111C1B] dark:text-[#EDF4F2]">
        <div className="flex items-start gap-3">
          {icon}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold">{dialog.title}</h3>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">
              {dialog.message}
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          {dialog.type === 'confirm' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#142321] px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-[#FAF9F5] dark:hover:bg-[#1B2D2B] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const cb = dialog.onConfirm;
                  onClose();
                  cb?.();
                }}
                className="rounded-lg bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#115E59] cursor-pointer"
              >
                Confirm
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-[#0F766E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#115E59] cursor-pointer"
            >
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
