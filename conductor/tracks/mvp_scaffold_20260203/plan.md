# Implementation Plan: Initialize Multi-Agent Debater MVP

## Phase 1: Environment & Project Setup
- [ ] Task: Initialize project structure and environment
    - [ ] Create Python virtual environment and `requirements.txt`
    - [ ] Create `.env.example` with port and model configurations
    - [ ] Implement `start.sh` and `stop.sh` scripts
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Environment & Project Setup' (Protocol in workflow.md)

## Phase 2: Backend Foundation (FastAPI & LangGraph)
- [ ] Task: Setup FastAPI server with SSE support
    - [ ] Write tests for health check and SSE streaming endpoint
    - [ ] Implement FastAPI app and SSE logic
- [ ] Task: Implement LangGraph Debate Workflow
    - [ ] Write tests for State definition and node transitions
    - [ ] Implement Proponent, Opponent, and Moderator nodes using Ollama
    - [ ] Integrate workflow with the SSE endpoint
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Backend Foundation (FastAPI & LangGraph)' (Protocol in workflow.md)

## Phase 3: Frontend Foundation (React & Tailwind)
- [ ] Task: Scaffold React application
    - [ ] Initialize Vite project with Tailwind CSS
    - [ ] Implement ThemeProvider for Dark/Light mode support
- [ ] Task: Create Debate Arena Dashboard UI
    - [ ] Write tests for layout and theme toggling
    - [ ] Implement UI matching `UI_Idea/screen.png` using Tailwind
- [ ] Task: Implement SSE Client and Debate Stream
    - [ ] Write tests for EventSource integration
    - [ ] Implement real-time message rendering for the debate
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Frontend Foundation (React & Tailwind)' (Protocol in workflow.md)

## Phase 4: Integration & Polish
- [ ] Task: Connect Frontend configuration to Backend
    - [ ] Implement Profile/Tone selection from UI to backend state
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Integration & Polish' (Protocol in workflow.md)
