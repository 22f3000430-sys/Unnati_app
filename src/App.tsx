import React, { useEffect, useState } from 'react';
import {
  CalendarCog,
  FileText,
  GraduationCap,
  Grid2x2,
  KeyRound,
  LayoutDashboard,
  Lock,
  Menu,
  Moon,
  Plus,
  Search,
  Sun,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type {
  AuthStatusResponse,
  DashboardResponse,
  LicenseStatusResponse,
  SeatingModuleType,
} from './types/seating.ts';
import { apiFetch, setAuthToken, setUnauthorizedHandler } from './utils/api.ts';
import { AuthGate } from './components/AuthGate.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { BoardSeatingView } from './components/BoardSeatingView.tsx';
import { StudentLookupView } from './components/StudentLookupView.tsx';
import { StudentsView } from './components/StudentsView.tsx';
import { MasterDataView, type MasterTab } from './components/MasterDataView.tsx';
import { ReportsView } from './components/ReportsView.tsx';
import { DialogModal, type DialogState } from './components/DialogModal.tsx';
import { UnnatiLogo } from './components/UnnatiLogo.tsx';
import { LicenseModal } from './components/LicenseModal.tsx';

type NavKey =
  | 'dashboard'
  | 'board'
  | 'school'
  | 'school-students'
  | 'lookup'
  | 'students'
  | 'master'
  | 'reports';

const NAV_GROUPS: Array<{
  heading: string;
  items: Array<{
    key: NavKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}> = [
  {
    heading: 'Board Exam Center',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'board', label: 'Board Seating', icon: Grid2x2 },
      { key: 'students', label: 'Nominal Roll', icon: Users },
      { key: 'lookup', label: 'Roll Lookup', icon: Search },
    ],
  },
  {
    heading: 'Pre-Board (Isolated)',
    items: [
      { key: 'school', label: 'Pre-Board Seating', icon: GraduationCap },
      { key: 'school-students', label: 'Pre-Board Students', icon: UserCheck },
    ],
  },
  {
    heading: 'Center Setup',
    items: [
      { key: 'master', label: 'Master Data', icon: CalendarCog },
      { key: 'reports', label: 'Reports', icon: FileText },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return localStorage.getItem('unnati-theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const [activeNav, setActiveNav] = useState<NavKey>('dashboard');
  const [masterTab, setMasterTab] = useState<MasterTab>('rooms');
  const [masterModule, setMasterModule] = useState<SeatingModuleType>('BOARD');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatusResponse | null>(null);
  const [showLicenseModal, setShowLicenseModal] = useState(false);

  const [sessions, setSessions] = useState<string[]>(['2025-26', '2026-27']);
  const [sessionYear, setSessionYear] = useState<string>('2025-26');
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [copyRoomsFrom, setCopyRoomsFrom] = useState('2025-26');
  const [creatingSession, setCreatingSession] = useState(false);

  const [dialog, setDialog] = useState<DialogState>({
    open: false,
    type: 'info',
    title: '',
    message: '',
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('unnati-theme', theme);
    } catch {
      // ignore storage failure
    }
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const notify = React.useCallback((type: 'info' | 'error', title: string, message: string) => {
    setDialog({ open: true, type, title, message });
  }, []);

  const confirm = React.useCallback((title: string, message: string, onConfirm: () => void) => {
    setDialog({ open: true, type: 'confirm', title, message, onConfirm });
  }, []);

  const refreshLicenseStatus = React.useCallback(async () => {
    try {
      const res = await fetch('/api/license/status');
      if (res.ok) {
        const data = (await res.json()) as LicenseStatusResponse;
        setLicenseStatus(data);
      }
    } catch {
      // ignore license check error
    }
  }, []);

  const refreshAuthStatus = React.useCallback(async () => {
    try {
      const res = await fetch('/api/auth/status');
      if (res.ok) {
        const data = (await res.json()) as AuthStatusResponse;
        setAuthStatus(data);
      } else {
        setAuthStatus({ configured: true, envManaged: false, authenticated: false });
      }
    } catch {
      setAuthStatus({ configured: false, envManaged: false, authenticated: false });
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAuthToken(null);
      setAuthStatus((prev) =>
        prev
          ? { ...prev, authenticated: false }
          : { configured: true, envManaged: false, authenticated: false },
      );
    });
    void refreshAuthStatus();
    void refreshLicenseStatus();
    return () => setUnauthorizedHandler(null);
  }, [refreshAuthStatus, refreshLicenseStatus]);

  const loadSessions = React.useCallback(async () => {
    try {
      const data = await apiFetch<{ sessions: string[] }>('/api/sessions', sessionYear);
      if (Array.isArray(data.sessions) && data.sessions.length > 0) {
        setSessions(data.sessions);
      }
    } catch {
      // Keep defaults
    }
  }, [sessionYear]);

  const loadDashboard = React.useCallback(
    async (targetSession = sessionYear) => {
      setDashboardLoading(true);
      try {
        const data = await apiFetch<DashboardResponse>('/api/dashboard', targetSession);
        setDashboard(data);
      } catch (err) {
        notify('error', 'Dashboard Error', String(err));
      } finally {
        setDashboardLoading(false);
      }
    },
    [sessionYear, notify],
  );

  useEffect(() => {
    if (!authStatus?.authenticated) return;
    void loadSessions();
    void loadDashboard(sessionYear);
    void refreshLicenseStatus();
  }, [authStatus?.authenticated, sessionYear, loadSessions, loadDashboard, refreshLicenseStatus]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAuthToken(null);
    setDashboard(null);
    setAuthStatus((prev) =>
      prev
        ? { ...prev, authenticated: false }
        : { configured: true, envManaged: false, authenticated: false },
    );
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newSessionName.trim();
    if (!clean) return;
    setCreatingSession(true);
    try {
      const res = await apiFetch<{ sessions: string[]; sessionYear: string }>(
        '/api/sessions',
        sessionYear,
        {
          method: 'POST',
          body: JSON.stringify({
            sessionYear: clean,
            copyRoomsFrom: copyRoomsFrom || undefined,
          }),
        },
      );
      setSessions(res.sessions);
      setSessionYear(res.sessionYear);
      setNewSessionName('');
      setShowNewSessionModal(false);
      notify('info', 'Session Created', `Switched to Session ${res.sessionYear}.`);
    } catch (err) {
      notify('error', 'Failed to Create Session', String(err));
    } finally {
      setCreatingSession(false);
    }
  };

  const handleClearSession = () => {
    confirm(
      `Clear Session ${sessionYear}?`,
      `This removes all Board & Pre-Board records, rooms, datesheets, and reports inside Session ${sessionYear}.`,
      async () => {
        try {
          await apiFetch(`/api/sessions/${encodeURIComponent(sessionYear)}/clear`, sessionYear, {
            method: 'POST',
          });
          await loadDashboard(sessionYear);
          setActiveNav('dashboard');
          notify('info', 'Session Cleared', `Session ${sessionYear} cleared.`);
        } catch (err) {
          notify('error', 'Failed to Clear Session', String(err));
        }
      },
    );
  };

  const activeLabel = ALL_NAV_ITEMS.find((i) => i.key === activeNav)?.label ?? 'Dashboard';

  const licenseShortBadge = licenseStatus
    ? licenseStatus.status === 'LICENSED'
      ? `${licenseStatus.plan} · ${licenseStatus.centerCode}`
      : licenseStatus.status === 'TRIAL_ACTIVE'
        ? `Trial · ${licenseStatus.daysRemaining ?? 14}d left`
        : licenseStatus.status.replace(/_/g, ' ')
    : 'License Check';

  const renderNavGroups = (closeMobile = false) => (
    <nav className="flex-1 space-y-5 px-3 py-4 overflow-y-auto">
      {NAV_GROUPS.map((group) => (
        <div key={group.heading}>
          <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-teal-200/50">
            {group.heading}
          </div>
          <div className="space-y-1">
            {group.items.map(({ key, label, icon: Icon }) => {
              const active = activeNav === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (key === 'master') {
                      setMasterModule('BOARD');
                    }
                    setActiveNav(key);
                    if (closeMobile) setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#0F766E] text-white shadow-xs'
                      : 'text-slate-300 hover:bg-[#1B2D2B] hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-600 dark:text-slate-300">
        Checking center access...
      </div>
    );
  }

  if (!authStatus?.authenticated) {
    return (
      <>
        <AuthGate
          status={authStatus ?? { configured: false, envManaged: false, authenticated: false }}
          license={licenseStatus}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenLicenseModal={() => setShowLicenseModal(true)}
          onAuthenticated={(token) => {
            setAuthToken(token);
            setAuthStatus((prev) => ({
              configured: true,
              envManaged: prev?.envManaged ?? false,
              authenticated: true,
            }));
          }}
        />
        <LicenseModal
          open={showLicenseModal}
          sessionYear={sessionYear}
          license={licenseStatus}
          canActivate={false}
          onClose={() => setShowLicenseModal(false)}
          onUpdated={setLicenseStatus}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen flex text-[#111C1B] dark:text-[#EDF4F2]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 bg-sidebar-textured border-r border-[#1F3230] text-slate-200">
        <div className="flex h-14 items-center border-b border-[#1F3230] px-4">
          <UnnatiLogo size="md" tone="dark-bg" />
        </div>

        {renderNavGroups(false)}

        <div className="border-t border-[#1F3230] px-4 py-3 space-y-2.5 text-xs text-teal-200/65">
          <div className="flex items-center justify-between">
            <span>Session</span>
            <span className="font-mono font-semibold text-white">{sessionYear}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowLicenseModal(true)}
            className="w-full flex items-center justify-between gap-2 rounded-lg border border-[#243B38] bg-[#132220] px-2.5 py-2 text-left text-xs hover:bg-[#1B2F2D] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <KeyRound
                className={`h-3.5 w-3.5 shrink-0 ${
                  licenseStatus?.writeAllowed ? 'text-teal-400' : 'text-red-400'
                }`}
              />
              <span className="truncate font-medium text-slate-200">{licenseShortBadge}</span>
            </span>
            <span className="text-[10px] font-mono text-teal-300/80 shrink-0">ID</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-50 flex w-64 flex-col bg-sidebar-textured text-slate-200">
            <div className="flex h-14 items-center justify-between border-b border-[#1F3230] px-4">
              <UnnatiLogo size="sm" tone="dark-bg" showSubtitle={false} />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close Navigation"
                className="rounded p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderNavGroups(true)}
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-60">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#D8D4CA] dark:border-[#213331] bg-[#F5F3EC]/92 dark:bg-[#0D1615]/92 backdrop-blur-xs px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open Navigation"
              className="rounded-md p-1.5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#182725] lg:hidden cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="font-mono font-medium text-slate-500 dark:text-slate-400">
                Session {sessionYear}
              </span>
              <span className="text-[#D8D4CA] dark:text-[#2A403E]">/</span>
              <span className="font-semibold text-[#111C1B] dark:text-[#EDF4F2] truncate">
                {activeLabel}
              </span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="session-select"
              className="hidden sm:inline text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              Session:
            </label>
            <select
              id="session-select"
              value={sessionYear}
              onChange={(e) => setSessionYear(e.target.value)}
              className="rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#111D1B] px-2.5 py-1.5 font-mono text-xs font-semibold text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] focus:outline-none"
            >
              {sessions.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                setCopyRoomsFrom(sessionYear);
                setShowNewSessionModal(true);
              }}
              title="Create New Academic Session"
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#111D1B] px-2.5 py-1.5 text-xs font-medium text-[#111C1B] dark:text-slate-200 hover:bg-[#FAF9F5] dark:hover:bg-[#182725] cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Session</span>
            </button>

            <button
              type="button"
              onClick={handleClearSession}
              title={`Clear all data in Session ${sessionYear}`}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#111D1B] px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-300 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Clear</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLicenseModal(true)}
              title="View Device ID & License"
              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                licenseStatus && !licenseStatus.writeAllowed
                  ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300'
                  : 'border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#111D1B] text-slate-700 dark:text-slate-200 hover:bg-[#FAF9F5] dark:hover:bg-[#182725]'
              }`}
            >
              <KeyRound className="h-3.5 w-3.5 text-[#0F766E] dark:text-teal-400" />
              <span className="hidden xl:inline">{licenseShortBadge}</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#111D1B] px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-amber-300 hover:bg-[#FAF9F5] dark:hover:bg-[#182725] cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleLogout()}
              title="Lock Center Portal"
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#111D1B] px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-[#FAF9F5] dark:hover:bg-[#182725] cursor-pointer"
            >
              <Lock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lock</span>
            </button>
          </div>
        </header>

        {/* Expired / Clock-Tamper Read-Only Banner */}
        {licenseStatus && !licenseStatus.writeAllowed && (
          <div className="border-b border-red-200 dark:border-red-800/70 bg-red-50/90 dark:bg-red-950/60 px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-red-900 dark:text-red-200">
            <span>
              <strong>Read-Only Mode:</strong> {licenseStatus.message}
            </span>
            <button
              type="button"
              onClick={() => setShowLicenseModal(true)}
              className="rounded-md bg-red-700 px-3 py-1 font-semibold text-white hover:bg-red-800 cursor-pointer"
            >
              Activate Device Key
            </button>
          </div>
        )}

        {/* Active View */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeNav === 'dashboard' && (
            <DashboardView
              data={dashboard}
              loading={dashboardLoading}
              onNavigate={(view) => setActiveNav(view)}
            />
          )}

          {activeNav === 'board' && (
            <BoardSeatingView
              sessionYear={sessionYear}
              moduleType="BOARD"
              onSavedAndGoToReports={() => {
                void loadDashboard(sessionYear);
                setActiveNav('reports');
              }}
              onOpenMasterData={(tab, mod) => {
                setMasterTab(tab);
                setMasterModule(mod ?? 'BOARD');
                setActiveNav('master');
              }}
              onNotify={notify}
            />
          )}

          {activeNav === 'school' && (
            <BoardSeatingView
              sessionYear={sessionYear}
              moduleType="SCHOOL"
              onSavedAndGoToReports={() => {
                void loadDashboard(sessionYear);
                setActiveNav('reports');
              }}
              onOpenMasterData={(tab, mod) => {
                setMasterTab(tab);
                setMasterModule(mod ?? 'SCHOOL');
                setActiveNav('master');
              }}
              onOpenPreBoardStudents={() => setActiveNav('school-students')}
              onNotify={notify}
            />
          )}

          {activeNav === 'lookup' && (
            <StudentLookupView sessionYear={sessionYear} onNotify={notify} />
          )}

          {activeNav === 'students' && (
            <StudentsView
              sessionYear={sessionYear}
              moduleType="BOARD"
              onDataChanged={() => void loadDashboard(sessionYear)}
              onNotify={notify}
              onConfirm={confirm}
            />
          )}

          {activeNav === 'school-students' && (
            <StudentsView
              sessionYear={sessionYear}
              moduleType="SCHOOL"
              onDataChanged={() => void loadDashboard(sessionYear)}
              onNotify={notify}
              onConfirm={confirm}
            />
          )}

          {activeNav === 'master' && (
            <MasterDataView
              sessionYear={sessionYear}
              initialTab={masterTab}
              initialModule={masterModule}
              onDataChanged={() => void loadDashboard(sessionYear)}
              onNotify={notify}
            />
          )}

          {activeNav === 'reports' && (
            <ReportsView
              sessionYear={sessionYear}
              onGoToSeating={() => setActiveNav('board')}
              onNotify={notify}
            />
          )}
        </main>
      </div>

      {/* New Session Modal */}
      {showNewSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#091211]/65 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-xl border border-[#E2DFD7] dark:border-[#243936] bg-white dark:bg-[#111D1B] text-[#111C1B] dark:text-[#EDF4F2] p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create Academic Session</h3>
              <button
                type="button"
                onClick={() => setShowNewSessionModal(false)}
                className="rounded p-1 text-slate-400 hover:bg-[#FAF9F5] dark:hover:bg-[#182725] hover:text-[#111C1B] dark:hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateSession(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Session Year Label
                </label>
                <input
                  type="text"
                  required
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="e.g. 2027-28"
                  className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#0C1514] px-3 py-2 font-mono text-sm text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Copy Room Layout From (optional)
                </label>
                <select
                  value={copyRoomsFrom}
                  onChange={(e) => setCopyRoomsFrom(e.target.value)}
                  className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#0C1514] px-3 py-2 text-sm text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] focus:outline-none"
                >
                  <option value="">Start completely empty</option>
                  {sessions.map((yr) => (
                    <option key={yr} value={yr}>
                      Copy rooms from {yr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewSessionModal(false)}
                  className="rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#142321] px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-[#FAF9F5] dark:hover:bg-[#1B2D2B] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingSession}
                  className="rounded-lg bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#115E59] disabled:opacity-50 cursor-pointer"
                >
                  {creatingSession ? 'Creating...' : 'Create Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <LicenseModal
        open={showLicenseModal}
        sessionYear={sessionYear}
        license={licenseStatus}
        canActivate={Boolean(authStatus?.authenticated)}
        onClose={() => setShowLicenseModal(false)}
        onUpdated={setLicenseStatus}
      />

      <DialogModal
        dialog={dialog}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
      />
    </div>
  );
}

export default App;
