# AgonAI

AgonAI is a multi-agent adversarial debate platform where two AI agents (Proponent and Opponent) debate a user-chosen topic, orchestrated by a Moderator agent. Each agent adopts a philosophical profile and communication tone, producing structured, real-time debates streamed to a modern web interface.

The platform is designed for exploring how different ideological perspectives and rhetorical styles interact when applied to controversial or complex topics. After the debate concludes, the Moderator delivers a scored verdict via a Decision Matrix, evaluating both sides on logic, evidence, and style.

## Features

- **Configurable AI Agents** -- Assign philosophical profiles (e.g. Stoicism, Utilitarianism, Existentialism) and communication tones (e.g. Socratic, Assertive, Empathetic) to each debater.
- **Real-time Streaming** -- Watch the debate unfold token-by-token via Server-Sent Events (SSE).
- **Multi-language Support** -- Each agent can debate in a different language.
- **Decision Matrix & Verdict** -- Structured scoring across logic, evidence, and style with moderator rationale.
- **Fact-Checking** -- Automated claim verification after the debate.
- **Saved Debates & Scenarios** -- Save and replay past debates; bookmark agent configurations for reuse.
- **Responsive UI** -- Works on desktop, tablet, and mobile.
- **Multiple LLM Providers** -- Supports Ollama (local) and Claude via Claude Code CLI.

## Architecture

```
Frontend (React + Vite + Tailwind CSS)
    |
    | SSE stream (/api/debate/stream)
    |
Backend (FastAPI + LangGraph)
    |
    | LLM calls
    |
Ollama or Claude
```

- **Backend**: FastAPI serves the debate API. LangGraph defines the cyclic workflow: `moderator -> proponent -> opponent -> repeat -> verdict`.
- **Frontend**: React SPA with real-time message streaming, agent configuration, and verdict display.
- **LLM**: All inference runs through Ollama (local models) or Claude Code CLI. Each agent can use a different model.

## Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **Ollama** installed and running (if using Ollama provider) -- see [ollama.com](https://ollama.com)

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/michaelnce/AgonAI.git
cd AgonAI
```

### 2. Set up the backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Set up the frontend

```bash
cd frontend
npm install
cd ..
```

### 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your settings (see the Environment Variables section below).

### 5. Pull an Ollama model (if using Ollama)

```bash
ollama pull glm-4:9b-chat-q4_K_M
```

You can use any model available on Ollama. Update the model names in `.env` accordingly.

### 6. Start the application

```bash
./start.sh
```

This starts both the backend and frontend in the background. Logs are written to `backend.log` and `frontend.log`.

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000

To stop:

```bash
./stop.sh
```

## LLM Providers

AgonAI supports two LLM providers. Set the `LLM_PROVIDER` variable in your `.env` file to choose which one to use.

### Ollama (Local)

Ollama runs open-source models locally on your machine. This is the default provider and requires no API key or subscription.

1. Install Ollama from [ollama.com](https://ollama.com).
2. Pull a model: `ollama pull glm-4:9b-chat-q4_K_M` (or any model you prefer).
3. Make sure Ollama is running (it starts automatically after install, or run `ollama serve`).
4. Set your `.env`:
   ```
   LLM_PROVIDER=ollama
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL_PROPONENT=glm-4:9b-chat-q4_K_M
   OLLAMA_MODEL_OPPONENT=glm-4:9b-chat-q4_K_M
   OLLAMA_MODEL_MODERATOR=glm-4:9b-chat-q4_K_M
   ```

You can assign a different model to each agent. For example, use a larger model for the Moderator and smaller ones for the debaters. Any model available through `ollama list` can be used.

**Pros**: Free, private, no internet required, full control over models.
**Cons**: Requires GPU/CPU resources, model quality depends on hardware and model size.

### Claude (via Claude Code CLI)

This provider uses the [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) to call Claude models. It leverages your existing Claude Max or Pro subscription -- no API key is needed.

1. Install Claude Code: `npm install -g @anthropic-ai/claude-code`
2. Authenticate: run `claude` in your terminal and follow the login flow.
3. Set your `.env`:
   ```
   LLM_PROVIDER=claude
   ```

When using Claude, the backend shells out to the `claude` CLI for each agent turn. It supports real-time token streaming and tracks token usage, cache hits, and cost per call. The performance stats (tokens, duration, cost) are displayed in the Decision Matrix after each debate.

**Pros**: High-quality responses (Claude Sonnet/Opus), token-by-token streaming with usage tracking, no local GPU needed.
**Cons**: Requires a Claude Max or Pro subscription, needs internet access.

### Comparison

| | Ollama | Claude |
|---|---|---|
| Cost | Free | Claude subscription |
| Privacy | Fully local | Data sent to Anthropic |
| Internet | Not required | Required |
| Streaming | Supported | Supported (with token tracking) |
| Model quality | Varies by model/hardware | Consistently high |
| Per-agent models | Yes (different model per agent) | Single model (Claude) |
| Token/cost stats | Not available | Displayed in Decision Matrix |

## Environment Variables

Configure these in your `.env` file:

| Variable | Default | Description |
|---|---|---|
| `BACKEND_PORT` | `8000` | Port for the FastAPI backend server |
| `FRONTEND_PORT` | `3000` | Port for the Vite dev server |
| `LLM_PROVIDER` | `ollama` | LLM provider to use: `ollama` or `claude` |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | URL of your Ollama instance |
| `OLLAMA_MODEL_PROPONENT` | `glm-4:9b-chat-q4_K_M` | Ollama model for the Proponent agent |
| `OLLAMA_MODEL_OPPONENT` | `glm-4:9b-chat-q4_K_M` | Ollama model for the Opponent agent |
| `OLLAMA_MODEL_MODERATOR` | `glm-4:9b-chat-q4_K_M` | Ollama model for the Moderator agent |
| `MAX_TURNS` | `10` | Number of debate rounds before the verdict |
| `WORD_LIMIT` | `75` | Maximum words per agent response |

### Optional (Email Export)

| Variable | Description |
|---|---|
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP server port |
| `SMTP_USER` | SMTP authentication username |
| `SMTP_PASS` | SMTP authentication password |
| `SENDER_EMAIL` | Email address used as the sender |

## Running Tests

```bash
# Activate virtual environment
source .venv/bin/activate

# Run all backend tests
pytest tests/

# Run with verbose output
pytest tests/ -v

# Run a specific test file
pytest tests/test_graph.py -v

# Frontend tests
cd frontend && npm run test
```

## License

MIT
