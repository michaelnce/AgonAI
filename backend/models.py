from typing import Optional, Dict, List, Any
from pydantic import BaseModel


class MessageRequest(BaseModel):
    message: str


class Message(BaseModel):
    speaker: str
    content: str
    turn: Optional[Any] = None
    timestamp: Optional[str] = None


class EmailRequest(BaseModel):
    recipient_email: str
    topic: str
    proponent: Dict[str, Any]
    opponent: Dict[str, Any]
    messages: List[Message]
    verdict: Dict[str, Any]
    token_usage: Optional[Dict[str, Any]] = None
    total_wall_time_ms: Optional[int] = None
    agent_names: Optional[Dict[str, str]] = None
    fact_checks: Optional[List[Dict[str, Any]]] = None


class FactCheckRequest(BaseModel):
    messages: List[Message]


class BestMatchRequest(BaseModel):
    topic: str
    resolve_proponent_profile: bool = False
    resolve_proponent_tone: bool = False
    resolve_opponent_profile: bool = False
    resolve_opponent_tone: bool = False
    current_proponent_profile: Optional[str] = None
    current_opponent_profile: Optional[str] = None


class ProblemAgentConfig(BaseModel):
    profile: str = "__random__"
    tone: str = "__random__"
    language: str = "English"


class ProblemRequest(BaseModel):
    problem: str
    agents: Optional[Dict[str, ProblemAgentConfig]] = None
    fact_check: bool = True
