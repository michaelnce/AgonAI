import { useState, useEffect, useRef, useCallback } from 'react';
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
import type { AgentRole, FactCheck, TokenUsageData } from '../types';

const AGENT_ROLES: AgentRole[] = ['analyst', 'creative', 'critic', 'pragmatist', 'synthesizer'];
const RANDOM_SENTINEL = "__random__";
const BEST_MATCH_SENTINEL = "__best_match__";
const getRandomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const ProblemSolver: React.FC = () => {
  const state = useProblemState();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [userMessage, setUserMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [savedSessionsList, setSavedSessionsList] = useState<Array<{ id: string; date: string; topic: string; [k: string]: unknown }>>([]);
  const [showSavedSessions, setShowSavedSessions] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages, state.streamingMessage]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => { return () => disconnect(); }, [disconnect]);

  // --- Saved sessions ---
  const fetchSavedSessions = async () => {
    try {
      const res = await fetch('/api/debates');
      if (res.ok) {
        const all = await res.json();
        setSavedSessionsList(all.filter((d: { type?: string }) => d.type === 'problem'));
      }
    } catch (e) { console.error('Failed to fetch sessions', e); }
  };

  useEffect(() => { fetchSavedSessions(); }, []);

  const saveSession = async () => {
    if (!state.solution || state.messages.length === 0) return;
    const session = {
      id: state.sessionId || crypto.randomUUID(),
      type: 'problem',
      date: new Date().toISOString(),
      topic: state.problem,
      agentConfigs: state.agentConfigs,
      agentNames: state.agentNames,
      messages: state.messages,
      solution: state.solution,
      factChecks: state.factChecks,
      tokenUsage: state.tokenUsage,
      totalWallTimeMs: state.startTime ? Date.now() - state.startTime : null,
    };
    try {
      const res = await fetch('/api/debates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session),
      });
      if (res.ok) { alert('Session saved!'); fetchSavedSessions(); }
      else alert('Failed to save session');
    } catch { alert('Failed to save session'); }
  };

  const loadSession = async (id: string) => {
    try {
      const res = await fetch(`/api/debates/${id}`);
      if (!res.ok) { alert('Failed to load session'); return; }
      const saved = await res.json();
      state.setProblem(saved.topic);
      if (saved.agentConfigs) state.setAgentConfigs(saved.agentConfigs);
      state.setAgentNames(saved.agentNames);
      state.setMessages(saved.messages);
      state.setSolution(saved.solution);
      state.setFactChecks(saved.factChecks ?? null);
      state.setTokenUsage(saved.tokenUsage ?? null);
      state.setStartTime(null);
      state.setStatus('finished');
      setShowSavedSessions(false);
    } catch { alert('Failed to load session'); }
  };

  const deleteSession = async (id: string) => {
    try { await fetch(`/api/debates/${id}`, { method: 'DELETE' }); fetchSavedSessions(); }
    catch { console.error('Failed to delete'); }
  };

  // --- Markdown export ---
  const handleSaveMarkdown = () => {
    if (!state.solution) return;
    const date = new Date().toLocaleString();
    let md = `# AgonAI Problem-Solving Report\n\n`;
    md += `**Date:** ${date}\n\n**Problem:** ${state.problem}\n\n---\n\n`;

    if (state.agentNames) {
      md += `## Agent Configuration\n\n| Role | Agent | Profile | Tone | Language |\n|------|-------|---------|------|----------|\n`;
      for (const role of AGENT_ROLES) {
        const cfg = state.agentConfigs[role];
        const name = state.agentNames[role] || role;
        md += `| ${role} | ${name} | ${cfg.profile} | ${cfg.tone} | ${cfg.language} |\n`;
      }
      md += `\n---\n\n`;
    }

    md += `## Session Transcript\n\n`;
    state.messages.forEach((msg) => {
      if (msg.speaker === '__phase_divider__') {
        md += `### ${msg.content.charAt(0).toUpperCase() + msg.content.slice(1)}${msg.turn > 1 ? ` — Round ${msg.turn}` : ''}\n\n`;
      } else {
        const name = state.agentNames?.[msg.speaker] || msg.speaker;
        md += `**${name} (${msg.speaker}):**\n\n${msg.content.replace(/^[A-Za-z]+:\s*/, '')}\n\n---\n\n`;
      }
    });

    md += `## Solution\n\n**Summary:** ${state.solution.solution_summary}\n\n`;
    md += `**Confidence:** ${state.solution.confidence_level}\n\n`;
    if (state.solution.key_recommendations?.length) {
      md += `### Recommendations\n\n`;
      state.solution.key_recommendations.forEach((r, i) => { md += `${i + 1}. ${r}\n`; });
      md += `\n`;
    }
    if (state.solution.implementation_steps?.length) {
      md += `### Implementation Steps\n\n`;
      state.solution.implementation_steps.forEach((s, i) => { md += `${i + 1}. ${s}\n`; });
      md += `\n`;
    }
    if (state.solution.risks_identified?.length) {
      md += `### Risks\n\n`;
      state.solution.risks_identified.forEach(r => { md += `- ${r}\n`; });
      md += `\n`;
    }
    if (state.solution.dissenting_views?.length) {
      md += `### Dissenting Views\n\n`;
      state.solution.dissenting_views.forEach(d => { md += `- ${d}\n`; });
      md += `\n`;
    }
    if (state.factChecks?.length) {
      md += `---\n\n## Fact-Check Report\n\n| Claim | Speaker | Verdict | Explanation |\n|---|---|---|---|\n`;
      state.factChecks.forEach(fc => { md += `| ${fc.claim} | ${fc.speaker} | ${fc.verdict} | ${fc.explanation} |\n`; });
      md += `\n`;
    }
    md += `---\n\n*Generated by [AgonAI](https://github.com/michaelnce/AgonAI)*\n`;

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = state.problem.slice(0, 40).replace(/[^a-zA-Z0-9]+/g, '-').replace(/-+$/, '').toLowerCase();
    a.href = url; a.download = `agonai-problem-${slug}.md`; a.click();
    URL.revokeObjectURL(url);
  };

  // --- Email export ---
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
          topic: state.problem,
          proponent: { profile: 'Problem Solver', tone: 'Collaborative' },
          opponent: { profile: 'Multi-Agent', tone: 'Collaborative' },
          messages: state.messages.filter(m => m.speaker !== '__phase_divider__'),
          verdict: { winner: 'Team', reasoning: state.solution?.solution_summary || '', scores: { proponent: { logic: 0, evidence: 0, style: 0 }, opponent: { logic: 0, evidence: 0, style: 0 } } },
          token_usage: state.tokenUsage,
          total_wall_time_ms: state.startTime ? Date.now() - state.startTime : null,
          agent_names: state.agentNames,
          fact_checks: state.factChecks,
        }),
      });
      if (response.ok) alert("Email sent!");
      else { const err = await response.json(); alert("Failed: " + (err.detail || "Unknown error")); }
    } catch (e) { alert("Error: " + String(e)); }
    finally { setIsEmailing(false); }
  };

  // --- Start session with Best Match resolution ---
  const startSession = async () => {
    disconnect();
    state.resetForNewSession();

    const resolved: Record<string, { profile: string; tone: string; language: string }> = {};
    for (const role of AGENT_ROLES) {
      resolved[role] = { ...state.agentConfigs[role] };
    }

    // Random resolution (local)
    for (const role of AGENT_ROLES) {
      if (resolved[role].profile === RANDOM_SENTINEL) resolved[role].profile = getRandomItem(profilesData).Movement;
      if (resolved[role].tone === RANDOM_SENTINEL) resolved[role].tone = getRandomItem(tonesData).tone;
    }

    // Best Match resolution (backend LLM call)
    const needsBestMatch = AGENT_ROLES.some(r =>
      resolved[r].profile === BEST_MATCH_SENTINEL || resolved[r].tone === BEST_MATCH_SENTINEL
    );

    if (needsBestMatch) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);
        const res = await fetch('/api/problem/resolve-agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            problem: state.problem,
            agents: Object.fromEntries(AGENT_ROLES.map(r => [r, {
              resolve_profile: resolved[r].profile === BEST_MATCH_SENTINEL,
              resolve_tone: resolved[r].tone === BEST_MATCH_SENTINEL,
            }])),
          }),
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const result = await res.json();
          for (const role of AGENT_ROLES) {
            if (result[role]?.profile) resolved[role].profile = result[role].profile;
            if (result[role]?.tone) resolved[role].tone = result[role].tone;
          }
        }
      } catch { /* fall through to random */ }

      // Fallback any remaining best_match to random
      for (const role of AGENT_ROLES) {
        if (resolved[role].profile === BEST_MATCH_SENTINEL) resolved[role].profile = getRandomItem(profilesData).Movement;
        if (resolved[role].tone === BEST_MATCH_SENTINEL) resolved[role].tone = getRandomItem(tonesData).tone;
      }
    }

    const params = new URLSearchParams({ problem: state.problem });
    for (const role of AGENT_ROLES) {
      params.set(`${role}_profile`, resolved[role].profile);
      params.set(`${role}_tone`, resolved[role].tone);
      params.set(`${role}_language`, resolved[role].language);
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

        if (phase && phase !== lastPhase) {
          state.setMessages(prev => [...prev, { speaker: '__phase_divider__', content: phase, turn: round, phase, round }]);
          lastPhase = phase;
        }

        state.setStreamingMessage(null);
        state.setMessages(prev => [...prev, {
          speaker, content, turn: 0,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          phase, round,
        }]);
        state.setPendingSpeaker(null);
      } else if (data.type === 'agent_names') {
        state.setAgentNames(data.agents);
      } else if (data.type === 'solution') {
        try {
          state.setSolution(JSON.parse(data.content));
          state.setStatus('finished');
          state.setPendingSpeaker(null);
        } catch (e) { console.error("Failed to parse solution", e); }
      } else if (data.type === 'fact_check') {
        try { state.setFactChecks(JSON.parse(data.content)); state.setIsFactChecking(false); }
        catch { state.setIsFactChecking(false); }
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

    es.onerror = () => { state.setStatus('error'); state.setPendingSpeaker(null); es.close(); };
  };

  const stopSession = () => { disconnect(); state.setStatus('finished'); state.setPendingSpeaker(null); };

  const handleSendMessage = async () => {
    if (!state.sessionId || !userMessage.trim() || state.status !== 'solving') return;
    setIsSending(true);
    try {
      await fetch(`/api/debate/${state.sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });
      setUserMessage("");
    } catch (e) { console.error("Failed to send message", e); }
    finally { setIsSending(false); }
  };

  const handleRerunFactCheck = async (mode: 'replace' | 'append') => {
    state.setIsFactChecking(true); state.setFactCheckError(null); state.setFactCheckProgress(null);
    if (mode === 'replace') state.setFactChecks(null);
    try {
      const response = await fetch('/api/debate/fact-check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: state.messages.filter(m => m.speaker !== '__phase_divider__') }),
      });
      if (!response.ok) { const err = await response.json(); state.setFactCheckError(err.detail || 'Fact-check failed'); state.setIsFactChecking(false); return; }
      const reader = response.body?.getReader();
      if (!reader) { state.setIsFactChecking(false); return; }
      const decoder = new TextDecoder(); let buffer = ''; const accumulated: FactCheck[] = [];
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === 'progress') state.setFactCheckProgress(`Checking message ${evt.current}/${evt.total} (${evt.speaker})...`);
            else if (evt.type === 'partial') { accumulated.push(...evt.checks); if (mode === 'replace') state.setFactChecks([...accumulated]); else state.setFactChecks(prev => [...(prev || []), ...evt.checks]); }
            else if (evt.type === 'complete' && mode === 'replace') state.setFactChecks(evt.fact_checks);
            else if (evt.type === 'token_usage') {
              const fc = evt.content as TokenUsageData;
              state.setTokenUsage(prev => prev ? { calls: [...prev.calls, ...fc.calls], total_input_tokens: prev.total_input_tokens + fc.total_input_tokens, total_output_tokens: prev.total_output_tokens + fc.total_output_tokens, total_cache_read_tokens: prev.total_cache_read_tokens + fc.total_cache_read_tokens, total_cache_creation_tokens: prev.total_cache_creation_tokens + fc.total_cache_creation_tokens, total_cost_usd: prev.total_cost_usd + fc.total_cost_usd, total_duration_ms: prev.total_duration_ms + fc.total_duration_ms } : fc);
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) { state.setFactCheckError(`Fact-check request failed: ${e}`); }
    finally { state.setIsFactChecking(false); state.setFactCheckProgress(null); }
  };

  // Determine which agent is currently speaking
  const currentSpeaker = state.streamingMessage?.speaker || state.pendingSpeaker;

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
            <button onClick={stopSession} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-red-900/20">Stop</button>
          )}
        </div>
      </div>

      {/* Agent Rows — 2 per line on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-6">
        {AGENT_ROLES.map((role) => (
          <ProblemAgentCard
            key={role} role={role}
            config={state.agentConfigs[role]}
            profiles={profilesData} tones={tonesData} languages={languagesData}
            onUpdate={(field, value) => state.updateAgentConfig(role, field, value)}
            disabled={state.status === 'solving'}
            agentName={state.agentNames?.[role]}
            status={state.status === 'solving' ? (currentSpeaker === role ? 'Speaking' : 'Waiting') : 'Idle'}
          />
        ))}
      </div>

      {/* Problem Input */}
      {state.status === 'idle' && (
        <div className="mb-6 md:mb-8 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-xl p-4 md:p-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Problem Statement</label>
            <button onClick={() => { const all = problemsData.flatMap(c => c.problems); state.setProblem(all[Math.floor(Math.random() * all.length)]); }} className="text-xs text-blue-500 hover:text-blue-400 font-medium transition-colors">Random Problem</button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 relative">
            <div className="flex-1 relative">
              <textarea value={state.problem} onChange={(e) => state.setProblem(e.target.value)} onFocus={() => setShowSuggestions(true)} rows={2}
                className="w-full bg-slate-50 dark:bg-[#0F172A] border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
                placeholder="Describe the problem to solve..." />
              {showSuggestions && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-20 max-h-80 overflow-y-auto">
                  {problemsData.map((cat) => (
                    <div key={cat.category}>
                      <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-slate-50 dark:bg-[#0F172A] sticky top-0">{cat.category}</div>
                      {cat.problems.map((p) => (
                        <button key={p} onClick={() => { state.setProblem(p); setShowSuggestions(false); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">{p}</button>
                      ))}
                    </div>
                  ))}
                  <button onClick={() => setShowSuggestions(false)} className="w-full py-2 text-xs text-gray-400 hover:text-gray-300 border-t border-gray-200 dark:border-gray-700">Close</button>
                </div>
              )}
            </div>
            <button onClick={startSession} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-lg font-bold transition-all shadow-lg shadow-emerald-900/20 hover:scale-105 active:scale-95 whitespace-nowrap">Solve It</button>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button type="button" role="switch" aria-checked={state.factCheckEnabled} onClick={() => state.setFactCheckEnabled(prev => !prev)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${state.factCheckEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${state.factCheckEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
            <span className="text-sm font-medium text-slate-600 dark:text-gray-400">Fact-check after session</span>
          </div>
        </div>
      )}

      {/* Chat Feed */}
      <div className="flex-1 flex flex-col bg-white dark:bg-[#020617] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden relative">
        <div className="absolute top-6 left-0 right-0 flex justify-center z-10">
          <div className="bg-slate-50/90 dark:bg-[#1E293B]/90 backdrop-blur border border-gray-200 dark:border-gray-700 text-emerald-600 dark:text-emerald-300 text-xs font-medium px-4 py-1.5 rounded-full shadow-lg max-w-[90%] truncate">
            Problem: <span className="text-slate-600 dark:text-gray-300 italic">{state.problem}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-16 md:pt-20 space-y-2 custom-scrollbar">
          {state.messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center opacity-20">
              <div className="text-6xl mb-4 grayscale">🧠</div>
              <p className="text-slate-500 dark:text-gray-400">Ready to solve problems collaboratively...</p>
            </div>
          )}
          {state.messages.map((msg, i) => {
            if (msg.speaker === '__phase_divider__') return <PhaseDivider key={i} phase={msg.content} round={msg.turn} />;
            return <ProblemMessage key={i} speaker={msg.speaker} content={msg.content} timestamp={msg.timestamp} agentNames={state.agentNames} />;
          })}
          {state.status === 'solving' && state.streamingMessage && (
            <ProblemMessage speaker={state.streamingMessage.speaker} content={state.streamingMessage.content} agentNames={state.agentNames} isStreaming />
          )}
          {state.status === 'solving' && state.pendingSpeaker && !state.streamingMessage && (
            <TypingIndicator speaker={state.pendingSpeaker} agentNames={state.agentNames} />
          )}

          {/* Solution Matrix */}
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
                <div className="bg-[#1E293B]/50 rounded-xl p-4 border border-gray-800">
                  <h4 className="text-[10px] font-bold text-emerald-500 uppercase mb-2">Solution Summary</h4>
                  <p className="text-gray-300 text-sm leading-relaxed">{state.solution.solution_summary}</p>
                </div>

                {state.solution.key_recommendations?.length > 0 && (
                  <div className="bg-[#1E293B]/50 rounded-xl p-4 border border-gray-800">
                    <h4 className="text-[10px] font-bold text-blue-500 uppercase mb-2">Key Recommendations</h4>
                    <ol className="list-decimal list-inside space-y-1">{state.solution.key_recommendations.map((r, i) => <li key={i} className="text-gray-300 text-sm">{r}</li>)}</ol>
                  </div>
                )}

                {state.solution.implementation_steps?.length > 0 && (
                  <div className="bg-[#1E293B]/50 rounded-xl p-4 border border-gray-800">
                    <h4 className="text-[10px] font-bold text-cyan-500 uppercase mb-2">Implementation Steps</h4>
                    <ol className="list-decimal list-inside space-y-1">{state.solution.implementation_steps.map((s, i) => <li key={i} className="text-gray-300 text-sm">{s}</li>)}</ol>
                  </div>
                )}

                {state.solution.risks_identified?.length > 0 && (
                  <details className="bg-[#1E293B]/50 rounded-xl border border-gray-800 group">
                    <summary className="p-4 cursor-pointer select-none hover:bg-[#1E293B]/80 transition-colors rounded-xl">
                      <span className="text-[10px] font-bold text-red-500 uppercase">Risks ({state.solution.risks_identified.length}) <span className="ml-1 group-open:rotate-90 inline-block transition-transform">&#9656;</span></span>
                    </summary>
                    <ul className="list-disc list-inside space-y-1 px-4 pb-4">{state.solution.risks_identified.map((r, i) => <li key={i} className="text-gray-400 text-xs">{r}</li>)}</ul>
                  </details>
                )}

                {state.solution.dissenting_views?.length > 0 && (
                  <details className="bg-[#1E293B]/50 rounded-xl border border-gray-800 group">
                    <summary className="p-4 cursor-pointer select-none hover:bg-[#1E293B]/80 transition-colors rounded-xl">
                      <span className="text-[10px] font-bold text-amber-500 uppercase">Dissenting Views ({state.solution.dissenting_views.length}) <span className="ml-1 group-open:rotate-90 inline-block transition-transform">&#9656;</span></span>
                    </summary>
                    <ul className="list-disc list-inside space-y-1 px-4 pb-4">{state.solution.dissenting_views.map((d, i) => <li key={i} className="text-gray-400 text-xs">{d}</li>)}</ul>
                  </details>
                )}

                {state.solution.agent_contributions && (
                  <details className="bg-[#1E293B]/50 rounded-xl border border-gray-800 group">
                    <summary className="p-4 cursor-pointer select-none hover:bg-[#1E293B]/80 transition-colors rounded-xl">
                      <span className="text-[10px] font-bold text-purple-500 uppercase">Agent Contributions <span className="ml-1 group-open:rotate-90 inline-block transition-transform">&#9656;</span></span>
                    </summary>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 px-4 pb-4">
                      {Object.entries(state.solution.agent_contributions).map(([role, contribution]) => (
                        <div key={role} className="bg-[#0F172A] rounded-lg p-3 border border-gray-800">
                          <span className="text-[10px] font-bold text-gray-500 uppercase">{state.agentNames?.[role] || role}</span>
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

              {state.tokenUsage && <TokenStats tokenUsage={state.tokenUsage} totalWallTimeMs={state.startTime ? Date.now() - state.startTime : null} />}

              <FactCheckReport factChecks={state.factChecks} isFactChecking={state.isFactChecking} factCheckError={state.factCheckError} factCheckProgress={state.factCheckProgress} onRerunFactCheck={handleRerunFactCheck} />

              {/* Footer with all actions */}
              <div className="p-4 bg-[#1E293B] border-t border-gray-700 flex flex-wrap justify-center gap-3 md:gap-4">
                <button onClick={saveSession} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2 rounded-lg text-sm transition-colors shadow-lg">Save Session</button>
                <button onClick={handleSaveMarkdown} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold px-6 py-2 rounded-lg text-sm transition-colors shadow-lg">Save as MD</button>
                <button onClick={handleSendEmail} disabled={isEmailing} className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold px-6 py-2 rounded-lg text-sm transition-colors shadow-lg">{isEmailing ? 'Sending...' : 'Send Summary'}</button>
                <button onClick={state.resetToIdle} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-lg text-sm transition-colors shadow-lg">New Problem</button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* User Input Area */}
        <div className="p-3 md:p-4 border-t border-gray-200 dark:border-gray-800 bg-slate-50 dark:bg-[#0F172A] flex gap-3 items-center">
          <input type="text" value={userMessage} onChange={(e) => setUserMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={state.status === 'solving' ? "Type a facilitator instruction..." : "Waiting to start..."}
            disabled={state.status !== 'solving'}
            className="flex-1 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50" />
          <button onClick={handleSendMessage} disabled={state.status !== 'solving' || !userMessage.trim() || isSending}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white w-10 h-10 rounded-lg flex items-center justify-center transition-colors shadow-lg shadow-blue-900/20">
            {isSending ? '...' : '➤'}
          </button>
        </div>
      </div>

      {/* Saved Sessions Modal */}
      {showSavedSessions && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Saved Problem Sessions</h2>
              <button onClick={() => setShowSavedSessions(false)} className="p-2 text-gray-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">&#10005;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {savedSessionsList.length === 0 ? (
                <p className="text-center text-gray-500 py-8 text-sm">No saved sessions yet.</p>
              ) : savedSessionsList.map((s) => (
                <div key={s.id} className="bg-slate-50 dark:bg-[#0F172A] rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{s.topic}</p>
                      <p className="text-[10px] text-gray-500 mt-1">{new Date(s.date).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => loadSession(s.id)} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">Load</button>
                      <button onClick={() => deleteSession(s.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors">&#10005;</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
