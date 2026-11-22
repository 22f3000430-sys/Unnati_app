import React, { useState } from 'react';
import { Check, CheckCircle2, Copy, KeyRound, ShieldAlert, ShieldCheck, Terminal, X } from 'lucide-react';
import type { LicenseStatusResponse } from '../types/seating.ts';
import { apiFetch } from '../utils/api.ts';

interface LicenseModalProps {
  open: boolean;
  sessionYear: string;
  license: LicenseStatusResponse | null;
  canActivate: boolean;
  onClose: () => void;
  onUpdated: (next: LicenseStatusResponse) => void;
}

export const LicenseModal: React.FC<LicenseModalProps> = ({
  open,
  sessionYear,
  license,
  canActivate,
  onClose,
  onUpdated,
}) => {
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showCliHelp, setShowCliHelp] = useState(false);

  if (!open || !license) return null;

  const handleCopyMachineId = async () => {
    try {
      await navigator.clipboard.writeText(license.machineId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) return;
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const updated = await apiFetch<LicenseStatusResponse>('/api/license/activate', sessionYear, {
        method: 'POST',
        body: JSON.stringify({ licenseKey: licenseKeyInput.trim() }),
      });
      setLicenseKeyInput('');
      setSuccessMsg(`Activated for ${updated.schoolName} (${updated.plan}).`);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const isHealthy = license.status === 'LICENSED' || license.status === 'TRIAL_ACTIVE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#091211]/70 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-lg rounded-xl border border-[#D8D4CA] dark:border-[#243936] bg-white dark:bg-[#111D1B] text-[#111C1B] dark:text-[#EDF4F2] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#E2DFD7] dark:border-[#213331] bg-[#FAF9F5] dark:bg-[#0D1615] px-5 py-4">
          <div className="flex items-center gap-2.5">
            {isHealthy ? (
              <ShieldCheck className="h-5 w-5 text-[#0F766E] dark:text-teal-400" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
            )}
            <div>
              <h3 className="text-base font-semibold">Device License &amp; Subscription</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Hardware-locked protection · Unnati Exam App
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close License Dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white dark:hover:bg-[#182725] hover:text-[#111C1B] dark:hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Status Banner */}
          <div
            className={`rounded-lg border px-4 py-3 text-xs space-y-1 ${
              license.status === 'LICENSED'
                ? 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/70 dark:bg-emerald-950/35 text-emerald-900 dark:text-emerald-200'
                : license.status === 'TRIAL_ACTIVE'
                  ? 'border-teal-200 dark:border-teal-800/70 bg-teal-50/70 dark:bg-teal-950/35 text-teal-900 dark:text-teal-200'
                  : 'border-red-200 dark:border-red-800/70 bg-red-50/80 dark:bg-red-950/40 text-red-900 dark:text-red-200'
            }`}
          >
            <div className="flex items-center justify-between font-semibold">
              <span>Status: {license.status.replace(/_/g, ' ')}</span>
              <span className="font-mono">{license.plan}</span>
            </div>
            <div>{license.message}</div>
          </div>

          {/* Machine ID Box */}
          <div className="rounded-lg border border-[#E2DFD7] dark:border-[#243936] bg-[#FAF9F5] dark:bg-[#0D1615] p-3.5 space-y-2">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              This Device&apos;s Hardware Machine ID (Share with vendor for a signed key)
            </div>
            <div className="flex items-center justify-between gap-2">
              <code
                data-testid="machine-id-value"
                className="font-mono text-sm font-bold tracking-wider text-[#111C1B] dark:text-teal-300"
              >
                {license.machineId}
              </code>
              <button
                type="button"
                onClick={() => void handleCopyMachineId()}
                className="inline-flex items-center gap-1 rounded-md border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#142321] px-2.5 py-1 text-xs font-semibold text-[#111C1B] dark:text-slate-200 hover:bg-[#FAF9F5] dark:hover:bg-[#1B2D2B] cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy ID
                  </>
                )}
              </button>
            </div>
          </div>

          {/* License Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs rounded-lg border border-[#E2DFD7] dark:border-[#213331] p-3.5">
            <div>
              <div className="text-slate-500 dark:text-slate-400">Institution</div>
              <div className="mt-0.5 font-semibold truncate">{license.schoolName}</div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">Center Code</div>
              <div className="mt-0.5 font-mono font-semibold">{license.centerCode}</div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">Valid Until</div>
              <div className="mt-0.5 font-mono font-semibold tabular-nums">
                {license.expiresAt ? license.expiresAt.slice(0, 10) : 'Perpetual'}
              </div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">Days Remaining</div>
              <div className="mt-0.5 font-mono font-semibold tabular-nums">
                {license.daysRemaining === null ? 'Unlimited' : `${license.daysRemaining} day(s)`}
              </div>
            </div>
          </div>

          {/* Activation Form */}
          {canActivate ? (
            <form onSubmit={(e) => void handleActivate(e)} className="space-y-3">
              {error && (
                <div className="rounded-lg border border-red-200 dark:border-red-800/70 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}
              {successMsg && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="license-key-input"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Paste Signed Subscription Key (<span className="font-mono">UNN1....</span>)
                </label>
                <textarea
                  id="license-key-input"
                  rows={2}
                  value={licenseKeyInput}
                  onChange={(e) => setLicenseKeyInput(e.target.value)}
                  placeholder="UNN1.eyJ2IjoxLCJtYWNoaW5lSWQiOi..."
                  className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#0C1514] px-3 py-2 font-mono text-xs text-[#111C1B] dark:text-[#EDF4F2] placeholder:text-slate-400 focus:border-[#0F766E] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowCliHelp((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-[#0F766E] dark:hover:text-teal-300 cursor-pointer"
                >
                  <Terminal className="h-3.5 w-3.5" />
                  {showCliHelp ? 'Hide Vendor Keygen Info' : 'Vendor Keygen Command'}
                </button>
                <button
                  type="submit"
                  disabled={submitting || !licenseKeyInput.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F766E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#115E59] disabled:opacity-50 cursor-pointer"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  {submitting ? 'Verifying...' : 'Activate Key'}
                </button>
              </div>
            </form>
          ) : (
            <div className="rounded-lg border border-[#E2DFD7] dark:border-[#213331] bg-[#FAF9F5] dark:bg-[#0D1615] px-3.5 py-2.5 text-xs text-slate-600 dark:text-slate-300">
              Sign in with your Admin Passcode first to activate or replace a subscription license key.
            </div>
          )}

          {showCliHelp && (
            <div className="rounded-lg border border-[#E2DFD7] dark:border-[#243936] bg-[#FAF9F5] dark:bg-[#0B1413] p-3 text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto">
              npx tsx scripts/keygen.ts --machineId {license.machineId} --school &quot;School Name&quot; --center 1011 --plan ANNUAL --days 365
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
