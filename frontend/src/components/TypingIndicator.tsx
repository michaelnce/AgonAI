import React from 'react';

const SPEAKER_COLORS: Record<string, string> = {
  proponent: 'bg-blue-500',
  opponent: 'bg-purple-500',
  moderator: 'bg-gray-500',
  facilitator: 'bg-slate-500',
  analyst: 'bg-blue-500',
  creative: 'bg-purple-500',
  critic: 'bg-orange-500',
  pragmatist: 'bg-green-500',
  synthesizer: 'bg-amber-500',
};

interface TypingIndicatorProps {
  speaker: string;
  agentNames?: Record<string, string> | { proponent: string; opponent: string } | null;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ speaker, agentNames }) => {
  const speakerKey = speaker.toLowerCase();
  const isProponent = speakerKey.includes('proponent');
  const isOpponent = speakerKey.includes('opponent');

  // Resolve display name from agentNames (supports both debate and problem formats)
  const displayName = (agentNames as Record<string, string>)?.[speakerKey] || speaker;
  const dotColor = SPEAKER_COLORS[speakerKey] || 'bg-blue-500';

  return (
    <div className={`flex flex-col mb-8 ${isProponent ? 'items-start' : isOpponent ? 'items-end' : 'items-center'}`}>
      <div className={`flex items-center gap-2 mb-2 ${isOpponent ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${dotColor}`}>
          <span className="text-white text-[10px]">{displayName.charAt(0).toUpperCase()}</span>
        </div>
        <span className="font-bold text-slate-900 dark:text-white text-xs">{displayName}</span>
        <span className="text-blue-400 text-[10px] animate-pulse">thinking...</span>
      </div>

      <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-2xl flex gap-1">
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-bounce [animation-delay:-0.3s]`}></span>
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-bounce [animation-delay:-0.15s]`}></span>
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-bounce`}></span>
      </div>
    </div>
  );
};
