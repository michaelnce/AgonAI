# Product Requirements Document: Project "Multi-Agent Debater"
**Version:** 1.2.0  
**Status:** In Development / Refinement  
**Lead Architect:** AI Systems Expert  

---

## 1. Executive Summary
The **Multi-Agent Debater** is an adversarial Agentic framework designed to provide a 360-degree view of any given "thesis." By utilizing a **Proponent Agent** and an **Opponent Agent** in a rapid-fire, turn-based dialogue, the system uncovers logical fallacies and identifies risks. A **Moderator Agent** synthesizes the exchange into a final "Decision Matrix." and designate the winner of the debate. The goal is a punchy, concise, and logically rigorous debate rather than long-form monologues. The opponent and Proponent agent will have the role and tone predefined in the data/profile.json and data/tones.json .. the user will be able or let the system choose randomly or select by himself in the UI inteface


---

## 2. Technical Stack & Environment

### 2.1 Core Stack
* **Orchestration:** `LangGraph` (Stateful, cyclic multi-agent workflow).
* **API Server:** `FastAPI` (Async streaming via Server-Sent Events).
* **Inference:** `Ollama` (Local inference).
* **Default Model:** `glm-4.7-flash:q8_0`.
* **Frontend:** `React` (Vite) + `Tailwind CSS`.

### 2.2 Global Configuration (`.env`)
The system is managed via a central environment file to ensure portability across different local hosting setups:
BACKEND_PORT
FRONTEND_PORT
OLLAMA_BASE_URL
OLLAMA_MODEL_Opponent
OLLAMA_MODEL_Proponent
MAX_TURNS
WORD_LIMIT


---

## 3. Agent Decomposition (The "Tribunal")

### 3.1 The Proponent (Agent "A")
* **Role:** Constructs the strongest case for the user's prompt.
* **Constraint:** Must respond directly to the Opponent’s latest critique.
* **Instruction:** Avoid long introductions; focus on one key point per turn.

### 3.2 The Opponent (Agent "B")
* **Role:** Acts as the "Devil’s Advocate."
* **Focus:** Identifies logical inconsistencies, hidden costs, and edge-case risks.
* **Instruction:** Limit responses to 3-4 sentences of sharp, focused critique.

### 3.3 The Moderator (The Judge)
* **Role:** Objective observer and final synthesizer.
* **Output:** Generates a **Decision Matrix** in Markdown highlighting:
    * **Points of Consensus:** Common ground found.
    * **Irreconcilable Differences:** Core points of conflict.
    * **Final Verdict:** Summary of which side presented the more logically sound case.

---

## 4. Formal Debate Workflow (State Machine)

The `LangGraph` workflow follows a strict turn-based sequence to ensure a "real discussion" feel:

1.  **Opening (Proponent):** Presents the initial case (max 100 words).
2.  **Rebuttal Loop (Cyclic):**
    * **Opponent:** Attacks a specific pillar of the Proponent's logic.
    * **Proponent:** Defends or counter-attacks.
    * *Constraint:* Strict token/word limit per node to prevent "speech-making."
3.  **Cross-Examination:** Moderator injects a specific "Stress Test" question to both agents.
4.  **Closing:** 50-word final wrap-up from each side.
5.  **Synthesis:** Moderator generates the final verdict.

---

## 5. Key Features

### 5.1 Real-Time Web Interface
* **Live Streaming:** Watch arguments appear token-by-token via SSE.
* **Profile Selection:** Toggle movement profiles (e.g., Accelerationist vs. Traditionalist).
* **History Sidebar:** Browse past debates stored as local Markdown files.

### 5.2 Storage & Replay
* **Archive:** All debates saved to `debates/*.md` with timestamps.
* **Replay:** Full Markdown rendering for review of previous sessions.

---

## 6. Definition of Done (DoD) & Roadmap

### Completed (MVP)
- [ ] LangGraph cyclic workflow.
- [ ] FastAPI backend with SSE streaming.
- [ ] React frontend with Markdown support.

### Backlog / Next Steps
- [ ] **Short-Form Logic:** Refactor prompts to enforce strict <75 word responses.
- [ ] **Env Refactor:** Move all hardcoded ports/models to `.env` using `pydantic-settings`.
- [ ] **Profile Editor:** UI to create/edit Agent Profiles and Tones.
- [ ] **PDF Export:** Export final Verdict and Decision Matrix as PDF.
