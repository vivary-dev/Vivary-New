"""Deterministic sequencer entry point for the bounded headless-loop proof."""

from __future__ import annotations

import os
import argparse
import ast
import ctypes
import codecs
import selectors
import hashlib
import json
import re
import shutil
import signal
import stat
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Protocol

from hoh.protocol import (
    BindingError,
    BudgetError,
    DeadlineError,
    EVIDENCE_SCHEMA,
    IterationDeadline,
    ProtocolError,
    RECEIPT_SCHEMA,
    ROLE_REQUEST_SCHEMA,
    ROLE_RESULT_SCHEMA,
    TRANSITION_SCHEMA,
    UsageLedger,
    _atomic_json_write,
    _exclusive_file_lock,
    boottime_ns,
    combine_clock_bindings,
    uses_boottime,
    validate_evidence_record,
    validate_receipt_record,
    validate_role_request,
    validate_role_result,
    validate_usage_record,
    validate_transition_record,
)
from hoh.workflow import REQUIREMENT_IDS, Workflow, evaluate_phase, record_hash
from hoh.context import ContextRetrievalError, retrieve_planner_context


class HarnessError(RuntimeError):
    """Deterministic preparation cannot establish its required observation."""


_FAILED_TEST = re.compile(
    r"^\S+ \((test_links\.LinkCheckTests\.test_[A-Za-z0-9_]+)\) \.\.\. FAIL$",
    re.MULTILINE,
)
_PASSED_TEST = re.compile(
    r"^\S+ \((test_links\.LinkCheckTests\.test_[A-Za-z0-9_]+)\) \.\.\. ok$",
    re.MULTILINE,
)
EXPECTED_ORACLE_TEST_IDS = frozenset(
    {
        "test_links.LinkCheckTests.test_reports_missing_relative_target",
        "test_links.LinkCheckTests.test_rejects_parent_escape",
        "test_links.LinkCheckTests.test_ignores_anchor_only_target",
        "test_links.LinkCheckTests.test_accepts_existing_relative_target",
    }
)


def canonical_json_bytes(value: object) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return "sha256:" + hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def hash_tree(root: Path) -> str:
    """Hash names, modes, and bytes without following links or reading Git state."""
    root = root.resolve(strict=True)
    digest = hashlib.sha256()
    for path in sorted(root.rglob("*"), key=lambda item: item.relative_to(root).as_posix()):
        relative = path.relative_to(root)
        if ".git" in relative.parts:
            continue
        if path.is_symlink():
            raise HarnessError(f"refuse symlink in hashed tree: {relative.as_posix()}")
        if path.is_dir():
            continue
        digest.update(relative.as_posix().encode("utf-8") + b"\0")
        digest.update((path.stat().st_mode & 0o777).to_bytes(2, "big") + b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return "sha256:" + digest.hexdigest()


def source_metrics(path: Path) -> dict[str, int]:
    """Return auditable physical line and largest function-span counts."""
    text = path.read_text(encoding="utf-8")
    try:
        tree = ast.parse(text)
    except SyntaxError as error:
        raise HarnessError(f"candidate source is not valid Python: {error}") from error
    spans = [
        node.end_lineno - node.lineno + 1
        for node in ast.walk(tree)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.end_lineno is not None
    ]
    return {"physical_lines": len(text.splitlines()), "largest_function_lines": max(spans, default=0)}


def process_evidence(result: dict[str, Any]) -> dict[str, Any]:
    return {
        key: result.get(key)
        for key in (
            "pid",
            "process_group",
            "owned_pids",
            "started_unix_ns",
            "finished_unix_ns",
            "started_monotonic_ns",
            "finished_monotonic_ns",
            "timed_out",
            "late_output",
            "deadline_error",
            "deadline_state",
            "forced_after_grace",
            "orphaned_descendants",
            "cleanup_confirmed",
            "cleanup_seconds",
        )
    }


class ReceiptStore:
    """An append-only receipt chain with an atomically rebuilt public index."""

    def __init__(self, root: Path, run_id: str):
        self.root = root
        self.details = root / "details"
        self.index = root / "index.md"
        self.run_id = run_id
        self.details.mkdir(parents=True, exist_ok=True)
        self._sequence = 0
        self._head: str | None = None
        self._last_payload: dict[str, Any] | None = None
        self._entries: list[tuple[str, str, str, str]] = []
        self._load()

    @property
    def head(self) -> str | None:
        return self._head

    @property
    def last_payload(self) -> dict[str, Any] | None:
        return self._last_payload

    def _load(self) -> None:
        expected_prior = None
        for path in sorted(self.details.glob("*.json")):
            try:
                record = validate_receipt_record(json.loads(path.read_text(encoding="utf-8")))
            except (OSError, json.JSONDecodeError, ProtocolError) as error:
                raise HarnessError(f"receipt chain is unreadable: {path.name}: {error}") from error
            if record["sequence"] != self._sequence + 1:
                raise HarnessError("receipt sequence has a gap")
            if record["prior_receipt_sha256"] != expected_prior:
                raise HarnessError("receipt chain prior hash differs")
            if record["payload"]["run_id"] != self.run_id:
                raise HarnessError("receipt chain crosses runs")
            digest = sha256_bytes(path.read_bytes())
            expected_name = f"{record['sequence']:04d}-{record['payload']['stage']}-{digest[7:19]}.json"
            if path.name != expected_name:
                raise HarnessError("receipt filename does not bind its content")
            self._sequence = record["sequence"]
            self._head = digest
            self._last_payload = record["payload"]
            expected_prior = digest
            self._entries.append(
                (path.name, record["payload"]["stage"], record["payload"]["status"], digest)
            )
        self._write_index()

    def _write_index(self) -> None:
        lines = [f"# Public receipt index for `{self.run_id}`", ""]
        for name, stage, status, digest in self._entries:
            lines.append(f"- [{stage}: {status}](details/{name}) `{digest}`")
        index_bytes = ("\n".join(lines) + "\n").encode("utf-8")
        descriptor, temporary_name = tempfile.mkstemp(
            prefix=f".{self.index.name}-", suffix=".tmp", dir=self.root
        )
        os.close(descriptor)
        temporary = Path(temporary_name)
        try:
            self._write_index_temporary(temporary, index_bytes)
            os.replace(temporary, self.index)
            self._fsync_directory(self.root)
        finally:
            try:
                temporary.unlink()
            except FileNotFoundError:
                pass

    @staticmethod
    def _write_index_temporary(path: Path, raw: bytes) -> None:
        ReceiptStore._write_receipt_temporary(path, raw)

    @staticmethod
    def _fsync_directory(path: Path) -> None:
        if os.name == "nt":
            return
        directory = os.open(path, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)

    @staticmethod
    def _write_receipt_temporary(path: Path, raw: bytes) -> None:
        with path.open("wb") as handle:
            handle.write(raw)
            handle.flush()
            os.fsync(handle.fileno())

    def append(self, payload: dict[str, Any]) -> dict[str, Any]:
        if payload.get("run_id") != self.run_id:
            raise HarnessError("receipt payload crosses runs")
        record = validate_receipt_record(
            {
                "schema": RECEIPT_SCHEMA,
                "sequence": self._sequence + 1,
                "prior_receipt_sha256": self._head,
                "payload": payload,
            }
        )
        raw = canonical_json_bytes(record)
        digest = sha256_bytes(raw)
        name = f"{record['sequence']:04d}-{payload['stage']}-{digest[7:19]}.json"
        path = self.details / name
        if path.exists() or path.is_symlink():
            raise HarnessError(f"refuse existing receipt: {path}")
        descriptor, temporary_name = tempfile.mkstemp(
            prefix=".receipt-", suffix=".tmp", dir=self.details
        )
        os.close(descriptor)
        temporary = Path(temporary_name)
        try:
            self._write_receipt_temporary(temporary, raw)
            temporary.chmod(0o444)
            os.link(temporary, path)
            self._fsync_directory(self.details)
        except FileExistsError as error:
            raise HarnessError(f"refuse existing receipt: {path}") from error
        finally:
            try:
                temporary.unlink()
            except FileNotFoundError:
                pass
            except PermissionError:
                temporary.chmod(0o600)
                temporary.unlink()
                if path.is_file():
                    path.chmod(0o444)
        self._sequence = record["sequence"]
        self._head = digest
        self._last_payload = record["payload"]
        self._entries.append((name, payload["stage"], payload["status"], digest))
        self._write_index()
        return {"path": path, "sha256": digest, "record": record}

    def materialize_public_projection(self, destination: Path) -> Path:
        """Copy only chain identity and deterministic observations into one role view."""
        if destination.exists() or destination.is_symlink():
            raise HarnessError(f"refuse existing public receipt projection: {destination}")
        details = destination / "details"
        details.mkdir(parents=True)
        index_lines = [f"# Public receipt index for `{self.run_id}`", ""]
        for source in sorted(self.details.glob("*.json")):
            record = validate_receipt_record(json.loads(source.read_text(encoding="utf-8")))
            payload = record["payload"]
            public_details: dict[str, Any] = {}
            evidence = payload["details"].get("evidence")
            if isinstance(evidence, dict):
                public_details["evidence"] = evidence
            for key in (
                "observation",
                "passed_test_ids",
                "lost_passing_test_ids",
                "evidence_report",
            ):
                if key in payload["details"]:
                    public_details[key] = payload["details"][key]
            public = {
                "schema": "vivary.hoh-public-receipt/v1",
                "run_id": self.run_id,
                "iteration": payload["iteration"],
                "stage": payload["stage"],
                "status": payload["status"],
                "receipt_sha256": sha256_file(source),
                "bindings": payload["bindings"],
                "observations": public_details,
            }
            public_name = source.name
            (details / public_name).write_bytes(canonical_json_bytes(public))
            index_lines.append(
                f"- [{payload['stage']}: {payload['status']}](details/{public_name}) "
                f"`{public['receipt_sha256']}`"
            )
        (destination / "index.md").write_text("\n".join(index_lines) + "\n", encoding="utf-8")
        return destination


class RoleView:
    """A materialized, link-free role projection with explicit write authority."""

    def __init__(self, root: Path, role: str, writable_root: str | None):
        self.root = root.resolve(strict=True)
        self.role = role
        self.writable_root = writable_root
        self.read_log: list[str] = []

    @classmethod
    def materialize(
        cls,
        destination: Path,
        *,
        role: str,
        sources: dict[str, Path],
        writable_root: str | None,
    ) -> "RoleView":
        if destination.exists() or destination.is_symlink():
            raise HarnessError(f"refuse existing role view: {destination}")
        if writable_root is not None and writable_root not in sources:
            raise HarnessError("role write root is not a projected source")
        destination.mkdir(parents=True)
        for logical, source in sources.items():
            if not re.fullmatch(r"[a-z0-9][a-z0-9._-]*", logical):
                raise HarnessError(f"invalid role root: {logical}")
            if source.is_symlink():
                raise HarnessError(f"refuse linked role source: {source}")
            source = source.resolve(strict=True)
            target = destination / logical
            if source.is_dir():
                shutil.copytree(source, target, symlinks=True)
            else:
                target.mkdir()
                shutil.copy2(source, target / source.name)
        for path in destination.rglob("*"):
            if path.is_symlink():
                raise HarnessError(f"refuse symlink in role view: {path}")
            relative = path.relative_to(destination)
            writable = writable_root is not None and relative.parts[0] == writable_root
            if path.is_file() and not writable:
                path.chmod(0o444)
            elif path.is_dir() and not writable:
                path.chmod(0o555)
        return cls(destination, role, writable_root)

    def _resolve(self, relative: str, *, write: bool = False) -> Path:
        candidate = Path(relative)
        if candidate.is_absolute() or not candidate.parts or ".." in candidate.parts:
            raise PermissionError("role path is outside its projection")
        if write and (self.writable_root is None or candidate.parts[0] != self.writable_root):
            raise PermissionError(f"{self.role} has no write authority for {relative}")
        current = self.root
        for part in candidate.parts:
            current = current / part
            if current.is_symlink():
                raise PermissionError("role links are not allowed")
        try:
            current.resolve(strict=not write).relative_to(self.root)
        except (OSError, ValueError) as error:
            raise PermissionError("role path escapes its projection") from error
        return current

    def read_text(self, relative: str) -> str:
        value = self._resolve(relative).read_text(encoding="utf-8")
        self.read_log.append(Path(relative).as_posix())
        return value

    def write_text(self, relative: str, value: str) -> None:
        target = self._resolve(relative, write=True)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(value, encoding="utf-8")

    def export_writable(self, destination: Path, allowed_files: set[str]) -> None:
        if self.writable_root is None:
            raise PermissionError(f"{self.role} has no writable projection")
        source = self.root / self.writable_root
        destination = destination.resolve(strict=True)
        source_files = {
            path.relative_to(source).as_posix(): path
            for path in source.rglob("*")
            if path.is_file() and not path.is_symlink()
        }
        if set(source_files) != allowed_files:
            raise HarnessError("developer changed the candidate file set")
        for relative, source_path in source_files.items():
            target = destination / relative
            if not target.is_file() or target.is_symlink():
                raise HarnessError(f"candidate target differs: {relative}")
            temporary = target.with_name(f".{target.name}.hoh-tmp")
            if temporary.exists() or temporary.is_symlink():
                raise HarnessError(f"refuse existing candidate temporary: {temporary}")
            shutil.copy2(source_path, temporary)
            os.replace(temporary, target)

    def environment(self, _name: str) -> str:
        raise PermissionError("role environment access is not available")

    def process_file(self, _relative: str) -> str:
        raise PermissionError("role process-file access is not available")

    def shell(self, _command: str) -> None:
        raise PermissionError("role shell access is not available")


class RoleAdapter(Protocol):
    runtime_id: str

    def maximum_charge(self, role: str) -> int | None: ...

    def invoke(
        self,
        request: dict[str, Any],
        prompt: str,
        view: RoleView,
        deadline: IterationDeadline,
    ) -> object: ...


@dataclass(frozen=True)
class RunFault:
    interrupt_after_developer: bool = False
    interrupt_before_developer_state: bool = False
    interrupt_after_iteration: int | None = None
    regress_before_qa: Callable[[Path], None] | None = None


class PacketDeadline:
    """Apply the existing trial clock to every process in an iteration."""

    def __init__(self, iteration: IterationDeadline, ledger: UsageLedger):
        self.iteration = iteration
        self.ledger = ledger
        self.path = iteration.path

    @property
    def expires_unix_ns(self) -> int:
        return min(self.iteration.expires_unix_ns, self.ledger.packet_expires_unix_ns())

    @property
    def stop_grace_seconds(self) -> float:
        return self.ledger.stop_grace_seconds

    def remaining(self) -> float:
        try:
            return min(self.iteration.remaining(), self.ledger.packet_remaining())
        except (DeadlineError, BudgetError):
            self.ledger.stop("iteration or packet deadline stopped")
            raise

    def snapshot(self) -> dict[str, Any]:
        return {"iteration": self.iteration.snapshot(),
                "usage_policy": self.ledger.observed_policy,
                "expires_unix_ns": self.expires_unix_ns}

    def clock_binding(self):
        if not uses_boottime(self.ledger.observed_policy):
            return None
        return combine_clock_bindings(self.iteration.clock_binding(), self.ledger.clock_binding())


class InvocationDeadline:
    """Use the earliest existing iteration, packet, or invocation deadline."""

    def __init__(self, iteration: IterationDeadline, ledger: UsageLedger, call_id: str):
        self.iteration = iteration
        self.ledger = ledger
        self.call_id = call_id
        self.path = iteration.path

    @property
    def expires_unix_ns(self) -> int:
        return min(self.iteration.expires_unix_ns,
                   self.ledger.invocation_expires_unix_ns(self.call_id))

    @property
    def stop_grace_seconds(self) -> float:
        return self.ledger.stop_grace_seconds

    def remaining(self) -> float:
        try:
            return min(self.iteration.remaining(), self.ledger.invocation_remaining(self.call_id))
        except (DeadlineError, BudgetError):
            self.ledger.stop("iteration or invocation deadline stopped", call_id=self.call_id)
            raise

    def snapshot(self) -> dict[str, Any]:
        return {"iteration": self.iteration.snapshot(),
                "usage_policy": self.ledger.observed_policy,
                "invocation": self.call_id, "expires_unix_ns": self.expires_unix_ns}

    def clock_binding(self):
        if not uses_boottime(self.ledger.observed_policy):
            return None
        return combine_clock_bindings(self.iteration.clock_binding(), self.ledger.clock_binding(self.call_id))


class HeadlessLoop:
    """Deterministic outer sequencer; adapters own only individual role calls."""

    def __init__(
        self,
        *,
        project: Path,
        receipt_dir: Path,
        prompt_dir: Path,
        run_id: str,
        iterations: int,
        iteration_timeout_seconds: float,
        reported_token_budget: int,
        usage_ledger: Path,
        workflow: dict[str, Any],
        adapters: dict[str, RoleAdapter],
    ):
        if iterations < 1:
            raise HarnessError("iterations must be positive")
        self.project = project.resolve(strict=True)
        self.receipt_dir = receipt_dir
        self.prompt_dir = prompt_dir.resolve(strict=True)
        self.run_id = run_id
        self.iterations = iterations
        self.iteration_timeout_seconds = iteration_timeout_seconds
        self.reported_token_budget = reported_token_budget
        self.usage_ledger_path = Path(usage_ledger).absolute()
        self.workflow = Workflow(workflow, run_id=run_id, iterations=iterations, adapters=adapters)
        self.observed_usage = self.workflow.usage_policy is not None
        self.product_test_executor = None
        native_hosts = [adapter for adapter in adapters.values()
                        if getattr(adapter, "executable_scope", None) == "habitat-container"]
        if native_hosts:
            from hoh.native_host import verified_habitat_owner
            from hoh.native_oracle import HabitatOracleExecutor
            if len(native_hosts) != 1 or not self.observed_usage:
                raise HarnessError("native oracle requires one observed Habitat runtime")
            adapter = native_hosts[0]
            owner = verified_habitat_owner(adapter.runner, adapter.launch_verifier)
            self.product_test_executor = HabitatOracleExecutor(owner.task_root / "oracles", owner.source_root)
        config = self.workflow.usage_policy
        if config is not None and iteration_timeout_seconds != config["policy"]["iteration_seconds"]:
            raise HarnessError("iteration timeout differs from the frozen experimental policy")
        self.ledger = UsageLedger(
            self.usage_ledger_path, reported_token_budget,
            **({"observed_policy": config["policy"], "trial": config["trial"],
                "admissions": config["admissions"]} if config is not None else {}),
        )
        self.receipt_dir.mkdir(parents=True, exist_ok=True)
        self.state_path = receipt_dir / "state.json"
        self.baseline_path = receipt_dir / "baseline.json"
        self.views = receipt_dir / "role-views"
        self.receipt_projections = receipt_dir / "role-receipt-projections"
        self.documents = receipt_dir / "documents"
        self.views.mkdir(exist_ok=True)
        self.receipt_projections.mkdir(exist_ok=True)
        self.documents.mkdir(exist_ok=True)
        self.prompts = {
            role: (self.prompt_dir / f"{role}.md").read_text(encoding="utf-8")
            for role in ("planner", "developer", "qa")
        }
        self.common = {
            "specification_sha256": sha256_file(self.project / "spec.md"),
            "oracle_sha256": hash_tree(self.project / "tests"),
            "prompt_sha256": {role: sha256_bytes(text.encode("utf-8")) for role, text in self.prompts.items()},
        }

    def _state(self) -> dict[str, Any] | None:
        if not self.state_path.exists():
            if self.receipts.head is not None:
                raise HarnessError("receipt state exists without its run control state")
            return None
        try:
            state = json.loads(self.state_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise HarnessError(f"run state is unreadable: {error}") from error
        expected = {
            "workflow_sha256",
            "run_id",
            "iteration",
            "stage",
            "candidate_sha256",
            "deadline_path",
            "usage_ledger_path",
            "usage_ledger_sha256",
            "reported_token_budget",
            "iteration_timeout_seconds",
            "iterations",
            "checkpoint_commit",
            "receipt_chain_head",
            "previous_candidate_sha256",
            "no_progress_count",
        }
        if not isinstance(state, dict) or set(state) != expected or state["run_id"] != self.run_id:
            raise HarnessError("run state is stale or crosses runs")
        if (
            state["usage_ledger_path"] != str(self.usage_ledger_path)
            or state["workflow_sha256"] != self.workflow.sha256
            or state["reported_token_budget"] != self.reported_token_budget
            or state["iteration_timeout_seconds"] != self.iteration_timeout_seconds
            or state["iterations"] != self.iterations
        ):
            raise HarnessError("resume ledger or iteration policy differs")
        if (
            not isinstance(state["iteration"], int)
            or isinstance(state["iteration"], bool)
            or not 1 <= state["iteration"] <= self.iterations
            or state["deadline_path"]
            != str(self.receipt_dir / f"iteration-{state['iteration']}-deadline.json")
        ):
            raise HarnessError("resume iteration or deadline path differs")
        recovered = self._recover_developer_state(state)
        state = recovered or state
        ledger_hash = sha256_file(self.usage_ledger_path) if self.usage_ledger_path.is_file() else None
        if state["usage_ledger_sha256"] != ledger_hash:
            raise HarnessError("resume usage ledger is missing or differs")
        if state["candidate_sha256"] != hash_tree(self.project):
            raise HarnessError("resume candidate differs from committed state")
        if state["checkpoint_commit"] != self._git_value("rev-parse", "HEAD"):
            raise HarnessError("resume Git checkpoint differs")
        if state["receipt_chain_head"] != self.receipts.head:
            raise HarnessError("resume receipt-chain head differs")
        if not isinstance(state["no_progress_count"], int) or isinstance(state["no_progress_count"], bool) or state["no_progress_count"] < 0:
            raise HarnessError("resume no-progress state differs")
        previous = state["previous_candidate_sha256"]
        if previous is not None and (not isinstance(previous, str) or not re.fullmatch(r"sha256:[0-9a-f]{64}", previous)):
            raise HarnessError("resume previous-candidate binding differs")
        self._verify_state_receipt_stage(state)
        self._verify_receipt_baseline_bindings()
        self._verify_workflow_receipts()
        if state["stage"] == "developer_complete":
            self._verify_developer_resume_artifacts(state)
        if recovered is not None:
            _atomic_json_write(self.state_path, state)
        return state

    def _recover_developer_state(self, state: dict[str, Any]) -> dict[str, Any] | None:
        """Finish only the accepted developer receipt's interrupted state write."""
        last = self.receipts.last_payload
        if (state["stage"] != "iteration_started" or last is None
                or (last["iteration"], last["stage"], last["status"])
                != (state["iteration"], "developer", "complete")):
            return None
        control = last["details"].get("control_transition", {})
        if (self.usage_ledger_path.is_symlink() or not self.usage_ledger_path.is_file()
                or control.get("prior_state_sha256") != sha256_file(self.state_path)
                or control.get("usage_ledger_sha256") != sha256_file(self.usage_ledger_path)):
            raise HarnessError("developer recovery control or usage binding differs")
        self._verify_receipt_baseline_bindings()
        self._verify_workflow_receipts()
        self._consume_handoff(self.workflow.binding(state["iteration"], "qa"))
        return {
            **state,
            "stage": "developer_complete",
            "candidate_sha256": last["bindings"]["candidate_sha256"],
            "checkpoint_commit": last["bindings"]["developer_checkpoint"],
            "receipt_chain_head": self.receipts.head,
            "usage_ledger_sha256": control["usage_ledger_sha256"],
        }

    def _verify_receipt_baseline_bindings(self) -> None:
        expected = {
            "baseline_sha256": self.baseline_sha256,
            "baseline_commit": self.baseline_commit,
            "baseline_tree": self.baseline_tree,
            "workflow_sha256": self.workflow.sha256,
        }
        for path in sorted(self.receipts.details.glob("*.json")):
            bindings = validate_receipt_record(
                json.loads(path.read_text(encoding="utf-8"))
            )["payload"]["bindings"]
            if any(bindings.get(field) != value for field, value in expected.items()):
                raise HarnessError("resume receipt baseline binding differs")

    def _verify_developer_resume_artifacts(self, state: dict[str, Any]) -> None:
        matches: list[dict[str, Any]] = []
        for path in sorted(self.receipts.details.glob("*.json")):
            payload = validate_receipt_record(
                json.loads(path.read_text(encoding="utf-8"))
            )["payload"]
            if (
                payload["iteration"] == state["iteration"]
                and payload["stage"] == "developer"
                and payload["status"] == "complete"
            ):
                matches.append(payload)
        if len(matches) != 1:
            raise HarnessError("resume developer receipt is missing or ambiguous")
        bindings = matches[0]["bindings"]
        if (
            bindings.get("candidate_sha256") != state["candidate_sha256"]
            or bindings.get("developer_checkpoint") != state["checkpoint_commit"]
        ):
            raise HarnessError("resume developer receipt binding differs")
        artifacts = {
            "development document": (
                self.documents / f"iteration-{state['iteration']}-development.md",
                bindings.get("development_document_sha256"),
            ),
            "developer report": (
                self.documents / f"iteration-{state['iteration']}-developer.md",
                bindings.get("developer_report_sha256"),
            ),
        }
        for label, (path, expected_hash) in artifacts.items():
            if path.is_symlink() or not path.is_file():
                raise HarnessError(f"resume {label} is missing or linked")
            if sha256_file(path) != expected_hash:
                raise HarnessError(f"resume {label} differs from developer receipt")

    def _save_state(
        self,
        iteration: int,
        stage: str,
        deadline_path: Path,
        *,
        previous_candidate_sha256: str | None,
        no_progress_count: int,
    ) -> None:
        ledger_hash = sha256_file(self.usage_ledger_path) if self.usage_ledger_path.is_file() else None
        _atomic_json_write(
            self.state_path,
            {
                "run_id": self.run_id,
                "workflow_sha256": self.workflow.sha256,
                "iteration": iteration,
                "stage": stage,
                "candidate_sha256": hash_tree(self.project),
                "deadline_path": str(deadline_path),
                "usage_ledger_path": str(self.usage_ledger_path),
                "usage_ledger_sha256": ledger_hash,
                "reported_token_budget": self.reported_token_budget,
                "iteration_timeout_seconds": self.iteration_timeout_seconds,
                "iterations": self.iterations,
                "checkpoint_commit": self._git_value("rev-parse", "HEAD"),
                "receipt_chain_head": self.receipts.head,
                "previous_candidate_sha256": previous_candidate_sha256,
                "no_progress_count": no_progress_count,
            },
        )

    def _refresh_state_after_role_failure(
        self, iteration: int, deadline_path: Path
    ) -> None:
        try:
            state = json.loads(self.state_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise HarnessError(f"cannot persist incomplete role state: {error}") from error
        if (
            not isinstance(state, dict)
            or state.get("run_id") != self.run_id
            or state.get("iteration") != iteration
            or state.get("stage") not in {"iteration_started", "developer_complete"}
        ):
            raise HarnessError("cannot bind incomplete role to current control state")
        self._save_state(
            iteration,
            state["stage"],
            deadline_path,
            previous_candidate_sha256=state.get("previous_candidate_sha256"),
            no_progress_count=state.get("no_progress_count"),
        )

    def _verify_state_receipt_stage(self, state: dict[str, Any]) -> None:
        last = self.receipts.last_payload
        if last is None or last["iteration"] != state["iteration"]:
            raise HarnessError("resume receipt stage is missing or inconsistent")
        expected = {
            "iteration_started": {
                ("iteration", "started"),
                ("planner", "incomplete"),
                ("developer", "incomplete"),
            },
            "developer_complete": {
                ("developer", "complete"),
                ("fault", "incomplete"),
                ("qa", "incomplete"),
            },
            "iteration_complete": {("qa", "complete")},
            "regressed": {("test", "regressed")},
            "failed": {("iteration", "failed"), ("test", "incomplete"),
                       ("planner", "failed"), ("developer", "failed"), ("qa", "failed")},
            "final_complete": {("iteration", "complete")},
        }
        if state["stage"] not in expected or (last["stage"], last["status"]) not in expected[state["stage"]]:
            raise HarnessError("resume control stage differs from the receipt chain")

    def _bindings(self, iteration: int, candidate: str, **extra: Any) -> dict[str, Any]:
        return {
            "workflow_sha256": self.workflow.sha256,
            "baseline_sha256": self.baseline_sha256,
            "baseline_commit": self.baseline_commit,
            "baseline_tree": self.baseline_tree,
            **self.common,
            "iteration": iteration,
            "candidate_sha256": candidate,
            "prior_receipt_sha256": self.receipts.head,
            **extra,
        }

    def _git_value(self, *arguments: str) -> str:
        completed = subprocess.run(
            ["git", *arguments],
            cwd=self.project,
            capture_output=True,
            text=True,
            check=False,
        )
        if completed.returncode:
            raise HarnessError(f"Git binding failed: {completed.stderr.strip()}")
        return completed.stdout.strip()

    def _verify_fixed_inputs(self) -> None:
        observed = {
            "specification_sha256": sha256_file(self.project / "spec.md"),
            "oracle_sha256": hash_tree(self.project / "tests"),
            "prompt_sha256": {
                role: sha256_file(self.prompt_dir / f"{role}.md")
                for role in ("planner", "developer", "qa")
            },
        }
        if observed != self.common:
            raise HarnessError("specification, oracle, or role prompt changed during the run")
        baseline = json.loads(self.baseline_path.read_text(encoding="utf-8"))
        commit = baseline["baseline_commit"]
        tree = baseline["baseline_tree"]
        if (
            baseline["baseline_sha256"] != self.baseline_sha256
            or commit != self.baseline_commit
            or tree != self.baseline_tree
        ):
            raise HarnessError("baseline binding changed during the run")
        if self._git_value("rev-parse", f"{commit}^{{tree}}") != tree:
            raise HarnessError("baseline commit or tree binding changed")

    def _append(self, iteration: int, stage: str, status: str, candidate: str, details: dict[str, Any], **extra: Any) -> dict[str, Any]:
        return self.receipts.append(
            {
                "run_id": self.run_id,
                "iteration": iteration,
                "stage": stage,
                "status": status,
                "bindings": self._bindings(iteration, candidate, **extra),
                "details": details,
            }
        )

    def _assemble_prompt(self, role: str, iteration: int, slots: dict[str, str]) -> str:
        rendered = self.prompts[role]
        values = {"iteration": str(iteration), **slots}
        for name, value in values.items():
            rendered = rendered.replace("{{" + name + "}}", value)
        unresolved = sorted(set(re.findall(r"{{([a-z_]+)}}", rendered)))
        if unresolved:
            raise HarnessError(f"unresolved prompt slots: {unresolved}")
        return rendered

    def _receipt_payloads(self) -> list[dict[str, Any]]:
        return [
            validate_receipt_record(json.loads(path.read_text(encoding="utf-8")))["payload"]
            for path in sorted(self.receipts.details.glob("*.json"))
        ]

    def _consume_handoff(self, binding: dict[str, Any]) -> str | None:
        handoffs = []
        for payload in self._receipt_payloads():
            if payload["status"] in {"failed", "regressed"} or (payload["stage"] == "test" and payload["status"] == "incomplete"):
                raise HarnessError("workflow stopped before this predecessor handoff could be consumed")
            handoff = payload["details"].get("handoff")
            if handoff is not None:
                self.workflow.validate_handoff(handoff)
                if handoff["successor"] == binding:
                    if payload["status"] != "complete":
                        raise HarnessError("handoff predecessor was not accepted")
                    handoffs.append(handoff)
        if binding["iteration"] == 1 and binding["role"] == "planner":
            if handoffs:
                raise HarnessError("initial planner cannot consume a successor handoff")
            return None
        if len(handoffs) != 1:
            raise HarnessError("accepted predecessor handoff is missing or repeated")
        handoff = handoffs[0]
        self._verify_handoff_artifacts(handoff)
        return record_hash(handoff)

    def _verify_handoff_artifacts(self, handoff: dict[str, Any]) -> None:
        self.workflow.validate_handoff(handoff)
        artifacts = handoff["artifacts"]
        if artifacts["candidate_sha256"] != hash_tree(self.project) or artifacts["checkpoint_commit"] != self._git_value("rev-parse", "HEAD"):
            raise HarnessError("accepted handoff candidate revision differs")
        predecessor_iteration = handoff["predecessor"]["iteration"]
        suffixes = {
            "development_document_sha256": "development",
            "developer_report_sha256": "developer",
            "qa_evidence_report_sha256": "evidence",
        }
        for field, suffix in suffixes.items():
            if field in artifacts:
                path = self.documents / f"iteration-{predecessor_iteration}-{suffix}.md"
                if path.is_symlink() or not path.is_file() or sha256_file(path) != artifacts[field]:
                    raise HarnessError(f"accepted handoff artifact differs: {field}")
        if "test_evidence_sha256" in artifacts:
            evidence = [
                payload["details"].get("evidence") for payload in self._receipt_payloads()
                if payload["iteration"] == predecessor_iteration and payload["stage"] == "test"
            ]
            if not evidence or record_hash(evidence[-1]) != artifacts["test_evidence_sha256"]:
                raise HarnessError("accepted handoff test evidence differs")

    def _verify_workflow_receipts(self) -> None:
        claims: dict[tuple[str, int], dict[str, Any]] = {}
        handoffs: dict[str, dict[str, Any]] = {}
        accepted_stages: set[str] = set()
        reservations = self.ledger.snapshot()["reservations"]
        for payload in self._receipt_payloads():
            details = payload["details"]
            request = details.get("dispatch")
            if request is not None:
                request = validate_role_request(request)
                binding = request["binding"]
                if binding != self.workflow.binding(request["iteration"], request["role"]):
                    raise HarnessError("persisted dispatch identity differs")
                key = (binding["stage_id"], request["attempt"])
                call_id = f"{self.run_id}-{request['iteration']}-{request['role']}-{request['attempt']}"
                if key in claims or details.get("call_id") != call_id or call_id not in reservations:
                    raise HarnessError("persisted dispatch or its reservation is missing or repeated")
                if self.observed_usage:
                    if ("maximum" in details or details.get("usage_policy_sha256")
                            != record_hash(self.workflow.usage_policy)):
                        raise HarnessError("persisted dispatch usage policy differs")
                elif details.get("maximum") != reservations[call_id]["maximum"]:
                    raise HarnessError("persisted dispatch reservation differs")
                if request["attempt"] > self.workflow.max_attempts:
                    raise HarnessError("persisted attempt exceeds its workflow policy")
                if request["attempt"] > 1 and (binding["stage_id"], request["attempt"] - 1) not in claims:
                    raise HarnessError("persisted schema retry has no preceding attempt")
                if request["role"] != "planner" or request["iteration"] != 1:
                    predecessor = handoffs.get(request["handoff_sha256"])
                    if predecessor is None or predecessor["successor"] != binding:
                        raise HarnessError("persisted dispatch has no accepted predecessor")
                elif request["handoff_sha256"] is not None:
                    raise HarnessError("initial dispatch has a predecessor")
                claims[key] = request
            handoff = details.get("handoff")
            if handoff is None:
                continue
            self.workflow.validate_handoff(handoff)
            source = handoff["predecessor"]
            key = (source["stage_id"], handoff["attempt"])
            if source["stage_id"] in accepted_stages or details.get("role_request") != claims.get(key):
                raise HarnessError("phase decision has a missing or repeated dispatch")
            if details.get("phase_gate") != handoff["gate"] or payload["stage"] != source["role"] or payload["iteration"] != source["iteration"]:
                raise HarnessError("phase decision differs from its receipt")
            result = validate_role_result(details.get("role_result"), request=claims[key])
            if result["request_sha256"] != record_hash(claims[key]):
                raise HarnessError("persisted phase response binding differs")
            if handoff["gate"]["decision"] == "blocked":
                if payload["status"] not in {"failed", "regressed"}:
                    raise HarnessError("blocked phase is marked accepted")
                continue
            if payload["status"] != "complete":
                raise HarnessError("accepted phase receipt is incomplete")
            call_id = f"{self.run_id}-{source['iteration']}-{source['role']}-{handoff['attempt']}"
            reservation = reservations[call_id]
            if reservation["status"] != "settled" or reservation["usage"] != result["usage"]:
                raise HarnessError("accepted phase usage differs from shared accounting")
            accepted_stages.add(source["stage_id"])
            handoffs[record_hash(handoff)] = handoff

    def _phase_details(
        self, result: dict[str, Any], gate: dict[str, Any], candidate: str,
        *, evidence: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        role, iteration = result["role"], result["iteration"]
        artifacts = {
            "candidate_sha256": candidate,
            "checkpoint_commit": self._git_value("rev-parse", "HEAD"),
            "development_document_sha256": sha256_file(self.documents / f"iteration-{iteration}-development.md"),
        }
        if role in {"developer", "qa"}:
            artifacts["developer_report_sha256"] = sha256_file(self.documents / f"iteration-{iteration}-developer.md")
        if role == "qa":
            artifacts["qa_evidence_report_sha256"] = sha256_file(self.documents / f"iteration-{iteration}-evidence.md")
            artifacts["test_evidence_sha256"] = record_hash(evidence)
        return {
            **({"context_capsule_fingerprint": result["_context_capsule_fingerprint"]}
               if "_context_capsule_fingerprint" in result else {}),
            "role_request": result["_request"],
            "role_result": {key: value for key, value in result.items() if not key.startswith("_")},
            "role_result_sha256": result["output_sha256"],
            "phase_gate": gate,
            "handoff": self.workflow.handoff(gate, artifacts),
            "opened_receipt_files": [path for path in result["_opened_files"] if path.startswith("receipts/")],
        }

    def _reject_phase(
        self, result: dict[str, Any], gate: dict[str, Any], candidate: str,
        deadline: IterationDeadline, *, evidence: dict[str, Any] | None = None,
    ) -> None:
        self._append(
            result["iteration"], result["role"], "failed", candidate,
            self._phase_details(result, gate, candidate, evidence=evidence),
        )
        state = json.loads(self.state_path.read_text(encoding="utf-8"))
        self._save_state(
            result["iteration"], "failed", deadline.path,
            previous_candidate_sha256=state["previous_candidate_sha256"],
            no_progress_count=state["no_progress_count"],
        )
        raise HarnessError(f"{result['role']} completion gate rejected: {', '.join(gate['reasons'])}")

    def _role_call(
        self,
        role: str,
        iteration: int,
        prompt: str,
        view: RoleView,
        deadline: IterationDeadline,
        candidate: str,
        test_evidence_sha256: str | None = None,
        context_capsule_fingerprint: str | None = None,
    ) -> dict[str, Any]:
        self._verify_fixed_inputs()
        binding = self.workflow.binding(iteration, role)
        adapter = self.workflow.adapter(iteration, role)
        handoff_hash = self._consume_handoff(binding)
        for payload in self._receipt_payloads():
            claim = payload["details"].get("dispatch")
            if claim is not None and claim["binding"]["stage_id"] == binding["stage_id"]:
                raise HarnessError("stage already dispatched; reconcile its native result before any replay")
        if role == "developer":
            projected_candidate = view.root / "candidate" / "linkcheck.py"
            if (
                view.writable_root != "candidate"
                or projected_candidate.is_symlink()
                or not projected_candidate.is_file()
                or sha256_file(projected_candidate)
                != sha256_file(self.project / "linkcheck.py")
                or candidate != hash_tree(self.project)
            ):
                raise HarnessError("developer request candidate projection differs")
        writable_before = (
            hash_tree(view.root / view.writable_root)
            if view.writable_root is not None
            else None
        )
        if role == "planner" and self.workflow.planner_priority_limit is not None:
            prompt += (
                f"\n\nTrial constraint: Report at most {self.workflow.planner_priority_limit} "
                "numbered unmet priorities. If all requirements are already green, report that "
                "honestly. Do not manufacture failures or edits, and do not undo collateral improvements."
            )
        if self.observed_usage and callable(getattr(adapter, "prepare_prompt", None)):
            prompt = adapter.prepare_prompt(prompt, binding=binding, candidate_sha256=candidate,
                                            test_evidence_sha256=test_evidence_sha256)
        maximum = None if self.observed_usage else adapter.maximum_charge(role)
        for attempt in range(1, self.workflow.max_attempts + 1):
            deadline.remaining()
            call_id = f"{self.run_id}-{iteration}-{role}-{attempt}"
            if self.observed_usage:
                self.ledger.admit(call_id, binding=binding, attempt=attempt)
                call_deadline = InvocationDeadline(deadline, self.ledger, call_id)
                admission = {"usage_policy_sha256": record_hash(self.workflow.usage_policy)}
            else:
                self.ledger.reserve(call_id, maximum)
                call_deadline = deadline
                admission = {"maximum": maximum}
            request = validate_role_request(
                {
                    "schema": ROLE_REQUEST_SCHEMA,
                    "run_id": self.run_id,
                    "iteration": iteration,
                    "role": role,
                    "binding": binding,
                    "attempt": attempt,
                    "handoff_sha256": handoff_hash,
                    "test_evidence_sha256": test_evidence_sha256,
                    "prompt_bytes": len(prompt.encode("utf-8")),
                    "prompt_sha256": sha256_bytes(prompt.encode("utf-8")),
                    "baseline_sha256": self.baseline_sha256,
                    "candidate_sha256": candidate,
                    "receipt_chain_head": self.receipts.head,
                    "deadline_unix_ns": call_deadline.expires_unix_ns,
                    "read_roots": sorted(path.name for path in view.root.iterdir()),
                    "write_root": view.writable_root,
                }
            )
            request_hash = sha256_bytes(canonical_json_bytes(request))
            self._append(
                iteration, role, "started", candidate,
                {"dispatch": request, "call_id": call_id, **admission,
                 **({"context_capsule_fingerprint": context_capsule_fingerprint}
                    if context_capsule_fingerprint is not None else {})},
                assembled_prompt_sha256=request["prompt_sha256"],
            )
            try:
                if self.observed_usage:
                    from hoh.claude import NativeAccountedRejection, NativeRoleSchemaError
                    try:
                        raw = adapter.invoke_observed(request, prompt, view, call_deadline,
                                                      ledger=self.ledger, call_id=call_id)
                    except NativeRoleSchemaError as error:
                        if error.request_sha256 != request_hash:
                            raise BindingError("native schema failure belongs to another request") from error
                        raw = {"usage": error.usage}
                else:
                    raw = adapter.invoke(request, prompt, view, call_deadline)
            except Exception as error:
                if self.observed_usage and isinstance(error, NativeAccountedRejection):
                    try:
                        settled = self.ledger.snapshot()["reservations"].get(call_id)
                        if (error.request_sha256 != request_hash or not isinstance(settled, dict)
                                or settled["status"] != "settled" or settled["binding"] != binding
                                or settled["attempt"] != attempt
                                or settled["usage"] != validate_usage_record(error.usage)):
                            raise BindingError("accounted native rejection differs from its settled request")
                    except ProtocolError:
                        self.ledger.stop("accounted native rejection binding failed", call_id=call_id)
                        raise
                else:
                    try:
                        self.ledger.settle(call_id, self._incomplete_usage(error))
                    except Exception:
                        pass
                self._append(
                    iteration,
                    role,
                    "incomplete",
                    candidate,
                    {"attempt": attempt, "request_sha256": request_hash, "adapter_error": str(error),
                     "native_usage_raw": getattr(error, "native_usage_raw", None)},
                    assembled_prompt_sha256=request["prompt_sha256"],
                )
                self._refresh_state_after_role_failure(iteration, deadline.path)
                raise HarnessError(f"{role} adapter failed: {error}") from error
            try:
                self._verify_fixed_inputs()
            except HarnessError as error:
                try:
                    self.ledger.settle(call_id, self._incomplete_usage(raw))
                except Exception:
                    pass
                self._append(
                    iteration,
                    role,
                    "incomplete",
                    candidate,
                    {"attempt": attempt, "request_sha256": request_hash, "invariant_error": str(error)},
                    assembled_prompt_sha256=request["prompt_sha256"],
                )
                self._refresh_state_after_role_failure(iteration, deadline.path)
                raise
            try:
                call_deadline.remaining()
            except (DeadlineError, BudgetError) as error:
                try:
                    self.ledger.settle(call_id, self._incomplete_usage(raw))
                except Exception:
                    pass
                self._append(
                    iteration,
                    role,
                    "incomplete",
                    candidate,
                    {"attempt": attempt, "request_sha256": request_hash, "deadline_error": str(error)},
                    assembled_prompt_sha256=request["prompt_sha256"],
                )
                self._refresh_state_after_role_failure(iteration, deadline.path)
                raise HarnessError(f"{role} returned after the iteration deadline") from error
            try:
                result = validate_role_result(raw, request=request)
                if result["request_sha256"] != request_hash:
                    raise BindingError("role result request hash differs")
                if result["output_sha256"] != sha256_bytes(result["output_text"].encode("utf-8")):
                    raise ProtocolError("role result output hash differs")
            except ProtocolError as error:
                try:
                    usage = (raw.get("usage") if self.observed_usage
                             and not isinstance(error, BindingError) and isinstance(raw, dict)
                             else self._incomplete_usage(raw))
                    self.ledger.settle(call_id, usage)
                except Exception:
                    if self.observed_usage:
                        self.ledger.stop("unsettled schema failure", call_id=call_id)
                self._append(
                    iteration,
                    role,
                    "incomplete",
                    candidate,
                    {
                        "attempt": attempt,
                        "request_sha256": request_hash,
                        "schema_error": str(error),
                    },
                    assembled_prompt_sha256=request["prompt_sha256"],
                )
                self._refresh_state_after_role_failure(iteration, deadline.path)
                if isinstance(error, BindingError):
                    raise HarnessError(f"{role} identity mismatch; refuse retry") from error
                if (
                    writable_before is not None
                    and hash_tree(view.root / view.writable_root) != writable_before
                ):
                    raise HarnessError(
                        f"{role} invalid attempt mutated its writable projection; refuse retry"
                    ) from error
                if attempt == self.workflow.max_attempts:
                    raise HarnessError(f"{role} result exhausted its configured schema attempts: {error}") from error
                continue
            try:
                self.ledger.settle(call_id, result["usage"])
                self._verify_observed_acceptance()
            except BudgetError as error:
                self._append(
                    iteration,
                    role,
                    "incomplete",
                    candidate,
                    {
                        "attempt": attempt,
                        "request_sha256": request_hash,
                        "budget_error": str(error),
                    },
                    assembled_prompt_sha256=request["prompt_sha256"],
                )
                self._refresh_state_after_role_failure(iteration, deadline.path)
                raise HarnessError(f"{role} usage exceeded or corrupted its reservation") from error
            return {**result, "_request": request, "_opened_files": list(view.read_log),
                    **({"_context_capsule_fingerprint": context_capsule_fingerprint}
                       if context_capsule_fingerprint is not None else {})}
        raise AssertionError("unreachable")

    @staticmethod
    def _incomplete_usage(raw: object) -> dict[str, Any]:
        vendor = raw if isinstance(raw, dict) else {
            "unparsed_type": type(raw).__name__,
            "native_usage_raw": getattr(raw, "native_usage_raw", None),
        }
        return {
            "schema": "vivary.hoh-usage/v1",
            "vendor_usage_raw": vendor,
            "aggregate_input_tokens": None,
            "aggregate_output_tokens": None,
            "cache_read_input_tokens": None,
            "cache_write_input_tokens": None,
            "budget_counted_tokens": None,
            "claude_agentic_turns": None,
            "codex_top_level_turns": None,
            "complete": False,
        }

    def _new_view(self, role: str, iteration: int, sources: dict[str, Path], write_root: str | None) -> RoleView:
        return RoleView.materialize(
            self.views / f"iteration-{iteration}-{role}",
            role=role,
            sources={**sources, "prompt": self.prompt_dir / f"{role}.md"},
            writable_root=write_root,
        )

    def _receipt_projection(self, role: str, iteration: int) -> Path:
        return self.receipts.materialize_public_projection(
            self.receipt_projections / f"iteration-{iteration}-{role}"
        )

    @staticmethod
    def _read_public_receipts(view: RoleView) -> str:
        index = view.read_text("receipts/index.md")
        details = []
        for relative in re.findall(r"\((details/[a-z0-9.-]+\.json)\)", index):
            details.append(view.read_text(f"receipts/{relative}"))
        return index + ("\n" + "\n".join(details) if details else "")

    def _ensure_git(self) -> None:
        if (self.project / ".git").exists():
            return
        environment = {
            **os.environ,
            "GIT_AUTHOR_NAME": "Vivary HoH",
            "GIT_AUTHOR_EMAIL": "hoh@example.invalid",
            "GIT_COMMITTER_NAME": "Vivary HoH",
            "GIT_COMMITTER_EMAIL": "hoh@example.invalid",
            "GIT_AUTHOR_DATE": "2000-01-01T00:00:00Z",
            "GIT_COMMITTER_DATE": "2000-01-01T00:00:00Z",
        }
        for command in (["git", "init", "-q"], ["git", "add", "-A"], ["git", "commit", "-q", "-m", "baseline"]):
            completed = subprocess.run(command, cwd=self.project, env=environment, capture_output=True, text=True)
            if completed.returncode:
                raise HarnessError(f"Git baseline failed: {completed.stderr.strip()}")

    def _verify_clean_git_baseline(self) -> None:
        status = self._git_value("status", "--porcelain=v1", "--untracked-files=all")
        tracked_output = self._git_value("ls-files", "--cached")
        tracked = set(tracked_output.splitlines()) if tracked_output else set()
        actual = {
            path.relative_to(self.project).as_posix()
            for path in self.project.rglob("*")
            if path.is_file() and ".git" not in path.relative_to(self.project).parts
        }
        if status or tracked != actual:
            raise HarnessError(
                "new baseline requires a clean Git worktree with every candidate file tracked"
            )

    def _checkpoint(self, iteration: int, deadline: IterationDeadline) -> str:
        environment = {
            **os.environ,
            "GIT_AUTHOR_NAME": "Vivary HoH",
            "GIT_AUTHOR_EMAIL": "hoh@example.invalid",
            "GIT_COMMITTER_NAME": "Vivary HoH",
            "GIT_COMMITTER_EMAIL": "hoh@example.invalid",
            "GIT_AUTHOR_DATE": f"2000-01-{iteration + 1:02d}T00:00:00Z",
            "GIT_COMMITTER_DATE": f"2000-01-{iteration + 1:02d}T00:00:00Z",
        }
        for command in (
            ["git", "add", "-A"],
            ["git", "commit", "-q", "--allow-empty", "-m", f"iteration {iteration} developer checkpoint"],
        ):
            result = run_owned_process(command, cwd=self.project, deadline=deadline, environment=environment)
            if not result["accepted"]:
                reason = result["deadline_error"] or result["stderr"].strip()
                raise HarnessError(
                    f"developer checkpoint failed: {reason or 'process supervision rejected completion'}; "
                    f"returncode={result['returncode']} cleanup_confirmed={result['cleanup_confirmed']} "
                    f"orphaned_descendants={result['orphaned_descendants']}"
                )
        completed = subprocess.run(["git", "rev-parse", "HEAD"], cwd=self.project, capture_output=True, text=True)
        if completed.returncode:
            raise HarnessError("cannot read developer checkpoint")
        return completed.stdout.strip()

    def _previous_passing_tests(self) -> set[str]:
        passing: set[str] = set()
        for path in sorted(self.receipts.details.glob("*.json")):
            record = json.loads(path.read_text(encoding="utf-8"))
            payload = record.get("payload", {})
            if payload.get("stage") == "test":
                values = payload.get("details", {}).get("passed_test_ids", [])
                if not isinstance(values, list) or any(not isinstance(item, str) for item in values):
                    raise HarnessError("persisted passing-test evidence differs")
                passing.update(values)
        return passing

    def _last_test_returncode(self) -> int | None:
        result = None
        for path in sorted(self.receipts.details.glob("*.json")):
            payload = json.loads(path.read_text(encoding="utf-8")).get("payload", {})
            if payload.get("stage") == "test":
                value = payload.get("details", {}).get("evidence", {}).get("returncode")
                if not isinstance(value, int) or isinstance(value, bool):
                    raise HarnessError("persisted test return code differs")
                result = value
        return result

    def _verify_observed_acceptance(self) -> None:
        if not self.observed_usage:
            return
        snapshot = self.ledger.snapshot()
        stop = snapshot["stop"]
        exact_target = (snapshot["charged"] == self.ledger.packet_budget
                        and stop is not None and stop["reason"] == "reported-target-reached")
        if (snapshot["charged"] > self.ledger.packet_budget
                or any(item["status"] != "settled" for item in snapshot["reservations"].values())
                or (stop is not None and not exact_target)):
            raise BudgetError("observed usage or stop state does not permit acceptance")

    def _verify_terminal_evidence(self, candidate_sha256: str) -> None:
        self._verify_observed_acceptance()
        last_test = None
        last_qa = None
        for path in sorted(self.receipts.details.glob("*.json")):
            payload = json.loads(path.read_text(encoding="utf-8"))["payload"]
            if payload["iteration"] != self.iterations:
                continue
            if payload["stage"] == "test":
                last_test = payload
            elif payload["stage"] == "qa":
                last_qa = payload
        if last_test is None or last_qa is None:
            raise HarnessError("terminal state lacks test or QA evidence")
        evidence = last_test["details"].get("evidence", {})
        if (
            evidence.get("returncode") != 0
            or evidence.get("complete") is not True
            or last_test["bindings"].get("candidate_sha256") != candidate_sha256
            or last_qa["status"] != "complete"
            or last_qa["bindings"].get("candidate_sha256") != candidate_sha256
            or last_qa["bindings"].get("frozen_candidate_before_sha256")
            != last_qa["bindings"].get("frozen_candidate_after_sha256")
        ):
            raise HarnessError("terminal test, candidate, or QA binding differs")
        handoff = last_qa["details"].get("handoff")
        self.workflow.validate_handoff(handoff)
        if handoff["gate"]["decision"] != "complete" or handoff["artifacts"]["candidate_sha256"] != candidate_sha256:
            raise HarnessError("terminal state lacks an accepted final phase gate")
        self._verify_handoff_artifacts(handoff)

    def run(self, fault: RunFault | None = None) -> dict[str, Any]:
        with _exclusive_file_lock(self.receipt_dir / "run.lock"):
            self.receipts = ReceiptStore(self.receipt_dir, self.run_id)
            return self._run(fault)

    def _run(self, fault: RunFault | None = None) -> dict[str, Any]:
        fault = fault or RunFault()
        new_baseline = not self.baseline_path.exists()
        self._ensure_git()
        if new_baseline:
            self._verify_clean_git_baseline()
        current = hash_tree(self.project)
        if self.baseline_path.exists():
            try:
                baseline = json.loads(self.baseline_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as error:
                raise HarnessError(f"baseline binding is unreadable: {error}") from error
            if not isinstance(baseline, dict) or set(baseline) != {
                "run_id",
                "baseline_sha256",
                "baseline_commit",
                "baseline_tree",
                "common",
                "usage_ledger_path",
                "reported_token_budget",
                "iteration_timeout_seconds",
                "iterations",
                "workflow_sha256",
            }:
                raise HarnessError("baseline binding shape differs")
            if (
                baseline["run_id"] != self.run_id
                or baseline["workflow_sha256"] != self.workflow.sha256
                or baseline["common"] != self.common
                or baseline["usage_ledger_path"] != str(self.usage_ledger_path)
                or baseline["reported_token_budget"] != self.reported_token_budget
                or baseline["iteration_timeout_seconds"] != self.iteration_timeout_seconds
                or baseline["iterations"] != self.iterations
            ):
                raise HarnessError("baseline binding is stale or crosses runs")
            self.baseline_sha256 = baseline["baseline_sha256"]
            self.baseline_commit = baseline["baseline_commit"]
            self.baseline_tree = baseline["baseline_tree"]
        else:
            self.baseline_sha256 = current
            self.baseline_commit = self._git_value("rev-parse", "HEAD")
            self.baseline_tree = self._git_value("rev-parse", "HEAD^{tree}")
            _atomic_json_write(
                self.baseline_path,
                {
                    "run_id": self.run_id,
                    "workflow_sha256": self.workflow.sha256,
                    "baseline_sha256": current,
                    "baseline_commit": self.baseline_commit,
                    "baseline_tree": self.baseline_tree,
                    "common": self.common,
                    "usage_ledger_path": str(self.usage_ledger_path),
                    "reported_token_budget": self.reported_token_budget,
                    "iteration_timeout_seconds": self.iteration_timeout_seconds,
                    "iterations": self.iterations,
                },
            )
        self._verify_fixed_inputs()
        state = self._state()
        if state and state["stage"] in {"failed", "regressed"}:
            raise HarnessError(f"persisted run state records a terminal {state['stage']} run")
        if state and state["stage"] == "final_complete":
            self._verify_terminal_evidence(current)
            return {
                "status": "complete",
                "iterations": self.iterations,
                "candidate_sha256": current,
                "receipt_chain_head": self.receipts.head,
                "ledger": self.ledger.snapshot(),
            }
        start_iteration = (
            state["iteration"] + 1
            if state and state["stage"] == "iteration_complete"
            else state["iteration"] if state else 1
        )
        if start_iteration > self.iterations:
            self._verify_terminal_evidence(current)
            final_deadline = self.receipt_dir / f"iteration-{self.iterations}-deadline.json"
            self._append(
                self.iterations,
                "iteration",
                "complete",
                current,
                {"observation": "final-candidate-oracle-green", "returncode": 0},
            )
            self._save_state(
                self.iterations,
                "final_complete",
                final_deadline,
                previous_candidate_sha256=state["previous_candidate_sha256"],
                no_progress_count=state["no_progress_count"],
            )
            return {
                "status": "complete",
                "iterations": self.iterations,
                "candidate_sha256": current,
                "receipt_chain_head": self.receipts.head,
                "ledger": self.ledger.snapshot(),
            }
        previous_hash = state["previous_candidate_sha256"] if state else None
        no_progress = state["no_progress_count"] if state else 0
        previous_passing = self._previous_passing_tests()
        final_test_returncode: int | None = None
        for iteration in range(start_iteration, self.iterations + 1):
            deadline_path = self.receipt_dir / f"iteration-{iteration}-deadline.json"
            if state and state["iteration"] == iteration:
                if Path(state["deadline_path"]) != deadline_path:
                    raise HarnessError("resume deadline path differs")
                deadline = IterationDeadline.resume(deadline_path, run_id=self.run_id, iteration=iteration,
                                                    observed_policy=self.ledger.observed_policy)
                deadline.remaining()
            else:
                deadline = IterationDeadline.create(
                    deadline_path,
                    run_id=self.run_id,
                    iteration=iteration,
                    duration_seconds=self.iteration_timeout_seconds,
                    observed_policy=self.ledger.observed_policy,
                )
                self._append(iteration, "iteration", "started", hash_tree(self.project), {"deadline_unix_ns": deadline.expires_unix_ns})
                self._save_state(
                    iteration,
                    "iteration_started",
                    deadline_path,
                    previous_candidate_sha256=previous_hash,
                    no_progress_count=no_progress,
                )

            if self.observed_usage:
                deadline = PacketDeadline(deadline, self.ledger)
                deadline.remaining()

            development_path = self.documents / f"iteration-{iteration}-development.md"
            resume_after_developer = bool(state and state["stage"] == "developer_complete")
            if not resume_after_developer:
                before = hash_tree(self.project)
                try:
                    capsule, retrieval = retrieve_planner_context(self.project, deadline, run_owned_process)
                except ContextRetrievalError as error:
                    self._append(iteration, "planner", "failed", before,
                                 {"context_retrieval": error.evidence, "reason": str(error)})
                    self._save_state(iteration, "failed", deadline.path,
                                     previous_candidate_sha256=previous_hash, no_progress_count=no_progress)
                    raise HarnessError(str(error)) from error
                capsule_path = self.documents / f"iteration-{iteration}-task-capsule.json"
                capsule_path.write_bytes(canonical_json_bytes(capsule))
                public_receipts = self._receipt_projection("planner", iteration)
                planner_view = self._new_view(
                    "planner",
                    iteration,
                    {"context": capsule_path, "receipts": public_receipts},
                    None,
                )
                preceding_evidence = self._read_public_receipts(planner_view)
                planner_prompt = self._assemble_prompt(
                    "planner",
                    iteration,
                    {
                        "task_capsule": planner_view.read_text(f"context/{capsule_path.name}"),
                        "previous_evidence": preceding_evidence,
                    },
                )
                before = hash_tree(self.project)
                planner = self._role_call("planner", iteration, planner_prompt, planner_view, deadline, before,
                                          context_capsule_fingerprint=capsule["fingerprint"])
                development_path.write_text(planner["output_text"], encoding="utf-8")
                planner_gate = evaluate_phase(
                    planner["_request"], planner, iterations=self.iterations,
                    candidate_unchanged=hash_tree(self.project) == before,
                    planner_priority_limit=self.workflow.planner_priority_limit,
                )
                if planner_gate["decision"] == "blocked":
                    self._reject_phase(planner, planner_gate, before, deadline)
                self._append(
                    iteration,
                    "planner",
                    "complete",
                    before,
                    {**self._phase_details(planner, planner_gate, before), "context_retrieval": retrieval},
                    development_document_sha256=sha256_file(development_path),
                    assembled_prompt_sha256=planner["_request"]["prompt_sha256"],
                )

                candidate_source = self.project / "linkcheck.py"
                developer_view = self._new_view(
                    "developer",
                    iteration,
                    {
                        "development": development_path,
                        "candidate": candidate_source,
                        "receipts": self._receipt_projection("developer", iteration),
                    },
                    "candidate",
                )
                self._read_public_receipts(developer_view)
                developer_prompt = self._assemble_prompt(
                    "developer",
                    iteration,
                    {"development_document": development_path.read_text(encoding="utf-8")},
                )
                developer = self._role_call("developer", iteration, developer_prompt, developer_view, deadline, before)
                developer_report_path = self.documents / f"iteration-{iteration}-developer.md"
                developer_report_path.write_text(developer["output_text"], encoding="utf-8")
                developer_candidate = developer_view.root / "candidate"
                developer_gate = evaluate_phase(
                    developer["_request"], developer, iterations=self.iterations,
                    candidate_unchanged=hash_tree(self.project) == before,
                    developer_source=developer_view.read_text("candidate/linkcheck.py"),
                    developer_files={path.relative_to(developer_candidate).as_posix() for path in developer_candidate.rglob("*") if path.is_file()},
                )
                if developer_gate["decision"] == "blocked":
                    self._reject_phase(developer, developer_gate, before, deadline)
                developer_view.export_writable(self.project, {"linkcheck.py"})
                after = hash_tree(self.project)
                transition = validate_transition_record(
                    {
                        "schema": TRANSITION_SCHEMA,
                        "run_id": self.run_id,
                        "iteration": iteration,
                        "from_stage": "planner",
                        "to_stage": "developer",
                        "candidate_before_sha256": before,
                        "candidate_after_sha256": after,
                        "prior_receipt_sha256": self.receipts.head,
                    }
                )
                checkpoint = self._checkpoint(iteration, deadline)
                self._append(
                    iteration,
                    "developer",
                    "complete",
                    after,
                    {
                        **self._phase_details(developer, developer_gate, after),
                        "transition": transition,
                        "control_transition": {
                            "prior_state_sha256": sha256_file(self.state_path),
                            "usage_ledger_sha256": sha256_file(self.usage_ledger_path),
                        },
                    },
                    development_document_sha256=sha256_file(development_path),
                    developer_report_sha256=sha256_file(developer_report_path),
                    developer_checkpoint=checkpoint,
                    assembled_prompt_sha256=developer["_request"]["prompt_sha256"],
                )
                if fault.interrupt_before_developer_state:
                    return {"status": "interrupted", "iteration": iteration, "candidate_sha256": after}
                if fault.interrupt_after_developer:
                    self._append(iteration, "fault", "incomplete", after, {"observation": "interrupted-after-developer-checkpoint"})
                    self._save_state(
                        iteration,
                        "developer_complete",
                        deadline_path,
                        previous_candidate_sha256=previous_hash,
                        no_progress_count=no_progress,
                    )
                    return {"status": "interrupted", "iteration": iteration, "candidate_sha256": after}
                self._save_state(
                    iteration,
                    "developer_complete",
                    deadline_path,
                    previous_candidate_sha256=previous_hash,
                    no_progress_count=no_progress,
                )
            else:
                after = hash_tree(self.project)

            healthy_hash = previous_hash or after
            if fault.regress_before_qa is not None:
                healthy_hash = after
                healthy_freeze = self.receipt_dir / "frozen" / f"iteration-{iteration}-pre-regression"
                if healthy_freeze.exists() or healthy_freeze.is_symlink():
                    raise HarnessError(f"refuse existing pre-regression freeze: {healthy_freeze}")
                shutil.copytree(self.project, healthy_freeze, ignore=shutil.ignore_patterns(".git"))
                for path in healthy_freeze.rglob("*"):
                    path.chmod(0o444 if path.is_file() else 0o555)
                healthy_frozen_hash_before = hash_tree(healthy_freeze)
                healthy_result = run_product_tests(
                    healthy_freeze, deadline=deadline, executor=self.product_test_executor,
                    invocation_id=f"{self.run_id}-i{iteration}-before-regression",
                )
                healthy_frozen_hash_after = hash_tree(healthy_freeze)
                healthy_project_hash_after = hash_tree(self.project)
                healthy_changed = (
                    healthy_frozen_hash_after != healthy_frozen_hash_before
                    or healthy_project_hash_after != healthy_hash
                )
                if healthy_changed or not healthy_result["oracle_complete"]:
                    self._append(
                        iteration,
                        "test",
                        "incomplete",
                        healthy_project_hash_after,
                        {
                            "observation": (
                                "pre-regression-candidate-changed-during-oracle"
                                if healthy_changed else "pre-regression-oracle-incomplete"
                            ),
                            "output": healthy_result["output"],
                            "output_sha256": sha256_bytes(
                                healthy_result["output"].encode("utf-8")
                            ),
                            "process_evidence": process_evidence(healthy_result),
                        },
                        frozen_candidate_before_sha256=healthy_frozen_hash_before,
                        frozen_candidate_after_sha256=healthy_frozen_hash_after,
                    )
                    self._save_state(
                        iteration,
                        "failed",
                        deadline_path,
                        previous_candidate_sha256=previous_hash,
                        no_progress_count=no_progress,
                    )
                    raise HarnessError(
                        "candidate changed during oracle execution"
                        if healthy_changed else "pre-regression oracle execution was incomplete"
                    )
                healthy_passing = set(healthy_result["passed_test_ids"])
                previous_passing.update(healthy_passing)
                healthy_frozen_hash = healthy_frozen_hash_after
                healthy_evidence = validate_evidence_record(
                    {
                        "schema": EVIDENCE_SCHEMA,
                        "run_id": self.run_id,
                        "iteration": iteration,
                        "candidate_sha256": healthy_frozen_hash,
                        "command": healthy_result["command"],
                        "returncode": healthy_result["returncode"],
                        "output_sha256": sha256_bytes(healthy_result["output"].encode("utf-8")),
                        "observations": sorted(set(healthy_result["failed_test_ids"])),
                        "complete": True,
                    },
                    run_id=self.run_id,
                    iteration=iteration,
                    candidate_sha256=healthy_frozen_hash,
                )
                self._append(
                    iteration,
                    "test",
                    "complete",
                    healthy_hash,
                    {
                        "fault_checkpoint": "pre-regression",
                        "evidence": healthy_evidence,
                        "output": healthy_result["output"],
                        "process_evidence": process_evidence(healthy_result),
                        "passed_test_ids": sorted(healthy_passing),
                        "lost_passing_test_ids": [],
                    },
                    frozen_candidate_sha256=healthy_frozen_hash,
                )
                fault.regress_before_qa(self.project)
                injected_hash = hash_tree(self.project)
                if injected_hash == healthy_hash:
                    raise HarnessError("regression injection made no candidate change")
                after = injected_hash
            frozen = self.receipt_dir / "frozen" / f"iteration-{iteration}"
            if frozen.exists() or frozen.is_symlink():
                raise HarnessError(f"refuse existing QA freeze: {frozen}")
            shutil.copytree(self.project, frozen, ignore=shutil.ignore_patterns(".git"))
            for path in frozen.rglob("*"):
                if path.is_file():
                    path.chmod(0o444)
                elif path.is_dir():
                    path.chmod(0o555)
            frozen_hash_before = hash_tree(frozen)
            test_result = run_product_tests(
                frozen, deadline=deadline, executor=self.product_test_executor,
                invocation_id=f"{self.run_id}-i{iteration}-oracle",
            )
            frozen_hash_after_test = hash_tree(frozen)
            project_hash_after_test = hash_tree(self.project)
            if frozen_hash_after_test != frozen_hash_before or project_hash_after_test != after:
                self._append(
                    iteration,
                    "test",
                    "incomplete",
                    project_hash_after_test,
                    {
                        "project_candidate_before_sha256": after,
                        "observation": (
                            "frozen-candidate-changed-during-oracle"
                            if frozen_hash_after_test != frozen_hash_before
                            else "project-candidate-changed-during-oracle"
                        ),
                        "output_sha256": sha256_bytes(test_result["output"].encode("utf-8")),
                        "process_evidence": process_evidence(test_result),
                    },
                    frozen_candidate_before_sha256=frozen_hash_before,
                    frozen_candidate_after_sha256=frozen_hash_after_test,
                )
                self._save_state(
                    iteration,
                    "failed",
                    deadline_path,
                    previous_candidate_sha256=previous_hash,
                    no_progress_count=no_progress,
                )
                raise HarnessError("candidate changed during oracle execution")
            self._verify_fixed_inputs()
            test_output_hash = sha256_bytes(test_result["output"].encode("utf-8"))
            observations = sorted(set(_FAILED_TEST.findall(test_result["output"])))
            passing = set(test_result["passed_test_ids"])
            lost_passing = sorted(previous_passing - passing)
            final_test_returncode = test_result["returncode"]
            evidence = validate_evidence_record(
                {
                    "schema": EVIDENCE_SCHEMA,
                    "run_id": self.run_id,
                    "iteration": iteration,
                    "candidate_sha256": frozen_hash_before,
                    "command": test_result["command"],
                    "returncode": test_result["returncode"],
                    "output_sha256": test_output_hash,
                    "observations": observations,
                    "complete": test_result["oracle_complete"],
                },
                run_id=self.run_id,
                iteration=iteration,
                candidate_sha256=frozen_hash_before,
            )
            self._append(
                iteration,
                "test",
                "incomplete" if not evidence["complete"] else "regressed" if lost_passing else "complete",
                after,
                {
                    "evidence": evidence,
                    "output": test_result["output"],
                    "process_evidence": process_evidence(test_result),
                    "passed_test_ids": sorted(passing),
                    "lost_passing_test_ids": lost_passing,
                    "healthy_candidate_sha256": healthy_hash,
                },
                frozen_candidate_sha256=frozen_hash_before,
            )
            if not test_result["oracle_complete"]:
                self._save_state(
                    iteration,
                    "failed",
                    deadline_path,
                    previous_candidate_sha256=previous_hash,
                    no_progress_count=no_progress,
                )
                raise HarnessError("fixed oracle did not execute every declared test exactly once")
            if lost_passing:
                try:
                    deadline.remaining()
                except DeadlineError:
                    self._append(
                        iteration, "test", "incomplete", after,
                        {"observation": "deadline-expired-before-regression-stop", "evidence": evidence},
                        frozen_candidate_sha256=frozen_hash_before,
                    )
                    self._save_state(
                        iteration, "failed", deadline_path,
                        previous_candidate_sha256=previous_hash,
                        no_progress_count=no_progress,
                    )
                    raise
                self._save_state(
                    iteration,
                    "regressed",
                    deadline_path,
                    previous_candidate_sha256=previous_hash,
                    no_progress_count=no_progress,
                )
                return {
                    "status": "regressed",
                    "iteration": iteration,
                    "healthy_candidate_sha256": healthy_hash,
                    "injected_candidate_sha256": after,
                    "observations": observations,
                    "lost_passing_test_ids": lost_passing,
                }
            if fault.regress_before_qa is not None:
                raise HarnessError("regression injection did not lose previously passing behavior")
            qa_view = self._new_view(
                "qa",
                iteration,
                {
                    "specification": self.project / "spec.md",
                    "development": development_path,
                    "developer-report": self.documents / f"iteration-{iteration}-developer.md",
                    "receipts": self._receipt_projection("qa", iteration),
                    "candidate": frozen / "linkcheck.py",
                },
                None,
            )
            self._read_public_receipts(qa_view)
            qa_prompt = self._assemble_prompt(
                "qa",
                iteration,
                {
                    "public_specification": qa_view.read_text("specification/spec.md"),
                    "development_document": development_path.read_text(encoding="utf-8"),
                    "developer_report": qa_view.read_text(f"developer-report/iteration-{iteration}-developer.md"),
                    "test_output": test_result["output"],
                },
            )
            qa = self._role_call(
                "qa", iteration, qa_prompt, qa_view, deadline, after,
                test_evidence_sha256=record_hash(evidence),
            )
            qa_report_path = self.documents / f"iteration-{iteration}-evidence.md"
            qa_report_path.write_text(qa["output_text"], encoding="utf-8")
            frozen_hash_after = hash_tree(frozen)
            prospective_no_progress = no_progress + 1 if previous_hash == after else 0
            qa_gate = evaluate_phase(
                qa["_request"], qa, iterations=self.iterations,
                candidate_unchanged=(frozen_hash_after == frozen_hash_after_test and hash_tree(self.project) == after),
                evidence=evidence, lost_passing=tuple(lost_passing),
                progress_allowed=prospective_no_progress < 2,
            )
            if qa_gate["decision"] == "blocked":
                self._reject_phase(qa, qa_gate, after, deadline, evidence=evidence)
            self._append(
                iteration,
                "qa",
                "complete",
                after,
                {
                    **self._phase_details(qa, qa_gate, after, evidence=evidence),
                    "evidence_report": qa["output_text"],
                    "evidence": evidence,
                    "source_metrics": source_metrics(self.project / "linkcheck.py"),
                },
                development_document_sha256=sha256_file(development_path),
                qa_evidence_report_sha256=sha256_file(qa_report_path),
                frozen_candidate_before_sha256=frozen_hash_before,
                frozen_candidate_after_sha256=frozen_hash_after,
                assembled_prompt_sha256=qa["_request"]["prompt_sha256"],
            )
            no_progress = prospective_no_progress
            previous_hash = after
            previous_passing.update(passing)
            self._save_state(
                iteration,
                "iteration_complete",
                deadline_path,
                previous_candidate_sha256=previous_hash,
                no_progress_count=no_progress,
            )
            self._verify_fixed_inputs()
            if fault.interrupt_after_iteration == iteration:
                return {
                    "status": "interrupted",
                    "iteration": iteration,
                    "candidate_sha256": after,
                }
            state = None
        if final_test_returncode != 0:
            final_deadline = self.receipt_dir / f"iteration-{self.iterations}-deadline.json"
            self._append(
                self.iterations,
                "iteration",
                "failed",
                hash_tree(self.project),
                {"observation": "final-candidate-oracle-red", "returncode": final_test_returncode},
            )
            self._save_state(
                self.iterations,
                "failed",
                final_deadline,
                previous_candidate_sha256=previous_hash,
                no_progress_count=no_progress,
            )
            raise HarnessError("final candidate did not satisfy the fixed oracle")
        self._verify_observed_acceptance()
        final_deadline = self.receipt_dir / f"iteration-{self.iterations}-deadline.json"
        self._append(
            self.iterations,
            "iteration",
            "complete",
            hash_tree(self.project),
            {"observation": "final-candidate-oracle-green", "returncode": final_test_returncode},
        )
        self._save_state(
            self.iterations,
            "final_complete",
            final_deadline,
            previous_candidate_sha256=previous_hash,
            no_progress_count=no_progress,
        )
        return {
            "status": "complete",
            "iterations": self.iterations,
            "candidate_sha256": hash_tree(self.project),
            "receipt_chain_head": self.receipts.head,
            "ledger": self.ledger.snapshot(),
        }


def _enable_child_subreaper() -> None:
    if os.name != "posix" or not sys.platform.startswith("linux"):
        raise HarnessError("owned descendant supervision requires Linux")
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(36, 1, 0, 0, 0) != 0:  # PR_SET_CHILD_SUBREAPER
        raise HarnessError(f"cannot enable child subreaper: errno={ctypes.get_errno()}")


def _process_group_members(process_group: int) -> dict[int, str]:
    members: dict[int, str] = {}
    for stat_path in Path("/proc").glob("[0-9]*/stat"):
        try:
            raw = stat_path.read_text(encoding="utf-8")
            fields = raw[raw.rfind(") ") + 2 :].split()
            if int(fields[2]) == process_group:
                members[int(stat_path.parent.name)] = fields[0]
        except (OSError, ValueError, IndexError):
            continue
    return members


def _reap_adopted_processes(process: subprocess.Popen[str], candidates: set[int]) -> None:
    process.poll()
    for pid in sorted(candidates - {process.pid}):
        try:
            os.waitpid(pid, os.WNOHANG)
        except ChildProcessError:
            continue


def _terminate_owned_group(
    process: subprocess.Popen[str],
    *,
    grace_seconds: float,
    expires_boottime_ns: int | None = None,
) -> tuple[bool, list[int], float]:
    started = time.monotonic()
    stop_at = started + grace_seconds
    kill_at = stop_at - min(0.25, grace_seconds / 4)
    seen = set(_process_group_members(process.pid))
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    killed = False
    while True:
        members = _process_group_members(process.pid)
        seen.update(members)
        _reap_adopted_processes(process, seen)
        members = _process_group_members(process.pid)
        if not members:
            return killed, sorted(seen), time.monotonic() - started
        now = time.monotonic()
        boot_remaining = (float("inf") if expires_boottime_ns is None else _boottime_cleanup_remaining(expires_boottime_ns))
        if not killed and (now >= kill_at or boot_remaining <= min(0.25, grace_seconds / 4)):
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            killed = True
        if now >= stop_at or boot_remaining <= 0:
            _reap_adopted_processes(process, seen)
            members = _process_group_members(process.pid)
            if members:
                raise HarnessError(
                    f"owned process cleanup was not confirmed within {grace_seconds:.1f}s: {members}"
                )
            return killed, sorted(seen), time.monotonic() - started
        time.sleep(min(0.01, stop_at - now, boot_remaining))


def _boottime_cleanup_remaining(expires):
    try:
        return (expires - boottime_ns()) / 1_000_000_000
    except DeadlineError:
        # Clock uncertainty authorizes no additional waiting during a stop.
        return 0


def _communicate_streaming(process, *, stdin_text, deadline, on_stdout_line, captured, max_output_bytes=None):
    """Drain both pipes while delivering complete native events before exit."""
    decoders = {name: codecs.getincrementaldecoder("utf-8")() for name in ("stdout", "stderr")}
    pending = ""
    output_bytes = 0
    input_bytes = memoryview((stdin_text or "").encode("utf-8"))
    absolute_clock = callable(getattr(deadline, "clock_binding", None)) and deadline.clock_binding() is not None
    with selectors.DefaultSelector() as selector:
        for name in ("stdout", "stderr"):
            pipe = getattr(process, name)
            os.set_blocking(pipe.fileno(), False)
            selector.register(pipe, selectors.EVENT_READ, name)
        if process.stdin is not None:
            if input_bytes:
                os.set_blocking(process.stdin.fileno(), False)
                selector.register(process.stdin, selectors.EVENT_WRITE, "stdin")
            else:
                process.stdin.close()
                process.stdin = None
        while selector.get_map():
            remaining = deadline.remaining()
            for key, _ in selector.select(min(remaining, 0.05)):
                if absolute_clock:
                    deadline.remaining()
                name = key.data
                if name == "stdin":
                    try:
                        written = os.write(key.fd, input_bytes[:65536])
                        input_bytes = input_bytes[written:]
                    except BrokenPipeError:
                        input_bytes = input_bytes[len(input_bytes):]
                    if not input_bytes:
                        selector.unregister(key.fileobj)
                        key.fileobj.close()
                        process.stdin = None
                    continue
                raw = os.read(key.fd, 65536)
                if max_output_bytes is not None and output_bytes + len(raw) > max_output_bytes:
                    captured[name].append(raw[:max_output_bytes - output_bytes])
                    raise HarnessError("owned process output exceeds its byte allowance")
                output_bytes += len(raw)
                captured[name].append(raw)
                text = decoders[name].decode(raw, final=not raw)
                if name == "stdout" and on_stdout_line is not None:
                    pending += text
                    while "\n" in pending:
                        line, pending = pending.split("\n", 1)
                        if len(line.encode("utf-8")) > 1_048_576:
                            raise HarnessError("native stream event exceeds the transport allowance")
                        if line.strip():
                            if absolute_clock:
                                deadline.remaining()
                            on_stdout_line(line)
                    if len(pending.encode("utf-8")) > 1_048_576:
                        raise HarnessError("native stream event exceeds the transport allowance")
                if not raw:
                    selector.unregister(key.fileobj)
                    if name == "stdout" and on_stdout_line is not None and pending.strip():
                        if absolute_clock:
                            deadline.remaining()
                        on_stdout_line(pending)
                        pending = ""
        if absolute_clock:
            while process.poll() is None:
                try:
                    process.wait(timeout=min(.05, deadline.remaining()))
                except subprocess.TimeoutExpired:
                    continue
            deadline.remaining()
        else:
            process.wait(timeout=deadline.remaining())


def _drain_stopped_stream(process, *, expires_monotonic, max_bytes, expires_boottime_ns=None):
    """Drain stopped binary pipes with bounded storage and the original expiry."""
    output = {"stdout": bytearray(), "stderr": bytearray()}
    remaining_bytes = max_bytes
    if process.stdin is not None:
        process.stdin.close()
        process.stdin = None
    with selectors.DefaultSelector() as selector:
        for name in output:
            pipe = getattr(process, name)
            if pipe is not None and not pipe.closed:
                os.set_blocking(pipe.fileno(), False)
                selector.register(pipe, selectors.EVENT_READ, name)
        while selector.get_map():
            remaining = expires_monotonic - time.monotonic()
            if expires_boottime_ns is not None:
                remaining = min(remaining, _boottime_cleanup_remaining(expires_boottime_ns))
            if remaining <= 0:
                raise HarnessError("owned process pipes did not close within the stop grace")
            for key, _ in selector.select(min(remaining, 0.05)):
                raw = os.read(key.fd, 65536)
                if not raw:
                    selector.unregister(key.fileobj)
                    continue
                retained = raw if remaining_bytes is None else raw[:remaining_bytes]
                output[key.data].extend(retained)
                if remaining_bytes is not None:
                    remaining_bytes -= len(retained)
        if expires_boottime_ns is not None:
            while process.poll() is None:
                remaining = min(expires_monotonic - time.monotonic(), _boottime_cleanup_remaining(expires_boottime_ns))
                if remaining <= 0:
                    raise HarnessError("owned process wait exceeded the absolute stop grace")
                try:
                    process.wait(timeout=min(.05, remaining))
                except subprocess.TimeoutExpired:
                    continue
        else:
            process.wait(timeout=max(0, expires_monotonic - time.monotonic()))
    return bytes(output["stdout"]), bytes(output["stderr"])


def run_owned_process(
    command: list[str],
    *,
    cwd: Path,
    deadline: IterationDeadline,
    environment: dict[str, str] | None = None,
    stdin_text: str | None = None,
    on_stdout_line: Callable[[str], None] | None = None,
    on_stop: Callable[..., None] | None = None,
    max_output_bytes: int | None = None,
) -> dict[str, Any]:
    """Run one owned process group within the persisted iteration deadline."""
    if max_output_bytes is not None and (type(max_output_bytes) is not int or max_output_bytes < 1):
        raise HarnessError("output allowance must be a positive byte count")
    _enable_child_subreaper()
    remaining = deadline.remaining()
    absolute_clock = callable(getattr(deadline, "clock_binding", None)) and deadline.clock_binding() is not None
    streaming = on_stdout_line is not None or max_output_bytes is not None or absolute_clock
    started_unix_ns = time.time_ns()
    started_monotonic_ns = time.monotonic_ns()
    process = subprocess.Popen(
        command,
        cwd=cwd,
        env=environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        stdin=subprocess.PIPE if stdin_text is not None else None,
        text=not streaming,
        start_new_session=True,
    )
    timed_out = False
    late_output = False
    forced_after_grace = False
    orphaned_descendants = False
    cleanup_confirmed = True
    cleanup_seconds = 0.0
    deadline_error: str | None = None
    owned_pids = [process.pid]
    captured: dict[str, list[bytes]] = {"stdout": [], "stderr": []}
    cleanup_started: float | None = None
    cleanup_expires: float | None = None
    cleanup_boottime: int | None = None
    stop_error: BaseException | None = None
    exception_cleanup_confirmed = False

    def terminate():
        nonlocal cleanup_started, cleanup_expires, cleanup_boottime, stop_error
        if cleanup_expires is None:
            cleanup_started = time.monotonic()
            cleanup_expires = cleanup_started + deadline.stop_grace_seconds
            if absolute_clock:
                try:
                    cleanup_boottime = boottime_ns() + int(deadline.stop_grace_seconds * 1_000_000_000)
                except DeadlineError:
                    cleanup_boottime = 0
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
            if on_stop is not None:
                try:
                    on_stop(expires_monotonic=cleanup_expires,
                            **({"expires_boottime_ns": cleanup_boottime} if absolute_clock else {}))
                except BaseException as error:
                    stop_error = error
        forced, pids, _ = _terminate_owned_group(
            process, grace_seconds=max(0, cleanup_expires - time.monotonic()),
            **({"expires_boottime_ns": cleanup_boottime} if absolute_clock else {})
        )
        if stop_error is not None:
            raise stop_error
        return forced, pids, time.monotonic() - cleanup_started

    try:
        if not streaming:
            stdout, stderr = process.communicate(input=stdin_text, timeout=remaining)
        else:
            _communicate_streaming(process, stdin_text=stdin_text, deadline=deadline,
                                   on_stdout_line=on_stdout_line, captured=captured,
                                   max_output_bytes=max_output_bytes)
            stdout, stderr = (b"".join(captured[name]).decode("utf-8") for name in ("stdout", "stderr"))
        try:
            deadline.remaining()
        except DeadlineError as error:
            timed_out = True
            late_output = True
            deadline_error = f"{type(error).__name__}: {error}"
        members = _process_group_members(process.pid)
        _reap_adopted_processes(process, {pid for pid, state in members.items() if state == "Z"})
        members = _process_group_members(process.pid)
        if members or timed_out:
            orphaned_descendants = bool(members)
            forced_after_grace, owned_pids, cleanup_seconds = terminate()
    except (subprocess.TimeoutExpired, DeadlineError) as error:
        timed_out = True
        deadline_error = f"{type(error).__name__}: {error}"
        forced_after_grace, owned_pids, cleanup_seconds = terminate()
        remaining_cleanup = cleanup_expires - time.monotonic()
        if remaining_cleanup <= 0:
            raise HarnessError("owned process output cleanup exceeded the stop grace")
        try:
            if streaming:
                tail_allowance = (None if max_output_bytes is None else max_output_bytes -
                                  sum(len(chunk) for chunks in captured.values() for chunk in chunks))
                stdout, stderr = _drain_stopped_stream(
                    process, expires_monotonic=cleanup_expires, max_bytes=tail_allowance,
                    **({"expires_boottime_ns": cleanup_boottime} if absolute_clock else {}),
                )
            else:
                stdout, stderr = process.communicate(timeout=remaining_cleanup)
        except subprocess.TimeoutExpired:
            cleanup_confirmed = False
            raise HarnessError("owned process pipes did not close within the stop grace")
        if streaming:
            remaining_bytes = max_output_bytes
            combined = []
            for name, tail in (("stdout", stdout), ("stderr", stderr)):
                value = b"".join(captured[name]) + tail
                if remaining_bytes is not None:
                    value = value[:remaining_bytes]
                    remaining_bytes -= len(value)
                combined.append(value.decode("utf-8", errors="replace"))
            stdout, stderr = combined
    except BaseException as error:
        # A rejected stream event must stop the owned process just like a timeout.
        _, _, cleanup_seconds = terminate()
        remaining_cleanup = cleanup_expires - time.monotonic()
        if remaining_cleanup <= 0:
            raise HarnessError("owned process cleanup exceeded the stop grace")
        if streaming:
            tail_allowance = (None if max_output_bytes is None else max_output_bytes -
                              sum(len(chunk) for chunks in captured.values() for chunk in chunks))
            tail = _drain_stopped_stream(process, expires_monotonic=cleanup_expires, max_bytes=tail_allowance,
                **({"expires_boottime_ns": cleanup_boottime} if absolute_clock else {}))
            for name, value in zip(("stdout", "stderr"), tail):
                captured[name].append(value)
        else:
            process.communicate(timeout=remaining_cleanup)
        if _process_group_members(process.pid):
            raise HarnessError("owned process group remains after rejected stream event")
        exception_cleanup_confirmed = True
        raise
    finally:
        failure = sys.exc_info()[1]
        if failure is not None:
            failure.process_evidence = {
                "stdout": b"".join(captured["stdout"]).decode("utf-8", errors="replace"),
                "stderr": b"".join(captured["stderr"]).decode("utf-8", errors="replace"),
                "pid": process.pid, "cleanup_confirmed": exception_cleanup_confirmed,
                "cleanup_seconds": time.monotonic() - cleanup_started if cleanup_started is not None else 0,
            }
        for pipe in (process.stdin, process.stdout, process.stderr):
            if pipe is not None:
                pipe.close()
    remaining_members = _process_group_members(process.pid)
    if remaining_members:
        cleanup_confirmed = False
        raise HarnessError(f"owned process group remains after cleanup: {remaining_members}")
    return {
        "command": list(command),
        "pid": process.pid,
        "process_group": process.pid,
        "owned_pids": owned_pids,
        "returncode": process.returncode,
        "stdout": stdout,
        "stderr": stderr,
        "started_unix_ns": started_unix_ns,
        "finished_unix_ns": time.time_ns(),
        "started_monotonic_ns": started_monotonic_ns,
        "finished_monotonic_ns": time.monotonic_ns(),
        "timed_out": timed_out,
        "late_output": late_output,
        "deadline_error": deadline_error,
        "deadline_state": deadline.snapshot(),
        "forced_after_grace": forced_after_grace,
        "orphaned_descendants": orphaned_descendants,
        "cleanup_confirmed": cleanup_confirmed,
        "cleanup_seconds": cleanup_seconds,
        "accepted": process.returncode == 0 and not timed_out and not orphaned_descendants,
    }


def run_product_tests(
    project: Path,
    *,
    timeout_seconds: float | None = None,
    deadline: IterationDeadline | None = None,
    executor: Any = None,
    invocation_id: str | None = None,
) -> dict[str, Any]:
    """Run the fixed product oracle and retain its case artifacts under `/tmp`."""
    project = project.resolve(strict=True)
    environment = dict(os.environ)
    environment.setdefault("HOH_TEST_ARTIFACT_ROOT", "/tmp/fixture-cases")
    command = [
        sys.executable,
        "-I",
        "-B",
        "-m",
        "unittest",
        "discover",
        "-s",
        "tests",
        "-p",
        "test_*.py",
        "-v",
    ]
    def observed(output: str, returncode: int, timed_out: bool) -> dict[str, Any]:
        failed = _FAILED_TEST.findall(output)
        passed = _PASSED_TEST.findall(output)
        executed = failed + passed
        oracle_complete = (
            not timed_out
            and len(executed) == len(EXPECTED_ORACLE_TEST_IDS)
            and set(executed) == EXPECTED_ORACLE_TEST_IDS
        )
        return {
            "failed_test_ids": failed,
            "passed_test_ids": passed,
            "executed_test_ids": executed,
            "oracle_complete": oracle_complete,
            "oracle_accepted": oracle_complete and returncode == 0,
        }
    if executor is not None and (deadline is None or invocation_id is None):
        raise HarnessError("isolated oracle requires its persisted deadline and invocation identity")
    if deadline is not None:
        if executor is None:
            process_result = run_owned_process(command, cwd=project, deadline=deadline, environment=environment)
        else:
            from hoh.native_oracle import HabitatOracleExecutor
            if type(executor) is not HabitatOracleExecutor:
                raise HarnessError("native oracle executor differs from the verified Habitat implementation")
            process_result = executor.run(project, deadline=deadline, invocation_id=invocation_id)
        output = process_result["stdout"] + process_result["stderr"]
        return {
            **process_result,
            "command": process_result["command"],
            "output": output,
            **observed(output, process_result["returncode"], process_result["timed_out"]),
        }
    if timeout_seconds is None:
        raise HarnessError("product tests require a timeout or persisted deadline")
    deadline_parent = Path("/tmp/hoh-test-deadlines")
    deadline_parent.mkdir(parents=True, exist_ok=True)
    deadline_root = Path(tempfile.mkdtemp(prefix="product-test-", dir=deadline_parent))
    local_deadline = IterationDeadline.create(
        deadline_root / "deadline.json",
        run_id=deadline_root.name,
        iteration=1,
        duration_seconds=timeout_seconds,
    )
    process_result = run_owned_process(
        command,
        cwd=project,
        deadline=local_deadline,
        environment=environment,
    )
    output = process_result["stdout"] + process_result["stderr"]
    return {
        **process_result,
        "command": command,
        "output": output,
        **observed(output, process_result["returncode"], process_result["timed_out"]),
    }


def verify_expected_red(
    fixture: Path,
    destination: Path,
    expected_failures: dict[str, str],
    *,
    timeout_seconds: float,
) -> dict[str, Any]:
    """Materialize the starter once and require its exact declared red result."""
    if destination.exists() or destination.is_symlink():
        raise HarnessError(f"refuse existing fixture destination: {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(fixture.resolve(strict=True), destination)
    for copied in destination.rglob("*"):
        if copied.is_file():
            copied.chmod(copied.stat().st_mode | stat.S_IWUSR)
    result = run_product_tests(destination, timeout_seconds=timeout_seconds)
    actual = set(result["failed_test_ids"])
    expected = set(expected_failures)
    if result["returncode"] == 0 or not result["oracle_complete"] or actual != expected:
        raise HarnessError(f"starter failure IDs differ: expected={sorted(expected)}, actual={sorted(actual)}")
    missing_observations = [
        observation for observation in expected_failures.values() if observation not in result["output"]
    ]
    if missing_observations:
        raise HarnessError(f"starter observations missing: {sorted(missing_observations)}")
    return result


def _native_adapter(runtime: str, receipt_dir: Path, *, observed: bool = False,
                    native_host_config: Path | None = None) -> RoleAdapter:
    if runtime != "claude":
        raise HarnessError(f"runtime adapter is not implemented by 20c: {runtime}")
    from hoh.claude import ClaudeAdapter, ClaudePreflightError

    evidence_path = receipt_dir / "claude-capability-evidence.json"
    try:
        evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ClaudePreflightError(
            f"verified Claude capability evidence is unavailable: {evidence_path}: {error}"
        ) from error
    if observed:
        from hoh.native_host import CLAUDE, HabitatNativeHost
        if sys.platform != "linux" or native_host_config is None:
            raise ClaudePreflightError("observed native execution requires Linux Habitat and --native-host-config")
        try:
            if (not native_host_config.is_absolute() or ".." in native_host_config.parts
                    or any(part.is_symlink() for part in (native_host_config, *native_host_config.parents))
                    or not native_host_config.is_file()):
                raise ValueError("host configuration must be an absolute, link-free regular file")
            config = json.loads(native_host_config.read_text(encoding="utf-8"))
            if (not isinstance(config, dict) or set(config) != {"schema", "task_root", "included_access_evidence"}
                    or config["schema"] != "vivary.habitat-native-host/v1"):
                raise ValueError("host configuration shape differs")
            paths = {}
            for key in ("task_root", "included_access_evidence"):
                if not isinstance(config[key], str):
                    raise ValueError("host configuration paths must be strings")
                value = Path(config[key])
                if not value.is_absolute() or ".." in value.parts or any(part.is_symlink() for part in (value, *value.parents)):
                    raise ValueError("host configuration paths must be absolute and link-free")
                paths[key] = value
            if not paths["included_access_evidence"].is_file():
                raise ValueError("included-access authority evidence is missing")
            if paths["task_root"].exists() and not paths["task_root"].is_dir():
                raise ValueError("native task root must be a directory")
        except (OSError, ValueError) as error:
            raise ClaudePreflightError(f"native host configuration is invalid: {error}") from error
        host = HabitatNativeHost(paths["task_root"], Path(__file__).resolve().parents[1],
                                 included_access_evidence=paths["included_access_evidence"])
        return ClaudeAdapter(executable=Path(CLAUDE), capability_evidence=evidence,
                             mode="observed", executable_scope="habitat-container",
                             runner=host.runner, launch_verifier=host.launch_verifier)
    if native_host_config is not None:
        raise ClaudePreflightError("native host configuration requires an explicit observed-usage workflow")
    executable = shutil.which("claude")
    if executable is None:
        raise ClaudePreflightError("installed native Claude CLI is unavailable")
    return ClaudeAdapter(
        executable=Path(executable).resolve(strict=True),
        capability_evidence=evidence,
    )


def load_native_workflow(
    path: Path, receipt_dir: Path, *, run_id: str, iterations: int,
    native_host_config: Path | None = None,
) -> tuple[dict[str, Any], dict[str, RoleAdapter]]:
    from hoh.claude import ClaudeAdapter

    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise HarnessError(f"workflow configuration is unreadable: {error}") from error
    # Validate assignments before looking up any executable or capability file.
    workflow = Workflow(value, run_id=run_id, iterations=iterations, adapters={"claude": ClaudeAdapter})
    adapters = {
        runtime: _native_adapter(runtime, receipt_dir, observed=workflow.usage_policy is not None,
                                 native_host_config=native_host_config)
        for runtime in {item["runtime"] for item in workflow.value["stages"]}
    }
    return workflow.value, adapters


def main(arguments: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the bounded headless role loop")
    parser.add_argument("--project", type=Path, required=True)
    parser.add_argument("--iterations", type=int, required=True)
    parser.add_argument("--workflow", type=Path, required=True)
    parser.add_argument("--receipt-dir", type=Path, required=True)
    parser.add_argument("--iteration-timeout-seconds", type=float, required=True)
    parser.add_argument("--reported-token-budget", type=int, required=True)
    parser.add_argument("--usage-ledger", type=Path, required=True)
    parser.add_argument("--run-id", default="healthy")
    parser.add_argument("--native-host-config", type=Path)
    values = parser.parse_args(arguments)
    try:
        workflow, adapters = load_native_workflow(
            values.workflow, values.receipt_dir, run_id=values.run_id, iterations=values.iterations,
            native_host_config=values.native_host_config,
        )
        loop = HeadlessLoop(
            project=values.project,
            receipt_dir=values.receipt_dir,
            prompt_dir=Path(__file__).resolve().parent / "hoh" / "prompts",
            run_id=values.run_id,
            iterations=values.iterations,
            iteration_timeout_seconds=values.iteration_timeout_seconds,
            reported_token_budget=values.reported_token_budget,
            usage_ledger=values.usage_ledger,
            workflow=workflow,
            adapters=adapters,
        )
        print(json.dumps(loop.run(), sort_keys=True))
        return 0
    except (HarnessError, ProtocolError) as error:
        print(f"headless loop refused: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
