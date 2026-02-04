# Specification: Moderator Decision Matrix & Verdict

## 1. Goal
Implement a final adjudication phase where the Moderator Agent analyzes the entire debate history and produces a structured "Decision Matrix" declaring a winner and providing scores.

## 2. User Experience
- **Debate Flow:**
    - The debate proceeds for `MAX_TURNS`.
    - At the end, instead of just stopping, the status changes to "Adjudicating".
    - The Moderator generates a final message containing the Verdict.
- **UI:**
    - A specialized "Decision Matrix" card appears at the bottom of the chat or as a modal/overlay.
    - Displays:
        - **Winner:** Proponent or Opponent.
        - **Scores:** Logic, Persuasion, Evidence (e.g., out of 10).
        - **Rationale:** A concise summary of why the winner was chosen.
        - **Key Fallacies:** (Optional) Identified logical flaws.

## 3. Technical Implementation
### Backend
- **State:** Add `verdict` field to `DebateState`.
- **Graph:**
    - Add a conditional edge: If `turn_count >= MAX_TURNS`, route to `verdict_node`.
    - `verdict_node`: Uses the Moderator model with a specific "Judge" prompt.
    - **Output:** The node should return a structured JSON string (or parseable text) embedded in the final message.
- **Prompt:** "You are the Judge. Analyze the debate. Assign scores (0-10) for Logic, Evidence, Tone. Declare a winner. Be rigorous and objective. Output valid JSON."

### Frontend
- **State:** Handle a new message type `verdict` or parse the final message.
- **Component:** `DecisionMatrix.tsx`
    - Props: `winner`, `scores`, `reasoning`.
    - Design: "Game Over" style summary card.

## 4. Acceptance Criteria
- [ ] Debate automatically ends after `MAX_TURNS` with a Verdict.
- [ ] Verdict contains a clear winner and numerical scores.
- [ ] Frontend renders the Decision Matrix visually (not just text).
