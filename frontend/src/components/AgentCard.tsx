import React from 'react';

interface AgentCardProps {
  name: string;
  role: 'Proponent' | 'Opponent' | 'Moderator';
  status: 'Speaking' | 'Waiting' | 'Idle';
  avatar?: string;
}

export const AgentCard: React.FC<AgentCardProps> = ({ name, role, status }) => {
  const isActive = status === 'Speaking';

  return (
    <div className={`p-4 rounded-xl border transition-all duration-300 ${
      isActive 
        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 ring-1 ring-blue-500' 
        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800'
    }`}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${
          role === 'Proponent' ? 'bg-green-100 text-green-700' : 
          role === 'Opponent' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
        }`}>
          {name[0]}
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-sm">{name}</h3>
          <p className="text-xs opacity-60">{role}</p>
        </div>
        <div className="flex flex-col items-end">
          <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${
            isActive ? 'bg-blue-500 text-white animate-pulse' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
          }`}>
            {status}
          </span>
        </div>
      </div>
    </div>
  );
};
