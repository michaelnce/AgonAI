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
  onRestart: () => void;
}

export const DecisionMatrix: React.FC<DecisionMatrixProps> = ({ data, onRestart }) => {
  const isProponentWin = data.winner.toLowerCase() === 'proponent';
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0F172A] border border-gray-700 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="bg-[#1E293B] p-6 text-center border-b border-gray-700">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">Final Judgment</h2>
          <h1 className={`text-4xl font-black uppercase tracking-tighter ${isProponentWin ? 'text-blue-500' : 'text-purple-500'}`}>
            {data.winner} Wins
          </h1>
        </div>

        {/* Scores */}
        <div className="p-8 grid grid-cols-2 gap-8 relative">
           <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gray-800 -translate-x-1/2"></div>
           
           {/* Proponent Scores */}
           <div className="text-right">
             <h3 className="text-blue-400 font-bold mb-4 uppercase text-sm">Proponent</h3>
             <div className="space-y-3">
               <ScoreRow label="Logic" score={data.scores.proponent.logic} color="text-blue-300" />
               <ScoreRow label="Evidence" score={data.scores.proponent.evidence} color="text-blue-300" />
               <ScoreRow label="Style" score={data.scores.proponent.style} color="text-blue-300" />
             </div>
           </div>

           {/* Opponent Scores */}
           <div>
             <h3 className="text-purple-400 font-bold mb-4 uppercase text-sm">Opponent</h3>
             <div className="space-y-3">
               <ScoreRow label="Logic" score={data.scores.opponent.logic} color="text-purple-300" />
               <ScoreRow label="Evidence" score={data.scores.opponent.evidence} color="text-purple-300" />
               <ScoreRow label="Style" score={data.scores.opponent.style} color="text-purple-300" />
             </div>
           </div>
        </div>

        {/* Reasoning */}
        <div className="px-8 pb-8">
          <div className="bg-[#1E293B]/50 rounded-xl p-6 border border-gray-800">
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Moderator's Rationale</h4>
            <p className="text-gray-300 text-sm leading-relaxed italic">
              "{data.reasoning}"
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-[#1E293B] border-t border-gray-700 flex justify-center">
          <button 
            onClick={onRestart}
            className="bg-white text-black hover:bg-gray-200 font-bold px-8 py-3 rounded-full transition-colors shadow-lg"
          >
            Start New Debate
          </button>
        </div>

      </div>
    </div>
  );
};

const ScoreRow = ({ label, score, color }: { label: string, score: number, color: string }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-xs text-gray-500 font-medium uppercase">{label}</span>
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[...Array(10)].map((_, i) => (
          <div 
            key={i} 
            className={`w-1 h-3 rounded-full ${i < score ? color : 'bg-gray-800'}`}
          />
        ))}
      </div>
      <span className={`font-mono font-bold ${color}`}>{score}</span>
    </div>
  </div>
);
