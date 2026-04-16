import { useRef, useEffect, useCallback } from 'react';
import type { Message, VerdictData, TokenUsageData } from '../types';

interface SSEHandlers {
  setStatus: (s: 'idle' | 'connecting' | 'debating' | 'finished' | 'error') => void;
  setDebateId: (id: string | null) => void;
  setPendingSpeaker: (s: string | null) => void;
  setStreamingMessage: (fn: React.SetStateAction<{ speaker: string; content: string } | null>) => void;
  setMessages: (fn: React.SetStateAction<Message[]>) => void;
  setVerdict: (v: VerdictData | null) => void;
  setAgentNames: (names: { proponent: string; opponent: string } | null) => void;
  setFactChecks: (fn: React.SetStateAction<import('../types').FactCheck[] | null>) => void;
  setIsFactChecking: (v: boolean) => void;
  setTokenUsage: (fn: React.SetStateAction<TokenUsageData | null>) => void;
}

export function useSSEConnection(handlers: SSEHandlers) {
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleSSEMessage = useCallback((event: MessageEvent) => {
    const data = JSON.parse(event.data);

    if (data.type === 'system') {
      if (data.content === 'connected') {
        handlers.setStatus('debating');
        if (data.debate_id) handlers.setDebateId(data.debate_id);
      } else if (data.content === 'fact_checking') {
        handlers.setIsFactChecking(true);
      } else if (data.content === 'finished') {
        handlers.setIsFactChecking(false);
        handlers.setStatus('finished');
        handlers.setPendingSpeaker(null);
        eventSourceRef.current?.close();
      }
    } else if (data.type === 'stream_chunk') {
      handlers.setPendingSpeaker(null);
      handlers.setStreamingMessage(prev => {
        if (prev && prev.speaker === data.speaker) {
          return { speaker: data.speaker, content: prev.content + data.chunk };
        }
        return { speaker: data.speaker, content: data.chunk };
      });
    } else if (data.type === 'stream_end') {
      const cleanContent = data.content.replace(/^(Moderator|Proponent|Opponent):\s*/i, '').trim();
      handlers.setStreamingMessage(null);
      handlers.setMessages(prev => [...prev, {
        speaker: data.speaker,
        content: cleanContent,
        turn: data.turn,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
      const current = data.speaker.toLowerCase();
      if (current.includes('moderator')) handlers.setPendingSpeaker('Proponent');
      else if (current.includes('proponent')) handlers.setPendingSpeaker('Opponent');
      else if (current.includes('opponent')) handlers.setPendingSpeaker('Proponent');
    } else if (data.type === 'debate_update') {
      const cleanContent = data.content.replace(/^(Moderator|Proponent|Opponent):\s*/i, '').trim();
      handlers.setMessages(prev => [...prev, {
        speaker: data.speaker,
        content: cleanContent,
        turn: data.turn,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
      const current = data.speaker.toLowerCase();
      if (current.includes('moderator')) handlers.setPendingSpeaker('Proponent');
      else if (current.includes('proponent')) handlers.setPendingSpeaker('Opponent');
      else if (current.includes('opponent')) handlers.setPendingSpeaker('Proponent');
    } else if (data.type === 'verdict') {
      try {
        handlers.setVerdict(JSON.parse(data.content));
        handlers.setStatus('finished');
        handlers.setPendingSpeaker(null);
      } catch (e) {
        console.error("Failed to parse verdict", e);
      }
    } else if (data.type === 'agent_names') {
      handlers.setAgentNames({ proponent: data.proponent_name, opponent: data.opponent_name });
    } else if (data.type === 'fact_check') {
      try {
        handlers.setFactChecks(JSON.parse(data.content));
        handlers.setIsFactChecking(false);
      } catch (e) {
        console.error("Failed to parse fact-check", e);
        handlers.setIsFactChecking(false);
      }
    } else if (data.type === 'fact_check_error') {
      console.warn("Fact-check failed:", data.content);
      handlers.setIsFactChecking(false);
    } else if (data.type === 'token_usage') {
      handlers.setTokenUsage(data.content);
    } else if (data.type === 'error') {
      handlers.setStatus('error');
      handlers.setPendingSpeaker(null);
      eventSourceRef.current?.close();
    }
  }, [handlers]);

  const connect = useCallback((url: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      console.log("[DEBATE] SSE connection opened");
    };

    es.onmessage = handleSSEMessage;

    es.onerror = (err) => {
      console.error("[DEBATE] SSE Error:", err);
      handlers.setStatus('error');
      handlers.setPendingSpeaker(null);
      es.close();
    };
  }, [handleSSEMessage, handlers]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return { connect, disconnect };
}
