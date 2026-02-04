# Track: Implement Moderator Decision Matrix & Verdict

## Status
- [ ] In Progress

## Context
The current MVP has a basic debate loop. We need to implement the final "Judgment" phase where the Moderator evaluates the performance of the Proponent and Opponent based on logic, evidence, and persuasion, and generates a structured "Decision Matrix" to declare a winner.

## Goals
1.  **Backend:** Implement a `verdict_node` in LangGraph that triggers after `MAX_TURNS`.
2.  **Logic:** Use structured prompting to get a JSON-compatible verdict from the LLM.
3.  **Frontend:** Create a `DecisionMatrix` component to display the winner, scores, and summary.
4.  **Polish:** Ensure prompts drive "punchy, concise, and rigorous" output.

## Documents
- [Specification](./spec.md)
- [Implementation Plan](./plan.md)
