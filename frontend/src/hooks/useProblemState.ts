import { useState } from 'react';
import type { ProblemMessage, SolutionData, TokenUsageData, FactCheck, AgentRole, ProblemAgentConfig } from '../types';

const DEFAULT_AGENT_CONFIGS: Record<AgentRole, ProblemAgentConfig> = {
  analyst: { profile: '__random__', tone: '__random__', language: 'English' },
  creative: { profile: '__random__', tone: '__random__', language: 'English' },
  critic: { profile: '__random__', tone: '__random__', language: 'English' },
  pragmatist: { profile: '__random__', tone: '__random__', language: 'English' },
  synthesizer: { profile: '__random__', tone: '__random__', language: 'English' },
};

export function useProblemState() {
  const [problem, setProblem] = useState("How should an organization implement AI governance policies that enable innovation while managing risk?");
  const [messages, setMessages] = useState<ProblemMessage[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'solving' | 'finished' | 'error'>('idle');
  const [pendingSpeaker, setPendingSpeaker] = useState<string | null>(null);
  const [solution, setSolution] = useState<SolutionData | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsageData | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [agentNames, setAgentNames] = useState<Record<string, string> | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<{ speaker: string; content: string } | null>(null);
  const [factChecks, setFactChecks] = useState<FactCheck[] | null>(null);
  const [isFactChecking, setIsFactChecking] = useState(false);
  const [factCheckError, setFactCheckError] = useState<string | null>(null);
  const [factCheckProgress, setFactCheckProgress] = useState<string | null>(null);
  const [factCheckEnabled, setFactCheckEnabled] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState<number>(1);

  const [agentConfigs, setAgentConfigs] = useState<Record<AgentRole, ProblemAgentConfig>>(
    () => JSON.parse(JSON.stringify(DEFAULT_AGENT_CONFIGS))
  );

  const updateAgentConfig = (role: AgentRole, field: keyof ProblemAgentConfig, value: string) => {
    setAgentConfigs(prev => ({
      ...prev,
      [role]: { ...prev[role], [field]: value },
    }));
  };

  const resetForNewSession = () => {
    setMessages([]);
    setSolution(null);
    setTokenUsage(null);
    setAgentNames(null);
    setStreamingMessage(null);
    setFactChecks(null);
    setIsFactChecking(false);
    setFactCheckError(null);
    setStartTime(Date.now());
    setStatus('connecting');
    setPendingSpeaker('Facilitator');
    setCurrentPhase(null);
    setCurrentRound(1);
  };

  const resetToIdle = () => {
    setSolution(null);
    setMessages([]);
    setTokenUsage(null);
    setAgentNames(null);
    setFactChecks(null);
    setStartTime(null);
    setStatus('idle');
    setCurrentPhase(null);
    setCurrentRound(1);
  };

  return {
    problem, setProblem,
    messages, setMessages,
    status, setStatus,
    pendingSpeaker, setPendingSpeaker,
    solution, setSolution,
    sessionId, setSessionId,
    tokenUsage, setTokenUsage,
    startTime, setStartTime,
    agentNames, setAgentNames,
    streamingMessage, setStreamingMessage,
    factChecks, setFactChecks,
    isFactChecking, setIsFactChecking,
    factCheckError, setFactCheckError,
    factCheckProgress, setFactCheckProgress,
    factCheckEnabled, setFactCheckEnabled,
    currentPhase, setCurrentPhase,
    currentRound, setCurrentRound,
    agentConfigs, updateAgentConfig, setAgentConfigs,
    resetForNewSession, resetToIdle,
  };
}
