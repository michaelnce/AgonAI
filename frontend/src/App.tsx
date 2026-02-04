import { useTheme } from './context/ThemeContext';

function App() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-300">
      <div className="container mx-auto px-4 py-8">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Debate Arena Scaffold</h1>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </button>
        </header>
        
        <main className="grid gap-6">
          <section className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <h2 className="text-xl font-semibold mb-4">Backend Status</h2>
            <p className="text-green-500 font-medium">✓ Ready to connect</p>
          </section>
          
          <section className="p-6 rounded-xl border border-gray-200 dark:border-gray-800">
            <h2 className="text-xl font-semibold mb-4">Instructions</h2>
            <ul className="list-disc list-inside space-y-2 opacity-80">
              <li>Theme persistence enabled</li>
              <li>Tailwind v4 integrated</li>
              <li>React Context for state management</li>
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;