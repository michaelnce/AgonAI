import React from 'react';

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-slate-100 dark:bg-[#0F172A] text-slate-700 dark:text-gray-300 flex flex-col border-r border-gray-200 dark:border-gray-800">
      {/* User Info / Active Session */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-700"></div>
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Debate History</h3>
          <p className="text-xs text-gray-500">Active Session: 2h 45m</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        <NavItem icon="📊" label="Current Debate" active />
        <NavItem icon="⏱️" label="History" />
        <NavItem icon="🔖" label="Saved Scenarios" />
        <NavItem icon="👥" label="Agent Profiles" />
        <NavItem icon="📚" label="Library" />

        <div className="pt-6 pb-2">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Recent Debates</h4>
          <div className="space-y-4">
            <RecentDebate title="Ethics of AGI Development" time="2 mins ago" />
            <RecentDebate title="Universal Basic Income" time="1 hour ago" />
          </div>
        </div>
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
        <NavItem icon="❓" label="Help Center" />
        <NavItem icon="🚪" label="Logout" />
      </div>
    </aside>
  );
};

const NavItem: React.FC<{ icon: string; label: string; active?: boolean }> = ({ icon, label, active }) => (
  <button className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${active ? 'bg-blue-600/20 text-blue-600 dark:text-blue-400 border-l-2 border-blue-500' : 'hover:bg-gray-200 dark:hover:bg-gray-800'
    }`}>
    <span>{icon}</span>
    <span className="font-medium text-sm">{label}</span>
  </button>
);

const RecentDebate: React.FC<{ title: string; time: string }> = ({ title, time }) => (
  <div className="cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors">
    <h5 className="text-sm font-medium truncate">{title}</h5>
    <p className="text-xs text-gray-500">{time}</p>
  </div>
);
