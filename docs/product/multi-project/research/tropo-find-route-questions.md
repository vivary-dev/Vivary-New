# Route questions in public find

## Recommendation

Let the privacy-filtered find and query accept a question that names a URL
route, such as "what serves /api/users?", only if one rule can also keep
refusing the host paths that Tropo's and the MCP adapter's tests require
refusing. Those include `/usr/local/private.txt`, `/data/private.txt`, and
`source:/data/private.txt`. The rule must give the same answer on Linux,
macOS, and Windows. If no such rule exists, the refusal stays, and the
refusal message explains it.

The owner requested this change during the issue #19 review. It lands as its
own PR after [PR #89](https://github.com/vivary-dev/Vivary-New/pull/89)
merges, because it changes Tropo's and the MCP adapter's privacy rules and
files that #89 adds.

## What happens today

Public find and public query both check the question with
`_public_query_value(root, value)` in `packages/tropo/tropo.py`. `find_context`
and `query_context` call it. It raises `PathRefusedError` when either check
fails:

- `_public_output_text_is_safe` refuses text that `_public_safe_text`
  rejects, such as empty, overlong, or unprintable text. It also refuses
  credential-like text and any match of `_PUBLIC_MACHINE_PATH_RE`.
- `_public_contains_workspace_path` refuses text that contains the project's
  own folder path, in either separator.

`_PUBLIC_MACHINE_PATH_RE` matches a drive path (`C:\`), a backslash network
share (`\\host\share`), and a `/`-led token at the start of the text or after
any character that is neither a word character nor `/`. That character can be
a space, `.`, `~`, `(`, a quote, or `:`. In "what serves /api/users?" the
regex matches ` /api/users?`, with the question mark. It also matches
`./src/relay.py` and `~/.ssh/config`. It does not match a bare relative path
such as `src/relay.py`, which find already accepts, or `//server/share`.

The MCP adapter `packages/mcp/vivary_mcp.py` checks questions only for type
and length. It checks results instead. `_assert_result_safe` runs its own
copy of the pattern, `_MACHINE_PATH_RE`, over every string in a producer
result, including the echoed `query`, and a match turns the result into
`producer_unavailable`. `test_result_firewall_refuses_machine_paths_and_credentials`
in `packages/mcp/tests/test_vivary_mcp.py` requires that refusal.
`docs/MCP.md` promises that the adapter returns no absolute machine path.
Changing Tropo alone would leave `vivary_find` and `vivary_query` refusing
the same questions over MCP, with a less clear reason.

On output, find drops a snippet whose own text fails
`_public_output_text_is_safe`. Query also replaces a title that fails that
check with the document's ID.

## Where users see it

After PR #89:

- `vivary find --public` returns a `vivary.read-refusal/v0` document with
  reason `path_refused`.
- The Workbench Details panel shows `FIND_PATH_REFUSED` from
  `packages/workbench/server/project-read.ts`.
- The Native agent receives the same result, with `status: "unavailable"`,
  `reason: "path_refused"`, and that message.

The issue #19 acceptance treats this refusal as a pass. The receipt
`docs/product/multi-project/receipts/09b-original-read-tools.md` and
`docs/product/multi-project/desktop-acceptance-status.md` record it, and the
private hosted journey script, which is not in the repository, asserts it.
Those records describe what the tested candidates did, so they stay as they
are. The change records its own result in a new dated entry.

## Design questions

1. Which rule separates a route from a host path? The pattern cannot tell
   `/api/users` from `/data/private.txt`. A rule that checks which
   directories exist on the host fails on hosts where `/data` or `/usr` does
   not exist. The rule also needs an answer for `~/.ssh/config`, a sibling
   project's folder, and `/etc/passwd`, and for trailing punctuation such as
   the `?` above.
2. What does `query` echo? Echoing the question keeps it readable and relaxes
   the "no machine path in output" promise for that field. Echoing its terms
   keeps the promise and shows text the caller did not type.
3. May snippets keep route text, under the same rule?
4. Should `//server/share` be refused like the backslash form?

## Files

- `packages/tropo/tropo.py`: `_public_query_value`, a question rule apart from
  `_PUBLIC_MACHINE_PATH_RE`, and the snippet check.
- `packages/tropo/tests/test_tropo.py`: accepted routes, and still-refused
  host paths, credentials, workspace paths, drive paths, and shares, for both
  find and query.
- `packages/mcp/vivary_mcp.py` and `packages/mcp/tests/test_vivary_mcp.py`:
  how `_assert_result_safe` treats the echoed `query` and snippets.
- `packages/vivary/tests/test_vivary_cli.py`: a public find with a route
  question.
- `packages/workbench/server/project-read.ts` and
  `packages/workbench/tests/project-read.test.ts`: the refusal message.
- `docs/ORIGINAL-CLI.md`, `docs/MCP.md`, `packages/workbench/README.md`, and
  the site mirrors `site/src/content/docs/original-cli.md`,
  `site/src/content/docs/mcp.md`, and `site/public/llms-full.txt`.

## Verify

The MCP tests need the packages CI installs first.

```console
python3 -m pip install pytest "mcp==2.0.0"
python3 packages/tropo/tests/test_tropo.py
python3 -m pytest packages/mcp/tests -q
python3 packages/vivary/tests/test_vivary_cli.py
pnpm --dir packages/workbench exec tsx --test tests/project-read.test.ts
```

Then ask the agent "what serves /api/users?" in a Git coding project, and ask
MCP `vivary_find` the same question. Confirm both return the route document
and no host path.

## Release

`docs/RELEASE-WORKFLOW.md` requires a `vivary-mcp` release and a Tropo floor
update for a change to `packages/mcp/vivary_mcp.py`. On 2026-09-24 PyPI
listed vivary-tropo 0.5.4 and vivary-mcp 0.1.3, and the Tropo source is
0.5.5. The owner decides which releases carry this change.
