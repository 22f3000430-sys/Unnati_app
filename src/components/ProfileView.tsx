import React, { useEffect, useState } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Save,
  ShieldAlert,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import type { CenterProfile, LicenseStatusResponse } from '../types/seating.ts';
import { apiFetch } from '../utils/api.ts';

interface ProfileViewProps {
  sessionYear: string;
  license: LicenseStatusResponse | null;
  onLicenseUpdated: (next: LicenseStatusResponse) => void;
  onNotify: (type: 'info' | 'error', title: string, message: string) => void;
}

const EMPTY_PROFILE: CenterProfile = {
  schoolName: '',
  centerCode: '',
  boardName: '',
  principalName: '',
  controllerName: '',
  phone: '',
  email: '',
  address: '',
  updatedAt: '',
};

export const ProfileView: React.FC<ProfileViewProps> = ({
  sessionYear,
  license,
  onLicenseUpdated,
  onNotify,
}) => {
  const [profile, setProfile] = useState<CenterProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [activating, setActivating] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [licenseSuccess, setLicenseSuccess] = useState<string | null>(null);
  const [showCliHelp, setShowCliHelp] = useState(false);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      setLoading(true);
      try {
        const res = await apiFetch<{ profile: CenterProfile; license: LicenseStatusResponse }>(
          '/api/profile',
          sessionYear,
        );
        if (!active) return;
        setProfile(res.profile);
        if (res.license) onLicenseUpdated(res.license);
      } catch (err) {
        if (active) onNotify('error', 'Failed to Load Profile', String(err));
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadProfile();
    return () => {
      active = false;
    };
  }, [sessionYear, onLicenseUpdated, onNotify]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.schoolName.trim()) {
      onNotify('error', 'Center Name Required', 'Please enter School / Examination Center Name.');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch<{ profile: CenterProfile }>('/api/profile', sessionYear, {
        method: 'POST',
        body: JSON.stringify(profile),
      });
      setProfile(res.profile);
      onNotify(
        'info',
        'Center Profile Saved',
        'PDF headers and official center details have been updated.',
      );
    } catch (err) {
      onNotify('error', 'Save Failed', String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleCopyMachineId = async () => {
    if (!license?.machineId) return;
    try {
      await navigator.clipboard.writeText(license.machineId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1800);
    } catch {
      setCopiedId(false);
    }
  };

  const handleActivateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) return;
    setActivating(true);
    setLicenseError(null);
    setLicenseSuccess(null);
    try {
      const updated = await apiFetch<LicenseStatusResponse>('/api/license/activate', sessionYear, {
        method: 'POST',
        body: JSON.stringify({ licenseKey: licenseKeyInput.trim() }),
      });
      setLicenseKeyInput('');
      setLicenseSuccess(`Activated ${updated.plan} key for ${updated.schoolName}.`);
      onLicenseUpdated(updated);
    } catch (err) {
      setLicenseError(err instanceof Error ? err.message : String(err));
    } finally {
      setActivating(false);
    }
  };

  const isHealthy = license?.status === 'LICENSED' || license?.status === 'TRIAL_ACTIVE';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
          Center Profile &amp; Subscription
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Manage examination center details printed on official PDFs and inspect your device-bound license status.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Center / School Profile Editor */}
        <div className="lg:col-span-7 rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-card-textured p-5 shadow-xs">
          <div className="flex items-center gap-2 border-b border-[#ECEAE4] dark:border-[#213331] pb-3 mb-4">
            <Building2 className="h-4 w-4 text-[#0F766E] dark:text-teal-400" />
            <h3 className="text-sm font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
              School &amp; Examination Center Details
            </h3>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Loading center details...
            </div>
          ) : (
            <form onSubmit={(e) => void handleSaveProfile(e)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="profile-school-name"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    School / Center Name *
                  </label>
                  <input
                    id="profile-school-name"
                    type="text"
                    required
                    value={profile.schoolName}
                    onChange={(e) => setProfile((p) => ({ ...p, schoolName: e.target.value }))}
                    placeholder="e.g. TAGORE S S I C HAPUR"
                    className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#0C1514] px-3 py-2 text-sm text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="profile-center-code"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Center Code
                  </label>
                  <input
                    id="profile-center-code"
                    type="text"
                    value={profile.centerCode}
                    onChange={(e) => setProfile((p) => ({ ...p, centerCode: e.target.value }))}
                    placeholder="e.g. 13265"
                    className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#0C1514] px-3 py-2 font-mono text-sm text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="profile-board-name"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Board / Affiliation
                  </label>
                  <input
                    id="profile-board-name"
                    type="text"
                    value={profile.boardName}
                    onChange={(e) => setProfile((p) => ({ ...p, boardName: e.target.value }))}
                    placeholder="e.g. UPMSP Board / CBSE"
                    className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#0C1514] px-3 py-2 text-sm text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="profile-principal-name"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Center Superintendent / Principal
                  </label>
                  <input
                    id="profile-principal-name"
                    type="text"
                    value={profile.principalName}
                    onChange={(e) => setProfile((p) => ({ ...p, principalName: e.target.value }))}
                    placeholder="Superintendent Name"
                    className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#0C1514] px-3 py-2 text-sm text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="profile-controller-name"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Exam In-Charge / Controller
                  </label>
                  <input
                    id="profile-controller-name"
                    type="text"
                    value={profile.controllerName}
                    onChange={(e) => setProfile((p) => ({ ...p, controllerName: e.target.value }))}
                    placeholder="Exam Controller Name"
                    className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#0C1514] px-3 py-2 text-sm text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="profile-phone"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Contact Phone
                  </label>
                  <input
                    id="profile-phone"
                    type="text"
                    value={profile.phone}
                    onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="e.g. 9829011223"
                    className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#0C1514] px-3 py-2 font-mono text-sm text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="profile-email"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Official Email
                  </label>
                  <input
                    id="profile-email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                    placeholder="exam@school.edu.in"
                    className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#0C1514] px-3 py-2 text-sm text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="profile-address"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Center Address / City
                  </label>
                  <input
                    id="profile-address"
                    type="text"
                    value={profile.address}
                    onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
                    placeholder="City, District, State"
                    className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#0C1514] px-3 py-2 text-sm text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#ECEAE4] dark:border-[#213331]">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {profile.updatedAt
                    ? `Last updated: ${new Date(profile.updatedAt).toLocaleString()}`
                    : 'Not saved yet'}
                </span>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0F766E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#115E59] disabled:opacity-50 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Saving...' : 'Save Center Profile'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right: Device Hardware Binding & Subscription Details */}
        <div className="lg:col-span-5 rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-card-textured p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#ECEAE4] dark:border-[#213331] pb-3">
            <div className="flex items-center gap-2">
              {isHealthy ? (
                <ShieldCheck className="h-4 w-4 text-[#0F766E] dark:text-teal-400" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
              )}
              <h3 className="text-sm font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
                Subscription &amp; Device Lock
              </h3>
            </div>
            {license && (
              <span
                className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold ${
                  license.status === 'LICENSED'
                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : license.status === 'TRIAL_ACTIVE'
                      ? 'bg-teal-100 text-teal-900 dark:bg-teal-950/60 dark:text-teal-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                }`}
              >
                {license.plan}
              </span>
            )}
          </div>

          {license ? (
            <>
              <div
                className={`rounded-lg border px-3.5 py-2.5 text-xs space-y-1 ${
                  license.status === 'LICENSED'
                    ? 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/75 dark:bg-emerald-950/35 text-emerald-900 dark:text-emerald-200'
                    : license.status === 'TRIAL_ACTIVE'
                      ? 'border-teal-200 dark:border-teal-800/70 bg-teal-50/75 dark:bg-teal-950/35 text-teal-900 dark:text-teal-200'
                      : 'border-red-200 dark:border-red-800/70 bg-red-50/80 dark:bg-red-950/40 text-red-900 dark:text-red-200'
                }`}
              >
                <div className="font-semibold">Status: {license.status.replace(/_/g, ' ')}</div>
                <div>{license.message}</div>
              </div>

              <div className="rounded-lg border border-[#E2DFD7] dark:border-[#243936] bg-[#FAF9F5] dark:bg-[#0D1615] p-3.5 space-y-2">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Hardware Machine ID (Locked to this PC)
                </div>
                <div className="flex items-center justify-between gap-2">
                  <code className="font-mono text-sm font-bold tracking-wider text-[#111C1B] dark:text-teal-300">
                    {license.machineId}
                  </code>
                  <button
                    type="button"
                    onClick={() => void handleCopyMachineId()}
                    className="inline-flex items-center gap-1 rounded-md border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#142321] px-2.5 py-1 text-xs font-semibold text-[#111C1B] dark:text-slate-200 hover:bg-[#FAF9F5] dark:hover:bg-[#1B2D2B] cursor-pointer"
                  >
                    {copiedId ? (
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

              <div className="grid grid-cols-2 gap-3 text-xs rounded-lg border border-[#E2DFD7] dark:border-[#213331] bg-white/70 dark:bg-[#0D1615]/60 p-3.5">
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Licensed Institution</div>
                  <div className="mt-0.5 font-semibold truncate">{license.schoolName}</div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Licensed Code</div>
                  <div className="mt-0.5 font-mono font-semibold">{license.centerCode}</div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Valid Until</div>
                  <div className="mt-0.5 font-mono font-semibold tabular-nums">
                    {license.expiresAt ? license.expiresAt.slice(0, 10) : 'Perpetual'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Remaining</div>
                  <div className="mt-0.5 font-mono font-semibold tabular-nums">
                    {license.daysRemaining === null
                      ? 'Unlimited'
                      : `${license.daysRemaining} day(s)`}
                  </div>
                </div>
              </div>

              <form onSubmit={(e) => void handleActivateKey(e)} className="space-y-2.5 pt-1">
                {licenseError && (
                  <div className="rounded-lg border border-red-200 dark:border-red-800/70 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
                    {licenseError}
                  </div>
                )}
                {licenseSuccess && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{licenseSuccess}</span>
                  </div>
                )}

                <label
                  htmlFor="profile-license-key"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Activate / Upgrade Subscription Key
                </label>
                <textarea
                  id="profile-license-key"
                  rows={2}
                  value={licenseKeyInput}
                  onChange={(e) => setLicenseKeyInput(e.target.value)}
                  placeholder="UNN1.eyJ2IjoxLCJtYWNoaW5lSWQiOi..."
                  className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#0C1514] px-3 py-2 font-mono text-xs text-[#111C1B] dark:text-[#EDF4F2] placeholder:text-slate-400 focus:border-[#0F766E] focus:outline-none"
                />

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCliHelp((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-[#0F766E] dark:hover:text-teal-300 cursor-pointer"
                  >
                    <Terminal className="h-3.5 w-3.5" />
                    {showCliHelp ? 'Hide CLI Info' : 'Keygen Command'}
                  </button>
                  <button
                    type="submit"
                    disabled={activating || !licenseKeyInput.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F766E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#115E59] disabled:opacity-50 cursor-pointer"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    {activating ? 'Activating...' : 'Activate Key'}
                  </button>
                </div>

                {showCliHelp && (
                  <div className="rounded-lg border border-[#E2DFD7] dark:border-[#243936] bg-[#FAF9F5] dark:bg-[#0B1413] p-2.5 text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto">
                    npx tsx scripts/keygen.ts --machineId {license.machineId} --school &quot;
                    {profile.schoolName || 'School Name'}&quot; --center {profile.centerCode || '13265'}{' '}
                    --plan ANNUAL --days 365
                  </div>
                )}
              </form>
            </>
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Loading device license information...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
