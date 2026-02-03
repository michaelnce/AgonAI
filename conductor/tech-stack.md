# Technology Stack

## Backend & Orchestration
- **Language:** Python 3.10+
- **API Framework:** FastAPI (Async, SSE for streaming)
- **Agent Orchestration:** LangGraph (Stateful, cyclic multi-agent workflows)
- **Environment Management:** `python-dotenv` and `pydantic-settings` for strict `.env` validation.

## Frontend
- **Framework:** React (Vite)
- **Styling:** Tailwind CSS (Dark/Light mode support)
- **State Management:** React Hooks / Context API
- **Communication:** EventSource (for Server-Sent Events)

## Inference (Local)
- **Provider:** Ollama
- **Model Configuration (per .env):**
  - `OLLAMA_MODEL_PROPONENT`
  - `OLLAMA_MODEL_OPPONENT`
  - `OLLAMA_MODEL_MODERATOR`

## Infrastructure & Automation
- **Environment:** Centralized `.env` file for all ports and model names.
- **Port Management:**
  - `BACKEND_PORT`
  - `FRONTEND_PORT`
- **Automation Scripts:**
  - `start.sh`: Shell script to launch both Frontend and Backend concurrently.
  - `stop.sh`: Shell script to identify and terminate processes based on `BACKEND_PORT` and `FRONTEND_PORT`.
