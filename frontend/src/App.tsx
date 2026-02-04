import { useState } from 'react';
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
  const [topic] = useState("The future of AI Safety and Alignment");
  const [messages] = useState<Message[]>([
    {
      speaker: "Moderator",
      content: "Welcome to today's debate on AI Safety. We have two distinguished experts to discuss this critical topic.",
      turn: 1
    },
    {
      speaker: "Proponent",
      content: "I argue that AI alignment is the most pressing technical challenge of our century. Without formal verification and robust safety frameworks, we risk creating systems that do not share human values.",
      turn: 2
    },
    {
      speaker: "Opponent",
      content: "While safety is important, we must not let existential fear stifle innovation. The real risks today are bias and misuse, not rogue AGI. We need practical guardrails, not just theoretical alignment.",
      turn: 3
    }
  ]);

  const [currentSpeaker] = useState("Opponent");

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
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm shadow-blue-500/20">
              New Debate
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
              name="Alice" 
              role="Moderator" 
              status={currentSpeaker === 'Moderator' ? 'Speaking' : 'Waiting'} 
            />
            <AgentCard 
              name="Bob" 
              role="Proponent" 
              status={currentSpeaker === 'Proponent' ? 'Speaking' : 'Waiting'} 
            />
            <AgentCard 
              name="Charlie" 
              role="Opponent" 
              status={currentSpeaker === 'Opponent' ? 'Speaking' : 'Waiting'} 
            />
          </div>

          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/50">
            <h3 className="text-sm font-bold text-blue-800 dark:text-blue-400 mb-2">Current Topic</h3>
            <p className="text-sm leading-relaxed opacity-80 italic">"{topic}"</p>
          </div>
        </aside>

        {/* Main Content - Debate Feed */}
        <section className="lg:col-span-3 flex flex-col min-h-[calc(100vh-12rem)]">
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {messages.map((msg, i) => (
              <DebateMessage 
                key={i} 
                speaker={msg.speaker} 
                content={msg.content} 
                turn={msg.turn} 
              />
            ))}
            {/* Typing indicator could go here */}
          </div>
          
          {/* Input/Status area */}
          <div className="mt-8 p-1 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-none">
            <div className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 text-sm opacity-50 italic">
                {currentSpeaker} is thinking...
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
        </section>
      </main>
    </div>
  );
}

export default App;
