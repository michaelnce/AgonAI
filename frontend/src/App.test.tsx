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
    expect(screen.getByText(/DebateAI/i)).toBeInTheDocument();
    expect(screen.getByText(/Participants/i)).toBeInTheDocument();
  });

  it('toggles theme when button is clicked', () => {
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );
    
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

    expect(screen.getByText(/Connecting to arena/i)).toBeInTheDocument();

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

    // Emit a debate update
    await act(async () => {
      MockEventSource.lastInstance.emit({ 
        type: 'debate_update', 
        speaker: 'Moderator', 
        content: 'Hello World', 
        turn: 1 
      });
    });

    expect(screen.getByText(/Hello World/i)).toBeInTheDocument();
    expect(screen.getByText(/Moderator is responding/i)).toBeInTheDocument();
  });
});
