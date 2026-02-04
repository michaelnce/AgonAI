import React from 'react';

interface Scores {
  logic: number;
  evidence: number;
  style: number;
}

interface VerdictData {
  winner: 'Proponent' | 'Opponent';
  scores: {
    proponent: Scores;
    opponent: Scores;
  };
  reasoning: string;
}

interface DecisionMatrixProps {
  data: VerdictData;
  proponentRole: string;
  opponentRole: string;
  onRestart: () => void;
}

export const DecisionMatrix: React.FC<DecisionMatrixProps> = ({ data, proponentRole, opponentRole, onRestart }) => {
  const isProponentWin = data.winner.toLowerCase() === 'proponent';
  
  return (
    <div className="my-8 bg-[#0F172A] border-2 border-gray-700 rounded-2xl w-full shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Header */}
        <div className="bg-[#1E293B] p-6 text-center border-b border-gray-700">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-xl">⚖️</span>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em]">Final Judgment</h2>
          </div>
          <h1 className={`text-3xl font-black uppercase tracking-tighter ${isProponentWin ? 'text-blue-500' : 'text-purple-500'}`}>
            {isProponentWin ? proponentRole : opponentRole} Wins
          </h1>
          <p className="text-[10px] text-gray-500 mt-1 uppercase font-bold">
            Based on {isProponentWin ? 'Proponent' : 'Opponent'} Performance
          </p>
        </div>

        {/* Scores */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 relative">
           <div className="hidden md:block absolute top-0 bottom-0 left-1/2 w-px bg-gray-800 -translate-x-1/2"></div>
           
           {/* Proponent Scores */}
           <div className="text-right">
             <h3 className="text-blue-400 font-bold mb-4 uppercase text-xs truncate">{proponentRole}</h3>
             <div className="space-y-3">
               <ScoreRow label="Logic" score={data.scores.proponent.logic} color="bg-blue-500" textColor="text-blue-300" />
               <ScoreRow label="Evidence" score={data.scores.proponent.evidence} color="bg-blue-500" textColor="text-blue-300" />
               <ScoreRow label="Style" score={data.scores.proponent.style} color="bg-blue-500" textColor="text-blue-300" />
             </div>
           </div>

           {/* Opponent Scores */}
           <div>
             <h3 className="text-purple-400 font-bold mb-4 uppercase text-xs truncate">{opponentRole}</h3>
             <div className="space-y-3">
               <ScoreRow label="Logic" score={data.scores.opponent.logic} color="bg-purple-500" textColor="text-purple-300" />
               <ScoreRow label="Evidence" score={data.scores.opponent.evidence} color="bg-purple-500" textColor="text-purple-300" />
               <ScoreRow label="Style" score={data.scores.opponent.style} color="bg-purple-500" textColor="text-purple-300" />
             </div>
           </div>
        </div>

        {/* Reasoning */}
        <div className="px-6 pb-6">
          <div className="bg-[#1E293B]/50 rounded-xl p-4 border border-gray-800">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2">Moderator's Rationale</h4>
            <p className="text-gray-300 text-sm leading-relaxed italic">
              "{data.reasoning}"
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#1E293B] border-t border-gray-700 flex justify-center">
          <button 
            onClick={onRestart}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-lg text-sm transition-colors shadow-lg"
          >
            Reset Arena
          </button>
        </div>
    </div>
  );
};

const ScoreRow = ({ label, score, color, textColor }: { label: string, score: number, color: string, textColor: string }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-[10px] text-gray-500 font-medium uppercase">{label}</span>
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[...Array(10)].map((_, i) => (
          <div 
            key={i} 
            className={`w-1 h-2.5 rounded-full ${i < score ? color : 'bg-gray-800'}`}
          />
        ))}
      </div>
      <span className={`font-mono font-bold text-xs ${textColor}`}>{score}</span>
    </div>
  </div>
);
