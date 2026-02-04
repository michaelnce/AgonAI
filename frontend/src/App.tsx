import { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { AgentCard } from './components/AgentCard';
import { DebateMessage } from './components/DebateMessage';

interface Message {
  speaker: string;
  content: string;
  turn: number;
}

function App() {
  const [topic, setTopic] = useState("Is Universal Basic Income the best solution for AI-driven job displacement?");
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'debating' | 'finished' | 'error'>('idle');
  
  // Agent Configuration State
  const [proponentProfile, setProponentProfile] = useState("Analytical Scholar");
  const [proponentTone, setProponentTone] = useState("Assertive");
  const [opponentProfile, setOpponentProfile] = useState("Creative Disruptor");
  const [opponentTone, setOpponentTone] = useState("Socratic");

  const profiles = ["Analytical Scholar", "Creative Disruptor", "Empathetic Mediator", "Technocrat"];
  const tones = ["Assertive", "Socratic", "Emotional", "Formal", "Concise"];

  const eventSourceRef = useRef<EventSource | null>(null);

  const startDebate = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setMessages([]);
    setStatus('connecting');

    const params = new URLSearchParams({
      topic: topic,
      proponent_profile: proponentProfile,
      proponent_tone: proponentTone,
      opponent_profile: opponentProfile,
      opponent_tone: opponentTone
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
      } else if (data.type === 'error') {
        setStatus('error');
        es.close();
      }
    };

    es.onerror = (err) => {
      console.error("SSE Error:", err);
      setStatus('error');
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
    <div className="flex min-h-screen bg-[#0F172A] font-sans text-gray-300">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <TopNav />

        <main className="flex-1 overflow-hidden flex flex-col p-8 max-w-7xl mx-auto w-full">
          
          {/* Dashboard Header */}
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">Debate Arena Dashboard</h1>
              <p className="text-gray-400">Configure and monitor adversarial AI agent interactions.</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-full border border-gray-700">
                <span className={`w-2.5 h-2.5 rounded-full ${status === 'debating' ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
                <span className="text-xs font-bold text-gray-300 uppercase tracking-wide">
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
              status={status === 'debating' ? 'Speaking' : 'Waiting'} 
              profiles={profiles}
              tones={tones}
              selectedProfile={proponentProfile}
              selectedTone={proponentTone}
              onProfileChange={setProponentProfile}
              onToneChange={setProponentTone}
              disabled={status === 'debating'}
            />
            <AgentCard 
              name="Opponent" 
              role="Opponent" 
              status={status === 'debating' ? 'Waiting' : 'Speaking'}
              profiles={profiles}
              tones={tones}
              selectedProfile={opponentProfile}
              selectedTone={opponentTone}
              onProfileChange={setOpponentProfile}
              onToneChange={setOpponentTone}
              disabled={status === 'debating'}
            />
          </div>

          {/* Topic Configuration - Visible when idle */}
          {status === 'idle' && (
            <div className="mb-8 bg-[#1E293B] border border-gray-700 rounded-xl p-6">
               <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wide">Debate Topic</label>
               <input 
                  type="text" 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full bg-[#0F172A] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Enter a controversial topic for the agents to debate..."
               />
            </div>
          )}

          {/* Chat Section */}
          <div className="flex-1 flex flex-col bg-[#020617] rounded-xl border border-gray-800 overflow-hidden relative">
            
            {/* Topic Overlay */}
            <div className="absolute top-6 left-0 right-0 flex justify-center z-10">
              <div className="bg-[#1E293B]/90 backdrop-blur border border-gray-700 text-blue-300 text-xs font-medium px-4 py-1.5 rounded-full shadow-lg">
                Debate Topic: <span className="text-gray-300 italic">{topic}</span>
              </div>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-8 pt-16 space-y-2 custom-scrollbar">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-20">
                  <div className="text-6xl mb-4 grayscale">💬</div>
                  <p>Ready to start debate simulation...</p>
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
              {status === 'debating' && (
                 <div className="flex justify-center mt-4">
                   <span className="loading-dot"></span>
                 </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-800 bg-[#0F172A] flex gap-3 items-center">
              <button className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-800 transition-colors">
                <span className="text-xl">⊕</span>
              </button>
              <input 
                type="text" 
                placeholder="Type a moderator instruction or prompt..." 
                className="flex-1 bg-[#1E293B] border border-gray-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
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
