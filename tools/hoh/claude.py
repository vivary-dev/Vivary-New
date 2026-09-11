"""Fail-closed native Claude Code adapter seam for the 20a runtime proof."""

from __future__ import annotations

import hashlib
import json
import uuid
from pathlib import Path
from typing import TYPE_CHECKING, Any

from hoh.protocol import ROLE_RESULT_SCHEMA, USAGE_SCHEMA, ProtocolError, validate_role_request
if TYPE_CHECKING:
    from hoh_loop import RoleView


SUPPORTED_VERSION = "2.1.241"
REQUIRED_FLAGS = frozenset({"--print", "--output-format", "--tools"})
REQUIRED_USAGE_FIELDS = frozenset(
    {"input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"}
)


class ClaudePreflightError(ProtocolError):
    """Installed Claude evidence cannot authorize a model invocation."""


class NativeInvocationError(ProtocolError):
    """Native execution or its accounting is uncertain; no retry is authorized."""

    native_usage_raw: object = None


class NativeModelIdentityError(NativeInvocationError):
    """The completed command has trustworthy usage but fails the pinned identity."""

    def __init__(self, usage: dict[str, Any]):
        super().__init__("native terminal model identity differs from the pinned trial")
        self.usage = usage
        self.native_usage_raw = usage["vendor_usage_raw"]


class NativeAccountedRejection(NativeInvocationError):
    """An identity rejection bound to a request whose usage is already settled."""

    def __init__(self, message: str, *, usage: dict[str, Any], request_sha256: str):
        super().__init__(message)
        self.usage = usage
        self.request_sha256 = request_sha256
        self.native_usage_raw = usage["vendor_usage_raw"]


class NativeRoleSchemaError(ProtocolError):
    """A successful accounted invocation returned an invalid role envelope."""

    def __init__(self, message: str, *, usage: dict[str, Any], request_sha256: str):
        super().__init__(message)
        self.usage = usage
        self.request_sha256 = request_sha256


OBSERVED_FLAGS = REQUIRED_FLAGS | {
    "--input-format", "--verbose", "--max-turns", "--strict-mcp-config",
    "--mcp-config", "--allowedTools", "--session-id", "--resume",
}
USAGE_MAPPING = "claude-reported-models-separate-cache-v2"
READ_TOOLS = {"mcp__vivary_role__read_text", "mcp__vivary_role__list_files"}
WRITE_TOOL = "mcp__vivary_role__write_text"
MODEL_IDENTITY_CONTRACT = "claude-2.1.241-opus5-context-identity-v1"
PINNED_DESCRIPTOR = "claude-opus-5[1m]"
PINNED_MODEL = {"canonicalModel": "claude-opus-5", "contextWindow": 1000000,
                "provider": "firstParty"}


def _verified_resume_alias(snapshot: dict[str, Any], request: dict[str, Any],
                           expected_model: str | None) -> bool:
    """Use only the settled first attempt of this exact native stage/session."""
    if request["attempt"] != 2 or expected_model != PINNED_DESCRIPTOR:
        return False
    prior = [item for item in snapshot["reservations"].values()
             if item.get("binding") == request["binding"] and item.get("attempt") == 1]
    if len(prior) != 1 or prior[0].get("status") != "settled":
        return False
    usage = prior[0].get("usage")
    if not isinstance(usage, dict) or usage.get("complete") is not True:
        return False
    raw = usage.get("vendor_usage_raw")
    if not isinstance(raw, dict) or raw.get("observed_model") != PINNED_DESCRIPTOR:
        return False
    models = raw.get("modelUsage")
    main = models.get(PINNED_DESCRIPTOR) if isinstance(models, dict) else None
    return isinstance(main, dict) and all(main.get(key) == value for key, value in PINNED_MODEL.items())


def _request_hash(request: dict[str, Any]) -> str:
    data = (json.dumps(request, sort_keys=True, separators=(",", ":")) + "\n").encode()
    return "sha256:" + hashlib.sha256(data).hexdigest()


def _strict_json(text: str) -> object:
    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in items:
            if key in result:
                raise ValueError("duplicate JSON key")
            result[key] = value
        return result
    def invalid_constant(value: str) -> None:
        raise ValueError(f"invalid JSON constant: {value}")
    return json.loads(text, object_pairs_hook=pairs, parse_constant=invalid_constant)


class ClaudeEventAccounting:
    """Reconcile native reports, retaining streamed input only as a lower bound.

    Installed stream-field semantics must be verified before observations are
    enabled. This parser does not prove provider coverage or process isolation.
    """

    def __init__(self, *, session_id: str, allowed_tools: set[str], observer: Any,
                 stream_mapping_verified: bool, expected_model: str | None = None,
                 runtime_version: str | None = None, resume_alias_verified: bool = False):
        self.session_id = session_id
        self.allowed_tools = allowed_tools
        self.observer = observer
        self.stream_mapping_verified = stream_mapping_verified
        self.expected_model = expected_model
        self.pinned_identity = runtime_version == "2.1.241" and expected_model == PINNED_DESCRIPTOR
        self.resume_alias_verified = self.pinned_identity and resume_alias_verified
        self.observed_model: str | None = None
        self.messages: dict[str, int] = {}
        self.terminal: dict[str, Any] | None = None
        self.rate_limit_events: list[dict[str, Any]] = []

    def accept(self, event: object) -> None:
        if not isinstance(event, dict):
            raise NativeInvocationError("native stream event is not an object")
        if self.terminal is not None:
            raise NativeInvocationError("native event follows terminal result")
        if event.get("session_id") not in (None, self.session_id):
            raise NativeInvocationError("native event session differs")
        if event.get("parent_tool_use_id") is not None:
            raise NativeInvocationError("native subagent event is forbidden")
        kind, subtype = event.get("type"), event.get("subtype", "")
        if kind not in {"system", "assistant", "user", "stream_event", "result", "rate_limit_event"}:
            raise NativeInvocationError("unsupported native stream event")
        if any(word in str(subtype).lower() for word in ("task", "agent", "background", "hook")):
            raise NativeInvocationError("native background task event is forbidden")
        if kind == "system" and subtype == "init":
            if self.observed_model is not None or event.get("session_id") != self.session_id:
                raise NativeInvocationError("native initialization is repeated or unbound")
            tools = event.get("tools")
            if not isinstance(tools, list) or set(tools) != self.allowed_tools:
                raise NativeInvocationError("native initialization tool set differs")
            model = event.get("model")
            resume_alias = self.resume_alias_verified and model == PINNED_MODEL["canonicalModel"]
            if (not isinstance(model, str) or not model
                    or (self.expected_model is not None and model != self.expected_model and not resume_alias)):
                raise NativeInvocationError("native initialized model differs from the trial")
            self.observed_model = model
        elif kind != "system" and self.observed_model is None:
            raise NativeInvocationError("native output precedes verified initialization")
        if kind == "rate_limit_event":
            self._accept_rate_limit(event)
            return
        if kind == "result":
            if event.get("session_id") != self.session_id:
                raise NativeInvocationError("terminal session identity is missing or differs")
            self.terminal = event
            return
        streamed = event.get("event") if kind == "stream_event" else None
        if isinstance(streamed, dict):
            block = streamed.get("content_block")
            if isinstance(block, dict) and block.get("type") == "tool_use" and block.get("name") not in self.allowed_tools:
                raise NativeInvocationError("streamed tool call is outside the role allowlist")
        message = event.get("message") if kind == "assistant" else None
        if isinstance(message, dict):
            for block in message.get("content", []):
                if isinstance(block, dict) and block.get("type") == "tool_use":
                    if block.get("name") not in self.allowed_tools:
                        raise NativeInvocationError("native tool call is outside the role allowlist")
            if self.stream_mapping_verified and "usage" in message:
                usage = message["usage"]
                fields = ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens")
                if not isinstance(usage, dict) or any(type(usage.get(key)) is not int or usage[key] < 0 for key in fields):
                    raise NativeInvocationError("streamed input accounting is invalid")
                message_id = message.get("id")
                if not isinstance(message_id, str) or not message_id:
                    raise NativeInvocationError("streamed usage has no attributable message ID")
                count = sum(usage[key] for key in fields)
                if count < self.messages.get(message_id, 0):
                    raise NativeInvocationError("streamed cumulative input decreased")
                self.messages[message_id] = count
                self.observer(message_id, count)

    def _accept_rate_limit(self, event: dict[str, Any]) -> None:
        """Retain quota telemetry without treating it as tokens or authority."""
        required = {"type", "session_id", "uuid", "rate_limit_info"}
        if (not required <= set(event) or set(event) - required - {"parent_tool_use_id"}
                or event["session_id"] != self.session_id or not isinstance(event["uuid"], str)):
            raise NativeInvocationError("rate-limit telemetry is not session-bound")
        try:
            uuid.UUID(event["uuid"])
            retained = json.loads(json.dumps(event, allow_nan=False))
        except (ValueError, TypeError, RecursionError) as error:
            raise NativeInvocationError("rate-limit telemetry is not valid JSON with an event UUID") from error
        self.rate_limit_events.append(retained)
        info = retained["rate_limit_info"]
        statuses = {"allowed", "allowed_warning", "rejected"}
        if (not isinstance(info, dict) or not isinstance(info.get("status"), str)
                or info["status"] not in statuses):
            raise NativeInvocationError("rate-limit telemetry status is invalid")
        for key in ("resetsAt", "overageResetsAt"):
            value = info.get(key)
            if value is not None and (type(value) is not int or not 0 <= value <= 2**53 - 1):
                raise NativeInvocationError("rate-limit telemetry reset timestamp is invalid")
        utilization = info.get("utilization")
        if utilization is not None and (type(utilization) not in (int, float) or not 0 <= utilization <= 1):
            raise NativeInvocationError("rate-limit telemetry utilization is invalid")
        kind = info.get("rateLimitType")
        if kind is not None and (not isinstance(kind, str) or kind not in {
                "five_hour", "seven_day", "seven_day_opus", "seven_day_sonnet", "overage"}):
            raise NativeInvocationError("rate-limit telemetry window is invalid")
        overage_status = info.get("overageStatus")
        if overage_status is not None and (not isinstance(overage_status, str) or overage_status not in statuses):
            raise NativeInvocationError("rate-limit telemetry overage status is invalid")
        reason = info.get("overageDisabledReason")
        if reason is not None and (not isinstance(reason, str) or len(reason) > 1024):
            raise NativeInvocationError("rate-limit telemetry overage reason is invalid")
        if "isUsingOverage" in info and type(info["isUsingOverage"]) is not bool:
            raise NativeInvocationError("rate-limit telemetry active-overage flag is invalid")
        if info["status"] == "rejected":
            raise NativeInvocationError("native quota rejected the invocation")
        if info.get("isUsingOverage") is True or kind == "overage":
            raise NativeInvocationError("native telemetry reports active overage outside included authority")

    def finish(self, process: object) -> tuple[str, dict[str, Any]]:
        if not isinstance(process, dict) or (
            type(process.get("returncode")) is not int or process["returncode"] != 0
            or process.get("timed_out") is not False
            or process.get("cleanup_confirmed") is not True
            or process.get("command_complete") is not True
        ):
            raise NativeInvocationError("native command failed or cleanup is unconfirmed")
        final = self.terminal
        if self.observed_model is None or final is None or final.get("subtype") != "success" or final.get("is_error") is not False:
            raise NativeInvocationError("exactly one successful terminal result is required")
        raw = final.get("usage")
        if not isinstance(raw, dict):
            raise NativeInvocationError("terminal usage is missing")
        raw = {**raw, "num_turns": final.get("num_turns"), "modelUsage": final.get("modelUsage"),
               "accounting_scope": "reported-main-loop", "native_helper_retry_coverage": "unknown",
               "observed_model": self.observed_model}
        if self.rate_limit_events:
            raw["rate_limit_events"] = self.rate_limit_events
        usage = normalize_claude_usage(raw, command_complete=True)
        if not usage["complete"] or usage["aggregate_input_tokens"] < sum(self.messages.values()):
            raise NativeInvocationError("terminal usage is invalid or below observed input")
        models = final.get("modelUsage")
        main_model = self.observed_model
        if models is not None:
            if not isinstance(models, dict):
                raise NativeInvocationError("per-model usage is invalid")
            if self.pinned_identity and {PINNED_DESCRIPTOR, PINNED_MODEL["canonicalModel"]} <= models.keys():
                raise NativeInvocationError("per-model alias entries are ambiguous")
            if main_model not in models and self.resume_alias_verified:
                alternate = PINNED_DESCRIPTOR if main_model == PINNED_MODEL["canonicalModel"] else PINNED_MODEL["canonicalModel"]
                if alternate in models:
                    main_model = alternate
            if main_model not in models:
                raise NativeInvocationError("per-model usage omits the initialized model")
            raw["reported_main_model"] = main_model
            usage = self._include_reported_models(models, raw, usage, main_model)
        if self.pinned_identity:
            main = models.get(main_model) if isinstance(models, dict) else None
            verified = isinstance(main, dict) and all(main.get(key) == value for key, value in PINNED_MODEL.items())
            raw["model_identity"] = {"contract": MODEL_IDENTITY_CONTRACT,
                "expected_descriptor": self.expected_model, "expected": PINNED_MODEL.copy(),
                "observed_descriptor": self.observed_model, "reported_main_model": main_model,
                "reported": {key: main.get(key) for key in PINNED_MODEL} if isinstance(main, dict) else None,
                "resume_alias_verified": self.resume_alias_verified, "verified": verified}
            if not verified:
                raise NativeModelIdentityError(usage)
        output = final.get("result")
        if not isinstance(output, str):
            raise NativeInvocationError("terminal result text is missing")
        return output, usage

    def _include_reported_models(self, models: dict[str, Any], raw: dict[str, Any],
                                 main_usage: dict[str, Any], main_model: str) -> dict[str, Any]:
        """Match the main report, then count only distinct canonical model entries."""
        fields = {"inputTokens": "input_tokens", "outputTokens": "output_tokens",
                  "cacheReadInputTokens": "cache_read_input_tokens",
                  "cacheCreationInputTokens": "cache_creation_input_tokens"}
        for name, item in models.items():
            if (not isinstance(name, str) or not name or not isinstance(item, dict)
                    or any(type(item.get(key)) is not int or item[key] < 0 for key in fields)):
                raise NativeInvocationError("per-model usage is invalid")
        main = models[main_model]
        for native, required in fields.items():
            if main[native] != raw[required]:
                raise NativeInvocationError("main-loop and per-model usage contradict")
        if len(models) == 1:
            return main_usage
        # A different display key alone does not establish non-overlap: aliases
        # could describe the same canonical model. Ambiguous reports stop here.
        canonical_ids = [item.get("canonicalModel") for item in models.values()]
        if (any(not isinstance(value, str) or not value for value in canonical_ids)
                or len(set(canonical_ids)) != len(canonical_ids)):
            raise NativeInvocationError("per-model entries are not demonstrably disjoint")
        totals = {key: raw[key] for key in fields.values()}
        count_fields = ("aggregate_input_tokens", "aggregate_output_tokens",
                        "cache_read_input_tokens", "cache_write_input_tokens", "budget_counted_tokens")
        auxiliary = {}
        for name, item in models.items():
            if name == main_model:
                continue
            counters = {required: item[native] for native, required in fields.items()}
            normalized = normalize_claude_usage(counters, command_complete=True)
            auxiliary[name] = {"canonical_model": item["canonicalModel"], "purpose": "unknown",
                               **{key: normalized[key] for key in count_fields}}
            for key, value in counters.items():
                totals[key] += value
        raw["accounting_scope"] = "reported-main-and-disjoint-auxiliary-models"
        raw["reported_usage_breakdown"] = {
            "main": {"model": main_model, "canonical_model": main["canonicalModel"],
                     **{key: main_usage[key] for key in count_fields}},
            "auxiliary": auxiliary,
        }
        combined = normalize_claude_usage({**totals, "num_turns": raw["num_turns"]}, command_complete=True)
        combined["vendor_usage_raw"] = raw
        return combined


def normalize_claude_usage(raw: object, *, command_complete: bool) -> dict[str, Any]:
    """Normalize Claude usage; base input excludes its separately named cache subsets."""
    vendor = raw if isinstance(raw, dict) else {}

    def token(name: str) -> int | None:
        value = vendor.get(name)
        return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else None

    base_input = token("input_tokens")
    output = token("output_tokens")
    cache_read = token("cache_read_input_tokens")
    cache_write = token("cache_creation_input_tokens")
    complete = command_complete and None not in (base_input, output, cache_read, cache_write)
    aggregate_input = (
        base_input + cache_read + cache_write
        if complete
        else None
    )
    turns = vendor.get("num_turns")
    if not isinstance(turns, int) or isinstance(turns, bool) or turns < 0:
        turns = None
    return {
        "schema": USAGE_SCHEMA,
        "vendor_usage_raw": vendor,
        "aggregate_input_tokens": aggregate_input,
        "aggregate_output_tokens": output if complete else None,
        "cache_read_input_tokens": cache_read,
        "cache_write_input_tokens": cache_write,
        "budget_counted_tokens": aggregate_input + output if complete else None,
        "claude_agentic_turns": turns,
        "codex_top_level_turns": None,
        "complete": complete,
    }


class ClaudeAdapter:
    """Invoke only a verified installed CLI after all 20a admission facts pass."""

    runtime_id = "claude"

    def __init__(
        self,
        *,
        executable: Path,
        capability_evidence: dict[str, Any],
        runner: Any = None,
        mode: str = "hard",
        launch_verifier: Any = None,
        executable_scope: str = "local",
    ):
        self.executable = executable
        self.evidence = capability_evidence
        self.runner = runner
        self.mode = mode
        self.launch_verifier = launch_verifier
        if executable_scope not in {"local", "habitat-container"}:
            raise ClaudePreflightError("unknown executable scope")
        self.executable_scope = executable_scope
        if mode == "observed":
            self._validate_observed_preflight()
        elif mode == "hard":
            self._validate_preflight()
        else:
            raise ClaudePreflightError("unknown Claude admission mode")

    def _validate_preflight(self) -> None:
        expected = {
            "version",
            "native_cli",
            "verified_flags",
            "isolation",
            "usage_fields",
            "whole_invocation_maximum_tokens",
        }
        if not isinstance(self.evidence, dict) or set(self.evidence) != expected:
            raise ClaudePreflightError("Claude capability evidence shape differs")
        if self.evidence["version"] != SUPPORTED_VERSION:
            raise ClaudePreflightError("Claude version is unsupported")
        if self.evidence["native_cli"] is not True:
            raise ClaudePreflightError("Claude executable is not the installed native CLI")
        flags = self.evidence["verified_flags"]
        if not isinstance(flags, list) or not REQUIRED_FLAGS.issubset(flags):
            raise ClaudePreflightError("required Claude flags are unverified")
        isolation = self.evidence["isolation"]
        if not isinstance(isolation, dict) or set(isolation) != {
            "authenticated_host",
            "scoped_role_view",
            "builtin_tools_disabled",
            "credential_free_worker",
        } or not all(value is True for value in isolation.values()):
            raise ClaudePreflightError("Claude role isolation is unverified")
        usage_fields = self.evidence["usage_fields"]
        if not isinstance(usage_fields, list) or set(usage_fields) != REQUIRED_USAGE_FIELDS:
            raise ClaudePreflightError("Claude cumulative usage fields are unverified")
        maximum = self.evidence["whole_invocation_maximum_tokens"]
        if maximum is None or not isinstance(maximum, int) or isinstance(maximum, bool) or maximum < 1:
            raise ClaudePreflightError("Claude whole-invocation token maximum is unknown")
        if not self.executable.is_file() or self.executable.is_symlink():
            raise ClaudePreflightError("Claude executable path is not a regular installed file")
        raise ClaudePreflightError(
            "Claude Code 2.1.241 has no verified native whole-invocation input-plus-output bound"
        )

    def maximum_charge(self, _role: str) -> int:
        raise ClaudePreflightError("Claude native invocation remains blocked")

    def _validate_observed_preflight(self) -> None:
        expected = {"version", "native_cli", "verified_flags", "usage_mapping",
                    "stream_mapping_verified", "evidence_ref"}
        if not isinstance(self.evidence, dict) or set(self.evidence) != expected:
            raise ClaudePreflightError("observed Claude capability evidence shape differs")
        if self.evidence["version"] != SUPPORTED_VERSION or self.evidence["native_cli"] is not True:
            raise ClaudePreflightError("installed native Claude version is unverified")
        flags = self.evidence["verified_flags"]
        if not isinstance(flags, list) or not OBSERVED_FLAGS.issubset(flags):
            raise ClaudePreflightError("observed Claude launch flags are unverified")
        if self.evidence["usage_mapping"] not in (None, USAGE_MAPPING):
            raise ClaudePreflightError("unsupported native usage mapping")
        if type(self.evidence["stream_mapping_verified"]) is not bool or not isinstance(self.evidence["evidence_ref"], str) or not self.evidence["evidence_ref"]:
            raise ClaudePreflightError("native evidence reference or stream mapping differs")
        if self.executable_scope == "local":
            if not self.executable.is_file() or self.executable.is_symlink():
                raise ClaudePreflightError("Claude executable is not a regular installed file")
        else:
            from hoh.native_host import verify_habitat_reference_executable
            from hoh.native_host import verified_habitat_owner
            verified_habitat_owner(self.runner, self.launch_verifier)
            verify_habitat_reference_executable(self.executable)
        if not callable(self.runner) or not callable(self.launch_verifier):
            raise ClaudePreflightError("verified native launch runner and isolation verifier are unavailable")

    @staticmethod
    def prepare_prompt(prompt: str, binding: dict[str, Any], candidate_sha256: str,
                       test_evidence_sha256: str | None) -> str:
        """Add the native response contract before the coordinator hashes input."""
        context = {"stage": binding, "candidate_sha256": candidate_sha256,
                   "test_evidence_sha256": test_evidence_sha256}
        return (prompt + "\n\nNative response contract:\n"
                "Return exactly one JSON object with output_text, decision, and requirements. "
                "output_text is your complete Markdown report body as a nonempty string, "
                "using the role document's required headings. The role document describes "
                "that report body; this native contract defines the response envelope. decision must be "
                "ready, rework, or blocked based on your actual observations. requirements "
                "is an array of unique requirement IDs that your report explicitly assesses. "
                "Do not invent passing checks. Do not include Markdown fences, accounting, "
                "hashes, or extra fields outside this object. Use only the supplied scoped "
                "role tools. Do not launch agents or background tasks.\n"
                "Bound stage context: " + json.dumps(context, sort_keys=True) + "\n")

    def invoke_observed(self, request: dict[str, Any], prompt: str, view: RoleView,
                        deadline: Any, *, ledger: Any, call_id: str) -> object:
        """Run a single admitted native prompt through an externally verified host.

        The caller supplies the real isolated-host verifier and supervised runner.
        Their test doubles prove this interface only, never live isolation.
        """
        if self.mode != "observed":
            raise ClaudePreflightError("observed dispatch requires explicit observed mode")
        request = validate_role_request(request)
        prompt_data = prompt.encode("utf-8")
        if (request["prompt_bytes"] != len(prompt_data)
                or request["prompt_sha256"] != "sha256:" + hashlib.sha256(prompt_data).hexdigest()):
            raise ClaudePreflightError("native prompt differs from the admitted prompt")
        policy = ledger.observed_policy
        ledger_snapshot = ledger.snapshot()
        claim = ledger_snapshot["reservations"].get(call_id)
        if not isinstance(claim, dict) or claim.get("status") != "claimed":
            raise ClaudePreflightError("native invocation has no active observed admission")
        if claim.get("binding") != request["binding"] or claim.get("attempt") != request["attempt"]:
            raise ClaudePreflightError("native invocation differs from its admitted binding")
        if ledger.trial["runtime"] != "claude" or ledger.trial["runtime_version"] != self.evidence["version"]:
            raise ClaudePreflightError("native runtime differs from its trial")
        preflight = ledger.admissions[call_id]["path"] == "preflight"
        if self.evidence["usage_mapping"] is None and not preflight:
            raise ClaudePreflightError("only the declared preflight may bootstrap usage mapping")
        if preflight and (request["role"] == "developer" or view.writable_root is not None):
            raise ClaudePreflightError("bootstrap preflight must have no write tools")
        expected_model = ledger.trial["model"]
        if expected_model == "native-default":
            expected_model = None if preflight else ledger.preflight_observed_model()
        if request["binding"]["runtime"] != "claude" or view.role != request["role"]:
            raise ClaudePreflightError("native runtime or role projection differs")
        session_id = request["binding"]["session_id"]
        try:
            uuid.UUID(session_id)
        except ValueError as error:
            raise ClaudePreflightError("Claude session identity must be a native UUID") from error
        habitat_owner = None
        if self.executable_scope == "habitat-container":
            from hoh.native_host import verified_habitat_owner
            habitat_owner = verified_habitat_owner(self.runner, self.launch_verifier)
        runner_started = False
        accounting = None
        try:
            from hoh.protocol import uses_boottime, validate_clock_binding
            timing = {}
            if uses_boottime(policy):
                deadline.remaining()
                bound = validate_clock_binding(deadline.clock_binding())
                admitted = ledger.clock_binding(call_id)
                if (bound["boot_id"] != admitted["boot_id"]
                        or bound["expires_boottime_ns"] > admitted["expires_boottime_ns"]
                        or bound["expires_unix_ns"] != request["deadline_unix_ns"]):
                    raise ClaudePreflightError("absolute invocation deadline differs from its claim")
                timing["deadline"] = deadline
            launch = self.launch_verifier(executable=self.executable, request=request, view=view,
                                          call_id=call_id, policy=policy, **timing)
            launch_keys = {"mcp_config", "allowed_tools", "session_mode", "evidence_ref"}
            if self.executable_scope == "habitat-container":
                launch_keys.add("execution")
            if not isinstance(launch, dict) or set(launch) != launch_keys:
                raise ClaudePreflightError("verified launch configuration shape differs")
            allowed = READ_TOOLS | ({WRITE_TOOL} if request["role"] == "developer" and not preflight else set())
            if not isinstance(launch["allowed_tools"], list) or set(launch["allowed_tools"]) != allowed:
                raise ClaudePreflightError("verified launch tools differ from role authority")
            expected_session_mode = "create" if request["attempt"] == 1 else "resume"
            if launch["session_mode"] != expected_session_mode or not launch["evidence_ref"]:
                raise ClaudePreflightError("verified launch session mode or evidence differs")
            if not isinstance(launch["mcp_config"], str) or not launch["mcp_config"].startswith("/"):
                raise ClaudePreflightError("MCP configuration must name the verified host's absolute file")
            command = [str(self.executable), "--print", "--input-format", "text", "--output-format", "stream-json",
                       "--verbose", "--max-turns", str(policy["max_turns"]), "--tools", "",
                       "--strict-mcp-config", "--mcp-config", launch["mcp_config"],
                       "--allowedTools", ",".join(sorted(allowed)),
                       "--session-id" if expected_session_mode == "create" else "--resume", session_id]
            if self.executable_scope == "habitat-container":
                from hoh.native_host import verify_habitat_execution
                verify_habitat_execution(self.executable, launch["execution"], call_id=call_id)
            accounting = ClaudeEventAccounting(
                session_id=session_id, allowed_tools=allowed,
                observer=lambda message_id, count: ledger.observe(call_id, message_id, count),
                stream_mapping_verified=self.evidence["stream_mapping_verified"],
                expected_model=expected_model,
                runtime_version=self.evidence["version"],
                resume_alias_verified=_verified_resume_alias(ledger_snapshot, request, expected_model),
            )
            deadline.remaining()
            runner_started = True
            process = self.runner(command, stdin_text=prompt, request=request, view=view,
                                  deadline=deadline, on_event=accounting.accept, launch=launch)
            deadline.remaining()
            output, usage = accounting.finish(process)
        except BaseException as error:
            if isinstance(error, NativeModelIdentityError):
                # Accounting and role acceptance are separate: this command ended
                # cleanly with reconciled counters before its identity was rejected.
                try:
                    ledger.settle(call_id, error.usage)
                finally:
                    ledger.stop("native terminal model identity failed", call_id=call_id)
                raise NativeAccountedRejection(str(error), usage=error.usage,
                                               request_sha256=_request_hash(request)) from error
            if accounting is not None and accounting.rate_limit_events:
                error.native_usage_raw = {
                    "terminal_usage": accounting.terminal.get("usage") if accounting.terminal is not None else None,
                    "rate_limit_events": accounting.rate_limit_events,
                }
            elif isinstance(error, NativeInvocationError) and accounting is not None and accounting.terminal is not None:
                error.native_usage_raw = accounting.terminal.get("usage")
            try:
                ledger.stop("native invocation or required accounting failed", call_id=call_id)
            finally:
                if habitat_owner is not None and not runner_started:
                    habitat_owner.abort_unstarted(call_id)
            raise
        request_hash = _request_hash(request)
        try:
            result = _strict_json(output)
            if not isinstance(result, dict) or set(result) != {"output_text", "decision", "requirements"}:
                raise ValueError("role response fields differ")
            if not isinstance(result["output_text"], str) or not result["output_text"].strip():
                raise ValueError("role report is empty")
            if result["decision"] not in ("ready", "rework", "blocked"):
                raise ValueError("role decision differs")
            requirements = result["requirements"]
            if (not isinstance(requirements, list)
                    or any(not isinstance(item, str) or not item for item in requirements)
                    or len(set(requirements)) != len(requirements)):
                raise ValueError("role requirements must be explicit unique strings")
        except (ValueError, TypeError) as error:
            raise NativeRoleSchemaError("native role response schema is invalid", usage=usage,
                                        request_sha256=request_hash) from error
        return {
            "schema": ROLE_RESULT_SCHEMA, "run_id": request["run_id"],
            "iteration": request["iteration"], "role": request["role"],
            "binding": request["binding"], "attempt": request["attempt"],
            "request_sha256": request_hash,
            "output_kind": {"planner": "development_document", "developer": "developer_report",
                            "qa": "evidence_report"}[request["role"]],
            "output_text": result["output_text"],
            "output_sha256": "sha256:" + hashlib.sha256(result["output_text"].encode()).hexdigest(),
            "submission": {"decision": result["decision"], "requirements": requirements,
                           "candidate_sha256": request["candidate_sha256"],
                           "test_evidence_sha256": request["test_evidence_sha256"]},
            "usage": usage, "complete": True,
        }

    def invoke(self, request: dict[str, Any], prompt: str, view: RoleView, deadline: Any) -> object:
        """Refuse: 20c established no safe native invocation path for this CLI."""
        raise ClaudePreflightError("Claude native invocation remains blocked")
