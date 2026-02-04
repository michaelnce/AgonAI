import React from 'react';

interface AgentCardProps {
  name: string;
  role: 'Proponent' | 'Opponent';
  status: 'Speaking' | 'Waiting' | 'Leading' | 'Defending';
  profiles: string[];
  tones: string[];
  selectedProfile: string;
  selectedTone: string;
  onProfileChange: (val: string) => void;
  onToneChange: (val: string) => void;
  disabled?: boolean;
}

export const AgentCard: React.FC<AgentCardProps> = ({ 
  role, 
  status, 
  profiles, 
  tones, 
  selectedProfile, 
  selectedTone, 
  onProfileChange, 
  onToneChange,
  disabled 
}) => {
  const isProponent = role === 'Proponent';
  const badgeColor = isProponent ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400';
  const badgeText = isProponent ? 'LEADING' : 'DEFENDING';

  return (
    <div className="bg-[#1E293B] border border-gray-700 rounded-xl p-5 flex-1 min-w-[300px]">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isProponent ? 'bg-blue-500' : 'bg-purple-500'}`}>
            <span className="text-white text-xs">✨</span>
          </div>
          <h3 className="font-bold text-white text-lg">{role} Agent</h3>
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${badgeColor}`}>
          {badgeText}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Profile</label>
          <select 
            value={selectedProfile}
            onChange={(e) => onProfileChange(e.target.value)}
            disabled={disabled}
            className="w-full bg-[#0F172A] border border-gray-700 text-gray-300 text-sm rounded-lg p-2.5 appearance-none focus:border-blue-500 focus:outline-none disabled:opacity-50"
          >
            {profiles.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Tone</label>
          <select 
            value={selectedTone}
            onChange={(e) => onToneChange(e.target.value)}
            disabled={disabled}
            className="w-full bg-[#0F172A] border border-gray-700 text-gray-300 text-sm rounded-lg p-2.5 appearance-none focus:border-blue-500 focus:outline-none disabled:opacity-50"
          >
             {tones.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
};
