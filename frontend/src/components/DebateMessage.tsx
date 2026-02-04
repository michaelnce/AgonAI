import React from 'react';

interface DebateMessageProps {
  speaker: string;
  content: string;
  turn: number;
}

export const DebateMessage: React.FC<DebateMessageProps> = ({ speaker, content, turn }) => {
  const isModerator = speaker.toLowerCase().includes('moderator');
  const isProponent = speaker.toLowerCase().includes('proponent');

  return (
    <div className={`flex flex-col mb-6 ${isModerator ? 'items-center' : isProponent ? 'items-start' : 'items-end'}`}>
      <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${
        isModerator 
          ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 text-center' 
          : isProponent 
            ? 'bg-green-50 dark:bg-green-900/30 border border-green-100 dark:border-green-800' 
            : 'bg-purple-50 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-800'
      }`}>
        <div className="flex items-center justify-between mb-2 gap-4">
          <span className="font-bold text-sm uppercase tracking-wider opacity-70">{speaker}</span>
          <span className="text-xs opacity-50">Turn {turn}</span>
        </div>
        <p className="leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
};
