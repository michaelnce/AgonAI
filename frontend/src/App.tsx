import { useState, useEffect, useRef } from 'react';
import { useTheme } from './context/ThemeContext';
import { AgentCard } from './components/AgentCard';
import { DebateMessage } from './components/DebateMessage';

interface Message {
  speaker: string;
  content: string;
  turn: number;
}

function App() {
  const { theme, toggleTheme } = useTheme();
  const [topic, setTopic] = useState("The future of AI Safety and Alignment");
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<string>("Moderator");
  const [status, setStatus] = useState<'idle' | 'connecting' | 'debating' | 'finished' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);

  const startDebate = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setMessages([]);
    setError(null);
    setStatus('connecting');
    setCurrentSpeaker('Moderator');

    // In a real app, we'd encode the topic as a query param
    const url = `/api/debate/stream?topic=${encodeURIComponent(topic)}`;
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
        setMessages(prev => [...prev, {
          speaker: data.speaker,
          content: data.content,
          turn: data.turn
        }]);
        
        // Infer next speaker or current speaker from the message
        // The backend sends 'speaker' as the one who just spoke.
        // We'll update the active state.
        setCurrentSpeaker(data.speaker);
      } else if (data.type === 'error') {
        setError(data.content);
        setStatus('error');
        es.close();
      }
    };

    es.onerror = (err) => {
      console.error("SSE Error:", err);
      setError("Failed to connect to debate stream.");
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">D</div>
            <h1 className="font-bold text-lg tracking-tight">DebateAI</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Toggle Theme"
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button 
              onClick={startDebate}
              disabled={status === 'connecting' || status === 'debating'}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm shadow-blue-500/20"
            >
              {status === 'idle' || status === 'finished' || status === 'error' ? 'Start Debate' : 'Debating...'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Sidebar - Agents */}
        <aside className="lg:col-span-1 space-y-6">
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest opacity-50 px-1">Participants</h2>
            <AgentCard 
              name="Moderator" 
              role="Moderator" 
              status={status === 'debating' && currentSpeaker.toLowerCase().includes('moderator') ? 'Speaking' : 'Waiting'} 
            />
            <AgentCard 
              name="Proponent" 
              role="Proponent" 
              status={status === 'debating' && currentSpeaker.toLowerCase().includes('proponent') ? 'Speaking' : 'Waiting'} 
            />
            <AgentCard 
              name="Opponent" 
              role="Opponent" 
              status={status === 'debating' && currentSpeaker.toLowerCase().includes('opponent') ? 'Speaking' : 'Waiting'} 
            />
          </div>

          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/50">
            <h3 className="text-sm font-bold text-blue-800 dark:text-blue-400 mb-2">Topic</h3>
            <input 
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={status === 'debating'}
              className="w-full bg-transparent text-sm border-b border-blue-200 dark:border-blue-800 focus:border-blue-500 outline-none pb-1 transition-colors"
            />
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/50 text-red-600 dark:text-red-400 text-sm">
              <h3 className="font-bold mb-1">Error</h3>
              <p>{error}</p>
            </div>
          )}
        </aside>

        {/* Main Content - Debate Feed */}
        <section className="lg:col-span-3 flex flex-col min-h-[calc(100vh-12rem)]">
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {messages.length === 0 && status === 'idle' && (
              <div className="h-full flex flex-col items-center justify-center opacity-30 text-center">
                <div className="text-6xl mb-4">🎤</div>
                <p>Enter a topic and click Start Debate</p>
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
          </div>
          
          {/* Status area */}
          {(status === 'connecting' || status === 'debating') && (
            <div className="mt-8 p-1 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-none">
              <div className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 text-sm opacity-50 italic">
                  {status === 'connecting' ? 'Connecting to arena...' : `${currentSpeaker} is responding...`}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                     <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]"></span>
                     <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]"></span>
                     <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce"></span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;