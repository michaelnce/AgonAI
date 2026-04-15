import React from 'react';
import { useTheme } from '../context/ThemeContext';

interface TopNavProps {
  onMenuToggle: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({ onMenuToggle }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-16 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0F172A] text-slate-900 dark:text-white flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-4 md:gap-8">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          title="Toggle Menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-500 rounded-full"></div>
          <span className="font-bold text-lg text-slate-900 dark:text-white">AgonAI</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <span className="text-slate-900 dark:text-white font-medium">Dashboard</span>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={toggleTheme}
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          title="Toggle Theme"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
    </header>
  );
};
