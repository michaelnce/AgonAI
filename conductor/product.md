# Initial Concept
The user wants to build the "Multi-Agent Debater" defined in `prb.md` and `UI_Idea/screen.png`. It is an AI-driven debate platform with Proponent, Opponent, and Moderator agents.

# Product Definition

## Vision
The **Multi-Agent Debater** is an adversarial Agentic framework designed to provide a 360-degree view of any given "thesis." By utilizing a **Proponent Agent** and an **Opponent Agent** in a rapid-fire, turn-based dialogue, the system uncovers logical fallacies and identifies risks. A **Moderator Agent** synthesizes the exchange into a final "Decision Matrix" and designates the winner.

## User Experience
- **Debate Arena:** A dark-mode dashboard ("Debate Arena") where users configure agents and watch live arguments.
- **Live Streaming:** Arguments appear token-by-token via SSE.
- **Control:** Users select Agent Profiles (e.g., "Analytical Scholar") and Tones (e.g., "Assertive") from the UI.

## Core Features
- **Orchestration:** LangGraph-based stateful, cyclic workflow.
- **The Tribunal:**
  - **Proponent:** Constructs the case.
  - **Opponent:** Critiques and identifies risks.
  - **Moderator:** Synthesizes and judges.
- **Debate Workflow:** Opening -> Rebuttal Loop -> Cross-Examination -> Closing -> Verdict.
- **History & Playback:** Debates saved as Markdown; full replay capability.
