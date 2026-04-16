import React from 'react';
import { TokenStats } from './TokenStats';
import { FactCheckReport } from './FactCheckReport';
import { DebateExporter } from './DebateExporter';
import type { VerdictData, TokenUsageData, FactCheck } from '../types';

interface DecisionMatrixProps {
  data: VerdictData;
  proponentRole: string;
  opponentRole: string;
  topic: string;
  proponentConfig: { profile: string; tone: string; language: string };
  opponentConfig: { profile: string; tone: string; language: string };
  messages: Array<{ speaker: string; content: string }>;
  tokenUsage: TokenUsageData | null;
  totalWallTimeMs: number | null;
  agentNames?: { proponent: string; opponent: string } | null;
  factChecks?: FactCheck[] | null;
  isFactChecking?: boolean;
  factCheckError?: string | null;
  factCheckProgress?: string | null;
  onRerunFactCheck?: (mode: 'replace' | 'append') => void;
  onSave?: () => void;
  onRestart: () => void;
}

const extractSummary = (text: string): string => {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const summary = sentences.slice(0, 2).join(' ');
  return summary.length < text.length ? summary : text;
};

const ScoreRow = ({ label, score, color, textColor }: { label: string; score: number; color: string; textColor: string }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-[10px] text-gray-500 font-medium uppercase">{label}</span>
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[...Array(10)].map((_, i) => (
          <div key={i} className={`w-1 h-2.5 rounded-full ${i < score ? color : 'bg-gray-800'}`} />
        ))}
      </div>
      <span className={`font-mono font-bold text-xs ${textColor}`}>{score}</span>
    </div>
  </div>
);

export const DecisionMatrix: React.FC<DecisionMatrixProps> = ({
  data, proponentRole, opponentRole, topic,
  proponentConfig, opponentConfig, messages,
  tokenUsage, totalWallTimeMs, agentNames,
  factChecks, isFactChecking, factCheckError, factCheckProgress,
  onRerunFactCheck, onSave, onRestart,
}) => {
  const isProponentWin = data.winner.toLowerCase() === 'proponent';
  const proLabel = agentNames?.proponent || proponentRole;
  const oppLabel = agentNames?.opponent || opponentRole;
  const winnerName = isProponentWin ? proLabel : oppLabel;
  const reasoningSummary = extractSummary(data.reasoning);
  const hasFullReasoning = reasoningSummary.length < data.reasoning.length;

  return (
    <div className="my-8 bg-[#0F172A] border-2 border-gray-700 rounded-2xl w-full shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="bg-[#1E293B] p-6 text-center border-b border-gray-700">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-xl">&#9878;</span>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em]">Final Judgment</h2>
        </div>
        <h1 className={`text-xl md:text-3xl font-black uppercase tracking-tighter ${isProponentWin ? 'text-blue-500' : 'text-purple-500'}`}>
          {winnerName} Wins
        </h1>
        <p className="text-[10px] text-gray-500 mt-1 uppercase font-bold">
          {isProponentWin ? `${proLabel} (Proponent)` : `${oppLabel} (Opponent)`} — {isProponentWin ? proponentRole : opponentRole}
        </p>
      </div>

      {/* Scores */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 relative">
        <div className="hidden md:block absolute top-0 bottom-0 left-1/2 w-px bg-gray-800 -translate-x-1/2"></div>
        <div className="text-right">
          <h3 className="text-blue-400 font-bold mb-1 uppercase text-xs truncate">{proLabel}</h3>
          <p className="text-[10px] text-gray-500 mb-3">{proponentRole}</p>
          <div className="space-y-3">
            <ScoreRow label="Logic" score={data.scores.proponent.logic} color="bg-blue-500" textColor="text-blue-300" />
            <ScoreRow label="Evidence" score={data.scores.proponent.evidence} color="bg-blue-500" textColor="text-blue-300" />
            <ScoreRow label="Style" score={data.scores.proponent.style} color="bg-blue-500" textColor="text-blue-300" />
          </div>
        </div>
        <div>
          <h3 className="text-purple-400 font-bold mb-1 uppercase text-xs truncate">{oppLabel}</h3>
          <p className="text-[10px] text-gray-500 mb-3">{opponentRole}</p>
          <div className="space-y-3">
            <ScoreRow label="Logic" score={data.scores.opponent.logic} color="bg-purple-500" textColor="text-purple-300" />
            <ScoreRow label="Evidence" score={data.scores.opponent.evidence} color="bg-purple-500" textColor="text-purple-300" />
            <ScoreRow label="Style" score={data.scores.opponent.style} color="bg-purple-500" textColor="text-purple-300" />
          </div>
        </div>
      </div>

      {/* Reasoning & Recommendations */}
      <div className="px-6 pb-6 space-y-4">
        <div className="bg-[#1E293B]/50 rounded-xl p-4 border border-gray-800">
          <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2">Moderator's Rationale</h4>
          <p className="text-gray-300 text-sm leading-relaxed italic">"{reasoningSummary}"</p>
          {hasFullReasoning && (
            <details className="mt-3 group">
              <summary className="text-[10px] font-bold text-gray-500 uppercase cursor-pointer hover:text-gray-300 transition-colors select-none">
                Full analysis
                <span className="ml-1 group-open:rotate-90 inline-block transition-transform">&#9656;</span>
              </summary>
              <p className="mt-3 text-gray-300 text-sm leading-relaxed italic whitespace-pre-line">"{data.reasoning}"</p>
            </details>
          )}
        </div>

        {data.recommendations && data.recommendations.length > 0 && (
          <details className="bg-[#1E293B]/50 rounded-xl border border-gray-800 group">
            <summary className="p-4 cursor-pointer select-none hover:bg-[#1E293B]/80 transition-colors rounded-xl">
              <span className="text-[10px] font-bold text-amber-500 uppercase">
                Further Reading ({data.recommendations.length})
                <span className="ml-1 group-open:rotate-90 inline-block transition-transform">&#9656;</span>
              </span>
            </summary>
            <ul className="list-disc list-inside space-y-1 px-4 pb-4">
              {data.recommendations.map((rec, i) => (
                <li key={i} className="text-gray-400 text-xs">{rec}</li>
              ))}
            </ul>
          </details>
        )}

        {data.references && data.references.length > 0 && (
          <details className="bg-[#1E293B]/50 rounded-xl border border-gray-800 group">
            <summary className="p-4 cursor-pointer select-none hover:bg-[#1E293B]/80 transition-colors rounded-xl">
              <span className="text-[10px] font-bold text-cyan-500 uppercase">
                Sources Cited During Debate ({data.references.length})
                <span className="ml-1 group-open:rotate-90 inline-block transition-transform">&#9656;</span>
              </span>
            </summary>
            <ul className="list-disc list-inside space-y-1 px-4 pb-4">
              {data.references.map((ref, i) => (
                <li key={i} className="text-gray-400 text-xs">{ref}</li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* Token Stats */}
      {tokenUsage && <TokenStats tokenUsage={tokenUsage} totalWallTimeMs={totalWallTimeMs} />}

      {/* Fact-Check */}
      <FactCheckReport
        factChecks={factChecks ?? null}
        isFactChecking={isFactChecking ?? false}
        factCheckError={factCheckError ?? null}
        factCheckProgress={factCheckProgress ?? null}
        onRerunFactCheck={onRerunFactCheck}
      />

      {/* Footer / Export */}
      <DebateExporter
        data={data} topic={topic}
        proponentConfig={proponentConfig} opponentConfig={opponentConfig}
        messages={messages} tokenUsage={tokenUsage} totalWallTimeMs={totalWallTimeMs}
        agentNames={agentNames} factChecks={factChecks}
        proLabel={proLabel} oppLabel={oppLabel} winnerName={winnerName}
        onSave={onSave} onRestart={onRestart}
      />
    </div>
  );
};
