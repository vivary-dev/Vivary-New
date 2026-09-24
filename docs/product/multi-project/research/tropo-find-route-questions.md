# Route and path questions in public find

## Recommendation

Let the privacy-filtered find accept questions that mention a URL route or a
project-relative path, such as "what serves /api/users?" or "where is
src/relay.py used?". Keep refusing a question that contains credential-like
text, control characters, the project's own absolute folder path, or a Windows
drive or network share path. Keep find's output free of host machine paths.

This change is tentative. The owner asked for it on 2026-09-24 during the
issue #19 review ([PR #89](https://github.com/vivary-dev/Vivary-New/pull/89)).
It lands as its own small PR after PR #89 merges, because it changes Tropo's
privacy rules. This note records the finding and the plan so they survive
the session that found them.

## What happens today

Every find question runs through Tropo's public facade. On the `feat/project-read-tools`
branch at `9c02663`, `find_context` in `packages/tropo/tropo.py` calls
`_public_query_value(root, question)`. That function raises `PathRefusedError`
when either check fails:

- `_public_output_text_is_safe(value, _PUBLIC_MAX_QUERY_CHARS)` refuses text
  that matches `_PUBLIC_MACHINE_PATH_RE`, credential patterns, or control
  characters.
- `_public_contains_workspace_path(value, root)` refuses text that contains the
  workspace's own path.

`_PUBLIC_MACHINE_PATH_RE` matches a drive letter path (`C:\`), a network share
(`\\host\share`), and any text that starts with `/` followed by a segment. A
URL route such as `/api/users` has the same shape as the POSIX path
`/api/users`, so the question is refused.

The facade repeats the question in the `query` field of `vivary.find-result/v0`,
and it promises that its output never contains a machine path. Refusing the
input is how it keeps that promise.

## Why it is too strict

- The question comes from the person or the model asking it. Repeating it back
  reveals nothing the asker did not already have.
- Routes and relative paths are ordinary coding questions. The refusal blocks a
  common use of find in coding projects.
- Ranking already splits a question into terms. `_query_terms` reduces
  `/api/users` to `api` and `users`, so accepting the text needs no new
  search logic.

## Where users see it

- The Workbench Details panel shows `FIND_PATH_REFUSED` from
  `packages/workbench/server/project-read.ts`: "Vivary refused this question
  or this project folder. A question cannot contain a file or URL path,
  credential-like text, control characters, or the folder's own path."
- The Native agent receives `find: unavailable, reason path_refused`.
- Seen in the packaged Windows acceptance and in step 8 of the hosted journey
  on 2026-09-24, both with "what serves /api/users".

## Tentative change

1. Split the question check from the output check. A new question check in
   Tropo refuses credential-like text, control characters, the workspace's
   own path, and Windows drive or network share paths. It accepts leading-slash
   routes and relative paths.
2. Decide what `query` echoes. The options follow:
   - Echo the question unchanged. This is the simplest. It relaxes the
     "no machine path in output" promise for this one field only, and the
     question text came from the caller.
   - Echo a normalized form, with route and path text replaced by its terms.
     This keeps the promise, but the caller sees text it did not type.
3. Keep refusing `/etc/passwd` and similar absolute paths if they can be told
   apart from routes. The first design step is to decide whether a rule can
   separate them, such as refusing only leading-slash text whose first segment
   is a common system directory. The alternative is to accept both.
4. Update the Workbench refusal message, `docs/ORIGINAL-CLI.md` (the
   `--public` section), and the Workbench README to match.

## Files

- `packages/tropo/tropo.py`: `_public_query_value`, and a question pattern
  separate from `_PUBLIC_MACHINE_PATH_RE`.
- `packages/tropo/tests/test_tropo.py`: accepted routes and relative paths,
  still-refused credentials, workspace paths, drive paths, and shares, and the
  echoed `query`.
- `packages/vivary/tests/test_vivary_cli.py`: a public find with a route
  question.
- `packages/workbench/server/project-read.ts` and its tests: the refusal
  message.
- `docs/ORIGINAL-CLI.md`, `packages/workbench/README.md`, and the site mirrors.

## Verify

```console
python packages/tropo/tests/test_tropo.py
python packages/vivary/tests/test_vivary_cli.py
pnpm --dir packages/workbench exec tsx --test tests/project-read.test.ts
```

Then ask the agent "what serves /api/users?" in a Git coding project and
confirm find returns the route document and no host path.

## Open questions

- Which `query` echo does the owner prefer?
- Should absolute POSIX paths stay refused, and can a rule separate them from
  routes without refusing real routes?
- Does the Tropo package version change for this, given that vivary-tropo is
  unpublished source?
