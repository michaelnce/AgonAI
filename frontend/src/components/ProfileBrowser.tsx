import React, { useState } from 'react';

interface Profile {
  Category: string;
  Movement: string;
  Definition: string;
  OpMove: string;
  RootConflict: string;
  KeyThinkers?: string[];
  SignatureArguments?: string[];
  KnownWeaknesses?: string[];
  RhetoricalStyle?: string;
}

interface ProfileBrowserProps {
  profiles: Profile[];
  onClose: () => void;
  onSelectProfile: (movement: string, role: 'proponent' | 'opponent') => void;
  disabled?: boolean;
}

export const ProfileBrowser: React.FC<ProfileBrowserProps> = ({ profiles, onClose, onSelectProfile, disabled }) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<string | null>(null);

  // Group profiles by category
  const categories: Record<string, Profile[]> = {};
  for (const p of profiles) {
    if (!categories[p.Category]) categories[p.Category] = [];
    categories[p.Category].push(p);
  }

  const selectedProfile = selectedMovement ? profiles.find(p => p.Movement === selectedMovement) : null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-8">
      <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Agent Profiles</h2>
            <p className="text-sm text-gray-500 mt-1">{profiles.length} philosophical movements across {Object.keys(categories).length} categories</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left: Category list */}
          <div className="w-1/2 overflow-y-auto border-r border-gray-200 dark:border-gray-700 p-4 space-y-1">
            {Object.entries(categories).map(([category, items]) => (
              <div key={category}>
                <button
                  onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="text-sm font-semibold text-slate-700 dark:text-gray-300">{category}</span>
                  <span className="text-xs text-gray-400">{expandedCategory === category ? '−' : '+'}</span>
                </button>

                {expandedCategory === category && (
                  <div className="ml-3 space-y-0.5 mb-2">
                    {items.map(p => (
                      <button
                        key={p.Movement}
                        onClick={() => setSelectedMovement(p.Movement)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          selectedMovement === p.Movement
                            ? 'bg-blue-600/20 text-blue-600 dark:text-blue-400'
                            : 'text-slate-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        }`}
                      >
                        <div className="font-medium">{p.Movement}</div>
                        <div className="text-xs text-gray-500 truncate mt-0.5">{p.Definition}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Right: Profile detail */}
          <div className="w-1/2 overflow-y-auto p-6">
            {selectedProfile ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedProfile.Movement}</h3>
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                    {selectedProfile.Category}
                  </span>
                </div>

                <div>
                  <h4 className="text-[10px] uppercase font-bold text-gray-500 mb-1">Definition</h4>
                  <p className="text-sm text-slate-700 dark:text-gray-300 leading-relaxed">{selectedProfile.Definition}</p>
                </div>

                <div>
                  <h4 className="text-[10px] uppercase font-bold text-gray-500 mb-1">Root Conflict</h4>
                  <p className="text-sm text-slate-600 dark:text-gray-400 italic">{selectedProfile.RootConflict}</p>
                </div>

                <div>
                  <h4 className="text-[10px] uppercase font-bold text-gray-500 mb-1">Opposes</h4>
                  <span className="text-sm text-red-600 dark:text-red-400 font-medium">{selectedProfile.OpMove}</span>
                </div>

                {selectedProfile.KeyThinkers && selectedProfile.KeyThinkers.length > 0 && (
                  <div>
                    <h4 className="text-[10px] uppercase font-bold text-gray-500 mb-1">Key Thinkers</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedProfile.KeyThinkers.map(t => (
                        <span key={t} className="text-xs bg-gray-100 dark:bg-gray-800 text-slate-700 dark:text-gray-300 px-2 py-1 rounded-md">{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedProfile.SignatureArguments && selectedProfile.SignatureArguments.length > 0 && (
                  <div>
                    <h4 className="text-[10px] uppercase font-bold text-gray-500 mb-1">Signature Arguments</h4>
                    <ul className="space-y-1.5">
                      {selectedProfile.SignatureArguments.map((a, i) => (
                        <li key={i} className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed flex gap-2">
                          <span className="text-blue-500 mt-0.5 shrink-0">-</span>
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedProfile.KnownWeaknesses && selectedProfile.KnownWeaknesses.length > 0 && (
                  <div>
                    <h4 className="text-[10px] uppercase font-bold text-gray-500 mb-1">Known Weaknesses</h4>
                    <ul className="space-y-1.5">
                      {selectedProfile.KnownWeaknesses.map((w, i) => (
                        <li key={i} className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed flex gap-2">
                          <span className="text-red-500 mt-0.5 shrink-0">-</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedProfile.RhetoricalStyle && (
                  <div>
                    <h4 className="text-[10px] uppercase font-bold text-gray-500 mb-1">Rhetorical Style</h4>
                    <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed italic">{selectedProfile.RhetoricalStyle}</p>
                  </div>
                )}

                {/* Action buttons */}
                {!disabled && (
                  <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => { onSelectProfile(selectedProfile.Movement, 'proponent'); onClose(); }}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 rounded-lg font-medium transition-colors"
                    >
                      Use as Proponent
                    </button>
                    <button
                      onClick={() => { onSelectProfile(selectedProfile.Movement, 'opponent'); onClose(); }}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-sm py-2 rounded-lg font-medium transition-colors"
                    >
                      Use as Opponent
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <div className="text-4xl mb-3 opacity-30">👥</div>
                <p className="text-sm">Select a profile to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
