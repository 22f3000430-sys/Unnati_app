import React, { useCallback, useState } from 'react';
import { DashboardView } from './components/DashboardView.tsx';
import { BoardSeatingView } from './components/BoardSeatingView.tsx';
import { OcrView } from './components/OcrView.tsx';
import { ReportsView } from './components/ReportsView.tsx';
import { DialogModal, type DialogState } from './components/DialogModal.tsx';

type NavSection = 'dashboard' | 'board-seating' | 'extraction' | 'reports';

export const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [dialog, setDialog] = useState<DialogState>({
    open: false,
    type: 'info',
    title: '',
    message: '',
  });

  const showDialog = useCallback(
    (
      type: 'info' | 'error' | 'confirm',
      title: string,
      message: string,
      onConfirm?: () => void,
    ) => {
      setDialog({ open: true, type, title, message, onConfirm });
    },
    [],
  );

  const navItems: Array<{ id: NavSection; label: string }> = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'board-seating', label: 'Board Seating' },
    { id: 'extraction', label: 'Extraction' },
    { id: 'reports', label: 'Reports' },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F1F5F9]">
      {/* Sidebar matching MainWindow.xaml */}
      <aside className="w-[240px] shrink-0 bg-[#0F172A] flex flex-col">
        <div className="p-5 text-[24px] font-bold text-white tracking-wide">SEATING APP</div>

        <nav className="px-2.5 space-y-2.5">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`w-full h-[45px] rounded-md px-3 text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#2563EB] text-white font-semibold'
                    : 'bg-slate-200 text-[#0F172A] hover:bg-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 h-full overflow-hidden bg-[#F1F5F9]">
        {activeSection === 'dashboard' && <DashboardView />}
        {activeSection === 'board-seating' && (
          <BoardSeatingView onShowDialog={showDialog} />
        )}
        {activeSection === 'extraction' && <OcrView onShowDialog={showDialog} />}
        {activeSection === 'reports' && <ReportsView />}
      </main>

      <DialogModal
        dialog={dialog}
        onClose={() => setDialog((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
};

export default App;
