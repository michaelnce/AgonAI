import React from 'react';
import type { AgentRole, ProblemAgentConfig } from '../types';

const ROLE_INFO: Record<AgentRole, { label: string; badge: string; color: string; bgColor: string; description: string }> = {
  analyst: { label: 'Analyst', badge: 'ANL', color: 'text-blue-400', bgColor: 'bg-blue-500/10 border-blue-500/30', description: 'Root causes & data' },
  creative: { label: 'Creative', badge: 'CRE', color: 'text-purple-400', bgColor: 'bg-purple-500/10 border-purple-500/30', description: 'Unconventional ideas' },
  critic: { label: 'Critic', badge: 'CRT', color: 'text-orange-400', bgColor: 'bg-orange-500/10 border-orange-500/30', description: 'Flaws & risks' },
  pragmatist: { label: 'Pragmatist', badge: 'PRG', color: 'text-green-400', bgColor: 'bg-green-500/10 border-green-500/30', description: 'Feasibility & cost' },
  synthesizer: { label: 'Synthesizer', badge: 'SYN', color: 'text-amber-400', bgColor: 'bg-amber-500/10 border-amber-500/30', description: 'Merges & consensus' },
};

interface ProblemAgentCardProps {
  role: AgentRole;
  config: ProblemAgentConfig;
  profiles: Array<{ Movement: string }>;
  tones: Array<{ tone: string }>;
  languages: Array<{ language: string }>;
  onUpdate: (field: keyof ProblemAgentConfig, value: string) => void;
  disabled: boolean;
  agentName?: string;
}

export const ProblemAgentCard: React.FC<ProblemAgentCardProps> = ({
  role, config, profiles, tones, languages, onUpdate, disabled, agentName,
}) => {
  const info = ROLE_INFO[role];

  return (
    <div className={`${info.bgColor} border rounded-xl p-3 transition-all`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${info.color} bg-black/20`}>{info.badge}</span>
          <span className={`text-sm font-bold ${info.color}`}>{agentName || info.label}</span>
        </div>
        <span className="text-[10px] text-gray-500">{info.description}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <select
          value={config.profile}
          onChange={(e) => onUpdate('profile', e.target.value)}
          disabled={disabled}
          className="bg-slate-50 dark:bg-[#0F172A] border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-[11px] text-slate-900 dark:text-white disabled:opacity-50"
        >
          <option value="__random__">Random Profile</option>
          {profiles.map((p) => (
            <option key={p.Movement} value={p.Movement}>{p.Movement}</option>
          ))}
        </select>
        <select
          value={config.tone}
          onChange={(e) => onUpdate('tone', e.target.value)}
          disabled={disabled}
          className="bg-slate-50 dark:bg-[#0F172A] border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-[11px] text-slate-900 dark:text-white disabled:opacity-50"
        >
          <option value="__random__">Random Tone</option>
          {tones.map((t) => (
            <option key={t.tone} value={t.tone}>{t.tone}</option>
          ))}
        </select>
        <select
          value={config.language}
          onChange={(e) => onUpdate('language', e.target.value)}
          disabled={disabled}
          className="bg-slate-50 dark:bg-[#0F172A] border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-[11px] text-slate-900 dark:text-white disabled:opacity-50"
        >
          {languages.map((l) => (
            <option key={l.language} value={l.language}>{l.language}</option>
          ))}
        </select>
      </div>
    </div>
  );
};
