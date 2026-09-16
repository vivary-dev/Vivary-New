# Entire for contributors

Entire records supported agent sessions alongside Git checkpoints. GitHub owns
issues and PR review. The private Entire remote holds source and session
checkpoints. A source push alone does not capture an agent conversation.

This setup was checked with Entire beta 0.10.6. Read the installed
`entire agent-help` and each command's `--help` before using different versions.
The [official setup guide](https://github.com/entireio/cli/blob/v0.10.6/README.md)
and [privacy guide](https://github.com/entireio/cli/blob/v0.10.6/docs/security-and-privacy.md)
explain the capture model.

## Enable a checkout

Install Entire using its official instructions and authenticate your contributor
account. Confirm `origin` is private `vivary-dev/Vivary-New` and `entire` points
to its private Entire mirror. Never put authentication tokens in tracked files.

For a fresh checkout with no checkpoint store, run:

```sh
entire enable --local --agent codex --checkpoint-backend refs \
  --skip-push-sessions --telemetry=false --absolute-git-hook-path \
  --agent-help-skill --search-skill --no-init-repo
entire agent add claude-code --agent-help-skill --search-skill
```

Select only agents you use. Preserve an existing checkpoint backend when enabling
an established checkout. Do not import old session history as part of setup.

Before enabling uploads, inspect `git remote get-url --push --all entire`.
Merge these keys into `.entire/settings.local.json`, preserving other settings:

```json
{
  "strategy_options": {
    "checkpoint_push_remote": "entire",
    "push_sessions": true
  }
}
```

Keep local settings untracked. The effective `strategy_options.checkpoint_remote`
key must be absent from both settings files. That dedicated destination overrides
the named-remote choice. The `checkpoint_push_remote` setting selects `entire`
for automatic checkpoint uploads. A missing named remote disables checkpoint sync.
Do not replace this setting with a guessed CLI flag.

Linked Git worktrees share one Git directory and therefore one Entire git-refs
checkpoint push queue. Setting `push_sessions` to `false` in one worktree is not
an isolation boundary. A later push from another worktree can still upload the
queued checkpoints. Keep every worktree that shares a Git directory within the
same authorized data boundary.

## Check hooks before work

Run `entire status --detailed` and `entire agent list` from the assigned worktree.
Status must show enabled capture and the `entire` checkpoint destination.

Codex can discover hooks in the main checkout instead of the working checkout.
Read the discovered path in `entire status --json`. Keep the reviewed Entire hooks
available at that path without overwriting unrelated hooks. If status reports
`trust_review_needed`, open `/hooks` in that Codex client and review the pending
hooks. Installed hooks are not proof that Codex has approved or executed them.

The root worktree may already hold identical Codex hooks. Compare the discovered
hooks with the reviewed ones before copying or overwriting anything. Identical
hooks need no change and still require the trust review above.

The repository includes Entire-generated agent hooks and help/search files.
Regenerate those through Entire when needed. Keep its local settings, logs,
metadata, and transcripts out of source commits.

## Use checkpoints during delivery

Start supported Codex or Claude Code sessions in the configured checkout.
Use `entire session current` or `entire session list` to confirm tracking.
Keep ordinary reviewed Git commits and push source to both remotes. Then inspect
`entire checkpoint list --json` and `entire checkpoint explain <id>` to check the
recorded work. An empty list means no checkpoint evidence exists yet.

For earlier decisions, use `entire search --json --compact` with a focused query.
Read `entire agent-help search` for the installed search syntax. Inspect a relevant
checkpoint before loading a full transcript. Session history can contain private
prompts and tool output. Review that content before sharing it outside the repo.

A controller on another computer that edits Zo through MCP is not a local agent
session. Zo hooks cannot automatically capture that controller's conversation.
Use a supported agent running in the Zo checkout when session capture is needed.
Record enabled configuration and observed capture separately.
