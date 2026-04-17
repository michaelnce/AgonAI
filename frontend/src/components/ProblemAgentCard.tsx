import React from 'react';
import type { AgentRole, ProblemAgentConfig } from '../types';

const ROLE_INFO: Record<AgentRole, { label: string; badge: string; color: string; borderColor: string; description: string }> = {
  analyst: { label: 'Analyst', badge: 'ANL', color: 'text-blue-400', borderColor: 'border-l-blue-500', description: 'Root causes & data' },
  creative: { label: 'Creative', badge: 'CRE', color: 'text-purple-400', borderColor: 'border-l-purple-500', description: 'Unconventional ideas' },
  critic: { label: 'Critic', badge: 'CRT', color: 'text-orange-400', borderColor: 'border-l-orange-500', description: 'Flaws & risks' },
  pragmatist: { label: 'Pragmatist', badge: 'PRG', color: 'text-green-400', borderColor: 'border-l-green-500', description: 'Feasibility & cost' },
  synthesizer: { label: 'Synthesizer', badge: 'SYN', color: 'text-amber-400', borderColor: 'border-l-amber-500', description: 'Merges & consensus' },
};

interface ProblemAgentCardProps {
  role: AgentRole;
  config: ProblemAgentConfig;
  profiles: Array<{ Movement: string }>;
  tones: Array<{ tone: string }>;
  languages: Array<{ name: string; flag?: string }>;
  onUpdate: (field: keyof ProblemAgentConfig, value: string) => void;
  disabled: boolean;
  agentName?: string;
  status?: 'Speaking' | 'Waiting' | 'Idle';
}

export const ProblemAgentCard: React.FC<ProblemAgentCardProps> = ({
  role, config, profiles, tones, languages, onUpdate, disabled, agentName, status,
}) => {
  const info = ROLE_INFO[role];
  const selectClass = "flex-1 min-w-0 bg-slate-50 dark:bg-[#0F172A] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white disabled:opacity-50 truncate";

  return (
    <div className={`flex items-center gap-4 bg-white dark:bg-[#1E293B]/60 border border-gray-200 dark:border-gray-700 ${info.borderColor} border-l-4 rounded-lg px-4 py-3 transition-all ${status === 'Speaking' ? 'ring-1 ring-green-500/40 bg-green-500/5 dark:bg-green-500/5' : ''}`}>
      {/* Role label */}
      <div className="flex items-center gap-2 shrink-0 w-32">
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${info.color} bg-black/10 dark:bg-black/20`}>{info.badge}</span>
        <div className="min-w-0">
          <span className={`text-sm font-bold ${info.color} block truncate`}>{agentName || info.label}</span>
          <span className="text-[10px] text-gray-500 block">{info.description}</span>
        </div>
        {status === 'Speaking' && <span className="text-[9px] text-green-400 font-bold animate-pulse shrink-0">●</span>}
      </div>

      {/* Dropdowns */}
      <div className="flex flex-1 items-center gap-3 min-w-0">
        <select value={config.profile} onChange={(e) => onUpdate('profile', e.target.value)} disabled={disabled} className={selectClass}>
          <option value="__random__">Random Profile</option>
          <option value="__best_match__">Best Match</option>
          {profiles.map((p) => <option key={p.Movement} value={p.Movement}>{p.Movement}</option>)}
        </select>
        <select value={config.tone} onChange={(e) => onUpdate('tone', e.target.value)} disabled={disabled} className={selectClass}>
          <option value="__random__">Random Tone</option>
          <option value="__best_match__">Best Match</option>
          {tones.map((t) => <option key={t.tone} value={t.tone}>{t.tone}</option>)}
        </select>
        <select value={config.language} onChange={(e) => onUpdate('language', e.target.value)} disabled={disabled} className={selectClass}>
          {languages.map((l) => <option key={l.name} value={l.name}>{l.flag ? `${l.flag} ` : ''}{l.name}</option>)}
        </select>
      </div>
    </div>
  );
};
