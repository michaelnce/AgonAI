import React from 'react';

interface DebateMessageProps {
  speaker: string;
  content: string;
  turn: number;
  timestamp?: string;
  agentNames?: { proponent: string; opponent: string } | null;
}

export const DebateMessage: React.FC<DebateMessageProps> = ({ speaker, content, timestamp, agentNames }) => {
  const isProponent = speaker.toLowerCase().includes('proponent');
  const isModerator = speaker.toLowerCase().includes('moderator');

  // Resolve display name: use assigned name if available, otherwise role
  const getDisplayName = () => {
    if (isModerator) return 'Moderator';
    if (isProponent) return agentNames?.proponent || 'Proponent';
    return agentNames?.opponent || 'Opponent';
  };

  const displayName = getDisplayName();
  const roleLabel = isModerator ? '' : isProponent ? 'PRO' : 'OPP';

  if (isModerator) {
    return (
      <div className="flex justify-center my-6">
        <div className="bg-slate-100 dark:bg-[#1E293B] text-slate-700 dark:text-gray-300 px-6 py-3 rounded-none text-sm border border-gray-200 dark:border-gray-700">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col mb-8 ${isProponent ? 'items-start' : 'items-end'}`}>
      {/* Header */}
      <div className={`flex items-center gap-2 mb-2 ${isProponent ? 'flex-row' : 'flex-row-reverse'}`}>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold ${isProponent ? 'bg-blue-500' : 'bg-purple-500'}`}>
          {displayName.charAt(0).toUpperCase()}
        </div>
        <span className="font-bold text-slate-900 dark:text-white text-xs">{displayName}</span>
        {roleLabel && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isProponent ? 'bg-blue-500/15 text-blue-400' : 'bg-purple-500/15 text-purple-400'}`}>
            {roleLabel}
          </span>
        )}
        <span className="text-gray-500 text-[10px]">{timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      {/* Bubble */}
      <div className={`max-w-[95%] md:max-w-[80%] p-3 md:p-5 rounded-2xl border text-sm leading-relaxed break-words ${isProponent
        ? 'bg-slate-50 dark:bg-[#1E293B]/80 border-gray-200 dark:border-gray-700 text-blue-600 dark:text-blue-400 rounded-tl-sm'
        : 'bg-white dark:bg-[#1E293B] border-gray-200 dark:border-gray-700 text-purple-600 dark:text-purple-400 rounded-tr-sm'
        }`}>
        {content}
      </div>
    </div>
  );
};
