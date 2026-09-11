"""Strict runtime-neutral records for the headless-loop proof."""

from __future__ import annotations

import re
import hashlib
import json
import os
import tempfile
import time
import zipfile
from contextlib import contextmanager
from pathlib import Path
from typing import Any


ROLE_REQUEST_SCHEMA = "vivary.hoh-role-request/v2"
ROLE_RESULT_SCHEMA = "vivary.hoh-role-result/v2"
EVIDENCE_SCHEMA = "vivary.hoh-evidence/v1"
TRANSITION_SCHEMA = "vivary.hoh-transition/v1"
RECEIPT_SCHEMA = "vivary.hoh-receipt/v1"
USAGE_SCHEMA = "vivary.hoh-usage/v1"
LEDGER_SCHEMA = "vivary.hoh-ledger/v1"
DEADLINE_SCHEMA = "vivary.hoh-deadline/v1"
OBSERVED_DEADLINE_SCHEMA = "vivary.hoh-observed-deadline/v1"
OBSERVED_LEDGER_SCHEMA = "vivary.hoh-observed-ledger/v1"
EXPERIMENTAL_LEDGER_SCHEMA = "vivary.hoh-observed-ledger/v3"
DEFAULT_OBSERVED_USAGE_POLICY = {
    "policy_revision": "20a-observed-usage-v1",
    "reported_token_target": 100_000,
    "launch_limit": 29,
    "invocation_seconds": 600,
    "packet_seconds": 3600,
    "iteration_seconds": 3600,
    "max_turns": 10,
    "stop_grace_seconds": 5,
    "healthy_iterations": 3,
    "fault_iterations": 1,
    "schema_retries": 1,
    "preflight_launches": 1,
}
ROLES = frozenset({"planner", "developer", "qa"})
_HASH = re.compile(r"^sha256:[0-9a-f]{64}$")
_SLUG = re.compile(r"^[a-z0-9][a-z0-9._-]*$")


class ProtocolError(ValueError):
    """A record does not match the declared protocol."""


class BudgetError(ProtocolError):
    """A call cannot reserve or settle its token charge safely."""


class BindingError(ProtocolError):
    """A response or assignment belongs to another stage or native session."""


class DeadlineError(ProtocolError):
    """An iteration deadline cannot admit or accept more work."""


class ClockError(DeadlineError):
    """The persisted wall clock moved backward or became uncertain."""


def _require_exact_keys(record: dict[str, Any], expected: set[str], label: str) -> None:
    missing = sorted(expected - record.keys())
    unknown = sorted(record.keys() - expected)
    if missing or unknown:
        raise ProtocolError(f"{label} keys differ: missing={missing}, unknown={unknown}")


def _is_int(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _require_hash(value: object, field: str) -> None:
    if not isinstance(value, str) or not _HASH.fullmatch(value):
        raise ProtocolError(f"{field} must be a sha256 digest")


def validate_stage_binding(record: object) -> dict[str, Any]:
    """Validate references to an assigned agent and its native session."""
    if not isinstance(record, dict):
        raise BindingError("stage binding must be an object")
    _require_exact_keys(record, {
        "stage_id", "run_id", "iteration", "role", "runtime", "agent_id", "session_id",
    }, "stage binding")
    for field in ("stage_id", "run_id", "runtime", "agent_id"):
        if not isinstance(record[field], str) or not _SLUG.fullmatch(record[field]):
            raise BindingError(f"stage {field} must be a slug")
    if not _is_int(record["iteration"]) or record["iteration"] < 1:
        raise BindingError("stage iteration must be positive")
    if not isinstance(record["role"], str) or record["role"] not in ROLES:
        raise BindingError("stage role differs")
    expected_id = f"{record['run_id']}-i{record['iteration']}-{record['role']}"
    if record["stage_id"] != expected_id:
        raise BindingError("stage id differs from run, iteration, and role")
    session = record["session_id"]
    if not isinstance(session, str) or not session.strip() or len(session) > 256 or any(ord(c) < 32 for c in session):
        raise BindingError("native session reference must be a bounded nonempty string")
    return dict(record)


def validate_submission(record: object, *, role: str) -> dict[str, Any]:
    """Check the explicit phase submission independently of usage completeness."""
    if not isinstance(record, dict):
        raise ProtocolError("phase submission must be an object")
    _require_exact_keys(record, {
        "decision", "candidate_sha256", "test_evidence_sha256", "requirements",
    }, "phase submission")
    if not isinstance(record["decision"], str) or record["decision"] not in {"ready", "rework", "blocked"}:
        raise ProtocolError("phase submission decision is unknown")
    _require_hash(record["candidate_sha256"], "submission candidate_sha256")
    if role == "qa":
        _require_hash(record["test_evidence_sha256"], "submission test_evidence_sha256")
    elif record["test_evidence_sha256"] is not None:
        raise ProtocolError("only QA submits deterministic evidence")
    requirements = record["requirements"]
    if not isinstance(requirements, list) or any(not isinstance(item, str) or not item for item in requirements) or len(set(requirements)) != len(requirements):
        raise ProtocolError("submission requirements must be unique strings")
    return {**record, "requirements": list(requirements)}


def validate_role_request(record: object) -> dict[str, Any]:
    """Validate and copy one runtime-neutral role request."""
    if not isinstance(record, dict):
        raise ProtocolError("role request must be an object")
    expected = {
        "schema",
        "run_id",
        "iteration",
        "role",
        "prompt_bytes",
        "prompt_sha256",
        "baseline_sha256",
        "candidate_sha256",
        "receipt_chain_head",
        "deadline_unix_ns",
        "read_roots",
        "write_root",
        "binding",
        "attempt",
        "handoff_sha256",
        "test_evidence_sha256",
    }
    _require_exact_keys(record, expected, "role request")
    if record["schema"] != ROLE_REQUEST_SCHEMA:
        raise ProtocolError("unsupported role request schema")
    if not isinstance(record["run_id"], str) or not _SLUG.fullmatch(record["run_id"]):
        raise ProtocolError("run_id must be a slug")
    if not _is_int(record["iteration"]) or record["iteration"] < 1:
        raise ProtocolError("iteration must be a positive integer")
    if not isinstance(record["role"], str) or record["role"] not in ROLES:
        raise ProtocolError("role must be planner, developer, or qa")
    if not _is_int(record["prompt_bytes"]) or record["prompt_bytes"] < 1:
        raise ProtocolError("prompt_bytes must be a positive integer")
    for field in ("prompt_sha256", "baseline_sha256", "candidate_sha256"):
        _require_hash(record[field], field)
    head = record["receipt_chain_head"]
    if head is not None:
        _require_hash(head, "receipt_chain_head")
    if not _is_int(record["deadline_unix_ns"]) or record["deadline_unix_ns"] < 1:
        raise ProtocolError("deadline_unix_ns must be a positive integer")
    roots = record["read_roots"]
    if not isinstance(roots, list) or not roots or any(
        not isinstance(root, str) or not _SLUG.fullmatch(root) for root in roots
    ) or len(set(roots)) != len(roots):
        raise ProtocolError("read_roots must be a non-empty list of slugs")
    write_root = record["write_root"]
    if write_root is not None and (
        not isinstance(write_root, str) or not _SLUG.fullmatch(write_root)
    ):
        raise ProtocolError("write_root must be null or a slug")
    if write_root is not None and write_root not in roots:
        raise ProtocolError("write_root must also be a declared read root")
    binding = validate_stage_binding(record["binding"])
    if any(binding[field] != record[field] for field in ("run_id", "iteration", "role")):
        raise BindingError("request stage binding differs")
    if not _is_int(record["attempt"]) or record["attempt"] < 1:
        raise ProtocolError("request attempt must be positive")
    if record["handoff_sha256"] is not None:
        _require_hash(record["handoff_sha256"], "handoff_sha256")
    if record["role"] == "qa":
        _require_hash(record["test_evidence_sha256"], "test_evidence_sha256")
    elif record["test_evidence_sha256"] is not None:
        raise ProtocolError("only QA requests deterministic evidence")
    return {**record, "binding": binding}


def validate_role_result(
    record: object,
    *,
    request: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Validate one role result and, when supplied, bind it to its request."""
    if not isinstance(record, dict):
        raise ProtocolError("role result must be an object")
    expected = {
        "schema",
        "run_id",
        "iteration",
        "role",
        "request_sha256",
        "output_kind",
        "output_text",
        "output_sha256",
        "usage",
        "complete",
        "binding",
        "attempt",
        "submission",
    }
    _require_exact_keys(record, expected, "role result")
    if record["schema"] != ROLE_RESULT_SCHEMA:
        raise ProtocolError("unsupported role result schema")
    if not isinstance(record["run_id"], str) or not _SLUG.fullmatch(record["run_id"]):
        raise ProtocolError("role result run_id must be a slug")
    if not _is_int(record["iteration"]) or record["iteration"] < 1:
        raise ProtocolError("role result iteration must be positive")
    if not isinstance(record["role"], str) or record["role"] not in ROLES:
        raise ProtocolError("role result role differs")
    expected_kind = {
        "planner": "development_document",
        "developer": "developer_report",
        "qa": "evidence_report",
    }[record["role"]]
    if record["output_kind"] != expected_kind:
        raise ProtocolError("role result output_kind differs from role")
    _require_hash(record["request_sha256"], "request_sha256")
    _require_hash(record["output_sha256"], "output_sha256")
    if not isinstance(record["output_text"], str) or not record["output_text"].strip():
        raise ProtocolError("role result output_text must be non-empty")
    if not isinstance(record["complete"], bool):
        raise ProtocolError("role result complete must be boolean")
    usage = validate_usage_record(record["usage"])
    binding = validate_stage_binding(record["binding"])
    if any(binding[field] != record[field] for field in ("run_id", "iteration", "role")):
        raise BindingError("result stage binding differs")
    if not _is_int(record["attempt"]) or record["attempt"] < 1:
        raise BindingError("result attempt differs")
    submission = validate_submission(record["submission"], role=record["role"])
    if record["complete"] != usage["complete"]:
        raise ProtocolError("role and usage completion differ")
    if request is not None:
        bound = validate_role_request(request)
        for field in ("run_id", "iteration", "role", "binding", "attempt"):
            if record[field] != bound[field]:
                raise BindingError(f"role result has stale or cross-run {field}")
        for field in ("candidate_sha256", "test_evidence_sha256"):
            if submission[field] != bound[field]:
                raise BindingError(f"phase submission has stale {field}")
    return {**record, "usage": usage, "binding": binding, "submission": submission}


def validate_evidence_record(
    record: object,
    *,
    run_id: str | None = None,
    iteration: int | None = None,
    candidate_sha256: str | None = None,
) -> dict[str, Any]:
    """Validate deterministic test evidence and optional freshness bindings."""
    if not isinstance(record, dict):
        raise ProtocolError("evidence must be an object")
    expected = {
        "schema",
        "run_id",
        "iteration",
        "candidate_sha256",
        "command",
        "returncode",
        "output_sha256",
        "observations",
        "complete",
    }
    _require_exact_keys(record, expected, "evidence")
    if record["schema"] != EVIDENCE_SCHEMA:
        raise ProtocolError("unsupported evidence schema")
    if not isinstance(record["run_id"], str) or not _SLUG.fullmatch(record["run_id"]):
        raise ProtocolError("evidence run_id must be a slug")
    if not _is_int(record["iteration"]) or record["iteration"] < 1:
        raise ProtocolError("evidence iteration must be positive")
    _require_hash(record["candidate_sha256"], "candidate_sha256")
    _require_hash(record["output_sha256"], "output_sha256")
    if (
        not isinstance(record["command"], list)
        or not record["command"]
        or any(not isinstance(item, str) or not item for item in record["command"])
    ):
        raise ProtocolError("evidence command must be a non-empty string list")
    if not _is_int(record["returncode"]):
        raise ProtocolError("evidence returncode must be an integer")
    if (
        not isinstance(record["observations"], list)
        or any(not isinstance(item, str) or not item for item in record["observations"])
        or len(set(record["observations"])) != len(record["observations"])
    ):
        raise ProtocolError("evidence observations must be unique strings")
    if not isinstance(record["complete"], bool):
        raise ProtocolError("evidence complete must be boolean")
    freshness = {
        "run_id": run_id,
        "iteration": iteration,
        "candidate_sha256": candidate_sha256,
    }
    for field, expected_value in freshness.items():
        if expected_value is not None and record[field] != expected_value:
            raise ProtocolError(f"evidence has stale or cross-run {field}")
    return dict(record)


def validate_transition_record(record: object) -> dict[str, Any]:
    """Validate one transition in the fixed planner/developer/QA order."""
    if not isinstance(record, dict):
        raise ProtocolError("transition must be an object")
    expected = {
        "schema",
        "run_id",
        "iteration",
        "from_stage",
        "to_stage",
        "candidate_before_sha256",
        "candidate_after_sha256",
        "prior_receipt_sha256",
    }
    _require_exact_keys(record, expected, "transition")
    if record["schema"] != TRANSITION_SCHEMA:
        raise ProtocolError("unsupported transition schema")
    if not isinstance(record["run_id"], str) or not _SLUG.fullmatch(record["run_id"]):
        raise ProtocolError("transition run_id must be a slug")
    if not _is_int(record["iteration"]) or record["iteration"] < 1:
        raise ProtocolError("transition iteration must be positive")
    allowed = {
        ("iteration_start", "planner"),
        ("planner", "developer"),
        ("developer", "qa"),
        ("qa", "iteration_complete"),
    }
    if (record["from_stage"], record["to_stage"]) not in allowed:
        raise ProtocolError("transition order differs")
    for field in ("candidate_before_sha256", "candidate_after_sha256"):
        _require_hash(record[field], field)
    head = record["prior_receipt_sha256"]
    if head is not None:
        _require_hash(head, "prior_receipt_sha256")
    return dict(record)


def validate_receipt_record(record: object) -> dict[str, Any]:
    """Validate the immutable envelope written for a sequencer event."""
    if not isinstance(record, dict):
        raise ProtocolError("receipt must be an object")
    expected = {"schema", "sequence", "prior_receipt_sha256", "payload"}
    _require_exact_keys(record, expected, "receipt")
    if record["schema"] != RECEIPT_SCHEMA:
        raise ProtocolError("unsupported receipt schema")
    if not _is_int(record["sequence"]) or record["sequence"] < 1:
        raise ProtocolError("receipt sequence must be positive")
    head = record["prior_receipt_sha256"]
    if head is not None:
        _require_hash(head, "prior_receipt_sha256")
    if not isinstance(record["payload"], dict):
        raise ProtocolError("receipt payload must be an object")
    required_payload = {
        "run_id",
        "iteration",
        "stage",
        "status",
        "bindings",
        "details",
    }
    _require_exact_keys(record["payload"], required_payload, "receipt payload")
    payload = record["payload"]
    if not isinstance(payload["run_id"], str) or not _SLUG.fullmatch(payload["run_id"]):
        raise ProtocolError("receipt run_id must be a slug")
    if not _is_int(payload["iteration"]) or payload["iteration"] < 1:
        raise ProtocolError("receipt iteration must be positive")
    if payload["stage"] not in {"iteration", "planner", "developer", "test", "qa", "fault"}:
        raise ProtocolError("receipt stage differs")
    if payload["status"] not in {"started", "complete", "incomplete", "failed", "regressed"}:
        raise ProtocolError("receipt status differs")
    if not isinstance(payload["bindings"], dict) or not isinstance(payload["details"], dict):
        raise ProtocolError("receipt bindings and details must be objects")
    bindings = payload["bindings"]
    required_bindings = {
        "baseline_sha256",
        "baseline_commit",
        "baseline_tree",
        "specification_sha256",
        "oracle_sha256",
        "prompt_sha256",
        "iteration",
        "candidate_sha256",
        "prior_receipt_sha256",
    }
    optional_bindings = {
        "workflow_sha256",
        "assembled_prompt_sha256",
        "development_document_sha256",
        "developer_report_sha256",
        "qa_evidence_report_sha256",
        "developer_checkpoint",
        "frozen_candidate_sha256",
        "frozen_candidate_before_sha256",
        "frozen_candidate_after_sha256",
    }
    missing = required_bindings - bindings.keys()
    unknown = bindings.keys() - required_bindings - optional_bindings
    if missing or unknown:
        raise ProtocolError(
            f"receipt binding keys differ: missing={sorted(missing)}, unknown={sorted(unknown)}"
        )
    for field in (
        "baseline_sha256",
        "specification_sha256",
        "oracle_sha256",
        "candidate_sha256",
    ):
        _require_hash(bindings[field], field)
    for field in ("baseline_commit", "baseline_tree"):
        if not isinstance(bindings[field], str) or not re.fullmatch(
            r"[0-9a-f]{40}|[0-9a-f]{64}", bindings[field]
        ):
            raise ProtocolError(f"{field} must be a Git object id")
    for field in optional_bindings - {"developer_checkpoint"}:
        if field in bindings:
            _require_hash(bindings[field], field)
    if bindings["prior_receipt_sha256"] is not None:
        _require_hash(bindings["prior_receipt_sha256"], "prior_receipt_sha256")
    prompts = bindings["prompt_sha256"]
    if not isinstance(prompts, dict) or set(prompts) != ROLES:
        raise ProtocolError("receipt prompt hashes must name planner, developer, and qa")
    for role, digest in prompts.items():
        _require_hash(digest, f"prompt_sha256.{role}")
    if bindings["iteration"] != payload["iteration"]:
        raise ProtocolError("receipt binding iteration differs from payload")
    checkpoint = bindings.get("developer_checkpoint")
    if checkpoint is not None and (
        not isinstance(checkpoint, str) or not re.fullmatch(r"[0-9a-f]{40}|[0-9a-f]{64}", checkpoint)
    ):
        raise ProtocolError("developer_checkpoint must be a Git object id")
    if bindings["prior_receipt_sha256"] != record["prior_receipt_sha256"]:
        raise ProtocolError("receipt binding prior hash differs from envelope")
    return {
        **record,
        "payload": {**payload, "bindings": dict(payload["bindings"]), "details": dict(payload["details"])},
    }


def _optional_token_count(value: object, field: str) -> None:
    if value is not None and (not _is_int(value) or value < 0):
        raise ProtocolError(f"{field} must be null or a non-negative integer")


def validate_usage_record(record: object) -> dict[str, Any]:
    """Validate normalized usage without adding cache fields a second time."""
    if not isinstance(record, dict):
        raise ProtocolError("usage record must be an object")
    value = record
    expected = {
        "schema",
        "vendor_usage_raw",
        "aggregate_input_tokens",
        "aggregate_output_tokens",
        "cache_read_input_tokens",
        "cache_write_input_tokens",
        "budget_counted_tokens",
        "claude_agentic_turns",
        "codex_top_level_turns",
        "complete",
    }
    _require_exact_keys(value, expected, "usage record")
    if value["schema"] != USAGE_SCHEMA:
        raise ProtocolError("unsupported usage schema")
    if not isinstance(value["vendor_usage_raw"], dict):
        raise ProtocolError("vendor_usage_raw must be an object")
    for field in (
        "aggregate_input_tokens",
        "aggregate_output_tokens",
        "cache_read_input_tokens",
        "cache_write_input_tokens",
        "budget_counted_tokens",
        "claude_agentic_turns",
        "codex_top_level_turns",
    ):
        _optional_token_count(value[field], field)
    if not isinstance(value["complete"], bool):
        raise ProtocolError("complete must be true or false")
    aggregate_input = value["aggregate_input_tokens"]
    aggregate_output = value["aggregate_output_tokens"]
    counted = value["budget_counted_tokens"]
    if value["complete"] and None in (aggregate_input, aggregate_output, counted):
        raise ProtocolError("complete usage requires input, output, and budget counts")
    if aggregate_input is not None and aggregate_output is not None:
        if counted != aggregate_input + aggregate_output:
            raise ProtocolError("budget_counted_tokens must equal aggregate input plus output")
    elif counted is not None:
        raise ProtocolError("a budget count requires both aggregate counts")
    return dict(value)


@contextmanager
def _exclusive_file_lock(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a+b") as lock:
        if os.name == "nt":
            import msvcrt

            if lock.tell() == 0:
                lock.write(b"0")
                lock.flush()
            lock.seek(0)
            msvcrt.locking(lock.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl

            fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            if os.name == "nt":
                lock.seek(0)
                msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(lock.fileno(), fcntl.LOCK_UN)


def _atomic_json_write(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(value, handle, sort_keys=True, separators=(",", ":"))
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
        if os.name != "nt":
            directory = os.open(path.parent, os.O_RDONLY)
            try:
                os.fsync(directory)
            finally:
                os.close(directory)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def _config_hash(value: object) -> str:
    return "sha256:" + hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def validate_observed_usage_policy(record: object) -> dict[str, Any]:
    """Validate experimental settings; each trial freezes their exact digest."""
    if not isinstance(record, dict) or set(record) not in (
            set(DEFAULT_OBSERVED_USAGE_POLICY), set(DEFAULT_OBSERVED_USAGE_POLICY) | {"clock_policy"}):
        raise BudgetError("observed policy keys differ")
    if "clock_policy" in record and record["clock_policy"] != BOOTTIME_POLICY:
        raise BudgetError("unsupported observed clock policy")
    revision = record["policy_revision"]
    if not isinstance(revision, str) or not _SLUG.fullmatch(revision) or not re.search(r"(?:^|[-.])v[1-9][0-9]*$", revision):
        raise BudgetError("policy_revision must be a versioned slug")
    for name, value in record.items():
        if name in {"policy_revision", "clock_policy"}:
            continue
        minimum = 0 if name in {"schema_retries", "preflight_launches", "fault_iterations"} else 1
        if not _is_int(value) or value < minimum:
            raise BudgetError(f"invalid experimental setting: {name}")
    return dict(record)


BOOTTIME_POLICY = "linux-boottime-capped-wall-v1"
BOOTTIME_LEDGER_SCHEMA = "vivary.hoh-observed-ledger/v2"
BOOTTIME_DEADLINE_SCHEMA = "vivary.hoh-observed-deadline/v2"


def uses_boottime(policy) -> bool:
    return isinstance(policy, dict) and policy.get("clock_policy") == BOOTTIME_POLICY


def boottime_ns(supplied=None) -> int:
    try:
        value = time.clock_gettime_ns(time.CLOCK_BOOTTIME) if supplied is None else supplied
    except (AttributeError, OSError) as error:
        raise ClockError("Linux CLOCK_BOOTTIME is unavailable") from error
    if not _is_int(value) or value < 1:
        raise ClockError("BOOTTIME observation must be a positive integer")
    return value


def new_boottime_clock(now, elapsed, boot, duration_ns, *, wall_cap=None, elapsed_cap=None):
    wall_expiry = min(now + duration_ns, wall_cap) if wall_cap is not None else now + duration_ns
    expiry = min(elapsed + duration_ns, elapsed + max(0, wall_expiry - now))
    if elapsed_cap is not None:
        expiry = min(expiry, elapsed_cap)
    return {"clock_policy": BOOTTIME_POLICY, "boot_id": boot,
            "started_unix_ns": now, "expires_unix_ns": wall_expiry,
            "started_boottime_ns": elapsed, "original_expires_boottime_ns": expiry,
            "effective_expires_boottime_ns": expiry,
            "last_observed_unix_ns": now, "last_observed_boottime_ns": elapsed,
            "audit": {"observations": 1, "wall_backsteps": 0, "wall_backstep_total_ns": 0,
                      "largest_wall_backstep_ns": 0, "wall_minus_boottime_delta_ns": 0,
                      "expiry_shortenings": 0, "expiry_shortening_total_ns": 0,
                      "first_correction": None, "last_correction": None}}


def validate_boottime_clock(clock):
    expected = {"clock_policy", "boot_id", "started_unix_ns", "expires_unix_ns", "started_boottime_ns",
                "original_expires_boottime_ns", "effective_expires_boottime_ns", "last_observed_unix_ns",
                "last_observed_boottime_ns", "audit"}
    if not isinstance(clock, dict) or set(clock) != expected or clock["clock_policy"] != BOOTTIME_POLICY:
        raise ClockError("BOOTTIME clock shape differs")
    IterationDeadline._boot_identity(clock["boot_id"])
    if any(not _is_int(clock[key]) or clock[key] < 1 for key in expected - {"clock_policy", "boot_id", "audit"}):
        raise ClockError("BOOTTIME clock values differ")
    if (clock["last_observed_boottime_ns"] < clock["started_boottime_ns"]
            or not clock["started_boottime_ns"] <= clock["effective_expires_boottime_ns"] <= clock["original_expires_boottime_ns"]
            or clock["expires_unix_ns"] < clock["started_unix_ns"]):
        raise ClockError("BOOTTIME clock was reset or extended")
    audit = clock["audit"]
    counters = {"observations", "wall_backsteps", "wall_backstep_total_ns", "largest_wall_backstep_ns",
                "expiry_shortenings", "expiry_shortening_total_ns"}
    if (not isinstance(audit, dict) or set(audit) != counters | {"wall_minus_boottime_delta_ns", "first_correction", "last_correction"}
            or any(not _is_int(audit[key]) or audit[key] < 0 for key in counters)
            or not _is_int(audit["wall_minus_boottime_delta_ns"]) or audit["observations"] < 1
            or audit["wall_backsteps"] >= audit["observations"] or audit["expiry_shortenings"] >= audit["observations"]
            or audit["largest_wall_backstep_ns"] > audit["wall_backstep_total_ns"]
            or audit["expiry_shortening_total_ns"] != clock["original_expires_boottime_ns"] - clock["effective_expires_boottime_ns"]
            or audit["wall_minus_boottime_delta_ns"] != (clock["last_observed_unix_ns"] - clock["started_unix_ns"])
               - (clock["last_observed_boottime_ns"] - clock["started_boottime_ns"])):
        raise ClockError("BOOTTIME aggregate audit differs")
    for name in ("first_correction", "last_correction"):
        item = audit[name]
        if item is not None and (not isinstance(item, dict) or set(item) != {"wall_ns", "boottime_ns", "delta_ns"}
                or any(not _is_int(value) for value in item.values())
                or item["wall_ns"] < 1 or not clock["started_boottime_ns"] <= item["boottime_ns"] <= clock["last_observed_boottime_ns"]):
            raise ClockError("BOOTTIME correction sample differs")
    if (audit["first_correction"] is None) != (audit["last_correction"] is None):
        raise ClockError("BOOTTIME correction endpoints differ")


def advance_boottime_clock(clock, now, elapsed, boot, *, elapsed_cap=None):
    """Mutate an already validated record; the caller must persist before returning."""
    if boot != clock["boot_id"] or elapsed < clock["last_observed_boottime_ns"]:
        raise ClockError("BOOTTIME reversed or system boot changed")
    wall_delta = now - clock["last_observed_unix_ns"]
    elapsed_delta = elapsed - clock["last_observed_boottime_ns"]
    correction = wall_delta - elapsed_delta
    audit = clock["audit"]
    audit["observations"] += 1
    if wall_delta < 0:
        audit["wall_backsteps"] += 1
        audit["wall_backstep_total_ns"] -= wall_delta
        audit["largest_wall_backstep_ns"] = max(audit["largest_wall_backstep_ns"], -wall_delta)
    audit["wall_minus_boottime_delta_ns"] += correction
    if correction:
        event = {"wall_ns": now, "boottime_ns": elapsed, "delta_ns": correction}
        if audit["first_correction"] is None:
            audit["first_correction"] = event
        audit["last_correction"] = event
    previous = clock["effective_expires_boottime_ns"]
    expiry = min(previous, elapsed + max(0, clock["expires_unix_ns"] - now))
    if elapsed_cap is not None:
        expiry = min(expiry, elapsed_cap)
    if expiry < previous:
        audit["expiry_shortenings"] += 1
        audit["expiry_shortening_total_ns"] += previous - expiry
    clock.update(effective_expires_boottime_ns=expiry, last_observed_unix_ns=now, last_observed_boottime_ns=elapsed)
    return (expiry - elapsed) / 1_000_000_000


def boottime_binding(clock):
    return {"clock_policy": BOOTTIME_POLICY, "boot_id": clock["boot_id"],
            "expires_unix_ns": clock["expires_unix_ns"],
            "expires_boottime_ns": clock["effective_expires_boottime_ns"]}


def validate_clock_binding(binding):
    if (not isinstance(binding, dict) or set(binding) != {"clock_policy", "boot_id", "expires_unix_ns", "expires_boottime_ns"}
            or binding["clock_policy"] != BOOTTIME_POLICY
            or any(not _is_int(binding[key]) or binding[key] < 1 for key in ("expires_unix_ns", "expires_boottime_ns"))):
        raise ClockError("absolute BOOTTIME launch binding differs")
    IterationDeadline._boot_identity(binding["boot_id"])
    return dict(binding)


def combine_clock_bindings(*bindings):
    bindings = [validate_clock_binding(binding) for binding in bindings]
    if len({binding["boot_id"] for binding in bindings}) != 1:
        raise ClockError("combined BOOTTIME deadlines cross a boot")
    return {**bindings[0], "expires_unix_ns": min(item["expires_unix_ns"] for item in bindings),
            "expires_boottime_ns": min(item["expires_boottime_ns"] for item in bindings)}


def clock_binding_args(binding):
    binding = validate_clock_binding(binding)
    return ["--clock-policy", binding["clock_policy"], "--boot-id", binding["boot_id"],
            "--expires-unix-ns", str(binding["expires_unix_ns"]),
            "--expires-boottime-ns", str(binding["expires_boottime_ns"])]


def _validate_observed_trial(record: object) -> dict[str, Any]:
    expected = {"packet_id", "trial_id", "source_baseline", "runtime", "runtime_version", "model"}
    if not isinstance(record, dict) or set(record) != expected:
        raise BudgetError("observed trial keys differ")
    for name, value in record.items():
        if not isinstance(value, str) or not value.strip() or len(value) > 256 or any(ord(c) < 32 for c in value):
            raise BudgetError(f"invalid trial identity: {name}")
    return dict(record)


def _validate_observed_admissions(record: object, policy: dict[str, Any], trial: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(record, dict) or not record:
        raise BudgetError("observed admissions must be a nonempty mapping")
    copied = {}
    stages = {path: set() for path in ("healthy", "resume", "regression", "preflight")}
    attempts = set()
    sessions = {}
    for call_id, admission in record.items():
        if not isinstance(call_id, str) or not _SLUG.fullmatch(call_id):
            raise BudgetError("admission call_id must be a slug")
        if not isinstance(admission, dict) or set(admission) != {"binding", "attempt", "path"}:
            raise BudgetError("admission shape differs")
        binding = validate_stage_binding(admission["binding"])
        attempt, path = admission["attempt"], admission["path"]
        if path not in stages or not _is_int(attempt) or not 1 <= attempt <= 1 + policy["schema_retries"]:
            raise BudgetError("admission path or attempt differs")
        if binding["runtime"] != trial["runtime"] or (path == "regression" and binding["role"] == "qa"):
            raise BudgetError("admission runtime or fault stage differs")
        if path == "preflight" and attempt != 1:
            raise BudgetError("preflight cannot authorize a schema retry")
        key = (binding["stage_id"], attempt)
        if key in attempts:
            raise BudgetError("duplicate declared stage attempt")
        attempts.add(key)
        session_stage = sessions.setdefault(binding["session_id"], binding["stage_id"])
        if session_stage != binding["stage_id"]:
            raise BudgetError("different stages cannot share a native session")
        stages[path].add((binding["run_id"], binding["iteration"]))
        copied[call_id] = {"binding": binding, "attempt": attempt, "path": path}
    limits = {"healthy": policy["healthy_iterations"], "resume": policy["fault_iterations"],
              "regression": policy["fault_iterations"], "preflight": policy["preflight_launches"]}
    if any(len(stages[path]) > limits[path] for path in stages):
        raise BudgetError("declared iterations exceed experimental settings")
    if sum(item["path"] == "preflight" for item in copied.values()) > policy["preflight_launches"]:
        raise BudgetError("declared preflight launches exceed experimental settings")
    return copied


class UsageLedger:
    """An atomic packet ledger that retains uncertain reservations."""

    def __init__(self, path: str | os.PathLike[str], packet_budget: int | None = None,
                 *, observed_policy: dict[str, Any] | None = None,
                 trial: dict[str, Any] | None = None,
                 admissions: dict[str, Any] | None = None):
        self.observed_policy = (validate_observed_usage_policy(observed_policy)
                                if observed_policy is not None else None)
        self.trial = _validate_observed_trial(trial) if self.observed_policy else None
        self.admissions = (_validate_observed_admissions(admissions, self.observed_policy, self.trial)
                           if self.observed_policy else None)
        if self.observed_policy:
            target = self.observed_policy["reported_token_target"]
            if packet_budget is not None and packet_budget != target:
                raise BudgetError("packet budget differs from observed policy target")
            packet_budget = target
        elif trial is not None or admissions is not None:
            raise BudgetError("trial and admissions require observed policy")
        if not _is_int(packet_budget) or packet_budget < 1:
            raise BudgetError("packet_budget must be a positive integer")
        self.path = Path(path)
        self.lock_path = self.path.with_name(self.path.name + ".lock")
        self.packet_budget = packet_budget

    def _read(self) -> dict[str, Any]:
        if self.observed_policy is not None:
            return self._read_observed()
        if not self.path.exists():
            return {
                "schema": LEDGER_SCHEMA,
                "packet_budget": self.packet_budget,
                "reservations": {},
            }
        try:
            state = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise BudgetError(f"usage ledger is unreadable: {error}") from error
        if (
            not isinstance(state, dict)
            or set(state) != {"schema", "packet_budget", "reservations"}
            or state.get("schema") != LEDGER_SCHEMA
            or state.get("packet_budget") != self.packet_budget
            or not isinstance(state.get("reservations"), dict)
        ):
            raise BudgetError("usage ledger identity or shape differs")
        for call_id, reservation in state["reservations"].items():
            self._validate_reservation(call_id, reservation)
        return state

    @staticmethod
    def _validate_reservation(call_id: object, reservation: object) -> None:
        if not isinstance(call_id, str) or not _SLUG.fullmatch(call_id):
            raise BudgetError("persisted call_id must be a slug")
        if not isinstance(reservation, dict) or set(reservation) != {
            "maximum",
            "charged",
            "status",
            "usage",
        }:
            raise BudgetError(f"persisted reservation shape differs: {call_id}")
        maximum = reservation["maximum"]
        charged = reservation["charged"]
        status = reservation["status"]
        if not _is_int(maximum) or maximum < 1:
            raise BudgetError(f"persisted maximum is invalid: {call_id}")
        if not _is_int(charged) or charged < 0:
            raise BudgetError(f"persisted charge is invalid: {call_id}")
        if status not in {"reserved", "incomplete", "settled", "overrun"}:
            raise BudgetError(f"persisted reservation status is invalid: {call_id}")
        if status == "reserved":
            if reservation["usage"] is not None or charged != maximum:
                raise BudgetError(f"reserved call does not retain its maximum: {call_id}")
            return
        try:
            usage = validate_usage_record(reservation["usage"])
        except ProtocolError as error:
            raise BudgetError(f"persisted usage is invalid: {call_id}: {error}") from error
        if status == "incomplete":
            if usage["complete"] or charged != maximum:
                raise BudgetError(f"incomplete call released its reservation: {call_id}")
            return
        counted = usage["budget_counted_tokens"]
        if not usage["complete"] or charged != counted:
            raise BudgetError(f"settled call differs from its usage: {call_id}")
        if status == "settled" and charged > maximum:
            raise BudgetError(f"settled call exceeded its maximum: {call_id}")
        if status == "overrun" and charged <= maximum:
            raise BudgetError(f"overrun call did not exceed its maximum: {call_id}")

    def _snapshot(self, state: dict[str, Any]) -> dict[str, Any]:
        if self.observed_policy is not None:
            charged = sum(item["charged"] or 0 for item in state["reservations"].values())
            provisional = sum(sum(item["observations"].values())
                              for item in state["reservations"].values()
                              if item["charged"] is None)
            lifetime = charged + sum(sum(item["charged"] or 0 for item in prior["state"]["reservations"].values())
                                    for prior in state["history"])
            lower_bound, unresolved = self._lifetime_accounting(state)
            return {**state, "charged": charged, "remaining": self.packet_budget - charged,
                    "provisional_reported_tokens": provisional, "lifetime_reported_tokens": lifetime,
                    "lifetime_known_reported_lower_bound": lower_bound,
                    "lifetime_unresolved_invocations": unresolved,
                    "lifetime_unresolved_count": len(unresolved),
                    "lifetime_accounting": "incomplete" if unresolved else "reported",
                    "fully_accounted": not unresolved,
                    "accounting": "unknown" if any(item["status"] == "unknown" for item in state["reservations"].values()) else "reported",
                    "coverage": "native-helper-and-retry-coverage-unknown"}
        charged = sum(item["charged"] for item in state["reservations"].values())
        return {**state, "charged": charged, "remaining": self.packet_budget - charged}

    def snapshot(self) -> dict[str, Any]:
        with _exclusive_file_lock(self.lock_path):
            return self._snapshot(self._read())

    def reserve(self, call_id: str, maximum: int | None) -> dict[str, Any]:
        if self.observed_policy is not None:
            raise BudgetError("observed usage requires a declared admission, not a maximum")
        if not isinstance(call_id, str) or not _SLUG.fullmatch(call_id):
            raise BudgetError("call_id must be a slug")
        if maximum is None or not _is_int(maximum) or maximum < 1:
            raise BudgetError("a verified positive maximum is required")
        with _exclusive_file_lock(self.lock_path):
            state = self._read()
            if call_id in state["reservations"]:
                raise BudgetError(f"call already reserved: {call_id}")
            snapshot = self._snapshot(state)
            if maximum > snapshot["remaining"]:
                raise BudgetError("maximum exceeds the remaining packet balance")
            state["reservations"][call_id] = {
                "maximum": maximum,
                "charged": maximum,
                "status": "reserved",
                "usage": None,
            }
            _atomic_json_write(self.path, state)
            return self._snapshot(state)

    def settle(self, call_id: str, usage: object) -> dict[str, Any]:
        if self.observed_policy is not None:
            return self._settle_observed(call_id, usage)
        normalized = validate_usage_record(usage)
        with _exclusive_file_lock(self.lock_path):
            state = self._read()
            reservation = state["reservations"].get(call_id)
            if not isinstance(reservation, dict) or reservation.get("status") != "reserved":
                raise BudgetError(f"call has no unsettled reservation: {call_id}")
            if normalized["complete"]:
                charged = normalized["budget_counted_tokens"]
                status = "overrun" if charged > reservation["maximum"] else "settled"
            else:
                charged = reservation["maximum"]
                status = "incomplete"
            reservation.update({"charged": charged, "status": status, "usage": normalized})
            _atomic_json_write(self.path, state)
            if status == "overrun":
                raise BudgetError("observed usage exceeded the reserved maximum")
            return self._snapshot(state)


    def _new_observed_state(self) -> dict[str, Any]:
        state = {"schema": OBSERVED_LEDGER_SCHEMA, "policy": self.observed_policy,
                "policy_sha256": _config_hash(self.observed_policy), "trial": self.trial,
                "admissions": self.admissions, "reservations": {}, "launches": 0,
                "clock": None, "stop": None, "history": []}
        if uses_boottime(self.observed_policy):
            state.update(schema=BOOTTIME_LEDGER_SCHEMA, abandoned_preparations=[])
        return state

    def _read_observed(self) -> dict[str, Any]:
        if self.path.is_symlink():
            raise BudgetError("refuse symlinked observed ledger")
        if not self.path.exists():
            return self._new_observed_state()
        try:
            state = json.loads(self.path.read_text(encoding="utf-8"))
            self._validate_observed_state(state)
        except (OSError, ValueError, TypeError, KeyError) as error:
            raise BudgetError(f"observed usage ledger is invalid: {error}") from error
        if (state["policy"] != self.observed_policy or state["trial"] != self.trial
                or state["admissions"] != self.admissions):
            raise BudgetError("trial policy, identity, or admissions changed; reconcile the existing ledger")
        return state

    @staticmethod
    def _validate_observed_state(state: object) -> None:
        expected = {"schema", "policy", "policy_sha256", "trial", "admissions", "reservations", "launches", "clock", "stop", "history"}
        modern = isinstance(state, dict) and uses_boottime(state.get("policy"))
        if modern:
            expected.add("abandoned_preparations")
        experimental = isinstance(state, dict) and state.get("schema") == EXPERIMENTAL_LEDGER_SCHEMA
        if not isinstance(state, dict) or set(state) != expected or (not experimental and state["schema"] != (BOOTTIME_LEDGER_SCHEMA if modern else OBSERVED_LEDGER_SCHEMA)):
            raise BudgetError("observed ledger shape differs")
        policy = validate_observed_usage_policy(state["policy"])
        trial = _validate_observed_trial(state["trial"])
        admissions = _validate_observed_admissions(state["admissions"], policy, trial)
        if state["policy_sha256"] != _config_hash(policy):
            raise BudgetError("experimental config digest differs")
        reservations = state["reservations"]
        if (not isinstance(reservations, dict) or not _is_int(state["launches"])
                or state["launches"] != len(reservations) or state["launches"] > policy["launch_limit"]):
            raise BudgetError("durable launch count differs")
        unresolved = 0
        for call_id, item in reservations.items():
            item_keys = {
                "binding", "attempt", "path", "status", "charged", "usage", "observations", "admitted_unix_ns", "admitted_monotonic_ns", "expires_unix_ns",
            }
            elapsed_key = "admitted_boottime_ns" if modern else "admitted_monotonic_ns"
            if modern:
                item_keys.remove("admitted_monotonic_ns")
                item_keys.update({elapsed_key, "clock"})
            if call_id not in admissions or not isinstance(item, dict) or set(item) != item_keys:
                raise BudgetError("persisted invocation shape differs")
            if any(item[key] != admissions[call_id][key] for key in ("binding", "attempt", "path")):
                raise BudgetError("persisted invocation binding differs")
            if item["status"] not in {"claimed", "settled", "unknown"}:
                raise BudgetError("persisted invocation status differs")
            if (not isinstance(item["observations"], dict)
                    or any(not isinstance(key, str) or not key or not _is_int(value) or value < 0
                           for key, value in item["observations"].items())):
                raise BudgetError("persisted provisional usage differs")
            if any(not _is_int(item[key]) or item[key] < 1 for key in ("admitted_unix_ns", elapsed_key, "expires_unix_ns")):
                raise BudgetError("persisted invocation deadline differs")
            if item["expires_unix_ns"] != min(item["admitted_unix_ns"] + policy["invocation_seconds"] * 1_000_000_000, state["clock"]["expires_unix_ns"]):
                raise BudgetError("persisted invocation deadline was extended")
            if modern:
                validate_boottime_clock(item["clock"])
                if (item["clock"]["started_unix_ns"] != item["admitted_unix_ns"]
                        or item["clock"]["started_boottime_ns"] != item[elapsed_key]
                        or item["clock"]["expires_unix_ns"] != item["expires_unix_ns"]
                        or item["clock"]["boot_id"] != state["clock"]["boot_id"]
                        or item["clock"]["original_expires_boottime_ns"] > min(
                            item[elapsed_key] + policy["invocation_seconds"] * 1_000_000_000,
                            state["clock"]["original_expires_boottime_ns"])):
                    raise BudgetError("invocation BOOTTIME binding differs")
            if item["status"] == "settled":
                usage = validate_usage_record(item["usage"])
                if (not usage["complete"] or not _is_int(item["charged"])
                        or item["charged"] != usage["budget_counted_tokens"]
                        or item["charged"] < sum(item["observations"].values())):
                    raise BudgetError("settled observed charge differs")
            else:
                unresolved += 1
                if item["charged"] is not None:
                    raise BudgetError("unresolved invocation has a fabricated charge")
                if item["usage"] is not None:
                    validate_usage_record(item["usage"])
        if unresolved > 1 or (any(item["status"] == "unknown" for item in reservations.values()) and state["stop"] is None):
            raise BudgetError("unresolved invocation requires a terminal hold")
        stop = state["stop"]
        if stop is not None and (not isinstance(stop, dict) or set(stop) != {"reason", "call_id"}
                                 or not isinstance(stop["reason"], str) or not stop["reason"]
                                 or (stop["call_id"] is not None and stop["call_id"] not in reservations)):
            raise BudgetError("persisted stop differs")
        clock = state["clock"]
        if reservations and clock is None:
            raise BudgetError("claimed invocation has no packet deadline")
        if clock is not None and modern:
            validate_boottime_clock(clock)
            if (clock["expires_unix_ns"] != clock["started_unix_ns"] + policy["packet_seconds"] * 1_000_000_000
                    or clock["original_expires_boottime_ns"] != clock["started_boottime_ns"] + policy["packet_seconds"] * 1_000_000_000):
                raise BudgetError("packet BOOTTIME duration differs")
        elif clock is not None:
            expected_clock = {"started_unix_ns", "expires_unix_ns", "last_observed_unix_ns", "started_monotonic_ns", "last_observed_monotonic_ns", "boot_id"}
            if not isinstance(clock, dict) or set(clock) != expected_clock:
                raise BudgetError("packet clock shape differs")
            if any(not _is_int(value) or value < 1 for key, value in clock.items() if key != "boot_id"):
                raise BudgetError("packet clock value differs")
            IterationDeadline._boot_identity(clock["boot_id"])
            if (clock["expires_unix_ns"] != clock["started_unix_ns"] + policy["packet_seconds"] * 1_000_000_000
                    or clock["last_observed_unix_ns"] < clock["started_unix_ns"]
                    or clock["last_observed_monotonic_ns"] < clock["started_monotonic_ns"]):
                raise BudgetError("packet clock was reset or extended")
        if not isinstance(state["history"], list):
            raise BudgetError("trial history differs")
        trial_ids = {trial["trial_id"]}
        for index, prior in enumerate(state["history"]):
            prior_keys = {"state", "state_sha256", "authorization_ref"}
            exception = prior.get("experimental_continuation") if isinstance(prior, dict) else None
            if exception is not None and experimental:
                prior_keys.add("experimental_continuation")
            if not isinstance(prior, dict) or set(prior) != prior_keys:
                raise BudgetError("prior trial record differs")
            old = prior["state"]
            if not isinstance(old, dict) or old.get("history") != []:
                raise BudgetError("prior trial history must be flat")
            UsageLedger._validate_observed_state(old)
            if prior["state_sha256"] != _config_hash(old) or not isinstance(prior["authorization_ref"], str) or not prior["authorization_ref"]:
                raise BudgetError("prior trial evidence differs")
            if old["trial"]["trial_id"] in trial_ids or old["trial"]["packet_id"] != trial["packet_id"]:
                raise BudgetError("prior trial identity differs")
            if exception is not None:
                if (not isinstance(exception, dict) or "prior_preparation_count" not in exception):
                    raise BudgetError("experimental history exception differs")
                authority = {key: value for key, value in exception.items() if key != "prior_preparation_count"}
                UsageLedger._validate_continuation_authority(authority)
                count = exception["prior_preparation_count"]
                preparations = state.get("abandoned_preparations", [])
                if not _is_int(count) or not 0 <= count <= len(preparations):
                    raise BudgetError("experimental preparation history differs")
                archived = {**old, "history": state["history"][:index]}
                if "abandoned_preparations" in archived:
                    archived["abandoned_preparations"] = preparations[:count]
                lower_bound, unresolved_ids = UsageLedger._lifetime_accounting(archived)
                successors = [*(item["state"] for item in state["history"][index + 1:]),
                              *(item["state"] for item in preparations), state]
                target_hashes = {_config_hash({"observed_policy": item["policy"], "trial": item["trial"],
                                               "admissions": item["admissions"]}) for item in successors}
                if (authority["old_state_sha256"] != _config_hash(archived)
                        or authority["authorization_ref"] != prior["authorization_ref"]
                        or authority["known_reported_lower_bound"] != lower_bound
                        or authority["unresolved_invocations"] != unresolved_ids
                        or authority["target_config_sha256"] not in target_hashes
                        or old["stop"] is None
                        or not any(item["status"] == "unknown" for item in old["reservations"].values())
                        or any(item["status"] == "claimed" for item in old["reservations"].values())):
                    raise BudgetError("experimental history evidence or unresolved accounting differs")
            elif any(item["status"] != "settled" for item in old["reservations"].values()):
                raise BudgetError("prior trial is repeated or unresolved")
            trial_ids.add(old["trial"]["trial_id"])
        if modern:
            preparations = state["abandoned_preparations"]
            if not isinstance(preparations, list):
                raise BudgetError("abandoned preparations differ")
            for prior in preparations:
                if not isinstance(prior, dict) or set(prior) != {"state", "state_sha256", "authorization_ref", "preparation"}:
                    raise BudgetError("abandoned preparation record differs")
                old = prior["state"]
                if (not isinstance(old, dict) or old.get("history") != [] or old.get("abandoned_preparations", []) != []
                        or old.get("clock") is not None or old.get("reservations") != {} or old.get("launches") != 0 or old.get("stop") is not None):
                    raise BudgetError("abandoned preparation was not inert")
                UsageLedger._validate_observed_state(old)
                if (prior["state_sha256"] != _config_hash(old) or not isinstance(prior["authorization_ref"], str)
                        or not prior["authorization_ref"].strip() or old["trial"]["trial_id"] in trial_ids
                        or old["trial"]["packet_id"] != trial["packet_id"]):
                    raise BudgetError("abandoned preparation evidence differs")
                UsageLedger._validate_preparation(prior["preparation"])
                trial_ids.add(old["trial"]["trial_id"])

    def _observe_clock(self, state: dict[str, Any], *, now_unix_ns=None, now_monotonic_ns=None, now_boottime_ns=None, boot_id=None) -> tuple[int, float]:
        if uses_boottime(self.observed_policy):
            elapsed = boottime_ns(now_boottime_ns)
            now = IterationDeadline._wall_clock(now_unix_ns)
            boot = IterationDeadline._boot_identity(boot_id)
            if state["clock"] is None:
                state["clock"] = new_boottime_clock(now, elapsed, boot, self.observed_policy["packet_seconds"] * 1_000_000_000)
                return now, self.observed_policy["packet_seconds"]
            seconds = advance_boottime_clock(state["clock"], now, elapsed, boot)
            if seconds <= 0:
                raise DeadlineError("packet BOOTTIME deadline expired")
            return now, seconds
        now = IterationDeadline._wall_clock(now_unix_ns)
        monotonic = IterationDeadline._monotonic_clock(now_monotonic_ns)
        boot = IterationDeadline._boot_identity(boot_id)
        clock = state["clock"]
        if clock is None:
            clock = {"started_unix_ns": now, "expires_unix_ns": now + self.observed_policy["packet_seconds"] * 1_000_000_000,
                     "last_observed_unix_ns": now, "started_monotonic_ns": monotonic,
                     "last_observed_monotonic_ns": monotonic, "boot_id": boot}
            state["clock"] = clock
        if (boot != clock["boot_id"] or now < clock["last_observed_unix_ns"]
                or monotonic < clock["last_observed_monotonic_ns"]
                or now - clock["last_observed_unix_ns"] + 1_000_000_000 < monotonic - clock["last_observed_monotonic_ns"]):
            raise ClockError("packet clock reversed, elapsed time is uncertain, or system boot changed")
        clock.update(last_observed_unix_ns=now, last_observed_monotonic_ns=monotonic)
        seconds = min(clock["expires_unix_ns"] - now,
                      self.observed_policy["packet_seconds"] * 1_000_000_000 - (monotonic - clock["started_monotonic_ns"])) / 1_000_000_000
        if seconds <= 0:
            raise DeadlineError("packet deadline expired")
        return now, seconds

    def _latch_stop(self, state: dict[str, Any], reason: str, call_id: str | None = None) -> None:
        if state["stop"] is None:
            state["stop"] = {"reason": reason, "call_id": call_id}
        for item in state["reservations"].values():
            if item["status"] == "claimed":
                item["status"] = "unknown"
        _atomic_json_write(self.path, state)

    def admit(self, call_id: str, *, binding: dict[str, Any], attempt: int,
              now_unix_ns=None, now_monotonic_ns=None, now_boottime_ns=None, boot_id=None) -> dict[str, Any]:
        """Consume a declared launch before dispatch; never recycle an uncertain claim."""
        if self.observed_policy is None:
            raise BudgetError("admission requires observed policy")
        with _exclusive_file_lock(self.lock_path):
            state = self._read()
            declaration = state["admissions"].get(call_id)
            if declaration is None or declaration["binding"] != binding or declaration["attempt"] != attempt:
                raise BindingError("undeclared or mismatched invocation")
            if state["stop"] is not None:
                raise BudgetError("packet has a persisted stop; no further dispatch")
            if call_id in state["reservations"]:
                raise BudgetError("invocation cannot be replayed")
            if any(item["status"] != "settled" for item in state["reservations"].values()):
                raise BudgetError("an invocation is unresolved")
            if attempt > 1:
                previous = [item for item in state["reservations"].values()
                            if item["binding"] == binding and item["attempt"] == attempt - 1]
                if len(previous) != 1 or previous[0]["status"] != "settled":
                    raise BudgetError("schema retry requires a settled preceding attempt")
            if state["launches"] >= self.observed_policy["launch_limit"] or self._snapshot(state)["remaining"] <= 0:
                self._latch_stop(state, "launch-limit-or-reported-target")
                raise BudgetError("observed trial allowance exhausted")
            try:
                now, _ = self._observe_clock(state, now_unix_ns=now_unix_ns, now_monotonic_ns=now_monotonic_ns, now_boottime_ns=now_boottime_ns, boot_id=boot_id)
            except DeadlineError as error:
                self._latch_stop(state, str(error))
                raise
            modern = uses_boottime(self.observed_policy)
            elapsed_key = "boottime" if modern else "monotonic"
            item = {**declaration, "status": "claimed", "charged": None,
                "usage": None, "observations": {}, "admitted_unix_ns": now,
                f"admitted_{elapsed_key}_ns": state["clock"][f"last_observed_{elapsed_key}_ns"],
                "expires_unix_ns": min(now + self.observed_policy["invocation_seconds"] * 1_000_000_000, state["clock"]["expires_unix_ns"])}
            if modern:
                item["clock"] = new_boottime_clock(now, item["admitted_boottime_ns"], state["clock"]["boot_id"],
                    self.observed_policy["invocation_seconds"] * 1_000_000_000,
                    wall_cap=state["clock"]["expires_unix_ns"], elapsed_cap=state["clock"]["effective_expires_boottime_ns"])
            state["reservations"][call_id] = item
            state["launches"] += 1
            _atomic_json_write(self.path, state)
            return self._snapshot(state)

    def observe(self, call_id: str, message_id: str, counted_tokens: int) -> dict[str, Any]:
        """Replace cumulative usage for one disjoint message; final settlement replaces it."""
        if self.observed_policy is None:
            raise BudgetError("observations require observed policy")
        if not isinstance(message_id, str) or not message_id or not _is_int(counted_tokens) or counted_tokens < 0:
            self.stop("invalid-provisional-observation", call_id)
            raise BudgetError("invalid provisional usage")
        with _exclusive_file_lock(self.lock_path):
            state = self._read()
            item = state["reservations"].get(call_id)
            if item is None or item["status"] != "claimed":
                raise BudgetError("usage observation has no active claim")
            previous = item["observations"].get(message_id, 0)
            if counted_tokens < previous:
                self._latch_stop(state, "provisional-usage-decreased", call_id)
                raise BudgetError("comparable provisional usage decreased")
            item["observations"][message_id] = counted_tokens
            snapshot = self._snapshot(state)
            if snapshot["charged"] + snapshot["provisional_reported_tokens"] >= self.packet_budget:
                self._latch_stop(state, "reported-target-observed", call_id)
                raise BudgetError("reported target reached during invocation")
            else:
                _atomic_json_write(self.path, state)
            return self._snapshot(state)

    def _settle_observed(self, call_id: str, usage: object, *, recovered: bool = False) -> dict[str, Any]:
        with _exclusive_file_lock(self.lock_path):
            state = self._read()
            item = state["reservations"].get(call_id)
            allowed = {"claimed", "unknown"} if recovered else {"claimed"}
            if item is None or item["status"] not in allowed:
                if item is not None and item["status"] == "settled":
                    self._latch_stop(state, "duplicate-final-report", call_id)
                raise BudgetError("invocation has no unsettled claim")
            try:
                normalized = validate_usage_record(usage)
                if not normalized["complete"]:
                    item["usage"] = normalized
                    raise BudgetError("required final usage is incomplete")
                if normalized["budget_counted_tokens"] < sum(item["observations"].values()):
                    raise BudgetError("final usage is below a comparable observation")
            except ProtocolError as error:
                self._latch_stop(state, str(error), call_id)
                raise
            item.update(status="settled", charged=normalized["budget_counted_tokens"], usage=normalized)
            if self._snapshot(state)["charged"] >= self.packet_budget:
                reason = "reported-target-overrun" if self._snapshot(state)["charged"] > self.packet_budget else "reported-target-reached"
                self._latch_stop(state, reason, call_id)
            else:
                _atomic_json_write(self.path, state)
            return self._snapshot(state)

    def reconcile(self, call_id: str, usage: object) -> dict[str, Any]:
        """Attach a recovered final report without clearing the persisted stop."""
        if self.observed_policy is None:
            raise BudgetError("reconciliation requires observed policy")
        return self._settle_observed(call_id, usage, recovered=True)

    def stop(self, reason: str, call_id: str | None = None) -> dict[str, Any]:
        if self.observed_policy is None or not isinstance(reason, str) or not reason:
            raise BudgetError("observed stop requires a reason")
        with _exclusive_file_lock(self.lock_path):
            state = self._read()
            if call_id is not None and call_id not in state["reservations"]:
                raise BudgetError("stop refers to an undeclared claim")
            self._latch_stop(state, reason, call_id)
            return self._snapshot(state)

    @property
    def stop_grace_seconds(self) -> int:
        if self.observed_policy is None:
            return IterationDeadline.STOP_GRACE_SECONDS
        return self.observed_policy["stop_grace_seconds"]

    def preflight_observed_model(self) -> str:
        """Read the current trial's model from its single settled preflight."""
        if self.observed_policy is None:
            raise BudgetError("native model resolution requires observed policy")
        with _exclusive_file_lock(self.lock_path):
            state = self._read()
            declared = [call_id for call_id, item in state["admissions"].items()
                        if item["path"] == "preflight"]
            if state["stop"] is not None or len(declared) != 1:
                raise BudgetError("native model requires one authorized preflight and no stop")
            preflight = state["reservations"].get(declared[0])
            if (preflight is None or preflight["status"] != "settled"
                    or preflight["binding"]["role"] == "developer"):
                raise BudgetError("native model preflight is not settled and read-only")
            raw = preflight["usage"]["vendor_usage_raw"]
            model = raw.get("observed_model") if isinstance(raw, dict) else None
            if (not isinstance(model, str) or not model.strip() or len(model) > 256
                    or model != model.strip() or model == "native-default"
                    or any(ord(character) < 32 or ord(character) == 127 for character in model)):
                raise BudgetError("preflight did not report a concrete native model")
            return model

    def packet_remaining(self, *, now_unix_ns=None, now_monotonic_ns=None, now_boottime_ns=None, boot_id=None) -> float:
        """Keep non-model work inside the same persisted trial clock."""
        if self.observed_policy is None:
            raise BudgetError("packet deadline requires observed policy")
        with _exclusive_file_lock(self.lock_path):
            state = self._read()
            if state["stop"] is not None:
                raise DeadlineError("packet has stopped")
            try:
                _, remaining = self._observe_clock(
                    state, now_unix_ns=now_unix_ns,
                    now_monotonic_ns=now_monotonic_ns, now_boottime_ns=now_boottime_ns, boot_id=boot_id,
                )
            except DeadlineError as error:
                self._latch_stop(state, str(error))
                raise
            _atomic_json_write(self.path, state)
            return remaining

    def packet_expires_unix_ns(self) -> int:
        state = self.snapshot()
        if self.observed_policy is None or state["clock"] is None:
            raise DeadlineError("packet deadline has not started")
        return state["clock"]["expires_unix_ns"]

    def invocation_expires_unix_ns(self, call_id: str) -> int:
        return self.snapshot()["reservations"][call_id]["expires_unix_ns"]

    def clock_binding(self, call_id=None):
        if not uses_boottime(self.observed_policy):
            return None
        with _exclusive_file_lock(self.lock_path):
            state = self._read()
            if state["stop"] is not None or state["clock"] is None:
                raise DeadlineError("packet BOOTTIME binding is unavailable")
            clock = state["clock"]
            binding = boottime_binding(clock)
            if call_id is not None:
                item = state["reservations"].get(call_id)
                if item is None or item["status"] != "claimed":
                    raise DeadlineError("invocation BOOTTIME binding is unavailable")
                binding["expires_unix_ns"] = min(binding["expires_unix_ns"], item["clock"]["expires_unix_ns"])
                binding["expires_boottime_ns"] = min(binding["expires_boottime_ns"], item["clock"]["effective_expires_boottime_ns"])
            return binding

    def invocation_remaining(self, call_id: str, *, now_unix_ns=None, now_monotonic_ns=None, now_boottime_ns=None, boot_id=None) -> float:
        if self.observed_policy is None:
            raise BudgetError("invocation deadline requires observed policy")
        with _exclusive_file_lock(self.lock_path):
            state = self._read()
            item = state["reservations"].get(call_id)
            if item is None or item["status"] != "claimed" or state["stop"] is not None:
                raise DeadlineError("invocation is not active or packet has stopped")
            try:
                now, packet_remaining = self._observe_clock(state, now_unix_ns=now_unix_ns, now_monotonic_ns=now_monotonic_ns, now_boottime_ns=now_boottime_ns, boot_id=boot_id)
                if uses_boottime(self.observed_policy):
                    remaining = advance_boottime_clock(item["clock"], now, state["clock"]["last_observed_boottime_ns"],
                        state["clock"]["boot_id"], elapsed_cap=state["clock"]["effective_expires_boottime_ns"])
                else:
                    remaining = min(packet_remaining, (item["expires_unix_ns"] - now) / 1_000_000_000,
                                    self.observed_policy["invocation_seconds"] -
                                    (state["clock"]["last_observed_monotonic_ns"] - item["admitted_monotonic_ns"]) / 1_000_000_000)
                if remaining <= 0:
                    raise DeadlineError("invocation deadline expired")
            except DeadlineError as error:
                self._latch_stop(state, str(error), call_id)
                raise
            _atomic_json_write(self.path, state)
            return remaining

    @staticmethod
    def _lifetime_accounting(state):
        """Reported lower bound only; absence of usage never establishes zero."""
        lower_bound, unresolved = 0, []
        for trial_state in [*(prior["state"] for prior in state["history"]), state]:
            for call_id, item in sorted(trial_state["reservations"].items()):
                if item["status"] == "settled":
                    lower_bound += item["charged"]
                else:
                    lower_bound += sum(item["observations"].values())
                    unresolved.append({"trial_id": trial_state["trial"]["trial_id"], "call_id": call_id})
        return lower_bound, unresolved

    @staticmethod
    def _validate_continuation_authority(authority):
        keys = {"schema", "authorization_ref", "old_state_sha256", "archive_sha256",
                "archive_members", "ledger_member", "quiescence_sha256", "target_config_sha256",
                "unresolved_invocations", "known_reported_lower_bound", "accounting_exception"}
        if (not isinstance(authority, dict) or set(authority) != keys
                or authority["schema"] != "vivary.hoh-experimental-continuation/v1"
                or not isinstance(authority["authorization_ref"], str) or not authority["authorization_ref"].strip()
                or authority["accounting_exception"] != "unresolved-native-usage-preserved"):
            raise BudgetError("explicit versioned experimental continuation authority is required")
        for key in ("old_state_sha256", "archive_sha256", "quiescence_sha256", "target_config_sha256"):
            if not isinstance(authority[key], str) or not re.fullmatch(r"sha256:[0-9a-f]{64}", authority[key]):
                raise BudgetError("experimental authority digest differs")
        members = authority["archive_members"]
        if (not isinstance(members, dict) or not members
                or any(not isinstance(name, str) or not name or not isinstance(value, str)
                       or not re.fullmatch(r"sha256:[0-9a-f]{64}", value) for name, value in members.items())
                or not isinstance(authority["ledger_member"], str) or authority["ledger_member"] not in members):
            raise BudgetError("exact archive member manifest and ledger member are required")
        unresolved = authority["unresolved_invocations"]
        if (not isinstance(unresolved, list) or not unresolved
                or any(not isinstance(item, dict) or set(item) != {"trial_id", "call_id"}
                       or any(not isinstance(value, str) or not _SLUG.fullmatch(value) for value in item.values())
                       for item in unresolved)
                or len({(item["trial_id"], item["call_id"]) for item in unresolved}) != len(unresolved)
                or not _is_int(authority["known_reported_lower_bound"]) or authority["known_reported_lower_bound"] < 0):
            raise BudgetError("exact unresolved invocation set and known lower bound are required")

    @staticmethod
    def _verify_continuation_artifacts(authority, archive_path, quiescence_path, old_bytes, state):
        """Verify bound receipts. The receipt issuer owns the actual process inspection."""
        try:
            archive_path, quiescence_path = Path(archive_path), Path(quiescence_path)
            if archive_path.is_symlink() or quiescence_path.is_symlink():
                raise BudgetError("continuation evidence cannot be symlinked")
            with archive_path.open("rb") as source:
                if "sha256:" + hashlib.file_digest(source, "sha256").hexdigest() != authority["archive_sha256"]:
                    raise BudgetError("continuation archive digest differs")
                source.seek(0)
                with zipfile.ZipFile(source) as archive:
                    names = archive.namelist()
                    if len(names) != len(set(names)) or set(names) != set(authority["archive_members"]):
                        raise BudgetError("archive contains duplicate, missing, or extra members")
                    for info in archive.infolist():
                        with archive.open(info) as member:
                            actual = "sha256:" + hashlib.file_digest(member, "sha256").hexdigest()
                        if actual != authority["archive_members"][info.filename]:
                            raise BudgetError("archive member digest differs")
                    if archive.read(authority["ledger_member"]) != old_bytes:
                        raise BudgetError("archived ledger bytes differ from the exact stopped ledger")
            raw = quiescence_path.read_bytes()
            if "sha256:" + hashlib.sha256(raw).hexdigest() != authority["quiescence_sha256"]:
                raise BudgetError("quiescence receipt digest differs")
            receipt = json.loads(raw)
            if (not isinstance(receipt, dict) or set(receipt) != {"schema", "old_state_sha256", "invocations"}
                    or receipt["schema"] != "vivary.hoh-quiescence/v1"
                    or receipt["old_state_sha256"] != authority["old_state_sha256"]
                    or not isinstance(receipt["invocations"], dict)
                    or set(receipt["invocations"]) != set(state["reservations"])
                    or any(not isinstance(item, dict) or set(item) != {"status", "evidence_ref"}
                           or item["status"] != "quiescent" or not isinstance(item["evidence_ref"], str)
                           or not item["evidence_ref"].strip() for item in receipt["invocations"].values())):
                raise BudgetError("every prior invocation requires bound quiescence evidence")
        except (OSError, ValueError, KeyError, zipfile.BadZipFile) as error:
            raise BudgetError(f"continuation evidence is unreadable: {error}") from error

    def continue_experiment(self, *, observed_policy, trial, admissions, authority,
                            archive_path, quiescence_path):
        """Continue a stopped experiment under a recorded accounting exception.

        This verifies exact archive and quiescence receipts, not process liveness.
        The caller must establish quiescence and record authority before calling.
        Unknown native usage stays immutable in history and blocks full accounting.
        """
        self._validate_continuation_authority(authority)
        target_config = {"observed_policy": observed_policy, "trial": trial, "admissions": admissions}
        if authority["target_config_sha256"] != _config_hash(target_config):
            raise BudgetError("continuation target differs from recorded authority")
        next_ledger = UsageLedger(self.path, **target_config)
        with _exclusive_file_lock(self.lock_path):
            if self.path.is_symlink() or not self.path.is_file():
                raise BudgetError("continuation requires an existing regular ledger")
            try:
                old_bytes = self.path.read_bytes()
                state = json.loads(old_bytes)
                self._validate_observed_state(state)
            except (OSError, ValueError, TypeError, KeyError) as error:
                raise BudgetError(f"continuation ledger is invalid: {error}") from error
            for prior in state["history"]:
                exception = prior.get("experimental_continuation", {})
                recorded = {key: value for key, value in exception.items() if key != "prior_preparation_count"}
                if recorded == authority:
                    if any(state[key] != target_config[config_key] for key, config_key in
                           (("policy", "observed_policy"), ("trial", "trial"), ("admissions", "admissions"))):
                        raise BudgetError("continuation was already superseded; replay cannot reset it")
                    self.observed_policy, self.trial, self.admissions = next_ledger.observed_policy, next_ledger.trial, next_ledger.admissions
                    self.packet_budget = next_ledger.packet_budget
                    return self._snapshot(state)
            if (_config_hash(state) != authority["old_state_sha256"]
                    or state["policy"] != self.observed_policy or state["trial"] != self.trial
                    or state["admissions"] != self.admissions or state["stop"] is None
                    or not any(item["status"] == "unknown" for item in state["reservations"].values())
                    or any(item["status"] == "claimed" for item in state["reservations"].values())):
                raise BudgetError("continuation requires the exact stopped, unclaimed unresolved trial")
            lower_bound, unresolved = self._lifetime_accounting(state)
            if (lower_bound != authority["known_reported_lower_bound"]
                    or unresolved != authority["unresolved_invocations"]):
                raise BudgetError("continuation lifetime accounting differs")
            preparations = state.get("abandoned_preparations", [])
            prior_states = [state, *(item["state"] for item in state["history"]), *(item["state"] for item in preparations)]
            if (trial["packet_id"] != state["trial"]["packet_id"]
                    or any(trial["trial_id"] == old["trial"]["trial_id"] for old in prior_states)
                    or any(observed_policy["policy_revision"] == old["policy"]["policy_revision"] for old in prior_states)):
                raise BudgetError("experimental continuation needs a fresh trial and policy revision in the same packet")
            old_sessions = {item["binding"]["session_id"] for old in prior_states for item in old["admissions"].values()}
            if any(item["binding"]["session_id"] in old_sessions for item in admissions.values()):
                raise BudgetError("experimental continuation requires fresh sessions across all history and preparations")
            if preparations and not uses_boottime(observed_policy):
                raise BudgetError("target clock policy cannot preserve abandoned preparations")
            self._verify_continuation_artifacts(authority, archive_path, quiescence_path, old_bytes, state)
            archived = {**state, "history": []}
            if "abandoned_preparations" in archived:
                archived["abandoned_preparations"] = []
            replacement = next_ledger._new_observed_state()
            replacement["schema"] = EXPERIMENTAL_LEDGER_SCHEMA
            replacement["history"] = [*state["history"], {
                "state": archived, "state_sha256": _config_hash(archived),
                "authorization_ref": authority["authorization_ref"],
                "experimental_continuation": {**authority, "prior_preparation_count": len(preparations)},
            }]
            if "abandoned_preparations" in replacement:
                replacement["abandoned_preparations"] = preparations
            self._validate_observed_state(replacement)
            _atomic_json_write(self.path, replacement)
            self.observed_policy, self.trial, self.admissions = next_ledger.observed_policy, next_ledger.trial, next_ledger.admissions
            self.packet_budget = next_ledger.packet_budget
            return self._snapshot(replacement)

    def next_trial(self, *, observed_policy: dict[str, Any], trial: dict[str, Any],
                   admissions: dict[str, Any], authorization_ref: str) -> dict[str, Any]:
        """Explicit authorized transition; keep all prior charges and stop evidence."""
        if not isinstance(authorization_ref, str) or not authorization_ref.strip():
            raise BudgetError("a recorded continuation authority reference is required")
        next_ledger = UsageLedger(self.path, observed_policy=observed_policy, trial=trial, admissions=admissions)
        with _exclusive_file_lock(self.lock_path):
            state = self._read()
            if not state["reservations"] or any(item["status"] != "settled" for item in state["reservations"].values()):
                raise BudgetError("prior trial is empty or unresolved; continuation cannot reset it")
            if trial["packet_id"] != self.trial["packet_id"] or trial["trial_id"] in {self.trial["trial_id"], *(item["state"]["trial"]["trial_id"] for item in state["history"])}:
                raise BudgetError("continuation must retain packet identity and name a new trial")
            previous_policies = [state["policy"], *(item["state"]["policy"] for item in state["history"]),
                                 *(item["state"]["policy"] for item in state.get("abandoned_preparations", []))]
            if any(observed_policy["policy_revision"] == old["policy_revision"] and observed_policy != old
                   for old in previous_policies):
                raise BudgetError("changed settings require a new policy revision")
            preparations = state.get("abandoned_preparations", [])
            if preparations and not uses_boottime(observed_policy):
                raise BudgetError("target schema cannot preserve abandoned preparation records")
            if any(trial["trial_id"] == prior["state"]["trial"]["trial_id"] for prior in preparations):
                raise BudgetError("an abandoned preparation identity cannot be reused")
            history = state.pop("history")
            state["history"] = []
            if "abandoned_preparations" in state:
                state["abandoned_preparations"] = []
            history.append({"state": state, "state_sha256": _config_hash(state), "authorization_ref": authorization_ref})
            replacement = next_ledger._new_observed_state()
            if state["schema"] == EXPERIMENTAL_LEDGER_SCHEMA:
                replacement["schema"] = EXPERIMENTAL_LEDGER_SCHEMA
            replacement["history"] = history
            if "abandoned_preparations" in replacement:
                replacement["abandoned_preparations"] = preparations
            self._validate_observed_state(replacement)
            _atomic_json_write(self.path, replacement)
            self.observed_policy, self.trial, self.admissions = next_ledger.observed_policy, next_ledger.trial, next_ledger.admissions
            self.packet_budget = next_ledger.packet_budget
            return self._snapshot(replacement)

    @staticmethod
    def _validate_preparation(preparation):
        if (not isinstance(preparation, dict) or set(preparation) != {"config_sha256", "source_sha256"}
                or any(not isinstance(value, str) or not re.fullmatch(r"sha256:[0-9a-f]{64}", value)
                       for value in preparation.values())):
            raise BudgetError("frozen preparation config and source digests are required")

    def revise_unstarted(self, *, observed_policy, trial, admissions, authorization_ref,
                         expected_state_sha256, preparation):
        """Replace an exact inert preparation, retaining trial accounting and provenance."""
        if not isinstance(authorization_ref, str) or not authorization_ref.strip():
            raise BudgetError("a recorded preparation revision authority is required")
        self._validate_preparation(preparation)
        replacement_ledger = UsageLedger(self.path, observed_policy=observed_policy, trial=trial, admissions=admissions)
        if not uses_boottime(observed_policy):
            raise BudgetError("preparation revision requires the explicit new ledger schema")
        with _exclusive_file_lock(self.lock_path):
            state = self._read()
            if (not self.path.is_file() or _config_hash(state) != expected_state_sha256
                    or state["clock"] is not None or state["reservations"] != {} or state["launches"] != 0 or state["stop"] is not None):
                raise BudgetError("preparation changed, started, or stopped; it cannot be revised")
            history = state["history"]
            preparations = state.get("abandoned_preparations", [])
            prior_states = [state, *(prior["state"] for prior in history), *(prior["state"] for prior in preparations)]
            if (trial["packet_id"] != state["trial"]["packet_id"]
                    or any(trial["trial_id"] == old["trial"]["trial_id"] for old in prior_states)
                    or any(observed_policy["policy_revision"] == old["policy"]["policy_revision"] for old in prior_states)):
                raise BudgetError("preparation revision needs a fresh trial and policy revision in the same packet")
            archived = {**state, "history": []}
            if "abandoned_preparations" in archived:
                archived["abandoned_preparations"] = []
            replacement = replacement_ledger._new_observed_state()
            if state["schema"] == EXPERIMENTAL_LEDGER_SCHEMA:
                replacement["schema"] = EXPERIMENTAL_LEDGER_SCHEMA
            replacement["history"] = history
            replacement["abandoned_preparations"] = [*preparations,
                {"state": archived, "state_sha256": _config_hash(archived), "authorization_ref": authorization_ref,
                 "preparation": dict(preparation)}]
            self._validate_observed_state(replacement)
            _atomic_json_write(self.path, replacement)
            self.observed_policy, self.trial, self.admissions = replacement_ledger.observed_policy, replacement_ledger.trial, replacement_ledger.admissions
            self.packet_budget = replacement_ledger.packet_budget
            return self._snapshot(replacement)


class IterationDeadline:
    """A persisted deadline bound to wall time, monotonic time, and one boot."""

    STOP_GRACE_SECONDS = 5.0

    def __init__(self, path: Path, run_id: str, iteration: int, *, observed_policy=None):
        self.path = path
        self.lock_path = path.with_name(path.name + ".lock")
        self.run_id = run_id
        self.iteration = iteration
        self.observed_policy = (validate_observed_usage_policy(observed_policy)
                                if observed_policy is not None else None)

    @classmethod
    def create(
        cls,
        path: str | os.PathLike[str],
        *,
        run_id: str,
        iteration: int,
        duration_seconds: float = 3600,
        now_unix_ns: int | None = None,
        now_monotonic_ns: int | None = None,
        now_boottime_ns: int | None = None,
        boot_id: str | None = None,
        observed_policy: dict[str, Any] | None = None,
    ) -> "IterationDeadline":
        deadline = cls(Path(path), run_id, iteration, observed_policy=observed_policy)
        deadline._validate_identity()
        if isinstance(duration_seconds, bool) or not isinstance(duration_seconds, (int, float)):
            raise DeadlineError("duration_seconds must be positive")
        if deadline.observed_policy is not None:
            if duration_seconds != deadline.observed_policy["iteration_seconds"]:
                raise DeadlineError("iteration duration differs from its experimental policy")
        elif duration_seconds <= 0 or duration_seconds > 3600:
            raise DeadlineError("duration_seconds must be in the range (0, 3600]")
        with _exclusive_file_lock(deadline.lock_path):
            if deadline.path.exists() or deadline.path.is_symlink():
                raise DeadlineError("refuse existing iteration deadline")
            if uses_boottime(deadline.observed_policy):
                elapsed = boottime_ns(now_boottime_ns)
                now = deadline._wall_clock(now_unix_ns)
                observed_boot = deadline._boot_identity(boot_id)
                state = {**new_boottime_clock(now, elapsed, observed_boot, int(duration_seconds * 1_000_000_000)),
                    "schema": BOOTTIME_DEADLINE_SCHEMA, "run_id": run_id, "iteration": iteration,
                    "duration_seconds": duration_seconds, "stop_grace_seconds": deadline.stop_grace_seconds,
                    "observed_policy_sha256": _config_hash(deadline.observed_policy), "stop": None}
                _atomic_json_write(deadline.path, state)
                return deadline
            now = deadline._wall_clock(now_unix_ns)
            monotonic_now = deadline._monotonic_clock(now_monotonic_ns)
            observed_boot = deadline._boot_identity(boot_id)
            state = {
                "schema": DEADLINE_SCHEMA,
                "run_id": run_id,
                "iteration": iteration,
                "duration_seconds": duration_seconds,
                "started_unix_ns": now,
                "expires_unix_ns": now + int(duration_seconds * 1_000_000_000),
                "last_observed_unix_ns": now,
                "started_monotonic_ns": monotonic_now,
                "last_observed_monotonic_ns": monotonic_now,
                "boot_id": observed_boot,
                "stop_grace_seconds": deadline.stop_grace_seconds,
            }
            if deadline.observed_policy is not None:
                state["schema"] = OBSERVED_DEADLINE_SCHEMA
                state["observed_policy_sha256"] = _config_hash(deadline.observed_policy)
            _atomic_json_write(deadline.path, state)
        return deadline

    @classmethod
    def resume(
        cls,
        path: str | os.PathLike[str],
        *,
        run_id: str,
        iteration: int,
        boot_id: str | None = None,
        observed_policy: dict[str, Any] | None = None,
    ) -> "IterationDeadline":
        deadline = cls(Path(path), run_id, iteration, observed_policy=observed_policy)
        deadline._validate_identity()
        with _exclusive_file_lock(deadline.lock_path):
            state = deadline._read()
            observed_boot = deadline._boot_identity(boot_id)
            if state["boot_id"] != observed_boot:
                if uses_boottime(deadline.observed_policy):
                    state["stop"] = "iteration deadline resume crosses a system boot"
                    _atomic_json_write(deadline.path, state)
                raise ClockError(
                    "iteration deadline crosses a system boot: "
                    f"persisted={state['boot_id']} observed={observed_boot}"
                )
        return deadline

    def _validate_identity(self) -> None:
        if not isinstance(self.run_id, str) or not _SLUG.fullmatch(self.run_id):
            raise DeadlineError("deadline run_id must be a slug")
        if not _is_int(self.iteration) or self.iteration < 1:
            raise DeadlineError("deadline iteration must be a positive integer")

    @staticmethod
    def _wall_clock(now_unix_ns: int | None) -> int:
        try:
            now = time.time_ns() if now_unix_ns is None else now_unix_ns
        except Exception as error:
            raise ClockError(f"wall clock unavailable: {error}") from error
        if not _is_int(now) or now < 1:
            raise ClockError("wall clock observation must be a positive integer")
        return now

    @staticmethod
    def _monotonic_clock(now_monotonic_ns: int | None) -> int:
        try:
            now = time.monotonic_ns() if now_monotonic_ns is None else now_monotonic_ns
        except Exception as error:
            raise ClockError(f"monotonic clock unavailable: {error}") from error
        if not _is_int(now) or now < 1:
            raise ClockError("monotonic clock observation must be a positive integer")
        return now

    @staticmethod
    def _boot_identity(boot_id: str | None) -> str:
        if boot_id is None:
            path = Path("/proc/sys/kernel/random/boot_id")
            try:
                boot_id = path.read_text(encoding="ascii").strip()
            except OSError as error:
                raise ClockError(f"Linux boot identity unavailable: {error}") from error
        if not isinstance(boot_id, str) or not re.fullmatch(
            r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", boot_id
        ):
            raise ClockError("boot identity is invalid")
        return boot_id

    def _read(self) -> dict[str, Any]:
        try:
            state = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise DeadlineError(f"iteration deadline is unreadable: {error}") from error
        if uses_boottime(self.observed_policy):
            metadata = {"schema", "run_id", "iteration", "duration_seconds", "stop_grace_seconds", "observed_policy_sha256", "stop"}
            if not isinstance(state, dict) or not metadata <= set(state):
                raise DeadlineError("BOOTTIME iteration metadata differs")
            validate_boottime_clock({key: value for key, value in state.items() if key not in metadata})
            if (state["schema"] != BOOTTIME_DEADLINE_SCHEMA or state["run_id"] != self.run_id or state["iteration"] != self.iteration
                    or state["duration_seconds"] != self.observed_policy["iteration_seconds"]
                    or state["stop_grace_seconds"] != self.stop_grace_seconds
                    or state["observed_policy_sha256"] != _config_hash(self.observed_policy)
                    or state["expires_unix_ns"] != state["started_unix_ns"] + self.observed_policy["iteration_seconds"] * 1_000_000_000
                    or state["original_expires_boottime_ns"] != state["started_boottime_ns"] + self.observed_policy["iteration_seconds"] * 1_000_000_000
                    or (state["stop"] is not None and (not isinstance(state["stop"], str) or not state["stop"]))):
                raise DeadlineError("BOOTTIME iteration identity or duration differs")
            return state
        expected = {
            "schema",
            "run_id",
            "iteration",
            "duration_seconds",
            "started_unix_ns",
            "expires_unix_ns",
            "last_observed_unix_ns",
            "started_monotonic_ns",
            "last_observed_monotonic_ns",
            "boot_id",
            "stop_grace_seconds",
        }
        if self.observed_policy is not None:
            expected.add("observed_policy_sha256")
        if not isinstance(state, dict) or set(state) != expected:
            raise DeadlineError("iteration deadline shape differs")
        if (self.observed_policy is not None and state["observed_policy_sha256"]
                != _config_hash(self.observed_policy)):
            raise DeadlineError("iteration deadline experimental policy differs")
        if (
            state["schema"] != (OBSERVED_DEADLINE_SCHEMA if self.observed_policy is not None else DEADLINE_SCHEMA)
            or state["run_id"] != self.run_id
            or state["iteration"] != self.iteration
            or state["stop_grace_seconds"] != self.stop_grace_seconds
        ):
            raise DeadlineError("iteration deadline identity differs")
        duration = state["duration_seconds"]
        timestamps = [
            state["started_unix_ns"],
            state["expires_unix_ns"],
            state["last_observed_unix_ns"],
            state["started_monotonic_ns"],
            state["last_observed_monotonic_ns"],
        ]
        if (
            isinstance(duration, bool)
            or not isinstance(duration, (int, float))
            or duration <= 0
            or (duration != self.observed_policy["iteration_seconds"] if self.observed_policy is not None else duration > 3600)
            or any(not _is_int(value) or value < 1 for value in timestamps)
            or state["expires_unix_ns"]
            != state["started_unix_ns"] + int(duration * 1_000_000_000)
            or state["last_observed_unix_ns"] < state["started_unix_ns"]
            or state["last_observed_monotonic_ns"] < state["started_monotonic_ns"]
            or not isinstance(state["boot_id"], str)
            or not re.fullmatch(
                r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
                state["boot_id"],
            )
        ):
            raise DeadlineError("iteration deadline state is invalid")
        return state

    @property
    def expires_unix_ns(self) -> int:
        with _exclusive_file_lock(self.lock_path):
            return self._read()["expires_unix_ns"]

    @property
    def stop_grace_seconds(self) -> float:
        return (self.observed_policy["stop_grace_seconds"]
                if self.observed_policy is not None else self.STOP_GRACE_SECONDS)

    def snapshot(self) -> dict[str, Any]:
        with _exclusive_file_lock(self.lock_path):
            return dict(self._read())

    def clock_binding(self):
        if not uses_boottime(self.observed_policy):
            return None
        with _exclusive_file_lock(self.lock_path):
            state = self._read()
            if state["stop"] is not None:
                raise DeadlineError("iteration BOOTTIME deadline has stopped")
            return boottime_binding(state)

    def remaining(
        self,
        *,
        now_unix_ns: int | None = None,
        now_monotonic_ns: int | None = None,
        now_boottime_ns: int | None = None,
        boot_id: str | None = None,
    ) -> float:
        with _exclusive_file_lock(self.lock_path):
            # Sample in persistence order: an earlier waiter must not compare a
            # stale pre-lock timestamp with a later observer's committed state.
            if uses_boottime(self.observed_policy):
                state = self._read()
                if state["stop"] is not None:
                    raise DeadlineError("iteration BOOTTIME deadline has stopped")
                try:
                    elapsed = boottime_ns(now_boottime_ns)
                    now = self._wall_clock(now_unix_ns)
                    observed_boot = self._boot_identity(boot_id)
                    remaining = advance_boottime_clock(state, now, elapsed, observed_boot)
                    if remaining <= 0:
                        raise DeadlineError("iteration BOOTTIME deadline expired")
                except DeadlineError as error:
                    state["stop"] = str(error)
                    _atomic_json_write(self.path, state)
                    raise
                _atomic_json_write(self.path, state)
                return remaining
            now = self._wall_clock(now_unix_ns)
            monotonic_now = self._monotonic_clock(now_monotonic_ns)
            observed_boot = self._boot_identity(boot_id)
            state = self._read()
            if observed_boot != state["boot_id"]:
                raise ClockError(
                    "iteration deadline crosses a system boot: "
                    f"persisted={state['boot_id']} observed={observed_boot}"
                )
            if now < state["last_observed_unix_ns"]:
                raise ClockError(
                    "wall clock moved backward: "
                    f"observed={now} persisted={state['last_observed_unix_ns']}"
                )
            if monotonic_now < state["last_observed_monotonic_ns"]:
                raise ClockError(
                    "monotonic clock moved backward: "
                    f"observed={monotonic_now} persisted={state['last_observed_monotonic_ns']}"
                )
            wall_delta = now - state["last_observed_unix_ns"]
            monotonic_delta = monotonic_now - state["last_observed_monotonic_ns"]
            if wall_delta + 1_000_000_000 < monotonic_delta:
                raise ClockError(
                    "wall clock elapsed less time than the monotonic clock: "
                    f"wall_delta_ns={wall_delta} monotonic_delta_ns={monotonic_delta} "
                    "tolerance_ns=1000000000"
                )
            state["last_observed_unix_ns"] = now
            state["last_observed_monotonic_ns"] = monotonic_now
            _atomic_json_write(self.path, state)
            wall_remaining = state["expires_unix_ns"] - now
            monotonic_remaining = (
                int(state["duration_seconds"] * 1_000_000_000)
                - (monotonic_now - state["started_monotonic_ns"])
            )
            remaining = min(wall_remaining, monotonic_remaining) / 1_000_000_000
            if remaining <= 0:
                raise DeadlineError("iteration deadline expired")
            return remaining
