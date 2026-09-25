# Route questions in public find

## Recommendation

Let the privacy-filtered find and query accept a question that names a URL
route, such as "what serves /api/users?". Keep refusing a question that
contains credential-like text, control characters, the project's own folder
path, a Windows drive path, or a network share path. Keep refusing other host
paths, such as `~/.ssh/config` or a sibling project's folder, unless the owner
decides otherwise. The open questions below list that decision.

This change is tentative. The owner asked for it during the issue #19 review.
It lands as its own PR after [PR #89](https://github.com/vivary-dev/Vivary-New/pull/89)
merges, because it changes Tropo's and the MCP adapter's privacy rules and the
Workbench files that #89 adds.

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
a space, `.`, `~`, `(`, a quote, or `:`. So the regex matches the ` /api/users`
in "what serves /api/users?". It also matches `./src/relay.py` and
`~/.ssh/config`. It does not match a bare relative path such as
`src/relay.py`, which find already accepts, or `//server/share`.

The MCP adapter `packages/mcp/vivary_mcp.py` keeps its own copy of the
pattern, `_MACHINE_PATH_RE`. `_assert_result_safe` runs it over every string in
a producer result, including the echoed `query`. A match turns the result into
`producer_unavailable`. `docs/MCP.md` promises that the adapter returns no
absolute machine path. Changing Tropo's question check alone would leave
`vivary_find` and `vivary_query` refusing the same questions over MCP, with a
less clear reason.

On output, find drops a snippet that fails `_public_output_text_is_safe`, so a
document that mentions `/api/users` returns with `snippet: null`. A title that
fails the same check falls back to the document's ID.

## Where users see it

After PR #89:

- The Workbench Details panel shows `FIND_PATH_REFUSED` from
  `packages/workbench/server/project-read.ts`.
- The Native agent receives the same result, with `status: "unavailable"`,
  `reason: "path_refused"`, and that message.
- The issue #19 acceptance treats the refusal as a pass. The receipt
  `docs/product/multi-project/receipts/09b-original-read-tools.md` and
  `desktop-acceptance-status.md` record that a path-like question was
  refused, and the hosted journey script asserts it. This change reverses that check,
  so those records and the script change with it.

## Tentative change

1. Split the question check from the output check, in both Tropo and the MCP
   adapter. The question check accepts a `/`-led token that looks like a
   route. It keeps the credential, printable-text, workspace-path, drive, and
   share checks, and adds `//host/share`.
2. Decide how to keep refusing host paths. `_PUBLIC_MACHINE_PATH_RE` cannot
   tell `/api/users` from `/data/private.txt`, and
   `test_public_context_refuses_any_absolute_machine_path_in_query` in
   `packages/tropo/tests/test_tropo.py` requires refusing
   `/usr/local/private.txt`, `/data/private.txt`, and
   `source:/data/private.txt`. One option refuses a `/`-led token whose first
   segment names a directory that exists at the host's root. Another accepts
   only tokens without a file extension. Both need tests against real routes.
3. Decide what `query` echoes. Echoing the question keeps it readable and
   relaxes the "no machine path in output" promise for that field. Echoing its
   terms keeps the promise and shows text the caller did not type.
4. Decide whether snippets may keep route text, under the same rule as the
   question.
5. Update the refusal message in `project-read.ts`, the acceptance records and
   hosted script above, `docs/ORIGINAL-CLI.md`, `docs/MCP.md`,
   `packages/workbench/README.md`, and the site mirrors
   `site/src/content/docs/original-cli.md` and `site/public/llms-full.txt`.

## Files

- `packages/tropo/tropo.py`: `_public_query_value`, a question pattern apart
  from `_PUBLIC_MACHINE_PATH_RE`, and the snippet check.
- `packages/tropo/tests/test_tropo.py`: accepted routes, and still-refused
  host paths, credentials, workspace paths, drive paths, and shares, for both
  find and query.
- `packages/mcp/vivary_mcp.py` and its tests: the matching result check for
  `vivary_find` and `vivary_query`.
- `packages/vivary/tests/test_vivary_cli.py`: a public find with a route
  question.
- `packages/workbench/server/project-read.ts` and
  `packages/workbench/tests/project-read.test.ts`: the refusal message.
- The docs and acceptance records named in step 5.

## Verify

```console
python3 packages/tropo/tests/test_tropo.py
python3 -m pytest packages/mcp/tests -q
python3 packages/vivary/tests/test_vivary_cli.py
pnpm --dir packages/workbench exec tsx --test tests/project-read.test.ts
```

Then ask the agent "what serves /api/users?" in a Git coding project, and
through MCP `vivary_find`. Confirm both return the route document and no host
path.

## Open questions

- Should other absolute POSIX paths stay refused, and which rule separates
  them from routes?
- Which `query` echo does the owner prefer?
- vivary-tropo 0.5.4 is published on PyPI, and the source is 0.5.5. Which
  release carries this change?
