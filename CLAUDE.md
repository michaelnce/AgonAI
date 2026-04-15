# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AgonAI is a multi-agent adversarial debate platform. Two AI agents (Proponent/Opponent) debate a user-chosen topic, orchestrated by a Moderator agent. The backend uses LangGraph to define a cyclic workflow (moderator -> proponent -> opponent -> repeat until MAX_TURNS -> verdict). The frontend displays the debate in real-time via Server-Sent Events (SSE).

All LLM inference runs through a local Ollama instance. Each agent (proponent, opponent, moderator) can use a different Ollama model.

## Commands

### Development
```bash
./start.sh          # Start both backend and frontend (reads .env for ports)
./stop.sh           # Kill running backend/frontend processes
```

### Backend only
```bash
source .venv/bin/activate
export PYTHONPATH=$PYTHONPATH:.
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port $BACKEND_PORT --reload
```

### Frontend only
```bash
cd frontend && npm run dev -- --host 0.0.0.0 --port $FRONTEND_PORT
```

### Testing
```bash
# All backend tests
pytest tests/

# Single test file or test
pytest tests/test_graph.py -v
pytest tests/test_graph.py::test_verdict_node -v

# Frontend tests
cd frontend && npm run test
```

### Linting
```bash
cd frontend && npm run lint    # ESLint for frontend
```

### Build
```bash
cd frontend && npm run build   # TypeScript + Vite production build
```

## Architecture

### Backend (FastAPI + LangGraph)

- **`backend/main.py`** — FastAPI app with endpoints:
  - `GET /api/debate/stream` — SSE endpoint that streams debate events. Accepts topic, profiles, tones, languages as query params.
  - `POST /api/debate/{debate_id}/message` — Inject moderator instructions into a live debate via an asyncio.Queue (`ACTIVE_DEBATES` dict).
  - `POST /api/debate/email` — Send debate transcript as HTML email.
- **`backend/graph.py`** — LangGraph workflow definition:
  - `DebateState` TypedDict holds messages, current_speaker, turn_count, topic, profiles, tones, languages, verdict.
  - Nodes: `moderator_node`, `proponent_node`, `opponent_node`, `verdict_node`.
  - `should_continue()` is the conditional edge function — routes to verdict when turn_count >= MAX_TURNS, otherwise continues the debate cycle.
  - `compile_graph()` builds and returns the compiled LangGraph `StateGraph`.
  - Profiles and tones are loaded from `data/profile.json` and `data/tones.json`.

### Frontend (React + Vite + Tailwind CSS)

- **`App.tsx`** — Main component managing debate state, SSE EventSource connection, and form controls.
- **`components/AgentCard.tsx`** — Agent configuration (profile, tone, language dropdowns).
- **`components/DebateMessage.tsx`** — Individual message bubble.
- **`components/DecisionMatrix.tsx`** — Structured verdict display with scores and reasoning.
- **`components/TypingIndicator.tsx`** — Animated indicator while an agent is generating.
- Configuration data lives in `frontend/src/data/` (profiles.json, tones.json, languages.json).

### Communication Flow

Frontend opens an SSE connection to `/api/debate/stream`. The backend's `event_generator()` async generator runs the compiled LangGraph workflow and yields events as they occur. The Vite dev server proxies `/api` requests to the backend (configured in `vite.config.ts`).

## Environment Configuration

Copy `.env.example` to `.env`. Key variables:

| Variable | Purpose |
|----------|---------|
| `BACKEND_PORT` / `FRONTEND_PORT` | Server ports |
| `OLLAMA_BASE_URL` | Ollama inference server URL |
| `OLLAMA_MODEL_PROPONENT/OPPONENT/MODERATOR` | Per-agent Ollama model names |
| `MAX_TURNS` | Number of debate rounds before verdict |
| `WORD_LIMIT` | Max words per agent response |
| `SMTP_*` / `SENDER_EMAIL` | Optional email export configuration |

## Testing Notes

Backend tests mock LLM responses via `unittest.mock.patch` on `ChatOllama`. Test files:
- `tests/test_graph.py` — Graph node execution, state transitions, workflow compilation
- `tests/test_backend.py` — FastAPI endpoints, SSE stream integrity
- `tests/test_backend_limits.py` — WORD_LIMIT enforcement in prompts
