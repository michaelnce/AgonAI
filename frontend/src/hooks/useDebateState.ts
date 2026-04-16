import { useState } from 'react';
import type { Message, VerdictData, TokenUsageData, FactCheck, SavedDebate } from '../types';

export function useDebateState() {
  const [topic, setTopic] = useState("Is Universal Basic Income the best solution for AI-driven job displacement?");
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'debating' | 'finished' | 'error'>('idle');
  const [pendingSpeaker, setPendingSpeaker] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<VerdictData | null>(null);
  const [debateId, setDebateId] = useState<string | null>(null);
  const [userMessage, setUserMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<TokenUsageData | null>(null);
  const [debateStartTime, setDebateStartTime] = useState<number | null>(null);
  const [agentNames, setAgentNames] = useState<{ proponent: string; opponent: string } | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<{ speaker: string; content: string } | null>(null);
  const [factChecks, setFactChecks] = useState<FactCheck[] | null>(null);
  const [isFactChecking, setIsFactChecking] = useState(false);
  const [factCheckError, setFactCheckError] = useState<string | null>(null);
  const [factCheckProgress, setFactCheckProgress] = useState<string | null>(null);
  const [factCheckEnabled, setFactCheckEnabled] = useState(true);

  // Agent configuration
  const [proponentProfile, setProponentProfile] = useState("__random__");
  const [proponentTone, setProponentTone] = useState("__random__");
  const [proponentLanguage, setProponentLanguage] = useState("English");
  const [opponentProfile, setOpponentProfile] = useState("__random__");
  const [opponentTone, setOpponentTone] = useState("__random__");
  const [opponentLanguage, setOpponentLanguage] = useState("English");

  const [areAgentDetailsExpanded, setAreAgentDetailsExpanded] = useState(false);
  const toggleAgentDetails = () => setAreAgentDetailsExpanded(prev => !prev);

  const resetForNewDebate = () => {
    setMessages([]);
    setVerdict(null);
    setTokenUsage(null);
    setAgentNames(null);
    setStreamingMessage(null);
    setFactChecks(null);
    setIsFactChecking(false);
    setFactCheckError(null);
    setDebateStartTime(Date.now());
    setStatus('connecting');
    setPendingSpeaker('Moderator');
  };

  const resetToIdle = () => {
    setVerdict(null);
    setMessages([]);
    setTokenUsage(null);
    setAgentNames(null);
    setFactChecks(null);
    setDebateStartTime(null);
    setStatus('idle');
  };

  const loadSavedDebate = (saved: SavedDebate) => {
    setTopic(saved.topic);
    setProponentProfile(saved.proponentConfig.profile);
    setProponentTone(saved.proponentConfig.tone);
    setProponentLanguage(saved.proponentConfig.language);
    setOpponentProfile(saved.opponentConfig.profile);
    setOpponentTone(saved.opponentConfig.tone);
    setOpponentLanguage(saved.opponentConfig.language);
    setAgentNames(saved.agentNames);
    setMessages(saved.messages);
    setVerdict(saved.verdict);
    setFactChecks(saved.factChecks);
    setTokenUsage(saved.tokenUsage);
    setDebateStartTime(null);
    setStatus('finished');
  };

  return {
    // Debate state
    topic, setTopic,
    messages, setMessages,
    status, setStatus,
    pendingSpeaker, setPendingSpeaker,
    verdict, setVerdict,
    debateId, setDebateId,
    userMessage, setUserMessage,
    isSending, setIsSending,
    tokenUsage, setTokenUsage,
    debateStartTime, setDebateStartTime,
    agentNames, setAgentNames,
    streamingMessage, setStreamingMessage,
    factChecks, setFactChecks,
    isFactChecking, setIsFactChecking,
    factCheckError, setFactCheckError,
    factCheckProgress, setFactCheckProgress,
    factCheckEnabled, setFactCheckEnabled,

    // Agent config
    proponentProfile, setProponentProfile,
    proponentTone, setProponentTone,
    proponentLanguage, setProponentLanguage,
    opponentProfile, setOpponentProfile,
    opponentTone, setOpponentTone,
    opponentLanguage, setOpponentLanguage,
    areAgentDetailsExpanded, toggleAgentDetails,

    // Actions
    resetForNewDebate,
    resetToIdle,
    loadSavedDebate,
  };
}
