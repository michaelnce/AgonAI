# Problem Solver — Feature Specification

## Overview

A new mode for AgonAI where 5 specialist agents collaborate through structured phases to solve a user-defined problem. Unlike the adversarial Debate Arena, the Problem Solver is **collaborative** — agents bring different worldviews but work toward a shared solution.

Each phase runs **multiple rounds** with facilitator checkpoints between them. The facilitator adapts — guiding agents to build on each other's insights, integrating perspectives when they diverge, and advancing when alignment is reached.

The communication style is modeled on leading global think tanks — Brookings, RAND Corporation, Chatham House, CSIS, Bruegel — emphasizing evidence-based analysis, structured policy reasoning, and collaborative synthesis over adversarial debate.

The feature is accessed via a new sidebar entry and runs on its own page, reusing shared components (chat feed, fact-check, token stats) while introducing a new agent layout and output format.

---

## Think Tank Methodology

### Communication Principles

The Problem Solver enforces a professional think tank tone across all agents and the facilitator:

1. **Evidence over opinion** — Every claim must reference data, precedent, or a named framework. No philosophical quotations, no literary references, no dramatic language.
2. **Build, don't attack** — Agents extend and refine each other's contributions. "Building on Sofia's point..." not "Sofia is wrong because..."
3. **Structured brevity** — Contributions are capped at 150 words. Speak like a senior analyst in a policy briefing: structured, precise, actionable.
4. **Identify gaps, propose solutions** — When disagreeing, always offer an alternative. "This approach has a gap in X — here's how to address it."
5. **Collective ownership** — The solution belongs to the team, not to any individual agent. No ego, no "I win" moments.
6. **Chatham House discipline** — Focus on the substance, not the speaker. Reference ideas by content, not by who said them.

### Facilitator Role

The facilitator operates as a **session chair**, not a debate moderator:

- Synthesizes contributions between rounds, identifying themes and gaps
- Asks targeted questions to deepen analysis: "What evidence supports this?" not "Attack their weakest point"
- Guides convergence by highlighting areas of alignment
- Never pits agents against each other — instead asks agents to integrate differing perspectives
- Maintains a running synthesis that evolves across phases

### Agent Behavior

Each agent contributes from their specialist lens but follows think tank norms:

- **Format**: Every contribution follows a structured template — (1) Key point, (2) Evidence/precedent, (3) Implication for the solution
- **Tone**: Professional, measured, collegial. Like a Brookings policy brief or a RAND research memo.
- **Citations**: Real data, named studies, specific precedents. No "many experts say" — name the expert, cite the year.
- **Disagreement**: Constructive only. "This approach would benefit from considering X" not "This is wrong."
- **Word limit**: 150 words max per contribution. Quality over quantity.

---

## Agent Architecture

### 5 Specialist Roles

Each agent has a **role** (fixed function), a **profile** (worldview from `profiles.json`), and a **tone** (voice from `tones.json`).

| Role | Function | What They Contribute |
|------|----------|---------------------|
| **Analyst** | Breaks down the problem, identifies root causes, maps dependencies | Structured decomposition, data-driven framing |
| **Creative** | Proposes unconventional or lateral solutions, challenges assumptions | Novel ideas, reframing, "what if" scenarios |
| **Critic** | Stress-tests proposals, finds flaws, identifies risks | Failure modes, edge cases, blind spots |
| **Pragmatist** | Evaluates feasibility, cost, timeline, real-world constraints | Implementation reality, trade-offs, priorities |
| **Synthesizer** | Merges ideas, resolves contradictions, builds consensus | Unified proposals, common ground, integration |

### Profile + Tone Assignment

- The **profile** (e.g., Empiricism, Post-Modernism) shapes how the agent sees the problem — their philosophical lens
- The **tone** (e.g., Assertive, Socratic) shapes how they communicate
- The **role** shapes what they're expected to contribute in each phase

The same `profiles.json` and `tones.json` data files are used. No new data files required.

### Agent Names

Like debates, the facilitator assigns each agent a unique human name on first turn (drawn from the existing name pools). Agents address each other by name throughout the session.

---

## Workflow: Multi-Round Phased Pipeline

The session runs through 5 structured phases. Each phase has **2-3 rounds** with a **facilitator checkpoint** between rounds. The facilitator decides whether to push for another round or advance to the next phase.

### Core Mechanic: Facilitator Checkpoints

After each round within a phase, the facilitator synthesizes progress and guides the next round:

- **If perspectives diverge**: "Sofia identified X while Kai proposed Y — how might these be integrated?"
- **If ideas overlap**: "Three of you converged on this approach — what's the strongest evidence for it? What gap remains?"
- **If consensus is clear**: Facilitator advances to the next phase (skips round 2, saves tokens)
- **If an angle is missing**: "The team hasn't addressed the implementation timeline — Pragmatist, what's realistic?"

This creates **guided collaborative deepening** — achieving analytical depth through structured facilitation rather than confrontation.

### Round Limits

- `MAX_ROUNDS_PER_PHASE`: configurable, default **2**, max **3**
- Facilitator can end a phase early if consensus is reached
- Each agent speaks once per round within a phase

### Phase 1: Frame (Facilitator Only)

The facilitator introduces the problem, sets context, and establishes what a good solution looks like.

- Presents the problem statement
- Introduces the 5 agents by name and role
- Defines success criteria: "A good solution would need to address X, Y, Z"
- Asks each agent to give their initial take

**Messages**: 1 facilitator

### Phase 2: Diverge (All 5 Agents, Multi-Round)

Each agent gives their **independent analysis** of the problem from their role's perspective.

- Analyst: decomposes the problem, identifies root causes
- Creative: reframes it, proposes unexpected angles
- Critic: identifies what makes this problem hard, where solutions usually fail
- Pragmatist: defines real-world constraints and priorities
- Synthesizer: identifies themes, potential integration points

**Round 1**: Each agent gives their initial take (5 messages)

**Checkpoint**: Facilitator reviews all 5 takes. Identifies the biggest disagreement or gap. Directs specific agents to go deeper. (1 message)

**Round 2**: Agents sharpen their positions based on checkpoint feedback. Agents called out directly respond to each other. (5 messages)

**Optional Round 3**: Only if facilitator detects fundamental unresolved tension.

**Messages**: 1 checkpoint + 10-15 agent = **11-16 total**

### Phase 3: React (Targeted Cross-Pollination, Multi-Round)

Agents respond to **specific other agents** they disagree with or want to build on. The facilitator steers who responds to whom.

**Checkpoint (opening)**: Facilitator highlights 2-3 tensions from Phase 2. Directs each agent to respond to a specific peer. (1 message)

**Round 1**: Each agent reacts to their assigned peer — quoting them, pushing back, or building on their idea. (5 messages)

**Checkpoint**: Facilitator identifies what's resolved vs still contested. Redirects agents if needed. (1 message)

**Round 2**: Agents address remaining conflicts. Those who agree can propose how to combine their ideas. (5 messages)

**Messages**: 2 checkpoints + 10 agent = **12 total**

### Phase 4: Converge (Solution Building, Multi-Round)

Each agent proposes their **concrete recommendation** for the solution, building on everything they've heard.

**Checkpoint (opening)**: Facilitator summarizes areas of agreement and remaining disagreements. Asks each agent for their concrete solution. (1 message)

**Round 1**: Each agent gives a focused, actionable recommendation. (5 messages)

**Checkpoint**: Facilitator identifies where proposals align and where they conflict. Directs agents to resolve implementation disagreements. (1 message)

**Round 2**: Agents refine and reconcile. Synthesizer proposes a merged approach. (5 messages)

**Messages**: 2 checkpoints + 10 agent = **12 total**

### Phase 5: Stress-Test (Challenge + Defend, Multi-Round)

The facilitator presents a **draft solution** based on Phase 4. Agents challenge and refine it.

**Checkpoint (opening)**: Facilitator presents the draft solution. Directs Critic and Pragmatist to find flaws. Directs Analyst, Creative, and Synthesizer to defend or refine. (1 message)

**Round 1**: Critic attacks weaknesses. Pragmatist flags implementation concerns. Others defend, concede, or propose amendments. (5 messages)

**Checkpoint**: Facilitator assesses which criticisms stand and which were addressed. (1 message)

**Round 2**: Final positions. Agents give their last word — accept, modify, or register dissent. (5 messages)

**Messages**: 2 checkpoints + 10 agent = **12 total**

### Phase 6: Final Synthesis (Facilitator Only)

The facilitator produces the **Solution Matrix** — a structured JSON output summarizing the collective work.

- Weighs all contributions, agreements, and dissenting views
- Assigns a confidence level based on degree of consensus
- Lists implementation steps in priority order
- Records unresolved disagreements honestly

**Messages**: 1 facilitator + Solution Matrix (JSON)

### Message Count Summary

| Phase | Facilitator | Agents | Total |
|-------|------------|--------|-------|
| Frame | 1 | 0 | 1 |
| Diverge | 1 | 10 | 11 |
| React | 2 | 10 | 12 |
| Converge | 2 | 10 | 12 |
| Stress-Test | 2 | 10 | 12 |
| Synthesis | 1 | 0 | 1 |
| **Total** | **9** | **40** | **~49** |

With optional round 3s skipped and early exits on consensus, typical sessions will land at **~35-49 LLM calls**.

---

## Solution Matrix (Output Format)

Replaces the debate's Decision Matrix. No winner — instead, a structured solution.

```json
{
  "solution_summary": "A concise 2-3 sentence summary of the recommended solution",
  "key_recommendations": [
    "Specific actionable recommendation 1",
    "Specific actionable recommendation 2",
    "Specific actionable recommendation 3"
  ],
  "implementation_steps": [
    "Step 1: ...",
    "Step 2: ...",
    "Step 3: ..."
  ],
  "risks_identified": [
    "Risk 1: ... (mitigation: ...)",
    "Risk 2: ... (mitigation: ...)"
  ],
  "dissenting_views": [
    "Agent X disagreed on Y because Z"
  ],
  "confidence_level": "high | medium | low",
  "confidence_reasoning": "Why this confidence level was assigned",
  "agent_contributions": {
    "analyst": "Key insight from the analyst",
    "creative": "Key insight from the creative",
    "critic": "Key concern raised",
    "pragmatist": "Key feasibility point",
    "synthesizer": "Key integration made"
  },
  "further_reading": [
    "Book or resource recommendation 1",
    "Book or resource recommendation 2"
  ],
  "references": [
    "Source cited during the session"
  ]
}
```

### Solution Matrix UI Display

The Solution Matrix component shows:

- **Header**: Problem statement + confidence level badge (green/yellow/red)
- **Solution Summary**: The core recommendation, prominently displayed
- **Key Recommendations**: Numbered list with checkmark icons
- **Implementation Steps**: Numbered timeline-style list
- **Risks & Mitigations**: Collapsible section with warning icons
- **Dissenting Views**: Collapsible section — important to show where consensus wasn't reached
- **Agent Contributions**: 5-card grid showing each agent's key insight
- **Further Reading + References**: Collapsible, same style as debate verdict

---

## Fact-Checking

Works identically to debate mode:

- Runs after the session completes (if the toggle is enabled)
- Processes each agent message individually
- Uses `MODEL_FACT_CHECK` (cheaper model)
- Results displayed in the same FactCheckReport component
- Can be re-run on demand

No changes to `services/fact_check.py` needed — it takes a list of `{speaker, content}` messages and processes them.

---

## Token Tracking

Works identically to debate mode:

- TokenTracker passed to all LLM calls (facilitator + 5 agents)
- Per-call breakdown shows: `facilitator-frame`, `analyst-diverge-r1`, `creative-diverge-r2`, etc.
- Total cost displayed in TokenStats component
- Token usage included in email/markdown export

---

## UI Design

### Sidebar Addition

```
Sidebar:
  ├── Debate Arena          ← existing (current page)
  ├── Problem Solver        ← NEW
  ├── Profiles              ← existing
  ├── Saved Scenarios       ← existing
  ├── Saved Sessions        ← renamed from "Saved Debates", stores both types
  └── Help                  ← existing (updated with problem solver docs)
```

### Problem Solver Page Layout

The page follows the same structure as the Debate Arena but with adapted sections.

#### Agent Configuration Section

A compact grid of 5 agent cards instead of 2:

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  Analyst     │ │  Creative    │ │  Critic      │
│  Profile: ▾  │ │  Profile: ▾  │ │  Profile: ▾  │
│  Tone:    ▾  │ │  Tone:    ▾  │ │  Tone:    ▾  │
│  Lang:    ▾  │ │  Lang:    ▾  │ │  Lang:    ▾  │
└─────────────┘ └─────────────┘ └─────────────┘
       ┌─────────────┐ ┌─────────────┐
       │  Pragmatist  │ │  Synthesizer │
       │  Profile: ▾  │ │  Profile: ▾  │
       │  Tone:    ▾  │ │  Tone:    ▾  │
       │  Lang:    ▾  │ │  Lang:    ▾  │
       └─────────────┘ └─────────────┘
```

- Each card is smaller than debate agent cards (compact mode)
- Cards are collapsible (expanded by default first time, then remembered)
- Each card shows: role name, role description (tooltip), profile dropdown, tone dropdown, language dropdown
- All 5 default to "Best Match" (auto-assigned based on problem topic)
- "Randomize All" button at the top

#### Problem Input Section

Same layout as the debate topic input:

```
┌────────────────────────────────────────────────────────────┐
│  PROBLEM STATEMENT                          [Random Problem]│
│  ┌──────────────────────────────────────┐  ┌──────────────┐│
│  │ Describe the problem to solve...     │  │   Solve It   ││
│  └──────────────────────────────────────┘  └──────────────┘│
│  [■ Fact-check after session]                               │
└────────────────────────────────────────────────────────────┘
```

- Problem suggestions dropdown (categorized, like topics)
- Fact-check toggle (same as debate)
- "Solve It" button (equivalent to "Start Debate")

#### Chat Feed

Same chat component, but with 6 speaker colors instead of 3:

| Speaker | Color | Badge |
|---------|-------|-------|
| Facilitator | Slate/Gray | HOST |
| Analyst | Blue | ANL |
| Creative | Purple | CRE |
| Critic | Red/Orange | CRT |
| Pragmatist | Green | PRG |
| Synthesizer | Amber | SYN |

Phase transitions shown as visual dividers in the chat:

```
━━━━ Phase 2: Diverge ━━━━
[Analyst message]
[Creative message]
[Critic message]
[Pragmatist message]
[Synthesizer message]
━━━━ Facilitator Checkpoint ━━━━
[Facilitator directs agents]
[Analyst round 2 message]
[Creative round 2 message]
...
━━━━ Phase 3: React ━━━━
```

#### Typing Indicator

Shows which agent is currently generating, with their role:

```
🟣 Creative (Sofia) is thinking...
```

#### Solution Matrix

Displayed after the final synthesis, replacing the Decision Matrix position. See "Solution Matrix UI Display" section above.

#### Footer Actions

Same as debate verdict footer:
- **Save Session** — saves to server storage
- **Save as MD** — markdown export
- **Send Summary** — email export
- **New Problem** — reset

---

## Backend Architecture

### New Files

```
backend/
├── problem_graph.py              # LangGraph workflow for problem-solving
├── prompts/
│   ├── facilitator_frame.txt     # Phase 1: frame the problem
│   ├── facilitator_checkpoint.txt # Generic checkpoint template
│   ├── facilitator_converge.txt  # Phase 4: summarize convergence
│   ├── facilitator_stress.txt    # Phase 5: present draft for stress-test
│   ├── facilitator_synthesis.txt # Phase 6: final synthesis prompt
│   ├── agent_diverge.txt         # Phase 2: independent analysis
│   ├── agent_react.txt           # Phase 3: targeted response
│   ├── agent_converge.txt        # Phase 4: concrete recommendation
│   ├── agent_stress_challenge.txt  # Phase 5: critic/pragmatist challenge
│   └── agent_stress_defend.txt   # Phase 5: other agents defend/refine
├── services/
│   └── problem_streaming.py      # SSE event generator for problem mode
```

### Modified Files

```
backend/
├── main.py                       # Add new endpoints
├── models.py                     # Add ProblemRequest model
├── storage.py                    # Support saving problem sessions (same format)

frontend/src/
├── App.tsx                       # Add routing for problem solver page
├── types.ts                      # Add SolutionData, ProblemSession types
├── components/
│   ├── Sidebar.tsx               # Add "Problem Solver" entry
│   ├── ProblemSolver.tsx         # NEW: main problem solver page
│   ├── ProblemAgentCard.tsx      # NEW: compact agent card for 5-agent grid
│   ├── SolutionMatrix.tsx        # NEW: solution output display
│   └── DebateMessage.tsx         # Extend with 5 new speaker colors + phase dividers
├── hooks/
│   ├── useProblemState.ts        # NEW: state management for problem mode
│   └── useSSEConnection.ts      # Reuse existing (same SSE protocol)
├── data/
│   └── problems.json             # NEW: sample problem suggestions
```

### New API Endpoints

```
GET  /api/problem/stream          # SSE stream for problem-solving session
POST /api/problem/fact-check      # On-demand fact-check (reuses existing logic)
POST /api/problem/resolve-agents  # Best-match agent assignment for 5 roles
```

### LangGraph Workflow (`problem_graph.py`)

#### State Definition

```python
class ProblemState(TypedDict):
    messages: Annotated[List[str], operator.add]
    phase: str                     # "frame" | "diverge" | "react" | "converge" | "stress" | "synthesis"
    phase_round: int               # current round within the phase (1, 2, 3)
    problem: str
    agent_configs: Dict[str, Dict] # {role: {profile, tone, language, name}}
    current_agent: str             # which agent/facilitator is speaking
    agent_order: List[str]         # order of agents for current phase
    agent_index: int               # index into agent_order for round-robin
    solution: str                  # final JSON output
    facilitator_language: str
```

#### Graph Structure

A single `agent_node` dispatches based on `phase` + `current_agent`. The `route_next` function handles:

1. **Within a round**: advance `agent_index` to the next agent
2. **End of round**: route to `facilitator_checkpoint`
3. **Checkpoint decision**: facilitator decides → advance phase or start next round
4. **End of all phases**: route to `facilitator_synthesis` → END

```
facilitator_frame
    → agent_node (analyst, diverge, r1)
    → agent_node (creative, diverge, r1)
    → agent_node (critic, diverge, r1)
    → agent_node (pragmatist, diverge, r1)
    → agent_node (synthesizer, diverge, r1)
    → facilitator_checkpoint
        → [advance?] → next phase
        → [more rounds?] → agent_node (analyst, diverge, r2) → ... → facilitator_checkpoint
    → agent_node (analyst, react, r1) → ...
    → ...
    → facilitator_synthesis
    → END
```

#### Checkpoint Decision Logic

The facilitator checkpoint prompt includes:

```
Based on the round just completed:
1. Did agents reach agreement on the key points? (YES/NO)
2. Are there unresolved contradictions that need another round? (YES/NO)
3. If YES to another round, which agents should be directed to address which specific points?

Return JSON: {"advance": true/false, "directions": "...specific instructions for next round..."}
```

If `advance: true` OR `phase_round >= MAX_ROUNDS_PER_PHASE`, move to next phase.
If `advance: false`, run another round with the facilitator's directed instructions injected into agent prompts.

### SSE Event Types

Reuses existing types plus new ones:

```
{type: "system", content: "connected", session_id: "..."}
{type: "phase", phase: "diverge", round: 1, label: "Phase 2: Diverge"}
{type: "stream_chunk", speaker: "analyst", chunk: "..."}
{type: "stream_end", speaker: "analyst", content: "...", phase: "diverge", round: 1}
{type: "agent_names", agents: {analyst: "Sofia", creative: "Kai", ...}}
{type: "checkpoint", advance: false, directions: "..."}
{type: "solution", content: "{...json...}"}
{type: "fact_check", content: "[...]"}
{type: "token_usage", content: {...}}
{type: "system", content: "finished"}
```

---

## Email + Markdown Export

### Markdown Export

```markdown
# AgonAI Problem-Solving Report

**Date:** ...
**Problem:** ...

---

## Agent Configuration

| Role | Agent | Profile | Tone | Language |
|------|-------|---------|------|----------|
| Analyst | Sofia | Empiricism | Methodical | English |
| Creative | Kai | Post-Modernism | Provocative | English |
| Critic | Dmitri | Skepticism | Socratic | English |
| Pragmatist | Harper | Pragmatism | Assertive | English |
| Synthesizer | Amara | Systems Thinking | Diplomatic | English |

---

## Session Transcript

### Phase 1: Frame
**Facilitator:** ...

### Phase 2: Diverge — Round 1
**Sofia (Analyst):** ...
**Kai (Creative):** ...
**Dmitri (Critic):** ...
**Harper (Pragmatist):** ...
**Amara (Synthesizer):** ...

### Facilitator Checkpoint
**Facilitator:** ...

### Phase 2: Diverge — Round 2
**Sofia (Analyst):** ...
...

### Phase 3: React — Round 1
...

---

## Solution

**Summary:** ...
**Confidence:** High

### Recommendations
1. ...
2. ...
3. ...

### Implementation Steps
1. ...
2. ...
3. ...

### Risks
- Risk 1 (mitigation: ...)
- Risk 2 (mitigation: ...)

### Dissenting Views
- Agent X disagreed on Y because Z

### Agent Contributions
| Role | Key Contribution |
|------|-----------------|
| Analyst | ... |
| Creative | ... |
| Critic | ... |
| Pragmatist | ... |
| Synthesizer | ... |

---

## Fact-Check Report
| Claim | Speaker | Verdict | Explanation |
|---|---|---|---|
...

## Performance Stats
- **Total Time:** ...
- **LLM Calls:** ...
- **Total Tokens:** ...
...

---

*Generated by [AgonAI](https://github.com/michaelnce/AgonAI)*
```

### Email Export

Same HTML template approach as debates, adapted for the Solution Matrix layout:
- Solution summary replaces verdict winner
- Recommendations + implementation steps replace scores
- Agent contributions grid replaces proponent/opponent score cards
- Risks + dissenting views as additional sections

---

## Data: Sample Problems (`problems.json`)

```json
[
  {
    "category": "Technology",
    "problems": [
      "How should a mid-size company migrate from monolithic architecture to microservices without disrupting production?",
      "Design a strategy to reduce cloud infrastructure costs by 40% while maintaining performance SLAs",
      "How should an organization implement AI governance policies that enable innovation while managing risk?"
    ]
  },
  {
    "category": "Business",
    "problems": [
      "A retail chain is losing 15% of customers to online competitors — develop a turnaround strategy",
      "How should a startup allocate a $2M seed round across product, hiring, and marketing?",
      "Design an employee retention strategy for a tech company experiencing 30% annual attrition"
    ]
  },
  {
    "category": "Public Policy",
    "problems": [
      "Design a policy framework for regulating AI-generated content without stifling innovation",
      "How should a city of 500,000 transition its public transit to fully electric by 2035?",
      "Propose a national strategy to address the growing gap between housing supply and demand"
    ]
  },
  {
    "category": "Environment",
    "problems": [
      "Develop a plan to make a university campus carbon-neutral within 5 years",
      "How should coastal cities prepare for 1 meter of sea level rise by 2100?",
      "Design a circular economy strategy for the fast fashion industry"
    ]
  },
  {
    "category": "Education",
    "problems": [
      "How should a school district integrate AI tools into K-12 education responsibly?",
      "Design a reskilling program for workers displaced by automation in manufacturing",
      "Propose a strategy to reduce the digital divide in rural communities"
    ]
  }
]
```

---

## Configuration

### New Environment Variables

```env
# Problem Solver settings
# MODEL_PROBLEM_FACILITATOR=claude-sonnet-4-20250514   # defaults to MODEL_MODERATOR
# MODEL_PROBLEM_AGENTS=claude-sonnet-4-20250514        # defaults to MODEL_PROPONENT
# MAX_ROUNDS_PER_PHASE=2                               # 1-3, default 2
```

No changes to existing debate configuration.

---

## Implementation Order

### Phase A: Backend Core
1. Define `ProblemState` TypedDict in `problem_graph.py`
2. Write all facilitator prompt templates (frame, checkpoint, converge, stress, synthesis)
3. Write all agent prompt templates (diverge, react, converge, stress-challenge, stress-defend)
4. Build LangGraph workflow: nodes, routing, checkpoint decision logic
5. Create `problem_streaming.py` SSE generator
6. Add `ProblemRequest` model to `models.py`
7. Add API endpoints to `main.py`
8. Test with curl/httpie

### Phase B: Frontend Core
1. Add `SolutionData` and `ProblemSession` types to `types.ts`
2. Create `useProblemState.ts` hook
3. Create `ProblemAgentCard.tsx` (compact agent card)
4. Create `ProblemSolver.tsx` (main page component)
5. Add sidebar entry + page routing in `App.tsx`
6. Extend `DebateMessage.tsx` with new speaker colors + phase dividers
7. Create `problems.json` sample data

### Phase C: Solution Output
1. Create `SolutionMatrix.tsx` component
2. Create problem-mode markdown export
3. Create problem-mode email HTML template in `email_service.py`
4. Adapt storage to save/load problem sessions

### Phase D: Polish
1. Fact-check integration (should work out of the box)
2. Token tracking verification
3. Best-match agent assignment endpoint (`/api/problem/resolve-agents`)
4. Update help panel with problem solver documentation
5. End-to-end testing

---

## What Is NOT Changing

- Debate Arena — completely untouched
- `profiles.json`, `tones.json`, `languages.json` — reused as-is
- `claude_llm.py` — no changes
- `storage.py` — minimal changes (already stores generic JSON)
- Fact-check service — reused as-is
- Token tracking — reused as-is
- SSE connection hook — reused as-is
