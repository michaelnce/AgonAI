import React from 'react';
import ReactMarkdown from 'react-markdown';

const SPEAKER_STYLES: Record<string, { color: string; bgColor: string; bubbleBg: string; bubbleText: string; badge: string }> = {
  facilitator: { color: 'bg-slate-500', bgColor: '', bubbleBg: 'bg-slate-100 dark:bg-[#1E293B] border-gray-200 dark:border-gray-700', bubbleText: 'text-slate-700 dark:text-gray-300', badge: 'HOST' },
  analyst: { color: 'bg-blue-500', bgColor: 'bg-blue-500/15 text-blue-400', bubbleBg: 'bg-slate-50 dark:bg-[#1E293B]/80 border-blue-500/20', bubbleText: 'text-blue-600 dark:text-blue-400', badge: 'ANL' },
  creative: { color: 'bg-purple-500', bgColor: 'bg-purple-500/15 text-purple-400', bubbleBg: 'bg-white dark:bg-[#1E293B] border-purple-500/20', bubbleText: 'text-purple-600 dark:text-purple-400', badge: 'CRE' },
  critic: { color: 'bg-orange-500', bgColor: 'bg-orange-500/15 text-orange-400', bubbleBg: 'bg-slate-50 dark:bg-[#1E293B]/80 border-orange-500/20', bubbleText: 'text-orange-600 dark:text-orange-400', badge: 'CRT' },
  pragmatist: { color: 'bg-green-500', bgColor: 'bg-green-500/15 text-green-400', bubbleBg: 'bg-white dark:bg-[#1E293B] border-green-500/20', bubbleText: 'text-green-600 dark:text-green-400', badge: 'PRG' },
  synthesizer: { color: 'bg-amber-500', bgColor: 'bg-amber-500/15 text-amber-400', bubbleBg: 'bg-slate-50 dark:bg-[#1E293B]/80 border-amber-500/20', bubbleText: 'text-amber-600 dark:text-amber-400', badge: 'SYN' },
};

interface ProblemMessageProps {
  speaker: string;
  content: string;
  timestamp?: string;
  agentNames?: Record<string, string> | null;
  isStreaming?: boolean;
}

export const ProblemMessage: React.FC<ProblemMessageProps> = ({ speaker, content, timestamp, agentNames }) => {
  const speakerKey = speaker.toLowerCase();
  const style = SPEAKER_STYLES[speakerKey] || SPEAKER_STYLES.facilitator;

  // Clean content: remove role prefix if present
  const cleanContent = content.replace(/^(Facilitator|Analyst|Creative|Critic|Pragmatist|Synthesizer):\s*/i, '').trim();

  const displayName = agentNames?.[speakerKey] || speaker.charAt(0).toUpperCase() + speaker.slice(1);

  if (speakerKey === 'facilitator') {
    return (
      <div className="flex justify-center my-6">
        <div className="bg-slate-100 dark:bg-[#1E293B] text-slate-700 dark:text-gray-300 px-6 py-3 rounded-none text-sm border border-gray-200 dark:border-gray-700 max-w-[95%] md:max-w-[85%] prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{cleanContent}</ReactMarkdown>
        </div>
      </div>
    );
  }

  // Alternate sides based on agent role for visual variety
  const isLeft = ['analyst', 'critic', 'synthesizer'].includes(speakerKey);

  return (
    <div className={`flex flex-col mb-8 ${isLeft ? 'items-start' : 'items-end'}`}>
      <div className={`flex items-center gap-2 mb-2 ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold ${style.color}`}>
          {displayName.charAt(0).toUpperCase()}
        </div>
        <span className="font-bold text-slate-900 dark:text-white text-xs">{displayName}</span>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${style.bgColor}`}>{style.badge}</span>
        <span className="text-gray-500 text-[10px]">{timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      <div className={`max-w-[95%] md:max-w-[80%] p-3 md:p-5 rounded-2xl border text-sm leading-relaxed break-words ${style.bubbleBg} ${style.bubbleText} ${isLeft ? 'rounded-tl-sm' : 'rounded-tr-sm'} prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1`}>
        <ReactMarkdown>{cleanContent}</ReactMarkdown>
      </div>
    </div>
  );
};

export const PhaseDivider: React.FC<{ phase: string; round?: number }> = ({ phase, round }) => (
  <div className="flex items-center gap-3 my-6">
    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
      {phase}{round && round > 1 ? ` — Round ${round}` : ''}
    </span>
    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
  </div>
);
