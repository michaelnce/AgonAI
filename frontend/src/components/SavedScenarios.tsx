import React, { useState, useEffect } from 'react';

interface Scenario {
  id: string;
  name: string;
  proponentProfile: string;
  proponentTone: string;
  opponentProfile: string;
  opponentTone: string;
  createdAt: string;
}

interface SavedScenariosProps {
  onClose: () => void;
  onLoad: (scenario: Scenario) => void;
  currentConfig: {
    proponentProfile: string;
    proponentTone: string;
    opponentProfile: string;
    opponentTone: string;
  };
  disabled?: boolean;
}

const STORAGE_KEY = 'debate_saved_scenarios';

function loadScenarios(): Scenario[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveScenarios(scenarios: Scenario[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
}

export const SavedScenarios: React.FC<SavedScenariosProps> = ({ onClose, onLoad, currentConfig, disabled }) => {
  const [scenarios, setScenarios] = useState<Scenario[]>(loadScenarios);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    saveScenarios(scenarios);
  }, [scenarios]);

  const handleSave = () => {
    if (!newName.trim()) return;
    // Skip saving if any value is a sentinel
    const vals = [currentConfig.proponentProfile, currentConfig.proponentTone, currentConfig.opponentProfile, currentConfig.opponentTone];
    if (vals.some(v => v.startsWith('__'))) return;

    const scenario: Scenario = {
      id: Date.now().toString(),
      name: newName.trim(),
      ...currentConfig,
      createdAt: new Date().toLocaleDateString(),
    };
    setScenarios(prev => [scenario, ...prev]);
    setNewName('');
  };

  const handleDelete = (id: string) => {
    setScenarios(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-8">
      <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Saved Scenarios</h2>
            <p className="text-sm text-gray-500 mt-1">{scenarios.length} scenario{scenarios.length !== 1 ? 's' : ''} saved</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Save current */}
        {!disabled && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1.5">Save Current Configuration</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="Scenario name..."
                className="flex-1 bg-slate-50 dark:bg-[#0F172A] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button
                onClick={handleSave}
                disabled={!newName.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Save
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {currentConfig.proponentProfile} / {currentConfig.proponentTone} vs {currentConfig.opponentProfile} / {currentConfig.opponentTone}
            </div>
          </div>
        )}

        {/* Scenario list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {scenarios.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
              <div className="text-4xl mb-3 opacity-30">🔖</div>
              <p className="text-sm">No saved scenarios yet</p>
              <p className="text-xs mt-1">Configure your agents and save a scenario above</p>
            </div>
          ) : (
            scenarios.map(s => (
              <div
                key={s.id}
                className="bg-slate-50 dark:bg-[#0F172A] border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{s.name}</h4>
                    <p className="text-[10px] text-gray-500 mt-0.5">{s.createdAt}</p>
                  </div>
                  <div className="flex gap-1.5">
                    {!disabled && (
                      <button
                        onClick={() => { onLoad(s); onClose(); }}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md font-medium transition-colors"
                      >
                        Load
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded-md transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-blue-500 font-medium">PRO: </span>
                    <span className="text-slate-600 dark:text-gray-400">{s.proponentProfile} / {s.proponentTone}</span>
                  </div>
                  <div>
                    <span className="text-purple-500 font-medium">OPP: </span>
                    <span className="text-slate-600 dark:text-gray-400">{s.opponentProfile} / {s.opponentTone}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
