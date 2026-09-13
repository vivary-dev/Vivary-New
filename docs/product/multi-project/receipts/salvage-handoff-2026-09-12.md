# Handoff salvage and GUI reconciliation

Date: 2026-09-13
Status: inventory and bounded recovery complete, full acceptance remains blocked by the failures below

## Preserved source and authority

- Repository: private [Vivary-New](https://github.com/vivary-dev/Vivary-New).
- Immutable salvage branch: [salvage/handoff-2026-09-12](https://github.com/vivary-dev/Vivary-New/tree/salvage/handoff-2026-09-12).
- Salvage tip: `1d1018c7375d2a979d40b73eec686305da76fcf9` on GitHub and Entire.
- Base: `aa5f9c850f2219f3d195d8dbfe458b25eeebeb3c`. All 50 salvage commits are absent from `main`.
- Untouched main: `36e1ebf670395de2b0996344182476b99275290f`.
- Both `2e714f5` and `1d1018c` are ancestors of the remote salvage tip.
- [Handoff PR #4](https://github.com/vivary-dev/vivary-workbench-handoff/pull/4) closed unmerged at 2026-09-13T17:56:01Z.

The closure comment is exactly:

> Superseded. This branch is main in vivary-dev/Vivary-New. The handoff line is preserved there as salvage/handoff-2026-09-12.

No wholesale merge, force-push, rebase, branch deletion, worktree deletion, or repository archival occurred.
The handoff repository changed only through that PR closure.

The earlier contributor and workspace-role work is separate in
[PR #3](https://github.com/vivary-dev/Vivary-New/pull/3), branch `feat/workspace-foundations` at `e3fc1f8`.
Its contributor docs and module map are committed. Pending auth diagnostics and
a regression remain in a named stash plus an ignored patch. Both worktrees are clean.

## One product centered on the GUI

Main already contains the GUI in `packages/workbench`: Agent chat, Full chat,
Settings and provider configuration, project selection, file inspection, and the
dark/green styling. Preserve its Native shell, run, conversation, and action owners.
Recover missing workspace operations underneath that GUI and expose the same
operations through the CLI. A second GUI or experimental supervisor is not the target.

The exact thin-workspace content plan is recovered. The Python provider behind
the retained guarded-creation adapter remains missing after its recovery failed
two custody tests on Zo. The archived provider is Linux-only and requires trusted
namespace custody. No GUI route or action currently mounts that creation flow.
This recovery does not establish GUI workspace creation or portable desktop setup.

## Full commit inventory

Reviewed all 50 commits with `git log --stat`, individual product diffs, main
source, and main history. Classification counts: 10 product code,
23 test or proof, and 17 docs and evidence.
Mixed feature commits use the product-code class. Their focused tests belong to
that feature. Test-only and historical proof commits remain history under D4.

Jeff approved the prepared CLI snapshot correction and resumed recovery on
2026-09-13. One product commit was recovered. The other candidate was skipped
after its isolated custody tests failed, following the instruction not to rewrite.

| Commit | Subject | Class | Ruling | Evidence |
| --- | --- | --- | --- | --- |
| [84596ca](https://github.com/vivary-dev/Vivary-New/commit/84596ca4fabeeaa4ea5551e784da69eb1f05d992) | docs: accept native defaults and prepare usage policy task | docs and evidence | retain history | Preserved at [docs/product/multi-project/design.md](https://github.com/vivary-dev/Vivary-New/blob/84596ca4fabeeaa4ea5551e784da69eb1f05d992/docs/product/multi-project/design.md). No re-application or new acceptance claim. |
| [22a54e1](https://github.com/vivary-dev/Vivary-New/commit/22a54e13b4b457ae13384cabfca5308d903ebf7d) | docs: claim shipped creation and planner context packet | docs and evidence | retain history | Preserved at [docs/product/multi-project/receipts/20j-shipped-creation-and-context.md](https://github.com/vivary-dev/Vivary-New/blob/22a54e13b4b457ae13384cabfca5308d903ebf7d/docs/product/multi-project/receipts/20j-shipped-creation-and-context.md). No re-application or new acceptance claim. |
| [86ce5dd](https://github.com/vivary-dev/Vivary-New/commit/86ce5ddcc999f6f33e2114f5436972c5cf636d6a) | feat: expose exact thin workspace creation previews | product code | re-apply: applied as 21c601f | Restored plan_thin_workspace and its shared renderer. The recovery has the same stable patch ID as the original. The retained server adapter calls this API. [36e1ebf: packages/workbench/server/creation_workspace.py](https://github.com/vivary-dev/Vivary-New/blob/36e1ebf670395de2b0996344182476b99275290f/packages/workbench/server/creation_workspace.py) |
| [9135ce1](https://github.com/vivary-dev/Vivary-New/commit/9135ce147ced8edeeb9fdfd5c9d9c4051fa82fc5) | build: record existing workbench package and dependency lock | product code | superseded | Keep the imported package/lock and subsequent launcher/UI dependencies. [ba6ddbd: packages/workbench/package.json](https://github.com/vivary-dev/Vivary-New/blob/ba6ddbd31428751fd612b910e2b20a4570bf77bf/packages/workbench/package.json), [347dd17: packages/workbench/package.json](https://github.com/vivary-dev/Vivary-New/blob/347dd17dff26b734bdd623cf7a549ba87e89ef5e/packages/workbench/package.json), [595b7d6: packages/workbench/pnpm-lock.yaml](https://github.com/vivary-dev/Vivary-New/blob/595b7d671f97807b420ca3087254ac3fca2dda36/packages/workbench/pnpm-lock.yaml) |
| [faf1d40](https://github.com/vivary-dev/Vivary-New/commit/faf1d40ccccfd003cf31bc5d6c15bedb17fc86a6) | feat: compose guarded creation with shipped workspace packages | product code | drop: needs rewrite | The six missing Python files applied exactly, but two strict symlink-custody tests failed on Zo. Skip until a compatible refusal implementation is reviewed. Existing Node bridge and root providers were retained. [ba6ddbd: packages/workbench/server/creation-provider.mjs](https://github.com/vivary-dev/Vivary-New/blob/ba6ddbd31428751fd612b910e2b20a4570bf77bf/packages/workbench/server/creation-provider.mjs), [0a5256c: packages/core/vivary_core/physical_observe.py](https://github.com/vivary-dev/Vivary-New/blob/0a5256c29069cfc8ea284238fc397d887e1e1346/packages/core/vivary_core/physical_observe.py) |
| [09f0f0d](https://github.com/vivary-dev/Vivary-New/commit/09f0f0d4791f4566b0e8cc4d89569d1f65346ad1) | feat: feed governed Tropo capsules into bounded planner stages | product code | drop | The Habitat-pinned HoH supervisor conflicts with the portable Native-owned execution path. Governed-context integration needs rewrite. [09f0f0d: tools/hoh/native_host.py](https://github.com/vivary-dev/Vivary-New/blob/09f0f0d4791f4566b0e8cc4d89569d1f65346ad1/tools/hoh/native_host.py), [09f0f0d: tools/hoh_loop.py](https://github.com/vivary-dev/Vivary-New/blob/09f0f0d4791f4566b0e8cc4d89569d1f65346ad1/tools/hoh_loop.py) |
| [c29f715](https://github.com/vivary-dev/Vivary-New/commit/c29f715edb5fa1ffb539cb711b4fe3baf3a5879a) | docs: record shipped integration evidence and next decision packet | test or proof | retain history | Preserved at [docs/product/multi-project/receipts/20j-shipped-creation-and-context.md](https://github.com/vivary-dev/Vivary-New/blob/c29f715edb5fa1ffb539cb711b4fe3baf3a5879a/docs/product/multi-project/receipts/20j-shipped-creation-and-context.md). No re-application or new acceptance claim. |
| [082728f](https://github.com/vivary-dev/Vivary-New/commit/082728f279e6635de3c19a7260d3a219b69027f3) | docs(workbench): record DeepSeek title proposal and approval gate | docs and evidence | retain history | Preserved at [docs/product/multi-project/receipts/05b-deepseek-chat-titles.md](https://github.com/vivary-dev/Vivary-New/blob/082728f279e6635de3c19a7260d3a219b69027f3/docs/product/multi-project/receipts/05b-deepseek-chat-titles.md). No re-application or new acceptance claim. |
| [19aed38](https://github.com/vivary-dev/Vivary-New/commit/19aed38d8f4d8eb1493db5a1d7136e8696b46fb2) | docs(workbench): scope DeepSeek titles to GUI conversations | docs and evidence | retain history | Preserved at [docs/product/multi-project/receipts/05b-deepseek-chat-titles.md](https://github.com/vivary-dev/Vivary-New/blob/19aed38d8f4d8eb1493db5a1d7136e8696b46fb2/docs/product/multi-project/receipts/05b-deepseek-chat-titles.md). No re-application or new acceptance claim. |
| [0151ccb](https://github.com/vivary-dev/Vivary-New/commit/0151ccb38c8400b03d7e4bbe00640b1d8d48a9aa) | feat(workbench): generate GUI chat titles with DeepSeek | product code | superseded | The Full chat title handler and startup plugin are already imported unchanged. Code-chat titles remain deferred. [ba6ddbd: packages/workbench/server/chat-title.mjs](https://github.com/vivary-dev/Vivary-New/blob/ba6ddbd31428751fd612b910e2b20a4570bf77bf/packages/workbench/server/chat-title.mjs), [ba6ddbd: packages/workbench/server/plugins/00-chat-title.mjs](https://github.com/vivary-dev/Vivary-New/blob/ba6ddbd31428751fd612b910e2b20a4570bf77bf/packages/workbench/server/plugins/00-chat-title.mjs) |
| [887ee84](https://github.com/vivary-dev/Vivary-New/commit/887ee843e5c9fd829904219f7086141721707dfe) | docs(program): require staged agents and reopen GUI title acceptance | docs and evidence | retain history | Preserved at [docs/product/multi-project/receipts/05b-deepseek-chat-titles.md](https://github.com/vivary-dev/Vivary-New/blob/887ee843e5c9fd829904219f7086141721707dfe/docs/product/multi-project/receipts/05b-deepseek-chat-titles.md). No re-application or new acceptance claim. |
| [b26a5e7](https://github.com/vivary-dev/Vivary-New/commit/b26a5e779a7d092cb13874c767413e1132d8ca51) | feat(workbench): compose isolated native chat history | product code | superseded | Native history is retained through the shared identity hook and newer URL-based conversation selection. [595b7d6: packages/workbench/app/routes/chat.tsx](https://github.com/vivary-dev/Vivary-New/blob/595b7d671f97807b420ca3087254ac3fca2dda36/packages/workbench/app/routes/chat.tsx), [595b7d6: packages/workbench/app/components/layout/use-vivary-chat-identity.ts](https://github.com/vivary-dev/Vivary-New/blob/595b7d671f97807b420ca3087254ac3fca2dda36/packages/workbench/app/components/layout/use-vivary-chat-identity.ts) |
| [b35b8f6](https://github.com/vivary-dev/Vivary-New/commit/b35b8f693ee06ccd59d4dc1d12e3ad23fa44081e) | test(workbench): prepare bounded chat title GUI proof | test or proof | retain history | Preserved at [docs/product/multi-project/receipts/05b-deepseek-chat-titles.md](https://github.com/vivary-dev/Vivary-New/blob/b35b8f693ee06ccd59d4dc1d12e3ad23fa44081e/docs/product/multi-project/receipts/05b-deepseek-chat-titles.md). No re-application or new acceptance claim. |
| [71bb695](https://github.com/vivary-dev/Vivary-New/commit/71bb6957825426a15db2885fcdeb108c49dca5d7) | test(workbench): apply GUI proof owner and record transport gate | test or proof | retain history | Preserved at [docs/product/multi-project/receipts/05b-deepseek-chat-titles.md](https://github.com/vivary-dev/Vivary-New/blob/71bb6957825426a15db2885fcdeb108c49dca5d7/docs/product/multi-project/receipts/05b-deepseek-chat-titles.md). No re-application or new acceptance claim. |
| [45c6648](https://github.com/vivary-dev/Vivary-New/commit/45c6648c1534973a48e80076db98951d6acb3cb1) | test(workbench): bind mount-free GUI proof transport | test or proof | retain history | Preserved at [docs/product/multi-project/receipts/05b-deepseek-chat-titles.md](https://github.com/vivary-dev/Vivary-New/blob/45c6648c1534973a48e80076db98951d6acb3cb1/docs/product/multi-project/receipts/05b-deepseek-chat-titles.md). No re-application or new acceptance claim. |
| [d60b057](https://github.com/vivary-dev/Vivary-New/commit/d60b0573978fb1c9b5790b406f904d4d2bf1c769) | fix(workbench): bound the full installed dependency inventory | test or proof | retain history | Historical dependency-inventory limit only. Preserved at [docs/product/multi-project/receipts/05b-deepseek-chat-titles.md](https://github.com/vivary-dev/Vivary-New/blob/d60b0573978fb1c9b5790b406f904d4d2bf1c769/docs/product/multi-project/receipts/05b-deepseek-chat-titles.md). No re-application or new acceptance claim. |
| [a4acea7](https://github.com/vivary-dev/Vivary-New/commit/a4acea786989340dc0a9258f6822854c06c5f091) | test(workbench): prepare approved second GUI bootstrap | test or proof | retain history | Preserved at [docs/product/multi-project/receipts/05b-deepseek-chat-titles.md](https://github.com/vivary-dev/Vivary-New/blob/a4acea786989340dc0a9258f6822854c06c5f091/docs/product/multi-project/receipts/05b-deepseek-chat-titles.md). No re-application or new acceptance claim. |
| [e370208](https://github.com/vivary-dev/Vivary-New/commit/e37020822f6e3f042a16fc15689835a7e9a6025d) | docs(workbench): preserve pre-build resource refusal evidence | docs and evidence | retain history | Preserved at [docs/product/multi-project/receipts/05b-deepseek-chat-titles.md](https://github.com/vivary-dev/Vivary-New/blob/e37020822f6e3f042a16fc15689835a7e9a6025d/docs/product/multi-project/receipts/05b-deepseek-chat-titles.md). No re-application or new acceptance claim. |
| [63a1d96](https://github.com/vivary-dev/Vivary-New/commit/63a1d96d1fada4693100669e202ce54b21e5613d) | docs(workbench): verify preserved GUI continuation evidence | docs and evidence | retain history | Preserved at [docs/product/multi-project/receipts/05b-deepseek-chat-titles.md](https://github.com/vivary-dev/Vivary-New/blob/63a1d96d1fada4693100669e202ce54b21e5613d/docs/product/multi-project/receipts/05b-deepseek-chat-titles.md). No re-application or new acceptance claim. |
| [9683102](https://github.com/vivary-dev/Vivary-New/commit/96831022053e5d60a419f686af757db18a6c884c) | test(workbench): prepare one-time GUI proof continuation | test or proof | retain history | Preserved at [docs/product/multi-project/receipts/05b-deepseek-chat-titles.md](https://github.com/vivary-dev/Vivary-New/blob/96831022053e5d60a419f686af757db18a6c884c/docs/product/multi-project/receipts/05b-deepseek-chat-titles.md). No re-application or new acceptance claim. |
| [7728a91](https://github.com/vivary-dev/Vivary-New/commit/7728a919a63e6f58f1d20dbd26ec2a27abe519c1) | docs(workbench): preserve GUI continuation resource failure | docs and evidence | retain history | Preserved at [docs/product/multi-project/receipts/05b-deepseek-chat-titles.md](https://github.com/vivary-dev/Vivary-New/blob/7728a919a63e6f58f1d20dbd26ec2a27abe519c1/docs/product/multi-project/receipts/05b-deepseek-chat-titles.md). No re-application or new acceptance claim. |
| [47d2e0a](https://github.com/vivary-dev/Vivary-New/commit/47d2e0a5bfbda31f64a614d0ff8f0dde76f4a1a0) | docs(workbench): record unapplied GUI recovery proposal | docs and evidence | retain history | Preserved at [docs/product/multi-project/receipts/05b-deepseek-chat-titles.md](https://github.com/vivary-dev/Vivary-New/blob/47d2e0a5bfbda31f64a614d0ff8f0dde76f4a1a0/docs/product/multi-project/receipts/05b-deepseek-chat-titles.md). No re-application or new acceptance claim. |
| [f581155](https://github.com/vivary-dev/Vivary-New/commit/f581155206c5b3fe11a26607681523f88784850d) | fix(05b): bound recovery inspection memory and preserve proof budget | test or proof | retain history | Preserved at [docs/product/multi-project/receipts/05b-deepseek-chat-titles.md](https://github.com/vivary-dev/Vivary-New/blob/f581155206c5b3fe11a26607681523f88784850d/docs/product/multi-project/receipts/05b-deepseek-chat-titles.md). No re-application or new acceptance claim. |
| [badae74](https://github.com/vivary-dev/Vivary-New/commit/badae747f24d8622cafb3e6de4693c496c9a0b60) | docs(05b): preserve interrupted recovery failure and remaining time | docs and evidence | retain history | Preserved at [docs/product/multi-project/receipts/05b-deepseek-chat-titles.md](https://github.com/vivary-dev/Vivary-New/blob/badae747f24d8622cafb3e6de4693c496c9a0b60/docs/product/multi-project/receipts/05b-deepseek-chat-titles.md). No re-application or new acceptance claim. |
| [195ef03](https://github.com/vivary-dev/Vivary-New/commit/195ef0353f122731bd26b7734a6b5bab5388fe12) | fix(05b): resume interrupted GUI proof with exact readonly mounts | test or proof | retain history | Preserved at [docs/product/multi-project/receipts/05b-deepseek-chat-titles.md](https://github.com/vivary-dev/Vivary-New/blob/195ef0353f122731bd26b7734a6b5bab5388fe12/docs/product/multi-project/receipts/05b-deepseek-chat-titles.md). No re-application or new acceptance claim. |
| [9b11c45](https://github.com/vivary-dev/Vivary-New/commit/9b11c45f56098ce2272b0a0c77697be09c2864f6) | feat(workbench): checkpoint complete app source and validation for Zo | product code | drop | The mounted GUI and custody behavior already exists on main. The remaining registry_observe.py wrapper has no product caller, so restoring this checkpoint adds an unused path. [0a5256c: packages/core/vivary_core/root_identity_lifecycle.py](https://github.com/vivary-dev/Vivary-New/blob/0a5256c29069cfc8ea284238fc397d887e1e1346/packages/core/vivary_core/root_identity_lifecycle.py), [0a5256c: packages/core/vivary_core/root_provider_stdio.py](https://github.com/vivary-dev/Vivary-New/blob/0a5256c29069cfc8ea284238fc397d887e1e1346/packages/core/vivary_core/root_provider_stdio.py), [595b7d6: packages/workbench/app/root.tsx](https://github.com/vivary-dev/Vivary-New/blob/595b7d671f97807b420ca3087254ac3fca2dda36/packages/workbench/app/root.tsx) |
| [c8fd467](https://github.com/vivary-dev/Vivary-New/commit/c8fd467b32ce515a4e3b2d9941a9dddb57536c7b) | docs(program): checkpoint current plans and registry dependencies | product code | superseded | The quarantine and VCS replay model is imported. Keep the newer local-root denial guards. Missing coverage and historical planning migration stay separate from this recovery. [ba6ddbd: scripts/registry_contract_model.mjs](https://github.com/vivary-dev/Vivary-New/blob/ba6ddbd31428751fd612b910e2b20a4570bf77bf/scripts/registry_contract_model.mjs), [00047ae: scripts/registry_contract_model.mjs](https://github.com/vivary-dev/Vivary-New/blob/00047ae20663d54b681c9cdea5d0c211ddfb6206/scripts/registry_contract_model.mjs) |
| [29f7686](https://github.com/vivary-dev/Vivary-New/commit/29f7686ff40acfd00624875bd25ae3c795c67c7c) | docs(05b): record private GitHub and Zo delivery approval | docs and evidence | retain history | Preserved at [docs/product/multi-project/receipts/05b-deepseek-chat-titles.md](https://github.com/vivary-dev/Vivary-New/blob/29f7686ff40acfd00624875bd25ae3c795c67c7c/docs/product/multi-project/receipts/05b-deepseek-chat-titles.md). No re-application or new acceptance claim. |
| [208934b](https://github.com/vivary-dev/Vivary-New/commit/208934b20d003cd3b653200d9b439d293c8fd16f) | docs(05b): align Zo project instructions and verified source delivery | docs and evidence | retain history | Preserved at [docs/product/multi-project/receipts/05b-deepseek-chat-titles.md](https://github.com/vivary-dev/Vivary-New/blob/208934b20d003cd3b653200d9b439d293c8fd16f/docs/product/multi-project/receipts/05b-deepseek-chat-titles.md). No re-application or new acceptance claim. |
| [9783790](https://github.com/vivary-dev/Vivary-New/commit/9783790a0272adfd26aa3ef1186852243f6710b4) | docs(05b): complete portable Zo handoff and ignore private scratch | docs and evidence | retain history | Preserved at [docs/product/multi-project/receipts/05b-deepseek-chat-titles.md](https://github.com/vivary-dev/Vivary-New/blob/9783790a0272adfd26aa3ef1186852243f6710b4/docs/product/multi-project/receipts/05b-deepseek-chat-titles.md). No re-application or new acceptance claim. |
| [396510b](https://github.com/vivary-dev/Vivary-New/commit/396510bd5e10d515a7f49758b435f58ba74b0cb0) | test: prepare bounded Zo GUI verification | test or proof | retain history | Preserved at [docs/product/multi-project/receipts/05b-deepseek-chat-titles.md](https://github.com/vivary-dev/Vivary-New/blob/396510bd5e10d515a7f49758b435f58ba74b0cb0/docs/product/multi-project/receipts/05b-deepseek-chat-titles.md). No re-application or new acceptance claim. |
| [72ddef2](https://github.com/vivary-dev/Vivary-New/commit/72ddef2ed5ba4bbc2d53905f4b512192d39f858d) | fix: preserve browser evidence ownership in Zo proof | test or proof | retain history | Preserved at [docs/product/multi-project/receipts/05b-deepseek-chat-titles.md](https://github.com/vivary-dev/Vivary-New/blob/72ddef2ed5ba4bbc2d53905f4b512192d39f858d/docs/product/multi-project/receipts/05b-deepseek-chat-titles.md). No re-application or new acceptance claim. |
| [d2bcc47](https://github.com/vivary-dev/Vivary-New/commit/d2bcc472b875d0bfe2f717d571f39c7520484908) | fix: open native history through the installed panel menu | test or proof | retain history | Browser-proof menu selection and assertions only, with no app navigation change. Preserved at [docs/product/multi-project/receipts/05b-deepseek-chat-titles.md](https://github.com/vivary-dev/Vivary-New/blob/d2bcc472b875d0bfe2f717d571f39c7520484908/docs/product/multi-project/receipts/05b-deepseek-chat-titles.md). No re-application or new acceptance claim. |
| [2e714f5](https://github.com/vivary-dev/Vivary-New/commit/2e714f56f62b3fb17411c556947081067dee41ab) | test: capture native history transitions in bounded Zo continuation | test or proof | retain history | Preserved at [docs/product/multi-project/receipts/05b-deepseek-chat-titles.md](https://github.com/vivary-dev/Vivary-New/blob/2e714f56f62b3fb17411c556947081067dee41ab/docs/product/multi-project/receipts/05b-deepseek-chat-titles.md). No re-application or new acceptance claim. |
| [71947f3](https://github.com/vivary-dev/Vivary-New/commit/71947f38fb2e5c8fe810c478c9cf9ad41c9f435d) | docs: require atomic reviewed changes on Zo with private Entire staging | docs and evidence | retain history | Preserved at [AGENTS.md](https://github.com/vivary-dev/Vivary-New/blob/71947f38fb2e5c8fe810c478c9cf9ad41c9f435d/AGENTS.md). No re-application or new acceptance claim. |
| [9f48d7b](https://github.com/vivary-dev/Vivary-New/commit/9f48d7bbfe0c09781d7090635353d1d5f366036d) | fix(workbench): isolate chat history by organization and verify GUI behavior | product code | superseded | Main retains organization-qualified chat scope and the history-menu focus rule. [ba6ddbd: packages/workbench/app/lib/chat-scope.ts](https://github.com/vivary-dev/Vivary-New/blob/ba6ddbd31428751fd612b910e2b20a4570bf77bf/packages/workbench/app/lib/chat-scope.ts), [ba6ddbd: packages/workbench/app/global.css](https://github.com/vivary-dev/Vivary-New/blob/ba6ddbd31428751fd612b910e2b20a4570bf77bf/packages/workbench/app/global.css), [595b7d6: packages/workbench/app/components/layout/use-vivary-chat-identity.ts](https://github.com/vivary-dev/Vivary-New/blob/595b7d671f97807b420ca3087254ac3fca2dda36/packages/workbench/app/components/layout/use-vivary-chat-identity.ts) |
| [bb415f6](https://github.com/vivary-dev/Vivary-New/commit/bb415f6f698ea87ca38e273fe3e15c36ca9d1070) | test(workbench): prepare portable C5 verification with bounded Zo evidence | test or proof | retain history | Preserved at [docs/product/multi-project/receipts/06e-project-selection.md](https://github.com/vivary-dev/Vivary-New/blob/bb415f6f698ea87ca38e273fe3e15c36ca9d1070/docs/product/multi-project/receipts/06e-project-selection.md). No re-application or new acceptance claim. |
| [7319f7f](https://github.com/vivary-dev/Vivary-New/commit/7319f7f7ff61e74274746d0f39b1ec4f8d3ec236) | docs: reconcile Zo continuation evidence and handoff | docs and evidence | retain history | Preserved at [docs/product/multi-project/receipts/05b-deepseek-chat-titles.md](https://github.com/vivary-dev/Vivary-New/blob/7319f7f7ff61e74274746d0f39b1ec4f8d3ec236/docs/product/multi-project/receipts/05b-deepseek-chat-titles.md). No re-application or new acceptance claim. |
| [c823144](https://github.com/vivary-dev/Vivary-New/commit/c8231443cf67926a9f0a85abb306a7000871b6a1) | docs: accept bounded 06e focused test evidence | docs and evidence | retain history | Preserved at [docs/product/multi-project/receipts/06e-project-selection.md](https://github.com/vivary-dev/Vivary-New/blob/c8231443cf67926a9f0a85abb306a7000871b6a1/docs/product/multi-project/receipts/06e-project-selection.md). No re-application or new acceptance claim. |
| [2f20ab7](https://github.com/vivary-dev/Vivary-New/commit/2f20ab7962ce086aa93d8f33000d0f895e26f3b5) | test: add bounded C5 browser proof | test or proof | retain history | Preserved at [docs/product/multi-project/receipts/06e-project-selection.md](https://github.com/vivary-dev/Vivary-New/blob/2f20ab7962ce086aa93d8f33000d0f895e26f3b5/docs/product/multi-project/receipts/06e-project-selection.md). No re-application or new acceptance claim. |
| [fe0a1dc](https://github.com/vivary-dev/Vivary-New/commit/fe0a1dcb34de913ab4b5a24046ba0aab3b6fd77a) | test: correct C5 custody within retained retry budget | test or proof | retain history | Preserved at [docs/product/multi-project/receipts/06e-project-selection.md](https://github.com/vivary-dev/Vivary-New/blob/fe0a1dcb34de913ab4b5a24046ba0aab3b6fd77a/docs/product/multi-project/receipts/06e-project-selection.md). No re-application or new acceptance claim. |
| [f7f833d](https://github.com/vivary-dev/Vivary-New/commit/f7f833d4905e8bc130c185a0fc52221430d197c0) | test: match Native batch state within retained C5 budget | test or proof | retain history | Preserved at [docs/product/multi-project/receipts/06e-project-selection.md](https://github.com/vivary-dev/Vivary-New/blob/f7f833d4905e8bc130c185a0fc52221430d197c0/docs/product/multi-project/receipts/06e-project-selection.md). No re-application or new acceptance claim. |
| [13e2d7b](https://github.com/vivary-dev/Vivary-New/commit/13e2d7bfd03d579937de10b72924f1ac2f2f703e) | test: validate Native state sync effects in C5 proof | test or proof | retain history | Preserved at [docs/product/multi-project/receipts/06e-project-selection.md](https://github.com/vivary-dev/Vivary-New/blob/13e2d7bfd03d579937de10b72924f1ac2f2f703e/docs/product/multi-project/receipts/06e-project-selection.md). No re-application or new acceptance claim. |
| [a2fbf40](https://github.com/vivary-dev/Vivary-New/commit/a2fbf40cf48e395e45d0448e55dfcb6d7ee9e8bf) | test: settle Native integration schema before C5 baseline | test or proof | retain history | Preserved at [docs/product/multi-project/receipts/06e-project-selection.md](https://github.com/vivary-dev/Vivary-New/blob/a2fbf40cf48e395e45d0448e55dfcb6d7ee9e8bf/docs/product/multi-project/receipts/06e-project-selection.md). No re-application or new acceptance claim. |
| [d1c09ea](https://github.com/vivary-dev/Vivary-New/commit/d1c09ea12c415c8aeebbfb2ad360a1c61b73e61a) | test: correct C5 artifact assertions and chat initialization | test or proof | retain history | Preserved at [docs/product/multi-project/receipts/06e-project-selection.md](https://github.com/vivary-dev/Vivary-New/blob/d1c09ea12c415c8aeebbfb2ad360a1c61b73e61a/docs/product/multi-project/receipts/06e-project-selection.md). No re-application or new acceptance claim. |
| [01a58b2](https://github.com/vivary-dev/Vivary-New/commit/01a58b21f5d570f0d632463294911b50caa9b903) | test: initialize C5 maintenance stores and prove manual refresh | test or proof | retain history | Preserved at [docs/product/multi-project/receipts/06e-project-selection.md](https://github.com/vivary-dev/Vivary-New/blob/01a58b21f5d570f0d632463294911b50caa9b903/docs/product/multi-project/receipts/06e-project-selection.md). No re-application or new acceptance claim. |
| [d9bf97e](https://github.com/vivary-dev/Vivary-New/commit/d9bf97e1c05dbb9a4c8e6ddd1af311d682f91eb3) | test: bind C5 replacement proof to response bytes | test or proof | retain history | Preserved at [docs/product/multi-project/receipts/06e-project-selection.md](https://github.com/vivary-dev/Vivary-New/blob/d9bf97e1c05dbb9a4c8e6ddd1af311d682f91eb3/docs/product/multi-project/receipts/06e-project-selection.md). No re-application or new acceptance claim. |
| [c857763](https://github.com/vivary-dev/Vivary-New/commit/c85776355fb7c428ac94e2c4954fa81fddfbe7f0) | test: settle C5 shutdown within supplemental budget | test or proof | retain history | Preserved at [docs/product/multi-project/receipts/06e-project-selection.md](https://github.com/vivary-dev/Vivary-New/blob/c85776355fb7c428ac94e2c4954fa81fddfbe7f0/docs/product/multi-project/receipts/06e-project-selection.md). No re-application or new acceptance claim. |
| [542e9ec](https://github.com/vivary-dev/Vivary-New/commit/542e9ec65930706faeddedc2016a7521dc2335e4) | docs: make product engineering the default | docs and evidence | retain history | Preserved at [docs/product/multi-project/receipts/06e-project-selection.md](https://github.com/vivary-dev/Vivary-New/blob/542e9ec65930706faeddedc2016a7521dc2335e4/docs/product/multi-project/receipts/06e-project-selection.md). No re-application or new acceptance claim. |
| [1d1018c](https://github.com/vivary-dev/Vivary-New/commit/1d1018c7375d2a979d40b73eec686305da76fcf9) | feat: start Workbench with configured project services | product code | superseded | Startup, request draining, shutdown, and Node rendering are retained. Local startup extends the configured-provider path. [ba6ddbd: packages/workbench/server/plugins/01-project-services.mjs](https://github.com/vivary-dev/Vivary-New/blob/ba6ddbd31428751fd612b910e2b20a4570bf77bf/packages/workbench/server/plugins/01-project-services.mjs), [00047ae: packages/workbench/server/project-services.mjs](https://github.com/vivary-dev/Vivary-New/blob/00047ae20663d54b681c9cdea5d0c211ddfb6206/packages/workbench/server/project-services.mjs), [ba6ddbd: packages/workbench/vite.config.ts](https://github.com/vivary-dev/Vivary-New/blob/ba6ddbd31428751fd612b910e2b20a4570bf77bf/packages/workbench/vite.config.ts) |

## Recovery details and retained evidence

- `86ce5dd`: applied as `21c601f`. Recovered `plan_thin_workspace`, its shared
  renderer, package guide, and seven preview tests. Thirteen existing thin-init
  tests passed before and after. The retained server adapter calls this API.
- `faf1d40`, needs rewrite: attempted only the six missing Python modules/tests.
  Five add/add conflicts retained main's existing Workbench files. All six added
  blobs matched the original source. Of 45 creation tests, 43 passed and two
  failed. The failures independently reproduced in the symlink-parent and changed
  ancestor cases. Zo followed same-object directory symlinks despite the requested
  no-follow open flags. No test was weakened. The six candidate files were removed
  before commit, and main's Node bridge, receipts, registry, and root providers
  remain unchanged. A compatible custody implementation needs separate review.
- `09f0f0d`, needs rewrite: port governed Tropo context preparation into existing
  Native Code runs after project authorization. Remove assumptions about a pinned
  Habitat image, Ubuntu executable paths, and a separate HoH supervisor.
- `9b11c45`: main retains `RootIdentityLifecycle`, the stdio provider, and the three
  root-identity suites through `0a5256c`. Main's provider also accepts verified Git,
  linked-worktree, and nested-project layouts. Restoring the salvage provider would
  narrow it to no-VCS roots. The unused `registry_observe.py` wrapper stays archived.
- `1d1018c` does not change Core files. Its root-identity source is inherited from
  `9b11c45`, whose relevant behavior is already present on main.
- `c8fd467`: its quarantine/replay runtime model is superseded. Seven explicit VCS
  replay/quarantine cases and two mutation operators are absent from main. Preserve
  their source as coverage candidates for a separate reviewed change. Do not import
  its older planning schema or statuses as current product truth.

All committed tests, fixtures, receipts, and proof scripts remain reachable through
the immutable salvage branch on GitHub and Entire. Each history row links its
original evidence at the exact commit. Untracked historical 05b/06e evidence and
budgets remain in the preserved Zo handoff workspace. No old campaign was rerun.
The canonical ignored handoff records the parked auth stash and local log paths.

## Verification and acceptance limits

The original main baseline failed two frozen Tropo command streams because
`30b9393` added community commands and filter help. Jeff approved the prepared
correction and continued recovery. `aef4d1a` fixes those snapshots. A separate
CI failure exposed an old 63-case assertion against an existing 83-case fixture.
`4946315` corrects that assertion and its diagnostic. Both fixes are also in PR #3.
No runtime registry or CLI behavior changed in those baseline fixes.

| Check | Observed result |
| --- | --- |
| Remote ancestry and count | Passed: all 50 original commits and both required ancestors preserved |
| CLI characterization | 3 passed after the snapshot correction |
| Thin initialization and preview | 13 passed before and after recovery, plus 7 new preview tests passed |
| Registry model | 40 passed, all 83 fixture decisions matched |
| Physical observer | 23 passed on supported tmpfs after the initial unsupported v9fs run |
| Creation receipt and effect-port checks | 21 passed against existing code |
| Attempted Python creation recovery | 43 passed, 2 errors. Candidate skipped, files removed |
| Full create-vivary Python suite | 264 passed, 5 skipped, 173 subtests passed, 2 failing subtests |
| Full Core suite | 869 passed, 1 skipped, 40 subtests passed, 4 failed |
| Workbench suites | 14 suites passed, 4 failed, 2 time-limited, 2 excluded, 12 not reached. Completed verdicts: 88 tests passed, 4 failed |
| Build and TypeScript | Workbench production build and direct tsc --noEmit both passed |
| Hosted Zo GUI | Navigation, settings, file inspection, composer focus passed. Conversation-selection save warning prevents full acceptance |

Creator failures are the legacy v0.2.0 and v0.3.1 doctor privacy-profile snapshot
comparisons at `test_create_vivary.py:1916`. Hashes match, but retained logs show
sub-millisecond mtime differences. The cause is not established. The npm launcher
suite was not run after the Python suite failed.

Core failures are host-dependent checks: one executable fsmonitor hook cannot run
on Zo's noexec tmpfs, and three chmod-based refusal cases remain writable as UID 0.
No permission assertion or product guard was relaxed. The creation-provider
failure is distinct from those Core baseline limits.

The final receipt records partial results honestly. Passing focused tests does
not satisfy the requested all-suite acceptance. No historical campaign was
replayed, no desktop package was built, and no model call was made.

## Workbench and hosted observations

The sequential Workbench run ended after 595 seconds. Completed passing suites
cover local roots, registry scopes, Native registration and VCS registration,
project catalog, runtime activity/preparation/readiness/start, project services,
registry HTTP, and creation receipts/effect ports.

Four suites reported failures. The historical GUI-runner fixture is absent.
Two mutation suites stopped because the temporary runner omitted their required
heap argument, so those are setup failures without a substantive verdict.
Registry actions passed 12 cases but its metadata test still expects the entire
app actions directory to be absent. The real app now has an actions directory.
The mutation and directory assertions were not rewritten in this recovery.

Chat-title completed eight assertions but its Native background plugins kept the
process alive until the 120-second limit. Registry-store completed nine assertions
before the overall deadline, without a final verdict. Creation-provider was
excluded because its skipped Python entrypoint remains missing. The readiness
component is Windows-only. Two root-provider wire suites, the activity component,
startup, seven TypeScript suites, and the Vitest shell were not reached. These
results do not represent a passing full Workbench suite.

The current branch built successfully on Zo and passed direct TypeScript checking.
The existing private service was restarted from that build without changing its
configuration or access boundary. Browser review reached Agent, Workbench,
Settings, and Agent again. The draft URL survived this navigation. The personal
workspace file list and README contents rendered. The focused composer retained
one restrained border without the earlier nested lime rectangles.

On first load the app displayed "Your conversation selection could not be saved."
That known hosted write/session issue prevents accepting persistence from this
smoke. No conversation was submitted, model called, provider credential changed,
or project registered. No existing project was available for a creation or
project-switching journey. The Workbench page still reports its file-editing
panel is not connected. The Agent file inspector is the working read surface.

Full command output and per-suite results remain in the ignored Zo integration
folder `.tmp/salvage-reconcile-20260913/`. Its `workbench-summary.json` names each
suite, command, result, and log. Source recovery and baseline corrections received
independent review. Only a stale failure-message count was found and corrected.

## Remaining implementation

- Restore guarded creation only after its strict custody behavior works on the
  supported host. Keep the failure closed. Then mount and exercise the actual
  GUI creation action using the recovered shared content plan.
- Port `09f0f0d` governed Tropo context into the existing Native Code execution
  path. This needs portable integration, not restoration of the HoH supervisor.
- Resolve the named suite failures and test-host incompatibilities before calling
  the recovery PR accepted. Keep contributor work in PR #3 and recovery in PR #4.
- Hosted settings writes still have the separately recorded private-proxy session
  issue. The parked auth proposal is outside this salvage recovery and remains
  unapplied.

The salvage branch and main are unchanged. The recovery PR stays draft. The
50-row table above is the complete disposition of this source line, not a claim
that the entire Vivary product is finished.

## Subsequent consolidation, 2026-09-13

Jeff later authorized merging useful work toward one desktop product. PR #3
merged into dev at `8a13a5d`. PR #4 was updated against that baseline and
retargeted to dev. The combined renderer passed 16 thin-init tests, 7 preview
tests, and 203 Tropo tests. Independent source review approved the integration.
All applicable PR checks passed before PR #4 merged at `7a86a86`.

The draft/blocked statements above describe the earlier recovery checkpoint.
They are not the active merge state. The [desktop release target](../desktop-release.md)
now assigns the remaining acceptance gaps to concrete packets. Integration does
not establish a finished Windows application. Main and the salvage tip were
unchanged by these merges.
