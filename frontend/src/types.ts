export interface Message {
  speaker: string;
  content: string;
  turn: number;
  timestamp?: string;
}

export interface VerdictData {
  winner: 'Proponent' | 'Opponent';
  scores: {
    proponent: { logic: number; evidence: number; style: number };
    opponent: { logic: number; evidence: number; style: number };
  };
  reasoning: string;
  recommendations?: string[];
  references?: string[];
}

export interface TokenCall {
  label: string;
  input_tokens: number;
  output_tokens: number;
  cache_read: number;
  cache_creation: number;
  cost_usd: number;
  duration_ms: number;
}

export interface TokenUsageData {
  calls: TokenCall[];
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_read_tokens: number;
  total_cache_creation_tokens: number;
  total_cost_usd: number;
  total_duration_ms: number;
}

export interface FactCheck {
  claim: string;
  speaker: string;
  verdict: 'VERIFIED' | 'DISPUTED' | 'FALSE' | 'UNVERIFIABLE';
  explanation: string;
}

export interface SavedDebate {
  id: string;
  date: string;
  topic: string;
  proponentConfig: { profile: string; tone: string; language: string };
  opponentConfig: { profile: string; tone: string; language: string };
  agentNames: { proponent: string; opponent: string } | null;
  messages: Message[];
  verdict: VerdictData | null;
  factChecks: FactCheck[] | null;
  tokenUsage: TokenUsageData | null;
  totalWallTimeMs: number | null;
}
