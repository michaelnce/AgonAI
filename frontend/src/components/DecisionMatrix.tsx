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
  recommendations?: string[];
  references?: string[];
}

interface TokenCall {
  label: string;
  input_tokens: number;
  output_tokens: number;
  cache_read: number;
  cache_creation: number;
  cost_usd: number;
  duration_ms: number;
}

interface TokenUsageData {
  calls: TokenCall[];
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_read_tokens: number;
  total_cache_creation_tokens: number;
  total_cost_usd: number;
  total_duration_ms: number;
}

interface FactCheck {
  claim: string;
  speaker: string;
  verdict: 'VERIFIED' | 'DISPUTED' | 'FALSE' | 'UNVERIFIABLE';
  explanation: string;
}

interface DecisionMatrixProps {
  data: VerdictData;
  proponentRole: string;
  opponentRole: string;
  topic: string;
  proponentConfig: { profile: string, tone: string, language: string };
  opponentConfig: { profile: string, tone: string, language: string };
  messages: Array<{ speaker: string, content: string }>;
  tokenUsage: TokenUsageData | null;
  totalWallTimeMs: number | null;
  agentNames?: { proponent: string; opponent: string } | null;
  factChecks?: FactCheck[] | null;
  isFactChecking?: boolean;
  onSave?: () => void;
  onRestart: () => void;
}

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
};

const formatNumber = (n: number): string => n.toLocaleString();

// Extract first ~2 sentences for summary
const extractSummary = (text: string): string => {
  // Split on sentence-ending punctuation followed by space or newline
  const sentences = text.split(/(?<=[.!?])\s+/);
  const summary = sentences.slice(0, 2).join(' ');
  return summary.length < text.length ? summary : text;
};

export const DecisionMatrix: React.FC<DecisionMatrixProps> = ({
  data,
  proponentRole,
  opponentRole,
  topic,
  proponentConfig,
  opponentConfig,
  messages,
  tokenUsage,
  totalWallTimeMs,
  agentNames,
  factChecks,
  isFactChecking,
  onSave,
  onRestart
}) => {
  const isProponentWin = data.winner.toLowerCase() === 'proponent';
  const [isEmailing, setIsEmailing] = React.useState(false);

  const proLabel = agentNames?.proponent || proponentRole;
  const oppLabel = agentNames?.opponent || opponentRole;
  const winnerName = isProponentWin ? proLabel : oppLabel;

  const reasoningSummary = extractSummary(data.reasoning);
  const hasFullReasoning = reasoningSummary.length < data.reasoning.length;

  const handleSendEmail = async () => {
    const email = window.prompt("Enter recipient email address:");
    if (!email) return;

    setIsEmailing(true);
    try {
      const response = await fetch('/api/debate/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_email: email,
          topic,
          proponent: proponentConfig,
          opponent: opponentConfig,
          messages,
          verdict: data,
          token_usage: tokenUsage,
          total_wall_time_ms: totalWallTimeMs,
          agent_names: agentNames,
          fact_checks: factChecks
        })
      });

      if (response.ok) {
        alert("Email sent successfully!");
      } else {
        const err = await response.json();
        const errorMessage = typeof err.detail === 'string'
          ? err.detail
          : JSON.stringify(err.detail, null, 2);
        alert("Failed to send email: " + (errorMessage || "Unknown error"));
      }
    } catch (e) {
      alert("Error sending email: " + String(e));
    } finally {
      setIsEmailing(false);
    }
  };

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

           {/* Proponent Scores */}
           <div className="text-right">
             <h3 className="text-blue-400 font-bold mb-1 uppercase text-xs truncate">{proLabel}</h3>
             <p className="text-[10px] text-gray-500 mb-3">{proponentRole}</p>
             <div className="space-y-3">
               <ScoreRow label="Logic" score={data.scores.proponent.logic} color="bg-blue-500" textColor="text-blue-300" />
               <ScoreRow label="Evidence" score={data.scores.proponent.evidence} color="bg-blue-500" textColor="text-blue-300" />
               <ScoreRow label="Style" score={data.scores.proponent.style} color="bg-blue-500" textColor="text-blue-300" />
             </div>
           </div>

           {/* Opponent Scores */}
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

        {/* Reasoning — collapsible */}
        <div className="px-6 pb-6 space-y-4">
          <div className="bg-[#1E293B]/50 rounded-xl p-4 border border-gray-800">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2">Moderator's Rationale</h4>
            <p className="text-gray-300 text-sm leading-relaxed italic">
              "{reasoningSummary}"
            </p>
            {hasFullReasoning && (
              <details className="mt-3 group">
                <summary className="text-[10px] font-bold text-gray-500 uppercase cursor-pointer hover:text-gray-300 transition-colors select-none">
                  Full analysis
                  <span className="ml-1 group-open:rotate-90 inline-block transition-transform">&#9656;</span>
                </summary>
                <p className="mt-3 text-gray-300 text-sm leading-relaxed italic whitespace-pre-line">
                  "{data.reasoning}"
                </p>
              </details>
            )}
          </div>

          {/* Recommendations — collapsible */}
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

          {/* References — collapsible */}
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

        {/* Performance Stats */}
        {tokenUsage && (
          <div className="px-6 pb-6">
            <details className="bg-[#1E293B]/50 rounded-xl border border-gray-800 group">
              <summary className="p-4 cursor-pointer select-none hover:bg-[#1E293B]/80 transition-colors rounded-xl">
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
                  Performance Stats
                  <span className="ml-2 text-gray-500 font-mono text-[10px]">
                    {formatDuration(totalWallTimeMs ?? tokenUsage.total_duration_ms)} | {formatNumber(tokenUsage.total_input_tokens + tokenUsage.total_output_tokens)} tokens | {tokenUsage.calls.length} calls
                  </span>
                  <span className="ml-1 group-open:rotate-90 inline-block transition-transform">&#9656;</span>
                </span>
              </summary>
              <div className="px-4 pb-4">
                {/* Summary Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <StatCard
                    label="Total Time"
                    value={formatDuration(totalWallTimeMs ?? tokenUsage.total_duration_ms)}
                    icon="clock"
                  />
                  <StatCard
                    label="LLM Calls"
                    value={String(tokenUsage.calls.length)}
                    icon="calls"
                  />
                  <StatCard
                    label="Total Tokens"
                    value={formatNumber(tokenUsage.total_input_tokens + tokenUsage.total_output_tokens)}
                    sub={`${formatNumber(tokenUsage.total_input_tokens)} in / ${formatNumber(tokenUsage.total_output_tokens)} out`}
                    icon="tokens"
                  />
                  <StatCard
                    label="API Processing"
                    value={formatDuration(tokenUsage.total_duration_ms)}
                    icon="api"
                  />
                </div>

                {/* Per-call breakdown */}
                <details className="group/inner">
                  <summary className="text-[10px] font-bold text-gray-500 uppercase cursor-pointer hover:text-gray-300 transition-colors select-none">
                    Per-call breakdown
                    <span className="ml-1 group-open/inner:rotate-90 inline-block transition-transform">&#9656;</span>
                  </summary>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 text-[10px] uppercase border-b border-gray-800">
                          <th className="text-left py-1.5 pr-3 font-bold">Call</th>
                          <th className="text-right py-1.5 px-2 font-bold">In</th>
                          <th className="text-right py-1.5 px-2 font-bold">Out</th>
                          <th className="text-right py-1.5 px-2 font-bold">Cache Read</th>
                          <th className="text-right py-1.5 pl-2 font-bold">Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tokenUsage.calls.map((call, i) => (
                          <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                            <td className="py-1.5 pr-3 text-gray-300 font-mono">{call.label}</td>
                            <td className="py-1.5 px-2 text-right text-gray-400 font-mono">{formatNumber(call.input_tokens)}</td>
                            <td className="py-1.5 px-2 text-right text-gray-400 font-mono">{formatNumber(call.output_tokens)}</td>
                            <td className="py-1.5 px-2 text-right text-gray-400 font-mono">{formatNumber(call.cache_read)}</td>
                            <td className="py-1.5 pl-2 text-right text-gray-400 font-mono">{formatDuration(call.duration_ms)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
            </details>
          </div>
        )}

        {/* Fact-Check Section */}
        {(factChecks || isFactChecking) && (
          <div className="px-6 pb-6">
            <div className="bg-[#1E293B]/50 rounded-xl p-4 border border-gray-800">
              <h4 className="text-[10px] font-bold text-orange-500 uppercase mb-3 tracking-wider">
                Fact-Check Report
                {isFactChecking && <span className="ml-2 text-gray-500 animate-pulse">Analyzing claims...</span>}
              </h4>
              {factChecks && factChecks.length > 0 && (
                <div className="space-y-2">
                  {/* Summary counts */}
                  <div className="flex gap-3 mb-3 text-[10px] font-bold">
                    <span className="text-green-400">{factChecks.filter(f => f.verdict === 'VERIFIED').length} Verified</span>
                    <span className="text-yellow-400">{factChecks.filter(f => f.verdict === 'DISPUTED').length} Disputed</span>
                    <span className="text-red-400">{factChecks.filter(f => f.verdict === 'FALSE').length} False</span>
                    <span className="text-gray-400">{factChecks.filter(f => f.verdict === 'UNVERIFIABLE').length} Unverifiable</span>
                  </div>
                  {factChecks.map((fc, i) => {
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
                    );
                  })}
                </div>
              )}
              {isFactChecking && !factChecks && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                  Analyzing factual claims in the debate transcript...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-[#1E293B] border-t border-gray-700 flex flex-wrap justify-center gap-3 md:gap-4">
          {onSave && (
            <button
              onClick={onSave}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2 rounded-lg text-sm transition-colors shadow-lg"
            >
              Save Debate
            </button>
          )}
          <button
            onClick={handleSendEmail}
            disabled={isEmailing}
            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold px-6 py-2 rounded-lg text-sm transition-colors shadow-lg"
          >
            {isEmailing ? 'Sending...' : 'Send Summary'}
          </button>
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

const iconMap: Record<string, string> = {
  clock: '\u23F1',
  calls: '\u2194',
  tokens: '\u2696',
  api: '\u26A1',
};

const StatCard = ({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: string }) => (
  <div className="bg-[#0F172A] rounded-lg p-3 border border-gray-800">
    <div className="flex items-center gap-1.5 mb-1">
      <span className="text-sm">{iconMap[icon] || ''}</span>
      <span className="text-[10px] font-bold text-gray-500 uppercase">{label}</span>
    </div>
    <div className="text-lg font-bold text-white font-mono">{value}</div>
    {sub && <div className="text-[10px] text-gray-500 font-mono mt-0.5">{sub}</div>}
  </div>
);

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
