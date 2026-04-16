import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ProblemAgentCard } from './ProblemAgentCard';
import { ProblemMessage, PhaseDivider } from './ProblemMessage';
import { TypingIndicator } from './TypingIndicator';
import { TokenStats } from './TokenStats';
import { FactCheckReport } from './FactCheckReport';
import { useProblemState } from '../hooks/useProblemState';
import profilesData from '../data/profiles.json';
import tonesData from '../data/tones.json';
import languagesData from '../data/languages.json';
import problemsData from '../data/problems.json';
import type { AgentRole, FactCheck, TokenUsageData, ProblemMessage as ProblemMessageType } from '../types';

const AGENT_ROLES: AgentRole[] = ['analyst', 'creative', 'critic', 'pragmatist', 'synthesizer'];

export const ProblemSolver: React.FC = () => {
  const state = useProblemState();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages, state.streamingMessage]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  const startSession = () => {
    disconnect();
    state.resetForNewSession();

    const params = new URLSearchParams({ problem: state.problem });

    for (const role of AGENT_ROLES) {
      const cfg = state.agentConfigs[role];
      params.set(`${role}_profile`, cfg.profile);
      params.set(`${role}_tone`, cfg.tone);
      params.set(`${role}_language`, cfg.language);
    }
    params.set('fact_check', state.factCheckEnabled ? 'true' : 'false');

    const url = `/api/problem/stream?${params.toString()}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    let lastPhase = '';

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'system') {
        if (data.content === 'connected') {
          state.setStatus('solving');
          if (data.session_id) state.setSessionId(data.session_id);
        } else if (data.content === 'fact_checking') {
          state.setIsFactChecking(true);
        } else if (data.content === 'finished') {
          state.setIsFactChecking(false);
          state.setStatus('finished');
          state.setPendingSpeaker(null);
          es.close();
        }
      } else if (data.type === 'phase') {
        state.setCurrentPhase(data.phase);
        state.setCurrentRound(data.round || 1);
      } else if (data.type === 'stream_chunk') {
        state.setPendingSpeaker(null);
        state.setStreamingMessage(prev => {
          if (prev && prev.speaker === data.speaker) {
            return { speaker: data.speaker, content: prev.content + data.chunk };
          }
          return { speaker: data.speaker, content: data.chunk };
        });
      } else if (data.type === 'stream_end') {
        const content = data.content;
        const speaker = data.speaker;
        const phase = data.phase || '';
        const round = data.round || 1;

        // Insert phase divider if phase changed
        if (phase && phase !== lastPhase) {
          state.setMessages(prev => [...prev, {
            speaker: '__phase_divider__',
            content: phase,
            turn: round,
            timestamp: undefined,
            phase,
            round,
          }]);
          lastPhase = phase;
        }

        state.setStreamingMessage(null);
        state.setMessages(prev => [...prev, {
          speaker,
          content,
          turn: 0,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          phase,
          round,
        }]);

        // Set next speaker hint
        state.setPendingSpeaker(null);
      } else if (data.type === 'agent_names') {
        state.setAgentNames(data.agents);
      } else if (data.type === 'solution') {
        try {
          state.setSolution(JSON.parse(data.content));
          state.setStatus('finished');
          state.setPendingSpeaker(null);
        } catch (e) {
          console.error("Failed to parse solution", e);
        }
      } else if (data.type === 'fact_check') {
        try {
          state.setFactChecks(JSON.parse(data.content));
          state.setIsFactChecking(false);
        } catch (e) {
          console.error("Failed to parse fact-check", e);
          state.setIsFactChecking(false);
        }
      } else if (data.type === 'fact_check_error') {
        state.setIsFactChecking(false);
      } else if (data.type === 'token_usage') {
        state.setTokenUsage(data.content);
      } else if (data.type === 'error') {
        state.setStatus('error');
        state.setPendingSpeaker(null);
        es.close();
      }
    };

    es.onerror = () => {
      state.setStatus('error');
      state.setPendingSpeaker(null);
      es.close();
    };
  };

  const stopSession = () => {
    disconnect();
    state.setStatus('finished');
    state.setPendingSpeaker(null);
  };

  const handleRerunFactCheck = async (mode: 'replace' | 'append') => {
    state.setIsFactChecking(true);
    state.setFactCheckError(null);
    state.setFactCheckProgress(null);
    if (mode === 'replace') state.setFactChecks(null);

    try {
      const response = await fetch('/api/debate/fact-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: state.messages.filter(m => m.speaker !== '__phase_divider__') }),
      });
      if (!response.ok) {
        const err = await response.json();
        state.setFactCheckError(err.detail || 'Fact-check failed');
        state.setIsFactChecking(false);
        return;
      }
      const reader = response.body?.getReader();
      if (!reader) { state.setIsFactChecking(false); return; }
      const decoder = new TextDecoder();
      let buffer = '';
      const accumulated: FactCheck[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === 'progress') {
              state.setFactCheckProgress(`Checking message ${evt.current}/${evt.total} (${evt.speaker})...`);
            } else if (evt.type === 'partial') {
              accumulated.push(...evt.checks);
              if (mode === 'replace') state.setFactChecks([...accumulated]);
              else state.setFactChecks(prev => [...(prev || []), ...evt.checks]);
            } else if (evt.type === 'complete') {
              if (mode === 'replace') state.setFactChecks(evt.fact_checks);
            } else if (evt.type === 'token_usage') {
              const fcUsage = evt.content as TokenUsageData;
              state.setTokenUsage(prev => {
                if (!prev) return fcUsage;
                return {
                  calls: [...prev.calls, ...fcUsage.calls],
                  total_input_tokens: prev.total_input_tokens + fcUsage.total_input_tokens,
                  total_output_tokens: prev.total_output_tokens + fcUsage.total_output_tokens,
                  total_cache_read_tokens: prev.total_cache_read_tokens + fcUsage.total_cache_read_tokens,
                  total_cache_creation_tokens: prev.total_cache_creation_tokens + fcUsage.total_cache_creation_tokens,
                  total_cost_usd: prev.total_cost_usd + fcUsage.total_cost_usd,
                  total_duration_ms: prev.total_duration_ms + fcUsage.total_duration_ms,
                };
              });
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      state.setFactCheckError(`Fact-check request failed: ${e}`);
    } finally {
      state.setIsFactChecking(false);
      state.setFactCheckProgress(null);
    }
  };

  return (
    <main className="flex-1 overflow-hidden flex flex-col p-4 md:p-8 max-w-7xl mx-auto w-full">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-slate-900 dark:text-white mb-1">Problem Solver</h1>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">5 specialist agents collaborate to find solutions.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700">
            <span className={`w-2.5 h-2.5 rounded-full ${state.status === 'solving' ? 'bg-green-500 animate-pulse' : 'bg-gray-400 dark:bg-gray-500'}`}></span>
            <span className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide">
              {state.status === 'solving' ? `SOLVING${state.currentPhase ? ` — ${state.currentPhase.toUpperCase()}` : ''}` : 'READY'}
            </span>
          </div>
          {state.status === 'solving' && (
            <button onClick={stopSession} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-red-900/20">
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        {AGENT_ROLES.map((role) => (
          <ProblemAgentCard
            key={role}
            role={role}
            config={state.agentConfigs[role]}
            profiles={profilesData}
            tones={tonesData}
            languages={languagesData}
            onUpdate={(field, value) => state.updateAgentConfig(role, field, value)}
            disabled={state.status === 'solving'}
            agentName={state.agentNames?.[role]}
          />
        ))}
      </div>

      {/* Problem Input */}
      {state.status === 'idle' && (
        <div className="mb-6 md:mb-8 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-xl p-4 md:p-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Problem Statement</label>
            <button
              onClick={() => {
                const all = problemsData.flatMap(c => c.problems);
                state.setProblem(all[Math.floor(Math.random() * all.length)]);
              }}
              className="text-xs text-blue-500 hover:text-blue-400 font-medium transition-colors"
            >
              Random Problem
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 relative">
            <div className="flex-1 relative">
              <textarea
                value={state.problem}
                onChange={(e) => state.setProblem(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                rows={2}
                className="w-full bg-slate-50 dark:bg-[#0F172A] border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
                placeholder="Describe the problem to solve..."
              />
              {showSuggestions && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-20 max-h-80 overflow-y-auto">
                  {problemsData.map((cat) => (
                    <div key={cat.category}>
                      <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-slate-50 dark:bg-[#0F172A] sticky top-0">
                        {cat.category}
                      </div>
                      {cat.problems.map((p) => (
                        <button
                          key={p}
                          onClick={() => { state.setProblem(p); setShowSuggestions(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  ))}
                  <button
                    onClick={() => setShowSuggestions(false)}
                    className="w-full py-2 text-xs text-gray-400 hover:text-gray-300 border-t border-gray-200 dark:border-gray-700"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={startSession}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-lg font-bold transition-all shadow-lg shadow-emerald-900/20 hover:scale-105 active:scale-95 whitespace-nowrap"
            >
              Solve It
            </button>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button
              type="button"
              role="switch"
              aria-checked={state.factCheckEnabled}
              onClick={() => state.setFactCheckEnabled(prev => !prev)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${state.factCheckEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${state.factCheckEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
            <span className="text-sm font-medium text-slate-600 dark:text-gray-400">Fact-check after session</span>
          </div>
        </div>
      )}

      {/* Chat Feed */}
      <div className="flex-1 flex flex-col bg-white dark:bg-[#020617] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden relative">
        {/* Problem Overlay */}
        <div className="absolute top-6 left-0 right-0 flex justify-center z-10">
          <div className="bg-slate-50/90 dark:bg-[#1E293B]/90 backdrop-blur border border-gray-200 dark:border-gray-700 text-emerald-600 dark:text-emerald-300 text-xs font-medium px-4 py-1.5 rounded-full shadow-lg max-w-[90%] truncate">
            Problem: <span className="text-slate-600 dark:text-gray-300 italic">{state.problem}</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-16 md:pt-20 space-y-2 custom-scrollbar">
          {state.messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center opacity-20">
              <div className="text-6xl mb-4 grayscale">🧠</div>
              <p className="text-slate-500 dark:text-gray-400">Ready to solve problems collaboratively...</p>
            </div>
          )}
          {state.messages.map((msg, i) => {
            if (msg.speaker === '__phase_divider__') {
              return <PhaseDivider key={i} phase={msg.content} round={msg.turn} />;
            }
            return (
              <ProblemMessage
                key={i}
                speaker={msg.speaker}
                content={msg.content}
                timestamp={msg.timestamp}
                agentNames={state.agentNames}
              />
            );
          })}
          {state.status === 'solving' && state.streamingMessage && (
            <ProblemMessage
              speaker={state.streamingMessage.speaker}
              content={state.streamingMessage.content}
              agentNames={state.agentNames}
              isStreaming
            />
          )}
          {state.status === 'solving' && state.pendingSpeaker && !state.streamingMessage && (
            <TypingIndicator speaker={state.pendingSpeaker} />
          )}

          {/* Solution Matrix placeholder — will be Phase C */}
          {state.solution && (
            <div className="my-8 bg-[#0F172A] border-2 border-gray-700 rounded-2xl w-full shadow-2xl overflow-hidden">
              <div className="bg-[#1E293B] p-6 text-center border-b border-gray-700">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-xl">🧠</span>
                  <h2 className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em]">Solution</h2>
                </div>
                <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${state.solution.confidence_level === 'high' ? 'bg-green-500/20 text-green-400' : state.solution.confidence_level === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                  {state.solution.confidence_level?.toUpperCase()} CONFIDENCE
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Summary */}
                <div className="bg-[#1E293B]/50 rounded-xl p-4 border border-gray-800">
                  <h4 className="text-[10px] font-bold text-emerald-500 uppercase mb-2">Solution Summary</h4>
                  <p className="text-gray-300 text-sm leading-relaxed">{state.solution.solution_summary}</p>
                </div>

                {/* Recommendations */}
                {state.solution.key_recommendations?.length > 0 && (
                  <div className="bg-[#1E293B]/50 rounded-xl p-4 border border-gray-800">
                    <h4 className="text-[10px] font-bold text-blue-500 uppercase mb-2">Key Recommendations</h4>
                    <ol className="list-decimal list-inside space-y-1">
                      {state.solution.key_recommendations.map((r, i) => (
                        <li key={i} className="text-gray-300 text-sm">{r}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Implementation Steps */}
                {state.solution.implementation_steps?.length > 0 && (
                  <div className="bg-[#1E293B]/50 rounded-xl p-4 border border-gray-800">
                    <h4 className="text-[10px] font-bold text-cyan-500 uppercase mb-2">Implementation Steps</h4>
                    <ol className="list-decimal list-inside space-y-1">
                      {state.solution.implementation_steps.map((s, i) => (
                        <li key={i} className="text-gray-300 text-sm">{s}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Risks */}
                {state.solution.risks_identified?.length > 0 && (
                  <details className="bg-[#1E293B]/50 rounded-xl border border-gray-800 group">
                    <summary className="p-4 cursor-pointer select-none hover:bg-[#1E293B]/80 transition-colors rounded-xl">
                      <span className="text-[10px] font-bold text-red-500 uppercase">
                        Risks Identified ({state.solution.risks_identified.length})
                        <span className="ml-1 group-open:rotate-90 inline-block transition-transform">&#9656;</span>
                      </span>
                    </summary>
                    <ul className="list-disc list-inside space-y-1 px-4 pb-4">
                      {state.solution.risks_identified.map((r, i) => (
                        <li key={i} className="text-gray-400 text-xs">{r}</li>
                      ))}
                    </ul>
                  </details>
                )}

                {/* Dissenting Views */}
                {state.solution.dissenting_views?.length > 0 && (
                  <details className="bg-[#1E293B]/50 rounded-xl border border-gray-800 group">
                    <summary className="p-4 cursor-pointer select-none hover:bg-[#1E293B]/80 transition-colors rounded-xl">
                      <span className="text-[10px] font-bold text-amber-500 uppercase">
                        Dissenting Views ({state.solution.dissenting_views.length})
                        <span className="ml-1 group-open:rotate-90 inline-block transition-transform">&#9656;</span>
                      </span>
                    </summary>
                    <ul className="list-disc list-inside space-y-1 px-4 pb-4">
                      {state.solution.dissenting_views.map((d, i) => (
                        <li key={i} className="text-gray-400 text-xs">{d}</li>
                      ))}
                    </ul>
                  </details>
                )}

                {/* Agent Contributions */}
                {state.solution.agent_contributions && (
                  <details className="bg-[#1E293B]/50 rounded-xl border border-gray-800 group">
                    <summary className="p-4 cursor-pointer select-none hover:bg-[#1E293B]/80 transition-colors rounded-xl">
                      <span className="text-[10px] font-bold text-purple-500 uppercase">
                        Agent Contributions
                        <span className="ml-1 group-open:rotate-90 inline-block transition-transform">&#9656;</span>
                      </span>
                    </summary>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 px-4 pb-4">
                      {Object.entries(state.solution.agent_contributions).map(([role, contribution]) => (
                        <div key={role} className="bg-[#0F172A] rounded-lg p-3 border border-gray-800">
                          <span className="text-[10px] font-bold text-gray-500 uppercase">{role}</span>
                          <p className="text-gray-400 text-xs mt-1">{contribution}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {state.solution.confidence_reasoning && (
                  <div className="bg-[#1E293B]/50 rounded-xl p-4 border border-gray-800">
                    <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2">Confidence Reasoning</h4>
                    <p className="text-gray-400 text-sm italic">"{state.solution.confidence_reasoning}"</p>
                  </div>
                )}
              </div>

              {/* Token Stats */}
              {state.tokenUsage && <TokenStats tokenUsage={state.tokenUsage} totalWallTimeMs={state.startTime ? Date.now() - state.startTime : null} />}

              {/* Fact Check */}
              <FactCheckReport
                factChecks={state.factChecks}
                isFactChecking={state.isFactChecking}
                factCheckError={state.factCheckError}
                factCheckProgress={state.factCheckProgress}
                onRerunFactCheck={handleRerunFactCheck}
              />

              {/* Footer */}
              <div className="p-4 bg-[#1E293B] border-t border-gray-700 flex flex-wrap justify-center gap-3 md:gap-4">
                <button onClick={state.resetToIdle} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-lg text-sm transition-colors shadow-lg">
                  New Problem
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>
    </main>
  );
};
