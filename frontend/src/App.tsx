import { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { AgentCard } from './components/AgentCard';
import { DebateMessage } from './components/DebateMessage';
import { TypingIndicator } from './components/TypingIndicator';
import { DecisionMatrix } from './components/DecisionMatrix';
import { ProfileBrowser } from './components/ProfileBrowser';
import { SavedScenarios } from './components/SavedScenarios';
import profilesData from './data/profiles.json';
import tonesData from './data/tones.json';
import languagesData from './data/languages.json';
import topicsData from './data/topics.json';

interface Message {
  speaker: string;
  content: string;
  turn: number;
  timestamp?: string;
}

interface VerdictData {
  winner: 'Proponent' | 'Opponent';
  scores: {
    proponent: { logic: number; evidence: number; style: number };
    opponent: { logic: number; evidence: number; style: number };
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

interface SavedDebate {
  id: string;
  date: string;
  topic: string;
  proponentConfig: { profile: string; tone: string; language: string };
  opponentConfig: { profile: string; tone: string; language: string };
  agentNames: { proponent: string; opponent: string } | null;
  messages: Message[];
  verdict: VerdictData | null;
  factChecks: FactCheck[] | null;
  tokenUsage: TokenUsageData | null;
  totalWallTimeMs: number | null;
}

// Utility for random selection
const getRandomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function App() {
  const [topic, setTopic] = useState("Is Universal Basic Income the best solution for AI-driven job displacement?");
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'debating' | 'finished' | 'error'>('idle');
  const [pendingSpeaker, setPendingSpeaker] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<VerdictData | null>(null);
  const [debateId, setDebateId] = useState<string | null>(null);
  const [userMessage, setUserMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<TokenUsageData | null>(null);
  const [debateStartTime, setDebateStartTime] = useState<number | null>(null);
  const [agentNames, setAgentNames] = useState<{ proponent: string; opponent: string } | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<{ speaker: string; content: string } | null>(null);
  const [factChecks, setFactChecks] = useState<FactCheck[] | null>(null);
  const [isFactChecking, setIsFactChecking] = useState(false);
  const [factCheckError, setFactCheckError] = useState<string | null>(null);
  const [showTopicSuggestions, setShowTopicSuggestions] = useState(false);

  // Agent Configuration State - Default to Random
  const [proponentProfile, setProponentProfile] = useState("__random__");
  const [proponentTone, setProponentTone] = useState("__random__");
  const [proponentLanguage, setProponentLanguage] = useState("English");

  const [opponentProfile, setOpponentProfile] = useState("__random__");
  const [opponentTone, setOpponentTone] = useState("__random__");
  const [opponentLanguage, setOpponentLanguage] = useState("English");

  const [areAgentDetailsExpanded, setAreAgentDetailsExpanded] = useState(false);
  const toggleAgentDetails = () => setAreAgentDetailsExpanded(prev => !prev);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const handleNavigate = (panel: string) => {
    if (panel === 'current') {
      setActivePanel(null);
    } else if (panel === 'help') {
      setActivePanel('help');
    } else {
      setActivePanel(panel);
    }
  };

  const eventSourceRef = useRef<EventSource | null>(null);

  const RANDOM_SENTINEL = "__random__";
  const BEST_MATCH_SENTINEL = "__best_match__";

  const startDebate = async () => {
    console.log("[DEBATE] startDebate called");
    console.log("[DEBATE] Current selections:", { proponentProfile, proponentTone, opponentProfile, opponentTone });

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setMessages([]);
    setVerdict(null);
    setTokenUsage(null);
    setAgentNames(null);
    setStreamingMessage(null);
    setFactChecks(null);
    setIsFactChecking(false);
    setFactCheckError(null);
    setDebateStartTime(Date.now());
    setStatus('connecting');
    setPendingSpeaker('Moderator'); // First speaker

    // Resolve sentinel values before starting
    let resolvedPropProfile = proponentProfile;
    let resolvedPropTone = proponentTone;
    let resolvedOppProfile = opponentProfile;
    let resolvedOppTone = opponentTone;

    // Random resolution (local)
    if (resolvedPropProfile === RANDOM_SENTINEL) {
      resolvedPropProfile = getRandomItem(profilesData).Movement;
    }
    if (resolvedOppProfile === RANDOM_SENTINEL) {
      resolvedOppProfile = getRandomItem(
        profilesData.filter(p => p.Movement !== resolvedPropProfile)
      ).Movement;
    }
    if (resolvedPropTone === RANDOM_SENTINEL) {
      resolvedPropTone = getRandomItem(tonesData).tone;
    }
    if (resolvedOppTone === RANDOM_SENTINEL) {
      resolvedOppTone = getRandomItem(tonesData).tone;
    }

    // Best Match resolution (backend LLM call)
    const needsBestMatch = [resolvedPropProfile, resolvedPropTone, resolvedOppProfile, resolvedOppTone]
      .includes(BEST_MATCH_SENTINEL);

    if (needsBestMatch) {
      console.log("[DEBATE] Best match needed, calling backend...");
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);
        const response = await fetch('/api/debate/resolve-best-match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            topic,
            resolve_proponent_profile: resolvedPropProfile === BEST_MATCH_SENTINEL,
            resolve_proponent_tone: resolvedPropTone === BEST_MATCH_SENTINEL,
            resolve_opponent_profile: resolvedOppProfile === BEST_MATCH_SENTINEL,
            resolve_opponent_tone: resolvedOppTone === BEST_MATCH_SENTINEL,
            current_proponent_profile: resolvedPropProfile,
            current_opponent_profile: resolvedOppProfile,
          }),
        });
        clearTimeout(timeoutId);
        const resolved = await response.json();
        console.log("[DEBATE] Best match resolved:", resolved);
        if (resolved.proponent_profile) resolvedPropProfile = resolved.proponent_profile;
        if (resolved.proponent_tone) resolvedPropTone = resolved.proponent_tone;
        if (resolved.opponent_profile) resolvedOppProfile = resolved.opponent_profile;
        if (resolved.opponent_tone) resolvedOppTone = resolved.opponent_tone;
      } catch (e) {
        console.warn("Best match failed, falling back to random:", e);
        if (resolvedPropProfile === BEST_MATCH_SENTINEL) resolvedPropProfile = getRandomItem(profilesData).Movement;
        if (resolvedOppProfile === BEST_MATCH_SENTINEL) resolvedOppProfile = getRandomItem(profilesData.filter(p => p.Movement !== resolvedPropProfile)).Movement;
        if (resolvedPropTone === BEST_MATCH_SENTINEL) resolvedPropTone = getRandomItem(tonesData).tone;
        if (resolvedOppTone === BEST_MATCH_SENTINEL) resolvedOppTone = getRandomItem(tonesData).tone;
      }
    }

    // Update UI to show resolved values
    console.log("[DEBATE] Final resolved config:", { resolvedPropProfile, resolvedPropTone, resolvedOppProfile, resolvedOppTone });
    setProponentProfile(resolvedPropProfile);
    setProponentTone(resolvedPropTone);
    setOpponentProfile(resolvedOppProfile);
    setOpponentTone(resolvedOppTone);

    // If both agents share the same language, moderator uses it too
    const moderatorLanguage = proponentLanguage === opponentLanguage ? proponentLanguage : "English";

    const params = new URLSearchParams({
      topic: topic,
      proponent_profile: resolvedPropProfile,
      proponent_tone: resolvedPropTone,
      proponent_language: proponentLanguage,
      opponent_profile: resolvedOppProfile,
      opponent_tone: resolvedOppTone,
      opponent_language: opponentLanguage,
      moderator_language: moderatorLanguage
    });

    const url = `/api/debate/stream?${params.toString()}`;
    console.log("[DEBATE] Opening SSE connection:", url);
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      console.log("[DEBATE] SSE connection opened");
    };

    es.onmessage = (event) => {
      console.log("[DEBATE] SSE message received:", event.data.substring(0, 100));
      const data = JSON.parse(event.data);

      if (data.type === 'system') {
        if (data.content === 'connected') {
          setStatus('debating');
          if (data.debate_id) {
            setDebateId(data.debate_id);
          }
        } else if (data.content === 'fact_checking') {
          setIsFactChecking(true);
        } else if (data.content === 'finished') {
          setIsFactChecking(false);
          setStatus('finished');
          setPendingSpeaker(null);
          es.close();
        }
      } else if (data.type === 'stream_chunk') {
        // Partial token from LLM — append to streaming message
        const speaker = data.speaker;
        setPendingSpeaker(null); // Hide typing indicator, show streaming text instead
        setStreamingMessage(prev => {
          if (prev && prev.speaker === speaker) {
            return { speaker, content: prev.content + data.chunk };
          }
          return { speaker, content: data.chunk };
        });
      } else if (data.type === 'stream_end') {
        // Node finished — commit the full message and clear streaming state
        const cleanContent = data.content.replace(/^(Moderator|Proponent|Opponent):\s*/i, '').trim();
        setStreamingMessage(null);
        setMessages(prev => [...prev, {
          speaker: data.speaker,
          content: cleanContent,
          turn: data.turn,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);

        // Set next speaker for typing indicator
        const current = data.speaker.toLowerCase();
        if (current.includes('moderator')) setPendingSpeaker('Proponent');
        else if (current.includes('proponent')) setPendingSpeaker('Opponent');
        else if (current.includes('opponent')) setPendingSpeaker('Proponent');
      } else if (data.type === 'debate_update') {
        // Fallback for non-streaming (Ollama provider)
        const cleanContent = data.content.replace(/^(Moderator|Proponent|Opponent):\s*/i, '').trim();
        setMessages(prev => [...prev, {
          speaker: data.speaker,
          content: cleanContent,
          turn: data.turn,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        const current = data.speaker.toLowerCase();
        if (current.includes('moderator')) setPendingSpeaker('Proponent');
        else if (current.includes('proponent')) setPendingSpeaker('Opponent');
        else if (current.includes('opponent')) setPendingSpeaker('Proponent');
      } else if (data.type === 'verdict') {
        try {
          const verdictJson = JSON.parse(data.content);
          setVerdict(verdictJson);
          setStatus('finished');
          setPendingSpeaker(null);
        } catch (e) {
          console.error("Failed to parse verdict", e);
        }
      } else if (data.type === 'agent_names') {
        setAgentNames({ proponent: data.proponent_name, opponent: data.opponent_name });
      } else if (data.type === 'fact_check') {
        try {
          const checks = JSON.parse(data.content);
          setFactChecks(checks);
          setIsFactChecking(false);
        } catch (e) {
          console.error("Failed to parse fact-check", e);
          setIsFactChecking(false);
        }
      } else if (data.type === 'fact_check_error') {
        console.warn("Fact-check failed:", data.content);
        setIsFactChecking(false);
      } else if (data.type === 'token_usage') {
        setTokenUsage(data.content);
      } else if (data.type === 'error') {
        setStatus('error');
        setPendingSpeaker(null);
        es.close();
      }
    };

    es.onerror = (err) => {
      console.error("[DEBATE] SSE Error:", err, "readyState:", es.readyState);
      setStatus('error');
      setPendingSpeaker(null);
      es.close();
    };
  };

  const stopDebate = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStatus('finished');
    setPendingSpeaker(null);
  };

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // --- Debate save/load ---
  const saveDebate = () => {
    if (!verdict || messages.length === 0) return;
    const saved: SavedDebate = {
      id: debateId || crypto.randomUUID(),
      date: new Date().toISOString(),
      topic,
      proponentConfig: { profile: proponentProfile, tone: proponentTone, language: proponentLanguage },
      opponentConfig: { profile: opponentProfile, tone: opponentTone, language: opponentLanguage },
      agentNames,
      messages,
      verdict,
      factChecks,
      tokenUsage,
      totalWallTimeMs: debateStartTime ? Date.now() - debateStartTime : null,
    };
    const existing: SavedDebate[] = JSON.parse(localStorage.getItem('savedDebates') || '[]');
    // Don't duplicate
    const filtered = existing.filter(d => d.id !== saved.id);
    filtered.unshift(saved);
    // Keep max 20
    localStorage.setItem('savedDebates', JSON.stringify(filtered.slice(0, 20)));
    alert('Debate saved!');
  };

  const loadDebate = (saved: SavedDebate) => {
    setTopic(saved.topic);
    setProponentProfile(saved.proponentConfig.profile);
    setProponentTone(saved.proponentConfig.tone);
    setProponentLanguage(saved.proponentConfig.language);
    setOpponentProfile(saved.opponentConfig.profile);
    setOpponentTone(saved.opponentConfig.tone);
    setOpponentLanguage(saved.opponentConfig.language);
    setAgentNames(saved.agentNames);
    setMessages(saved.messages);
    setVerdict(saved.verdict);
    setFactChecks(saved.factChecks);
    setTokenUsage(saved.tokenUsage);
    setDebateStartTime(null);
    setStatus('finished');
    setActivePanel(null);
  };

  const handleSendMessage = async () => {
    if (!debateId || !userMessage.trim() || status !== 'debating') return;

    setIsSending(true);
    try {
      await fetch(`/api/debate/${debateId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: userMessage })
      });
      setUserMessage("");
    } catch (e) {
      console.error("Failed to send message", e);
    } finally {
      setIsSending(false);
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
                <span className={`w-2.5 h-2.5 rounded-full ${status === 'debating' ? 'bg-green-500 animate-pulse' : 'bg-gray-400 dark:bg-gray-500'}`}></span>
                <span className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide">
                  LIVE STATUS: {status === 'debating' ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
              {status === 'debating' && (
                <button
                  onClick={stopDebate}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-red-900/20"
                >
                  Stop Debate
                </button>
              )}
            </div>
          </div>
          {/* Agent Configuration */}
          <div className="flex flex-col md:flex-row gap-4 md:gap-6 mb-6 md:mb-8">
            <AgentCard
              name="Proponent"
              role="Proponent"
              status={status === 'debating' && pendingSpeaker === 'Proponent' ? 'Speaking' : 'Waiting'}
              profiles={profilesData}
              tones={tonesData}
              languages={languagesData}
              selectedProfile={proponentProfile}
              selectedTone={proponentTone}
              selectedLanguage={proponentLanguage}
              onProfileChange={setProponentProfile}
              onToneChange={setProponentTone}
              onLanguageChange={setProponentLanguage}
              isExpanded={areAgentDetailsExpanded}
              onToggleExpand={toggleAgentDetails}
              disabled={status === 'debating'}
            />
            <AgentCard
              name="Opponent"
              role="Opponent"
              status={status === 'debating' && pendingSpeaker === 'Opponent' ? 'Speaking' : 'Waiting'}
              profiles={profilesData}
              tones={tonesData}
              languages={languagesData}
              selectedProfile={opponentProfile}
              selectedTone={opponentTone}
              selectedLanguage={opponentLanguage}
              onProfileChange={setOpponentProfile}
              onToneChange={setOpponentTone}
              onLanguageChange={setOpponentLanguage}
              isExpanded={areAgentDetailsExpanded}
              onToggleExpand={toggleAgentDetails}
              disabled={status === 'debating'}
            />            </div>


          {/* Topic Configuration - Visible when idle */}
          {status === 'idle' && (
            <div className="mb-6 md:mb-8 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-xl p-4 md:p-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Debate Topic</label>
                <button
                  onClick={() => {
                    const allTopics = topicsData.flatMap(c => c.topics);
                    setTopic(allTopics[Math.floor(Math.random() * allTopics.length)]);
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
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
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
                              onClick={() => { setTopic(t); setShowTopicSuggestions(false); }}
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
            </div>
          )}

          {/* Chat Section */}
          <div className="flex-1 flex flex-col bg-white dark:bg-[#020617] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden relative">

            {/* Topic Overlay */}
            <div className="absolute top-6 left-0 right-0 flex justify-center z-10">
              <div className="bg-slate-50/90 dark:bg-[#1E293B]/90 backdrop-blur border border-gray-200 dark:border-gray-700 text-blue-600 dark:text-blue-300 text-xs font-medium px-4 py-1.5 rounded-full shadow-lg">
                Debate Topic: <span className="text-slate-600 dark:text-gray-300 italic">{topic}</span>
              </div>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-16 md:pt-20 space-y-2 custom-scrollbar">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-20">
                  <div className="text-6xl mb-4 grayscale">💬</div>
                  <p className="text-slate-500 dark:text-gray-400">Ready to start debate simulation...</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <DebateMessage
                  key={i}
                  speaker={msg.speaker}
                  content={msg.content}
                  turn={msg.turn}
                  timestamp={msg.timestamp}
                  agentNames={agentNames}
                />
              ))}
              {status === 'debating' && streamingMessage && (
                <DebateMessage
                  speaker={streamingMessage.speaker}
                  content={streamingMessage.content}
                  turn={0}
                  agentNames={agentNames}
                />
              )}
              {status === 'debating' && pendingSpeaker && !streamingMessage && (
                <TypingIndicator speaker={pendingSpeaker} />
              )}
              {verdict && (
                <DecisionMatrix
                  data={verdict}
                  proponentRole={proponentProfile}
                  opponentRole={opponentProfile}
                  topic={topic}
                  proponentConfig={{
                    profile: proponentProfile,
                    tone: proponentTone,
                    language: proponentLanguage
                  }}
                  opponentConfig={{
                    profile: opponentProfile,
                    tone: opponentTone,
                    language: opponentLanguage
                  }}
                  messages={messages}
                  tokenUsage={tokenUsage}
                  totalWallTimeMs={debateStartTime ? Date.now() - debateStartTime : null}
                  agentNames={agentNames}
                  factChecks={factChecks}
                  isFactChecking={isFactChecking}
                  factCheckError={factCheckError}
                  onRerunFactCheck={async (mode) => {
                    setIsFactChecking(true);
                    setFactCheckError(null);
                    try {
                      const response = await fetch('/api/debate/fact-check', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ messages }),
                      });
                      const data = await response.json();
                      if (response.ok && data.fact_checks) {
                        if (mode === 'replace') {
                          setFactChecks(data.fact_checks);
                        } else {
                          setFactChecks(prev => [...(prev || []), ...data.fact_checks]);
                        }
                        setFactCheckError(null);
                      } else {
                        const errMsg = data.detail || 'Fact-check failed';
                        console.error('Fact-check failed:', errMsg);
                        setFactCheckError(errMsg);
                      }
                    } catch (e) {
                      const errMsg = `Fact-check request failed: ${e}`;
                      console.error(errMsg);
                      setFactCheckError(errMsg);
                    } finally {
                      setIsFactChecking(false);
                    }
                  }}
                  onSave={saveDebate}
                  onRestart={() => {
                    setVerdict(null);
                    setMessages([]);
                    setTokenUsage(null);
                    setAgentNames(null);
                    setFactChecks(null);
                    setDebateStartTime(null);
                    setStatus('idle');
                  }}
                />
              )}
            </div>

            {/* Input Area */}
            <div className="p-3 md:p-4 border-t border-gray-200 dark:border-gray-800 bg-slate-50 dark:bg-[#0F172A] flex gap-3 items-center">
              <input
                type="text"
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={status === 'debating' ? "Type a moderator instruction..." : "Waiting to start..."}
                disabled={status !== 'debating'}
                className="flex-1 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
              />
              <button
                onClick={handleSendMessage}
                disabled={status !== 'debating' || !userMessage.trim() || isSending}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white w-10 h-10 rounded-lg flex items-center justify-center transition-colors shadow-lg shadow-blue-900/20"
              >
                {isSending ? '...' : '➤'}
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
            if (role === 'proponent') setProponentProfile(movement);
            else setOpponentProfile(movement);
          }}
          disabled={status === 'debating'}
        />
      )}

      {activePanel === 'scenarios' && (
        <SavedScenarios
          onClose={() => setActivePanel(null)}
          onLoad={(scenario) => {
            setProponentProfile(scenario.proponentProfile);
            setProponentTone(scenario.proponentTone);
            setOpponentProfile(scenario.opponentProfile);
            setOpponentTone(scenario.opponentTone);
          }}
          currentConfig={{
            proponentProfile,
            proponentTone,
            opponentProfile,
            opponentTone,
          }}
          disabled={status === 'debating'}
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
              {(() => {
                const saved: SavedDebate[] = JSON.parse(localStorage.getItem('savedDebates') || '[]');
                if (saved.length === 0) {
                  return <p className="text-center text-gray-500 py-8 text-sm">No saved debates yet. Complete a debate and click "Save Debate" to store it.</p>;
                }
                return saved.map((d) => (
                  <div key={d.id} className="bg-slate-50 dark:bg-[#0F172A] rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{d.topic}</p>
                        <p className="text-[10px] text-gray-500 mt-1">
                          {new Date(d.date).toLocaleDateString()} — {d.agentNames ? `${d.agentNames.proponent} vs ${d.agentNames.opponent}` : `${d.proponentConfig.profile} vs ${d.opponentConfig.profile}`}
                          {d.verdict && <span className={`ml-2 font-bold ${d.verdict.winner === 'Proponent' ? 'text-blue-400' : 'text-purple-400'}`}>{d.verdict.winner} wins</span>}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => loadDebate(d)}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                        >
                          Replay
                        </button>
                        <button
                          onClick={() => {
                            const existing: SavedDebate[] = JSON.parse(localStorage.getItem('savedDebates') || '[]');
                            localStorage.setItem('savedDebates', JSON.stringify(existing.filter(x => x.id !== d.id)));
                            setActivePanel(null);
                            setTimeout(() => setActivePanel('debates'), 0);
                          }}
                          className="text-xs text-red-400 hover:text-red-300 px-2 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                        >
                          &#10005;
                        </button>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {activePanel === 'help' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md shadow-2xl p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Help Center</h2>
              <button
                onClick={() => setActivePanel(null)}
                className="p-2 text-gray-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
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
