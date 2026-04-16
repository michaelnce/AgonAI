import React from 'react';
import type { FactCheck } from '../types';

interface FactCheckReportProps {
  factChecks: FactCheck[] | null;
  isFactChecking: boolean;
  factCheckError: string | null;
  factCheckProgress: string | null;
  onRerunFactCheck?: (mode: 'replace' | 'append') => void;
}

export const FactCheckReport: React.FC<FactCheckReportProps> = ({
  factChecks,
  isFactChecking,
  factCheckError,
  factCheckProgress,
  onRerunFactCheck,
}) => {
  if (!factChecks && !isFactChecking && !onRerunFactCheck) return null;

  const colors: Record<string, string> = {
    VERIFIED: 'border-green-500/30 bg-green-500/5',
    DISPUTED: 'border-yellow-500/30 bg-yellow-500/5',
    FALSE: 'border-red-500/30 bg-red-500/5',
    UNVERIFIABLE: 'border-gray-500/30 bg-gray-500/5',
  };
  const badges: Record<string, string> = {
    VERIFIED: 'bg-green-500/20 text-green-400',
    DISPUTED: 'bg-yellow-500/20 text-yellow-400',
    FALSE: 'bg-red-500/20 text-red-400',
    UNVERIFIABLE: 'bg-gray-500/20 text-gray-400',
  };

  return (
    <div className="px-6 pb-6">
      <div className="bg-[#1E293B]/50 rounded-xl p-4 border border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">
            Fact-Check Report
            {isFactChecking && <span className="ml-2 text-gray-500 animate-pulse">Analyzing claims...</span>}
          </h4>
          {onRerunFactCheck && !isFactChecking && (
            <div className="flex gap-2">
              {!factChecks && (
                <button
                  onClick={() => onRerunFactCheck('replace')}
                  className="text-[10px] font-bold text-orange-400 hover:text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 px-2.5 py-1 rounded-md transition-colors"
                >
                  Run Fact Check
                </button>
              )}
              {factChecks && (
                <>
                  <button
                    onClick={() => onRerunFactCheck('replace')}
                    className="text-[10px] font-bold text-orange-400 hover:text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 px-2.5 py-1 rounded-md transition-colors"
                  >
                    Re-run (Replace)
                  </button>
                  <button
                    onClick={() => onRerunFactCheck('append')}
                    className="text-[10px] font-bold text-gray-400 hover:text-gray-300 bg-gray-500/10 hover:bg-gray-500/20 px-2.5 py-1 rounded-md transition-colors"
                  >
                    Re-run (Keep Both)
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {factCheckError && (
          <div className="flex items-center gap-2 text-xs text-red-400 mb-3 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <span className="shrink-0">&#9888;</span>
            <span>{factCheckError}</span>
          </div>
        )}
        {!factChecks && !isFactChecking && !factCheckError && (
          <p className="text-xs text-gray-500">No fact-check results yet. Click "Run Fact Check" to analyze claims from the debate.</p>
        )}
        {factChecks && factChecks.length > 0 && (
          <div className="space-y-2">
            <div className="flex gap-3 mb-3 text-[10px] font-bold">
              <span className="text-green-400">{factChecks.filter(f => f.verdict === 'VERIFIED').length} Verified</span>
              <span className="text-yellow-400">{factChecks.filter(f => f.verdict === 'DISPUTED').length} Disputed</span>
              <span className="text-red-400">{factChecks.filter(f => f.verdict === 'FALSE').length} False</span>
              <span className="text-gray-400">{factChecks.filter(f => f.verdict === 'UNVERIFIABLE').length} Unverifiable</span>
            </div>
            {factChecks.map((fc, i) => (
              <div key={i} className={`rounded-lg p-3 border ${colors[fc.verdict] || ''}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-xs text-gray-300 flex-1">"{fc.claim}"</p>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded shrink-0 ${badges[fc.verdict] || ''}`}>
                    {fc.verdict}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-gray-500">{fc.speaker}</span>
                  <span className="text-gray-600">—</span>
                  <span className="text-gray-400">{fc.explanation}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {isFactChecking && (
          <div className="flex items-center gap-2 text-sm text-gray-400 mt-2">
            <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin shrink-0"></div>
            {factCheckProgress || 'Analyzing factual claims...'}
          </div>
        )}
      </div>
    </div>
  );
};
