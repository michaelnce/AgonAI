import { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { AgentCard } from './components/AgentCard';
import { DebateMessage } from './components/DebateMessage';
import { TypingIndicator } from './components/TypingIndicator';
import { DecisionMatrix } from './components/DecisionMatrix';
import profilesData from './data/profiles.json';
import tonesData from './data/tones.json';
import languagesData from './data/languages.json';

interface Message {
  speaker: string;
  content: string;
  turn: number;
}

interface VerdictData {
  winner: 'Proponent' | 'Opponent';
  scores: {
    proponent: { logic: number; evidence: number; style: number };
    opponent: { logic: number; evidence: number; style: number };
  };
  reasoning: string;
}

function App() {
  const [topic, setTopic] = useState("Is Universal Basic Income the best solution for AI-driven job displacement?");
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'debating' | 'finished' | 'error'>('idle');
  const [pendingSpeaker, setPendingSpeaker] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<VerdictData | null>(null);

  // Agent Configuration State
  const [proponentProfile, setProponentProfile] = useState(profilesData[0].Movement);
  const [proponentTone, setProponentTone] = useState(tonesData[0].tone);
  const [proponentLanguage, setProponentLanguage] = useState(languagesData[0].name);

  const [opponentProfile, setOpponentProfile] = useState(profilesData[1].Movement);
  const [opponentTone, setOpponentTone] = useState(tonesData[1].tone);
  const [opponentLanguage, setOpponentLanguage] = useState(languagesData[0].name);

  const eventSourceRef = useRef<EventSource | null>(null);

  const startDebate = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setMessages([]);
    setVerdict(null);
    setStatus('connecting');
    setPendingSpeaker('Moderator'); // First speaker

    const params = new URLSearchParams({
      topic: topic,
      proponent_profile: proponentProfile,
      proponent_tone: proponentTone,
      proponent_language: proponentLanguage,
      opponent_profile: opponentProfile,
      opponent_tone: opponentTone,
      opponent_language: opponentLanguage
    });

    const url = `/api/debate/stream?${params.toString()}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      console.log("SSE connected");
    };

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'system') {
        if (data.content === 'connected') {
          setStatus('debating');
        } else if (data.content === 'finished') {
          setStatus('finished');
          setPendingSpeaker(null);
          es.close();
        }
      } else if (data.type === 'debate_update') {
        // Clean content to remove speaker prefix
        const cleanContent = data.content.replace(/^(Moderator|Proponent|Opponent):\s*/i, '').trim();

        setMessages(prev => [...prev, {
          speaker: data.speaker,
          content: cleanContent,
          turn: data.turn
        }]);

        // Logic to determine NEXT speaker based on WHO just spoke
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
      } else if (data.type === 'error') {
        setStatus('error');
        setPendingSpeaker(null);
        es.close();
      }
    };

    es.onerror = (err) => {
      console.error("SSE Error:", err);
      setStatus('error');
      setPendingSpeaker(null);
      es.close();
    };
  };

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

    return (
      <div className="flex min-h-screen bg-slate-50 dark:bg-[#0F172A] font-sans text-slate-900 dark:text-gray-300">
        <Sidebar />
  
        <div className="flex-1 flex flex-col">
          <TopNav />
  
          <main className="flex-1 overflow-hidden flex flex-col p-8 max-w-7xl mx-auto w-full">
            
            {/* Dashboard Header */}
            <div className="flex justify-between items-end mb-8">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">Debate Arena Dashboard</h1>
                <p className="text-gray-600 dark:text-gray-400">Configure and monitor adversarial AI agent interactions.</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700">
                  <span className={`w-2.5 h-2.5 rounded-full ${status === 'debating' ? 'bg-green-500 animate-pulse' : 'bg-gray-400 dark:bg-gray-500'}`}></span>
                  <span className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide">
                    LIVE STATUS: {status === 'debating' ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                <button
                  onClick={startDebate}
                  disabled={status === 'debating'}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-blue-900/20"
                >
                  Start Debate
                </button>
              </div>
            </div>
  
            {/* Agent Configuration */}
            <div className="flex gap-6 mb-8">
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
                            disabled={status === 'debating'}
                          />            </div>
  
            {/* Topic Configuration - Visible when idle */}
            {status === 'idle' && (
              <div className="mb-8 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Debate Topic</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#0F172A] border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Enter a controversial topic for the agents to debate..."
                />
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
              <div className="flex-1 overflow-y-auto p-8 pt-16 space-y-2 custom-scrollbar">
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
                  />
                ))}
                {status === 'debating' && pendingSpeaker && (
                  <TypingIndicator speaker={pendingSpeaker} />
                )}
                {verdict && (
                  <DecisionMatrix 
                    data={verdict} 
                    proponentRole={proponentProfile}
                    opponentRole={opponentProfile}
                    onRestart={() => {
                      setVerdict(null);
                      setMessages([]);
                      setStatus('idle');
                    }} 
                  />
                )}
              </div>
  
              {/* Input Area */}            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-slate-50 dark:bg-[#0F172A] flex gap-3 items-center">
              <button className="p-2 text-gray-400 hover:text-slate-900 dark:hover:text-white rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
                <span className="text-xl">⊕</span>
              </button>
              <input
                type="text"
                placeholder="Type a moderator instruction or prompt..."
                className="flex-1 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button className="bg-blue-600 hover:bg-blue-700 text-white w-10 h-10 rounded-lg flex items-center justify-center transition-colors">
                ➤
              </button>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
