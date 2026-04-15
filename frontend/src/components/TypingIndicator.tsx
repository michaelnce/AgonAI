import React from 'react';

interface TypingIndicatorProps {
  speaker: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ speaker }) => {
  const isProponent = speaker.toLowerCase().includes('proponent');
  const isOpponent = speaker.toLowerCase().includes('opponent');

  return (
    <div className={`flex flex-col mb-8 ${isProponent ? 'items-start' : isOpponent ? 'items-end' : 'items-center'}`}>
      <div className={`flex items-center gap-2 mb-2 ${isOpponent ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isProponent ? 'bg-blue-500' : isOpponent ? 'bg-purple-500' : 'bg-gray-500'
          }`}>
          <span className="text-white text-[10px]">⚡</span>
        </div>
        <span className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wide">{speaker}</span>
        <span className="text-blue-400 text-[10px] animate-pulse">thinking...</span>
      </div>

      <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-2xl flex gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]"></span>
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]"></span>
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce"></span>
      </div>
    </div>
  );
};
