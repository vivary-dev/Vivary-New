# Native context compaction policy

**Status:** Native-default policy accepted by the owner on 2026-09-07. Integration and comparative verification remain pending.

**Research date:** 2026-09-07.

**Reader:** Owners of Vivary's native runtime session contract and its verification fixtures.

**Retirement:** Move the requirements into the native adapter contract and acceptance evidence, then replace this report with a link from that contract.

## Recommendation

Keep each native runtime's model-aware compaction default. Primary research does not establish one best token threshold across models, runtimes, and coding tasks. Treat 250,000 active-context tokens as a candidate benchmark, not a product default. Adopt an override only if representative Vivary tasks show better completion, factual recall, response completeness, and cost than the native baseline.

Any tested threshold is a per-session working-context limit. It does not replace the existing 100,000-token cumulative proof budget for the whole proof packet across invocations.

Count the full context already active for the next call once, including instructions, messages, tool definitions, tool results, and cached prefix content. Track the future response and reasoning reserve separately when resolving a safe threshold. Do not treat repeated billing or cumulative usage across calls as active-context size. Anthropic documents that the context window contains the request and generated response. Its request count includes system instructions, messages, tools, images, and documents ([Claude context windows](https://platform.claude.com/docs/en/build-with-claude/context-windows)). OpenAI also describes context as input plus output for each inference call ([Codex agent loop](https://openai.com/index/unrolling-the-codex-agent-loop/)).

A candidate threshold must yield to a smaller model window and the runtime's reserved headroom. Preserve the user's chosen model, reasoning effort, and response verbosity. A context threshold is separate from output limits.

## Use the runtime's native mechanism

### Codex

Leave `model_auto_compact_token_limit` unset and keep the default `model_auto_compact_token_limit_scope = "total"`. The [Codex configuration reference](https://developers.openai.com/codex/config-reference/) says the unset limit uses model defaults. It defines `total` as the full active context and `body_after_prefix` as only growth after the carried compaction prefix. When model metadata omits a threshold, the current source uses 90% of the resolved context as a fallback. It clamps configured or model-supplied thresholds to that bound when the window is known ([`openai_models.rs`](https://github.com/openai/codex/blob/main/codex-rs/protocol/src/openai_models.rs)). This model-aware rule is the baseline for any 250,000-token experiment.

Keep `model_verbosity` unset unless the user selects an override. The configuration reference says an unset value uses the selected model or preset default. OpenAI's reasoning guide says reasoning and visible output share `max_output_tokens`. Exhaustion can return `incomplete` before any visible answer, and it recommends an initial 25,000-token reserve ([allocating space for reasoning](https://developers.openai.com/api/docs/guides/reasoning#allocating-space-for-reasoning)). Vivary should detect `incomplete` and keep the task open. It should not translate that API starting point into a forced Codex response limit.

Codex automatically calls its native compact endpoint after the threshold. The returned context includes an opaque compaction item that carries prior state in fewer tokens ([Codex agent loop](https://openai.com/index/unrolling-the-codex-agent-loop/)). The standalone Responses API also supports server-side and explicit compaction, but that is an API integration contract, not a reason to wrap Codex in another model loop. The API requires clients to pass the returned compacted window intact because it can contain retained items as well as the opaque item ([OpenAI compaction guide](https://developers.openai.com/api/docs/guides/compaction#standalone-compact-endpoint)).

Local inspection found `@openai/codex` 0.153.4, but the installed package contains a launcher rather than the Rust source. The links above describe official documentation and current `main`. They do not prove the installed tag's exact implementation.

### Claude Code

Leave `CLAUDE_CODE_AUTO_COMPACT_WINDOW` and `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` unset for the baseline. Claude Code's default compaction threshold varies by model and can be the model limit ([default auto-compact thresholds](https://code.claude.com/docs/en/model-config#default-auto-compact-thresholds)). An override can set an effective window from 100,000 to 1,000,000 tokens, capped at the model's real window. A percentage override can compact earlier but applies only to sessions that compact before the context limit ([Claude Code environment variables](https://code.claude.com/docs/en/env-vars#environment-variables)). Measure the observed trigger in any 250,000-token experiment instead of deriving one percentage for every model.

Claude Code's `/compact` command accepts focus instructions, while automatic compaction stays owned by Claude Code ([Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web#manage-context)). `CLAUDE_CODE_MAX_OUTPUT_TOKENS` has model-specific defaults and caps, and raising it reduces space before compaction. Leave it unset unless the user chose a value ([Claude Code environment variables](https://code.claude.com/docs/en/env-vars#environment-variables)). Thinking is part of output and the context budget, so model capability and native headroom still govern the actual trigger.

## Preserve durable task state

Checkpoint the existing task record before the configured risk boundary instead of depending on interception of every compaction event. Save the goal, constraints, decisions, artifact paths and hashes, verified facts, pending work, and identifiers for external effects. Do not save hidden reasoning or create a new memory database. After compaction, reconcile the native session against that record before continuing. Native compacted state supports continuation inside one runtime. Codex uses an opaque encrypted item, while Claude Code uses a summary. The durable facts support crash recovery and transfer between runtimes.

Anthropic's context-engineering guidance warns that compaction can lose details. It recommends removing stale tool results, keeping structured notes outside the context window, and retrieving files or queries when needed ([Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)). These practices reduce context before summarization and make lost details recoverable.

Prefer bounded tool output and retrieval from saved artifacts before adding more summary layers. In one SWE-agent evaluation across five model configurations, masking older observations halved cost relative to raw history and matched or slightly exceeded LLM summarization's solve rate. The authors also reported an initial OpenHands check, so this is useful evidence rather than a universal result ([The Complexity Trap](https://arxiv.org/abs/2508.21433)). Long context alone is not a quality guarantee. On the retrieval tasks and models tested in *Lost in the Middle*, quality often fell when relevant facts appeared in the middle of long inputs ([Liu et al.](https://aclanthology.org/2024.tacl-1.9/)).

## Verification required

Use low thresholds in deterministic fixtures so tests cross the adapter boundary repeatedly. These fixtures prove accounting and recovery, not native compaction quality. Verify that the adapter:

- uses the native model-aware default unless an evidence-backed override is selected.
- counts the intended scope and respects the resolved model ceiling.
- preserves durable task fields and artifact hashes across repeated compaction.
- recovers from a crash between checkpoint and the next inference without replaying external effects.
- reports failed compaction or incomplete model output as unfinished work.
- produces a complete visible response after compaction.
- records enough evidence to compare native runs without changing user-selected output settings.

Run the quality comparison as a separate, bounded, authorized packet with its own budget. Replay the same representative tasks with the same runtime, model, reasoning, and output settings. Compare the native default with the 250,000-token candidate only where the runtime and model accept that value. Measure task completion, factual recall, response completeness, latency, and cost. Do not charge this research against packet 20a's 100,000-token proof budget.

Run all checks in the bounded Habitat environment named by the owning packet. No live comparative evidence exists yet. Until it does, keep this document labeled as an implementation proposal.
