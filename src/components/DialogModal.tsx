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
      <AlertCircle className="h-6 w-6 text-red-600 shrink-0" />
    ) : dialog.type === 'confirm' ? (
      <HelpCircle className="h-6 w-6 text-blue-600 shrink-0" />
    ) : (
      <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200">
        <div className="flex items-start gap-3">
          {icon}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-slate-900">{dialog.title}</h3>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{dialog.message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          {dialog.type === 'confirm' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
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
                className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
              >
                Confirm
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-[#2563EB] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
            >
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
