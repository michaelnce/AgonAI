# Implementation Plan: Moderator Decision Matrix & Verdict

## Phase 1: Backend Logic (Verdict Node)
- [ ] Task: Update `DebateState` to include verdict data
- [ ] Task: Implement `verdict_node` in `backend/graph.py`
    - [ ] Create strict JSON prompt for adjudication
    - [ ] Handle conditional routing (stop after max turns)
- [ ] Task: Update `backend/main.py` to stream the verdict event

## Phase 2: Frontend Visualization
- [ ] Task: Create `DecisionMatrix` component
    - [ ] Design layout for Winner, Scores, and Rationale
- [ ] Task: Update `App.tsx` to handle verdict event
    - [ ] Parse JSON data from backend
    - [ ] Render `DecisionMatrix` at end of chat

## Phase 3: Polish & Verification
- [ ] Task: Verify concise/rigorous prompts
- [ ] Task: End-to-end test of full debate cycle
