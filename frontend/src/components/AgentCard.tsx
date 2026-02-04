import React from 'react';

interface Profile {
  Category: string;
  Movement: string;
  Definition: string;
  OpMove: string;
  RootConflict: string;
}

interface Tone {
  tone: string;
  category: string;
  description: string;
}

interface AgentCardProps {
  name: string;
  role: 'Proponent' | 'Opponent';
  status: 'Speaking' | 'Waiting' | 'Leading' | 'Defending';
  profiles: Profile[];
  tones: Tone[];
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

  const activeProfile = profiles.find(p => p.Movement === selectedProfile);
  const activeTone = tones.find(t => t.tone === selectedTone);

  return (
    <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex-1 min-w-[300px] flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isProponent ? 'bg-blue-500' : 'bg-purple-500'}`}>
            <span className="text-white text-xs">✨</span>
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white text-lg">{role} Agent</h3>
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${badgeColor}`}>
          {badgeText}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Profile</label>
          <select
            value={selectedProfile}
            onChange={(e) => onProfileChange(e.target.value)}
            disabled={disabled}
            className="w-full bg-slate-50 dark:bg-[#0F172A] border border-gray-200 dark:border-gray-700 text-slate-900 dark:text-gray-300 text-sm rounded-lg p-2.5 appearance-none focus:border-blue-500 focus:outline-none disabled:opacity-50"
          >
            {profiles.map(p => <option key={p.Movement} value={p.Movement}>{p.Movement}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Tone</label>
          <select
            value={selectedTone}
            onChange={(e) => onToneChange(e.target.value)}
            disabled={disabled}
            className="w-full bg-slate-50 dark:bg-[#0F172A] border border-gray-200 dark:border-gray-700 text-slate-900 dark:text-gray-300 text-sm rounded-lg p-2.5 appearance-none focus:border-blue-500 focus:outline-none disabled:opacity-50"
          >
            {tones.map(t => <option key={t.tone} value={t.tone}>{t.tone}</option>)}
          </select>
        </div>
      </div>

      {/* Info Card */}
      <div className="mt-auto bg-slate-50 dark:bg-[#0F172A] rounded-lg p-3 text-xs space-y-2 border border-gray-200 dark:border-gray-800">
        {activeProfile && (
          <div>
            <span className="font-bold text-gray-500 dark:text-gray-400 block mb-1">PROFILE</span>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed">{activeProfile.Definition}</p>
            <div className="mt-2 flex gap-2 text-[10px]">
              <span className="text-gray-500">Root Conflict:</span>
              <span className="text-slate-600 dark:text-gray-300 italic">{activeProfile.RootConflict}</span>
            </div>
          </div>
        )}
        {activeTone && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
            <span className="font-bold text-gray-500 dark:text-gray-400 block mb-1">TONE</span>
            <p className="text-slate-700 dark:text-gray-300">{activeTone.description}</p>
          </div>
        )}
      </div>
    </div>
  );
};
