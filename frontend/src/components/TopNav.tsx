import React from 'react';
import { useTheme } from '../context/ThemeContext';

export const TopNav: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-16 border-b border-gray-800 bg-[#0F172A] text-white flex items-center justify-between px-6">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-500 rounded-full"></div>
          <span className="font-bold text-lg">Debate Arena</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-gray-400">
          <a href="#" className="hover:text-white transition-colors">Dashboard</a>
          <a href="#" className="hover:text-white transition-colors">Analytics</a>
          <a href="#" className="hover:text-white transition-colors">Models</a>
          <a href="#" className="hover:text-white transition-colors">Settings</a>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
          <input 
            type="text" 
            placeholder="Search debates..." 
            className="bg-gray-800 border-none rounded-lg py-1.5 pl-10 pr-4 text-sm text-white focus:ring-1 focus:ring-blue-500 w-64"
          />
        </div>
        
        <button 
          onClick={toggleTheme}
          className="p-2 text-gray-400 hover:text-white transition-colors"
          title="Toggle Theme"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
          Upgrade
        </button>
        
        <div className="w-8 h-8 rounded-full bg-orange-200 border-2 border-gray-700"></div>
      </div>
    </header>
  );
};
