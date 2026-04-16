import { useState, useEffect, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { AgentCard } from './components/AgentCard';
import { DebateMessage } from './components/DebateMessage';
import { TypingIndicator } from './components/TypingIndicator';
import { DecisionMatrix } from './components/DecisionMatrix';
import { ProfileBrowser } from './components/ProfileBrowser';
import { SavedScenarios } from './components/SavedScenarios';
import { useDebateState } from './hooks/useDebateState';
import { useSSEConnection } from './hooks/useSSEConnection';
import profilesData from './data/profiles.json';
import tonesData from './data/tones.json';
import languagesData from './data/languages.json';
import topicsData from './data/topics.json';
import type { SavedDebate, FactCheck, TokenUsageData } from './types';

const getRandomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const RANDOM_SENTINEL = "__random__";
const BEST_MATCH_SENTINEL = "__best_match__";

function App() {
  const state = useDebateState();
  const [showTopicSuggestions, setShowTopicSuggestions] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [savedDebatesList, setSavedDebatesList] = useState<SavedDebate[]>([]);

  const handleNavigate = (panel: string) => {
    if (panel === 'current') setActivePanel(null);
    else if (panel === 'help') setActivePanel('help');
    else setActivePanel(panel);
  };

  const sseHandlers = useMemo(() => ({
    setStatus: state.setStatus,
    setDebateId: state.setDebateId,
    setPendingSpeaker: state.setPendingSpeaker,
    setStreamingMessage: state.setStreamingMessage,
    setMessages: state.setMessages,
    setVerdict: state.setVerdict,
    setAgentNames: state.setAgentNames,
    setFactChecks: state.setFactChecks,
    setIsFactChecking: state.setIsFactChecking,
    setTokenUsage: state.setTokenUsage,
  }), []);

  const { connect, disconnect } = useSSEConnection(sseHandlers);

  // --- Saved debates ---
  const fetchSavedDebates = async () => {
    try {
      const res = await fetch('/api/debates');
      if (res.ok) setSavedDebatesList(await res.json());
    } catch (e) { console.error('Failed to fetch saved debates', e); }
  };

  useEffect(() => { fetchSavedDebates(); }, []);
  useEffect(() => { if (activePanel === 'debates') fetchSavedDebates(); }, [activePanel]);

  const saveDebate = async () => {
    if (!state.verdict || state.messages.length === 0) return;
    const debate: SavedDebate = {
      id: state.debateId || crypto.randomUUID(),
      date: new Date().toISOString(),
      topic: state.topic,
      proponentConfig: { profile: state.proponentProfile, tone: state.proponentTone, language: state.proponentLanguage },
      opponentConfig: { profile: state.opponentProfile, tone: state.opponentTone, language: state.opponentLanguage },
      agentNames: state.agentNames,
      messages: state.messages,
      verdict: state.verdict,
      factChecks: state.factChecks,
      tokenUsage: state.tokenUsage,
      totalWallTimeMs: state.debateStartTime ? Date.now() - state.debateStartTime : null,
    };
    try {
      const res = await fetch('/api/debates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(debate),
      });
      if (res.ok) { alert('Debate saved!'); fetchSavedDebates(); }
      else alert('Failed to save debate');
    } catch (e) { console.error('Failed to save debate', e); alert('Failed to save debate'); }
  };

  const loadDebate = async (summary: SavedDebate & { id: string }) => {
    try {
      const res = await fetch(`/api/debates/${summary.id}`);
      if (!res.ok) { alert('Failed to load debate'); return; }
      const saved: SavedDebate = await res.json();
      state.loadSavedDebate(saved);
      setActivePanel(null);
    } catch (e) { console.error('Failed to load debate', e); alert('Failed to load debate'); }
  };

  const deleteSavedDebate = async (id: string) => {
    try { await fetch(`/api/debates/${id}`, { method: 'DELETE' }); fetchSavedDebates(); }
    catch (e) { console.error('Failed to delete debate', e); }
  };

  // --- Start debate ---
  const startDebate = async () => {
    disconnect();
    state.resetForNewDebate();

    let resolvedPropProfile = state.proponentProfile;
    let resolvedPropTone = state.proponentTone;
    let resolvedOppProfile = state.opponentProfile;
    let resolvedOppTone = state.opponentTone;

    if (resolvedPropProfile === RANDOM_SENTINEL) resolvedPropProfile = getRandomItem(profilesData).Movement;
    if (resolvedOppProfile === RANDOM_SENTINEL) resolvedOppProfile = getRandomItem(profilesData.filter(p => p.Movement !== resolvedPropProfile)).Movement;
    if (resolvedPropTone === RANDOM_SENTINEL) resolvedPropTone = getRandomItem(tonesData).tone;
    if (resolvedOppTone === RANDOM_SENTINEL) resolvedOppTone = getRandomItem(tonesData).tone;

    const needsBestMatch = [resolvedPropProfile, resolvedPropTone, resolvedOppProfile, resolvedOppTone].includes(BEST_MATCH_SENTINEL);

    if (needsBestMatch) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);
        const response = await fetch('/api/debate/resolve-best-match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            topic: state.topic,
            resolve_proponent_profile: resolvedPropProfile === BEST_MATCH_SENTINEL,
            resolve_proponent_tone: resolvedPropTone === BEST_MATCH_SENTINEL,
            resolve_opponent_profile: resolvedOppProfile === BEST_MATCH_SENTINEL,
            resolve_opponent_tone: resolvedOppTone === BEST_MATCH_SENTINEL,
            current_proponent_profile: resolvedPropProfile !== BEST_MATCH_SENTINEL ? resolvedPropProfile : null,
            current_opponent_profile: resolvedOppProfile !== BEST_MATCH_SENTINEL ? resolvedOppProfile : null,
          }),
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          const resolved = await response.json();
          if (resolved.proponent_profile) resolvedPropProfile = resolved.proponent_profile;
          if (resolved.proponent_tone) resolvedPropTone = resolved.proponent_tone;
          if (resolved.opponent_profile) resolvedOppProfile = resolved.opponent_profile;
          if (resolved.opponent_tone) resolvedOppTone = resolved.opponent_tone;
        }
      } catch {
        // Fall back to random on failure
      }
      if (resolvedPropProfile === BEST_MATCH_SENTINEL) resolvedPropProfile = getRandomItem(profilesData).Movement;
      if (resolvedOppProfile === BEST_MATCH_SENTINEL) resolvedOppProfile = getRandomItem(profilesData.filter(p => p.Movement !== resolvedPropProfile)).Movement;
      if (resolvedPropTone === BEST_MATCH_SENTINEL) resolvedPropTone = getRandomItem(tonesData).tone;
      if (resolvedOppTone === BEST_MATCH_SENTINEL) resolvedOppTone = getRandomItem(tonesData).tone;
    }

    state.setProponentProfile(resolvedPropProfile);
    state.setProponentTone(resolvedPropTone);
    state.setOpponentProfile(resolvedOppProfile);
    state.setOpponentTone(resolvedOppTone);

    const moderatorLanguage = state.proponentLanguage === state.opponentLanguage ? state.proponentLanguage : "English";

    const params = new URLSearchParams({
      topic: state.topic,
      proponent_profile: resolvedPropProfile,
      proponent_tone: resolvedPropTone,
      proponent_language: state.proponentLanguage,
      opponent_profile: resolvedOppProfile,
      opponent_tone: resolvedOppTone,
      opponent_language: state.opponentLanguage,
      moderator_language: moderatorLanguage,
      fact_check: state.factCheckEnabled ? 'true' : 'false',
    });

    connect(`/api/debate/stream?${params.toString()}`);
  };

  const stopDebate = () => {
    disconnect();
    state.setStatus('finished');
    state.setPendingSpeaker(null);
  };

  const handleSendMessage = async () => {
    if (!state.debateId || !state.userMessage.trim() || state.status !== 'debating') return;
    state.setIsSending(true);
    try {
      await fetch(`/api/debate/${state.debateId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: state.userMessage }),
      });
      state.setUserMessage("");
    } catch (e) { console.error("Failed to send message", e); }
    finally { state.setIsSending(false); }
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
        body: JSON.stringify({ messages: state.messages }),
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
              if (mode === 'replace') {
                state.setFactChecks([...accumulated]);
              } else {
                state.setFactChecks(prev => [...(prev || []), ...evt.checks]);
              }
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
            } else if (evt.type === 'error') {
              console.warn('Fact-check partial error:', evt.message);
            }
          } catch { /* skip unparseable lines */ }
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
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#0F172A] font-sans text-slate-900 dark:text-gray-300">
      <Sidebar onNavigate={handleNavigate} activePanel={activePanel} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col">
        <TopNav onMenuToggle={() => setSidebarOpen(prev => !prev)} />

        <main className="flex-1 overflow-hidden flex flex-col p-4 md:p-8 max-w-7xl mx-auto w-full">

          {/* Dashboard Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6 md:mb-8">
            <div>
              <h1 className="text-xl md:text-3xl font-bold text-slate-900 dark:text-white mb-1">Debate Arena Dashboard</h1>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">Configure and monitor adversarial AI agent interactions.</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700">
                <span className={`w-2.5 h-2.5 rounded-full ${state.status === 'debating' ? 'bg-green-500 animate-pulse' : 'bg-gray-400 dark:bg-gray-500'}`}></span>
                <span className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide">
                  LIVE STATUS: {state.status === 'debating' ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
              {state.status === 'debating' && (
                <button onClick={stopDebate} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-red-900/20">
                  Stop Debate
                </button>
              )}
            </div>
          </div>

          {/* Agent Configuration */}
          <div className="flex flex-col md:flex-row gap-4 md:gap-6 mb-6 md:mb-8">
            <AgentCard
              name="Proponent" role="Proponent"
              status={state.status === 'debating' && state.pendingSpeaker === 'Proponent' ? 'Speaking' : 'Waiting'}
              profiles={profilesData} tones={tonesData} languages={languagesData}
              selectedProfile={state.proponentProfile} selectedTone={state.proponentTone} selectedLanguage={state.proponentLanguage}
              onProfileChange={state.setProponentProfile} onToneChange={state.setProponentTone} onLanguageChange={state.setProponentLanguage}
              isExpanded={state.areAgentDetailsExpanded} onToggleExpand={state.toggleAgentDetails}
              disabled={state.status === 'debating'}
            />
            <AgentCard
              name="Opponent" role="Opponent"
              status={state.status === 'debating' && state.pendingSpeaker === 'Opponent' ? 'Speaking' : 'Waiting'}
              profiles={profilesData} tones={tonesData} languages={languagesData}
              selectedProfile={state.opponentProfile} selectedTone={state.opponentTone} selectedLanguage={state.opponentLanguage}
              onProfileChange={state.setOpponentProfile} onToneChange={state.setOpponentTone} onLanguageChange={state.setOpponentLanguage}
              isExpanded={state.areAgentDetailsExpanded} onToggleExpand={state.toggleAgentDetails}
              disabled={state.status === 'debating'}
            />
          </div>

          {/* Topic Configuration - Visible when idle */}
          {state.status === 'idle' && (
            <div className="mb-6 md:mb-8 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-xl p-4 md:p-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Debate Topic</label>
                <button
                  onClick={() => {
                    const allTopics = topicsData.flatMap(c => c.topics);
                    state.setTopic(allTopics[Math.floor(Math.random() * allTopics.length)]);
                  }}
                  className="text-xs text-blue-500 hover:text-blue-400 font-medium transition-colors"
                >
                  Random Topic
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 relative">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={state.topic}
                    onChange={(e) => state.setTopic(e.target.value)}
                    onFocus={() => setShowTopicSuggestions(true)}
                    className="w-full bg-slate-50 dark:bg-[#0F172A] border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="Enter a topic or pick from suggestions..."
                  />
                  {showTopicSuggestions && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-20 max-h-80 overflow-y-auto">
                      {topicsData.map((cat) => (
                        <div key={cat.category}>
                          <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-slate-50 dark:bg-[#0F172A] sticky top-0">
                            {cat.category}
                          </div>
                          {cat.topics.map((t) => (
                            <button
                              key={t}
                              onClick={() => { state.setTopic(t); setShowTopicSuggestions(false); }}
                              className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      ))}
                      <button
                        onClick={() => setShowTopicSuggestions(false)}
                        className="w-full py-2 text-xs text-gray-400 hover:text-gray-300 border-t border-gray-200 dark:border-gray-700"
                      >
                        Close
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={startDebate}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold transition-all shadow-lg shadow-blue-900/20 hover:scale-105 active:scale-95 whitespace-nowrap"
                >
                  Start Debate
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
                <span className="text-sm font-medium text-slate-600 dark:text-gray-400">
                  Fact-check after debate
                </span>
              </div>
            </div>
          )}

          {/* Chat Section */}
          <div className="flex-1 flex flex-col bg-white dark:bg-[#020617] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden relative">

            {/* Topic Overlay */}
            <div className="absolute top-6 left-0 right-0 flex justify-center z-10">
              <div className="bg-slate-50/90 dark:bg-[#1E293B]/90 backdrop-blur border border-gray-200 dark:border-gray-700 text-blue-600 dark:text-blue-300 text-xs font-medium px-4 py-1.5 rounded-full shadow-lg">
                Debate Topic: <span className="text-slate-600 dark:text-gray-300 italic">{state.topic}</span>
              </div>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-16 md:pt-20 space-y-2 custom-scrollbar">
              {state.messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-20">
                  <div className="text-6xl mb-4 grayscale">💬</div>
                  <p className="text-slate-500 dark:text-gray-400">Ready to start debate simulation...</p>
                </div>
              )}
              {state.messages.map((msg, i) => (
                <DebateMessage key={i} speaker={msg.speaker} content={msg.content} turn={msg.turn} timestamp={msg.timestamp} agentNames={state.agentNames} />
              ))}
              {state.status === 'debating' && state.streamingMessage && (
                <DebateMessage speaker={state.streamingMessage.speaker} content={state.streamingMessage.content} turn={0} isStreaming agentNames={state.agentNames} />
              )}
              {state.status === 'debating' && state.pendingSpeaker && !state.streamingMessage && (
                <TypingIndicator speaker={state.pendingSpeaker} agentNames={state.agentNames} />
              )}
              {state.verdict && (
                <DecisionMatrix
                  data={state.verdict}
                  proponentRole={state.proponentProfile}
                  opponentRole={state.opponentProfile}
                  topic={state.topic}
                  proponentConfig={{ profile: state.proponentProfile, tone: state.proponentTone, language: state.proponentLanguage }}
                  opponentConfig={{ profile: state.opponentProfile, tone: state.opponentTone, language: state.opponentLanguage }}
                  messages={state.messages}
                  tokenUsage={state.tokenUsage}
                  totalWallTimeMs={state.debateStartTime ? Date.now() - state.debateStartTime : null}
                  agentNames={state.agentNames}
                  factChecks={state.factChecks}
                  isFactChecking={state.isFactChecking}
                  factCheckError={state.factCheckError}
                  factCheckProgress={state.factCheckProgress}
                  onRerunFactCheck={handleRerunFactCheck}
                  onSave={saveDebate}
                  onRestart={state.resetToIdle}
                />
              )}
            </div>

            {/* Input Area */}
            <div className="p-3 md:p-4 border-t border-gray-200 dark:border-gray-800 bg-slate-50 dark:bg-[#0F172A] flex gap-3 items-center">
              <input
                type="text"
                value={state.userMessage}
                onChange={(e) => state.setUserMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={state.status === 'debating' ? "Type a moderator instruction..." : "Waiting to start..."}
                disabled={state.status !== 'debating'}
                className="flex-1 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
              />
              <button
                onClick={handleSendMessage}
                disabled={state.status !== 'debating' || !state.userMessage.trim() || state.isSending}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white w-10 h-10 rounded-lg flex items-center justify-center transition-colors shadow-lg shadow-blue-900/20"
              >
                {state.isSending ? '...' : '➤'}
              </button>
            </div>

          </div>
        </main>
      </div>

      {/* Modals */}
      {activePanel === 'profiles' && (
        <ProfileBrowser
          profiles={profilesData}
          onClose={() => setActivePanel(null)}
          onSelectProfile={(movement, role) => {
            if (role === 'proponent') state.setProponentProfile(movement);
            else state.setOpponentProfile(movement);
          }}
          disabled={state.status === 'debating'}
        />
      )}

      {activePanel === 'scenarios' && (
        <SavedScenarios
          onClose={() => setActivePanel(null)}
          onLoad={(scenario) => {
            state.setProponentProfile(scenario.proponentProfile);
            state.setProponentTone(scenario.proponentTone);
            state.setOpponentProfile(scenario.opponentProfile);
            state.setOpponentTone(scenario.opponentTone);
          }}
          currentConfig={{
            proponentProfile: state.proponentProfile,
            proponentTone: state.proponentTone,
            opponentProfile: state.opponentProfile,
            opponentTone: state.opponentTone,
          }}
          disabled={state.status === 'debating'}
        />
      )}

      {activePanel === 'debates' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg shadow-2xl max-h-[90vh] md:max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">Saved Debates</h2>
              <button onClick={() => setActivePanel(null)} className="p-2 text-gray-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                &#10005;
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {savedDebatesList.length === 0 ? (
                <p className="text-center text-gray-500 py-8 text-sm">No saved debates yet. Complete a debate and click "Save Debate" to store it.</p>
              ) : (
                savedDebatesList.map((d) => (
                  <div key={d.id} className="bg-slate-50 dark:bg-[#0F172A] rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{d.topic}</p>
                        <p className="text-[10px] text-gray-500 mt-1">
                          {new Date(d.date).toLocaleDateString()} — {d.agentNames ? `${d.agentNames.proponent} vs ${d.agentNames.opponent}` : `${d.proponentConfig?.profile} vs ${d.opponentConfig?.profile}`}
                          {d.verdict && <span className={`ml-2 font-bold ${d.verdict.winner === 'Proponent' ? 'text-blue-400' : 'text-purple-400'}`}>{d.verdict.winner} wins</span>}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => loadDebate(d as SavedDebate & { id: string })} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                          Replay
                        </button>
                        <button onClick={() => deleteSavedDebate(d.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors">
                          &#10005;
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activePanel === 'help' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md shadow-2xl p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Help Center</h2>
              <button onClick={() => setActivePanel(null)} className="p-2 text-gray-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                ✕
              </button>
            </div>
            <div className="space-y-3 text-sm text-slate-600 dark:text-gray-400">
              <p><span className="font-semibold text-slate-900 dark:text-white">1. Configure agents</span> — Pick philosophical profiles and communication tones for each debater, or use Random / Best Match.</p>
              <p><span className="font-semibold text-slate-900 dark:text-white">2. Enter a topic</span> — Type a controversial question for the agents to debate.</p>
              <p><span className="font-semibold text-slate-900 dark:text-white">3. Start the debate</span> — Watch the agents argue in real-time. The moderator steers the discussion.</p>
              <p><span className="font-semibold text-slate-900 dark:text-white">4. Send instructions</span> — During a debate, type moderator instructions to redirect the conversation.</p>
              <p><span className="font-semibold text-slate-900 dark:text-white">5. Review the verdict</span> — After the debate, a Decision Matrix scores both sides and declares a winner.</p>
              <p><span className="font-semibold text-slate-900 dark:text-white">6. Save scenarios</span> — Save your favorite agent configurations for quick reuse.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
