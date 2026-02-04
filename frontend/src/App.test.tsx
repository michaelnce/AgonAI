import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';

describe('App Component', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.spyOn(Math, 'random').mockRestore();
  });

  it('renders correctly', () => {
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );
    expect(screen.getByText(/Debate Arena Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Configure and monitor/i)).toBeInTheDocument();
  });

  it('toggles theme when button is clicked', () => {
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );
    
    // TopNav has the theme toggle
    const toggleButton = screen.getByTitle(/Toggle Theme/i);
    const initialText = toggleButton.textContent;
    
    fireEvent.click(toggleButton);
    expect(toggleButton.textContent).not.toBe(initialText);
  });

  it('starts debate and displays messages', async () => {
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );

    const startButton = screen.getByRole('button', { name: /Start Debate/i });
    fireEvent.click(startButton);
    
    // Access the mocked instance
    const MockEventSource = (window as any).MockEventSource;
    
    // Wait for onopen
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    // Emit connection event
    await act(async () => {
      MockEventSource.lastInstance.emit({ type: 'system', content: 'connected' });
    });

    // Now status should be active
    expect(screen.getByText(/LIVE STATUS: ACTIVE/i)).toBeInTheDocument();

    // Emit a debate update with prefix
    await act(async () => {
      MockEventSource.lastInstance.emit({ 
        type: 'debate_update', 
        speaker: 'Proponent', 
        content: 'Proponent: Hello World', 
        turn: 1 
      });
    });

    // Should NOT have prefix
    expect(screen.getByText(/Hello World/i)).toBeInTheDocument();
    expect(screen.queryByText(/Proponent: Hello World/i)).not.toBeInTheDocument();

    // After proponent speaks, next is Opponent
    const opponentThinking = screen.getAllByText(/Opponent/i);
    expect(opponentThinking.length).toBeGreaterThan(0);
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
  });

  it('displays verdict when debate concludes', async () => {
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );

    const startButton = screen.getByRole('button', { name: /Start Debate/i });
    fireEvent.click(startButton);
    
    const MockEventSource = (window as any).MockEventSource;
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    
    // Emit verdict
    const verdictData = JSON.stringify({
      winner: 'Proponent',
      scores: {
        proponent: { logic: 9, evidence: 8, style: 9 },
        opponent: { logic: 7, evidence: 6, style: 8 }
      },
      reasoning: 'Proponent was more logical.'
    });

    await act(async () => {
      MockEventSource.lastInstance.emit({ type: 'verdict', content: verdictData });
    });

    expect(screen.getByText(/Final Judgment/i)).toBeInTheDocument();
    expect(screen.getByText(/Rationalism Wins/i)).toBeInTheDocument();
    expect(screen.getByText(/Proponent was more logical/i)).toBeInTheDocument();

    // Test Reset
    const resetButton = screen.getByRole('button', { name: /Reset Arena/i });
    fireEvent.click(resetButton);
    expect(screen.queryByText(/Final Judgment/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hello World/i)).not.toBeInTheDocument();
  });
});
