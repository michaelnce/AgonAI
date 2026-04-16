import React from 'react';
import type { TokenUsageData } from '../types';

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
};

const formatNumber = (n: number): string => n.toLocaleString();

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

interface TokenStatsProps {
  tokenUsage: TokenUsageData;
  totalWallTimeMs: number | null;
}

export const TokenStats: React.FC<TokenStatsProps> = ({ tokenUsage, totalWallTimeMs }) => (
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard label="Total Time" value={formatDuration(totalWallTimeMs ?? tokenUsage.total_duration_ms)} icon="clock" />
          <StatCard label="LLM Calls" value={String(tokenUsage.calls.length)} icon="calls" />
          <StatCard
            label="Total Tokens"
            value={formatNumber(tokenUsage.total_input_tokens + tokenUsage.total_output_tokens)}
            sub={`${formatNumber(tokenUsage.total_input_tokens)} in / ${formatNumber(tokenUsage.total_output_tokens)} out`}
            icon="tokens"
          />
          <StatCard label="API Processing" value={formatDuration(tokenUsage.total_duration_ms)} icon="api" />
        </div>

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
);
