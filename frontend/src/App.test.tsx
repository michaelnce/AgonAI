import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';

describe('App Component', () => {
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

    // Emit a debate update
    await act(async () => {
      MockEventSource.lastInstance.emit({ 
        type: 'debate_update', 
        speaker: 'Proponent', 
        content: 'Hello World', 
        turn: 1 
      });
    });

    expect(screen.getByText(/Hello World/i)).toBeInTheDocument();
  });
});
