import React, { useState } from 'react';
import { KeyRound, Moon, Sun } from 'lucide-react';
import type { AuthStatusResponse, LicenseStatusResponse } from '../types/seating.ts';
import { UnnatiLogo } from './UnnatiLogo.tsx';

interface AuthGateProps {
  status: AuthStatusResponse;
  license: LicenseStatusResponse | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenLicenseModal: () => void;
  onAuthenticated: (token: string) => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({
  status,
  license,
  theme,
  onToggleTheme,
  onOpenLicenseModal,
  onAuthenticated,
}) => {
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFirstSetup = !status.configured;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isFirstSetup) {
      if (passcode.trim().length < 6) {
        setError('Passcode must be at least 6 characters long.');
        return;
      }
      if (passcode !== confirmPasscode) {
        setError('Passcodes do not match.');
        return;
      }
    } else if (!passcode.trim()) {
      setError('Enter your admin passcode.');
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = isFirstSetup ? '/api/auth/claim' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        token?: string;
        error?: string;
      };
      if (!res.ok || !data.token) {
        setError(data.error || `Authentication failed (${res.status})`);
        return;
      }
      onAuthenticated(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-[#111C1B] dark:text-[#EDF4F2]">
      <div className="w-full max-w-md flex justify-end mb-3">
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D4CA] dark:border-[#243936] bg-white/90 dark:bg-[#111D1B]/90 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-amber-300 shadow-xs hover:bg-white dark:hover:bg-[#182725] cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-[#D8D4CA] dark:border-[#243936] bg-white dark:bg-[#111D1B] shadow-2xl overflow-hidden">
        <div className="bg-sidebar-textured px-6 py-5 text-white border-b border-[#1F3230]">
          <UnnatiLogo size="lg" tone="dark-bg" showSubtitle={false} />
          <p className="mt-1.5 text-xs text-teal-200/75">
            {isFirstSetup
              ? 'First-Run Center Admin Setup'
              : 'Protected Center Access · Board & Pre-Board Seating'}
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4">
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {isFirstSetup
              ? 'Set an Admin Passcode (min 6 characters) to protect student nominal rolls, room plans, and PDF imports.'
              : 'Enter your center Admin Passcode to unlock nominal rolls, seating generation, and reports.'}
          </p>

          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-800/70 bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="admin-passcode"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              {isFirstSetup ? 'Create Admin Passcode' : 'Admin Passcode'}
            </label>
            <input
              id="admin-passcode"
              type="password"
              autoFocus
              required
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#0C1514] px-3 py-2 text-sm text-[#111C1B] dark:text-[#EDF4F2] placeholder:text-slate-400 focus:border-[#0F766E] focus:outline-none"
            />
          </div>

          {isFirstSetup && (
            <div>
              <label
                htmlFor="admin-passcode-confirm"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Confirm Passcode
              </label>
              <input
                id="admin-passcode-confirm"
                type="password"
                required
                value={confirmPasscode}
                onChange={(e) => setConfirmPasscode(e.target.value)}
                placeholder="Re-enter passcode"
                className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#0C1514] px-3 py-2 text-sm text-[#111C1B] dark:text-[#EDF4F2] placeholder:text-slate-400 focus:border-[#0F766E] focus:outline-none"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[#0F766E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#115E59] disabled:opacity-50 cursor-pointer"
          >
            {submitting
              ? 'Verifying...'
              : isFirstSetup
                ? 'Save Passcode & Continue'
                : 'Unlock Unnati Exam App'}
          </button>

          {license && (
            <div className="pt-2 border-t border-[#ECEAE4] dark:border-[#213331] flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="font-mono truncate">Device: {license.machineId}</span>
              <button
                type="button"
                onClick={onOpenLicenseModal}
                className="inline-flex items-center gap-1 font-medium text-[#0F766E] dark:text-teal-400 hover:underline shrink-0 cursor-pointer"
              >
                <KeyRound className="h-3 w-3" />
                {license.status === 'LICENSED'
                  ? license.plan
                  : license.status === 'TRIAL_ACTIVE'
                    ? `${license.daysRemaining ?? 14}d Trial`
                    : 'License Info'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
