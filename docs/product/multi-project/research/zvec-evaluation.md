# zvec-grep evaluation for Vivary

Primary-source review: 2026-09-13. No installation, model download, indexing, or
runtime measurement was performed. Follow [the desktop release plan](../desktop-release.md)
and [packet 11d](../packets/11d-evaluate-zvec-search.md). Adoption remains a proposal.

## Verified upstream facts

- [zvec-grep](https://github.com/zvec-ai/zvec-grep) combines managed ripgrep,
  ranked BM25, and vector retrieval across code and text. It is Apache-2.0.
  Exact identifiers and paths still suit ripgrep. Hybrid retrieval can help when
  the source location or wording is unknown.
- The [package manifest](https://github.com/zvec-ai/zvec-grep/blob/main/package.json)
  requires Node >=22. Dependencies include `@zvec/zvec`, Hugging Face tokenizers
  and Transformers, `@vscode/ripgrep`, Tree-sitter WASM, and optional `node-llama-cpp`.
  This adds native packaging and model-runtime work beyond ordinary text search.
- [Upstream CI](https://github.com/zvec-ai/zvec-grep/blob/main/.github/workflows/ci.yml)
  targets Windows Node24 for unit, integration, package-consumer, and real local-model
  checks. This review did not verify the latest run or Vivary.exe compatibility.
  Windows x64 is the first candidate. No Windows ARM64 acceptance is claimed.
- [Embedding documentation](https://github.com/zvec-ai/zvec-grep/blob/main/docs/07-embedding.md)
  names `local/potion-code-16m-v2` as the small local default. Models download on
  first use, normally from Hugging Face, and cache locally. A first indexed search
  can create an index automatically. Remote models require data-transfer authority.
- Local embeddings avoid provider API charges but consume bandwidth, CPU, memory,
  and disk. No measured Vivary cost or footprint is available. Remote API pricing
  is separate. Vendor benchmarks using remote models do not establish local results.
- The README and indexed documentation showed differing CLI spellings. Pin a
  released artifact and its matching interface before running the spike.

## Proposed decision criteria

Keep 11c exact search as the default, with no index or model prerequisite.
Compare ripgrep, BM25, and one small local hybrid model on fixed code/Markdown
queries. Agree numeric resource limits and download authority before starting.
Measure useful source matches, cold cost, warm latency, memory, and index size.

Check packaged Windows x64, Unicode paths, changes/deletions, restart, privacy
exclusions, and revoked roots. Return bounded source locations through the existing
Native tool/action owner. Treat the index as disposable derived data, never the
owner of project memory or transcripts. Prefer direct execution. No new agent loop,
mandatory daemon, global agent-config installer, or remote embedding default.

Proceed only if measured usefulness justifies the local footprint and maintenance.
Deferring or rejecting this dependency must not delay the first Windows release.
