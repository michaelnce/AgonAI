# Specification: Initialize Multi-Agent Debater MVP

## 1. Goal
Establish the foundational infrastructure for the Multi-Agent Debater, including a stateful LangGraph orchestration, a FastAPI backend capable of SSE streaming, and a React-based frontend dashboard matching the "Debate Arena" design.

## 2. Scope
- **Infrastructure:** `.env` configuration, `start.sh`/`stop.sh` scripts, and Python virtual environment.
- **Backend:** 
    - FastAPI server with SSE endpoints.
    - LangGraph workflow with Proponent, Opponent, and Moderator nodes.
    - Integration with local Ollama instance.
- **Frontend:**
    - Vite/React project with Tailwind CSS.
    - Dashboard UI matching the provided screenshot (Dark/Light mode).
    - SSE client to stream debate responses in real-time.
- **Data:** Loading agent profiles and tones from `data/*.json`.

## 3. Technical Requirements
- Python 3.10+ with `venv`.
- LangGraph for state management.
- FastAPI for streaming.
- React with Tailwind CSS for UI.
- Local Ollama for inference.

## 4. Acceptance Criteria
- `start.sh` successfully launches both servers.
- Backend can execute a simple 3-turn debate via LangGraph.
- Frontend displays the debate stream token-by-token.
- UI supports toggling between dark and light modes.
