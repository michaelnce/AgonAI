# AgonAI — Improvements Roadmap

| # | Improvement | Effort | Impact | Score | Status |
|---|------------|--------|--------|-------|--------|
| 1 | **Collapsible verdict** — Short 2-3 sentence summary visible by default, full rationale in expandable section. Same for references/recommendations. | Low | High | 9/10 | Done |
| 2 | **Limit citations per turn** — Add a rule like "cite ONE new source max per turn, make it count." Currently both agents dump 3-5 references per response. | Low | High | 9/10 | Done |
| 3 | **Agent names in UI** — Backend assigns names (Dmitri, Harper) but UI shows "Proponent"/"Opponent". Display assigned names and generate distinct avatars. | Low | Medium | 7/10 | Done |
| 4 | **More moderator interventions** — Add mid-debate interventions every 2-3 turns: call out dodged questions, redirect repetition, raise edge cases. | Medium | High | 8.5/10 | Done |
| 5 | **Streaming per-token display** — Stream words as they arrive instead of waiting for full response. CLI supports `--output-format stream-json`. | High | High | 8/10 | Done |
| 6 | **Verdict length control** — Add `VERDICT_WORD_LIMIT` env var and split prompt: concise judgment + detailed breakdown. Current prompt asks too many things at once. | Low | Medium | 8/10 | Todo |
| 7 | **Make agents interrupt each other** — Add prompts that encourage half-sentences, interruptions, "attends attends". Agents still write polished paragraphs despite podcast rules. | Low | Medium | 7.5/10 | Done |
| 8 | **Dark/light mode toggle** — UI is hardcoded dark. CSS already uses `dark:` prefixes but there's no toggle. | Low | Medium | 7/10 | Todo |
| 9 | **Debate replay/share** — Save completed debates to local storage or backend. Let users share via URL or export as PDF. Debates are currently ephemeral. | Medium | High | 7/10 | Done |
| 10 | **Topic suggestions/presets** — Add a "Suggest Topic" button or dropdown of curated controversial topics. Help users find good topics. | Low | Medium | 6.5/10 | Done |
| 11 | **Turn-by-turn progress indicator** — Show "Turn 3/10" with a progress bar. User has no idea how long the debate will last. Data already in SSE events. | Low | Medium | 6.5/10 | Todo |
| 12 | **Fact-check layer** — After debate, run a separate LLM pass to check factual claims. Flag suspicious dates, quotes, attributions. Builds trust. | High | High | 6/10 | Done |
| 13 | **Audience voting** — Let user vote for who's winning after each turn. Show running tally. Compare with final verdict. | Medium | Medium | 5.5/10 | Todo |
