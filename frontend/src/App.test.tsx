import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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
});
