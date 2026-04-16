import React from 'react';

interface SidebarProps {
  onNavigate: (panel: string) => void;
  activePanel: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onNavigate, activePanel, isOpen, onClose }) => {
  const handleNav = (panel: string) => {
    onNavigate(panel);
    onClose();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-slate-100 dark:bg-[#0F172A] text-slate-700 dark:text-gray-300 flex flex-col border-r border-gray-200 dark:border-gray-800
        transform transition-transform duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Branding */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-lg">
            ⚖️
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">AgonAI</h3>
            <p className="text-xs text-gray-500">AI Adversarial Simulation</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <NavItem icon="📊" label="Debate Arena" active={activePanel === null} onClick={() => handleNav('current')} />
          <NavItem icon="🧠" label="Problem Solver" active={activePanel === 'problem'} onClick={() => handleNav('problem')} />
          <NavItem icon="📁" label="Saved Sessions" active={activePanel === 'debates'} onClick={() => handleNav('debates')} />
          <NavItem icon="🔖" label="Saved Scenarios" active={activePanel === 'scenarios'} onClick={() => handleNav('scenarios')} />
          <NavItem icon="👥" label="Agent Profiles" active={activePanel === 'profiles'} onClick={() => handleNav('profiles')} />
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
          <NavItem icon="❓" label="Help Center" onClick={() => handleNav('help')} />
        </div>
      </aside>
    </>
  );
};

const NavItem: React.FC<{ icon: string; label: string; active?: boolean; onClick?: () => void }> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${active ? 'bg-blue-600/20 text-blue-600 dark:text-blue-400 border-l-2 border-blue-500' : 'hover:bg-gray-200 dark:hover:bg-gray-800'
    }`}
  >
    <span>{icon}</span>
    <span className="font-medium text-sm">{label}</span>
  </button>
);
