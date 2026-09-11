"""Private duplex transport for the synchronous creation engine.

The executable entry point is deliberately unconfigured.  A trusted host fixture
or production composition must call :func:`serve` with fixed parents, namespace
custody, and workspace operations.  Request frames contain claims only.
"""
from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import re
import sys
from typing import BinaryIO, Mapping

# This executable's own Core package is its only application import root under -I.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from vivary_core.creation_apply import (
    CreationApply,
    CreationApplyFailure,
    CreationApplyResult,
    CreationNamespaceIdentity,
    CreationReceiptSnapshot,
)
from vivary_core.creation_authority import (
    CreationAuthority,
    CreationBinding,
    CreationLease,
    ResolvedCreationAuthority,
)
from vivary_core.physical_observe import ObservationFailure


PROTOCOL_VERSION = 1
DEFAULT_FRAME_BYTES = 16 * 1024
_ID = re.compile(r"[A-Za-z0-9_-]{1,128}\Z")
_NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}\Z")
_DIGEST = re.compile(r"sha256:[0-9a-f]{64}\Z")
_PHASES = frozenset({"preparing", "prepared", "publishing", "published"})
_FAILURE_PHASES = _PHASES | {"failed"}
_EFFECTS = frozenset({"prepare-stage", "publish", "recover-publication"})


@dataclass(frozen=True)
class CreationProviderComposition:
    """Trusted, process-local construction inputs; never decoded from the wire."""

    parents: Mapping[str, Path]
    namespace: object
    operations: object


def _pairs(items):
    value = {}
    for key, item in items:
        if key in value:
            raise ValueError("duplicate JSON field")
        value[key] = item
    return value


def _exact(value, fields):
    if type(value) is not dict or set(value) != set(fields):
        raise ValueError("invalid message fields")


def _integer(value, *, minimum=1):
    if type(value) is not int or not minimum <= value <= 2**53 - 1:
        raise ValueError("invalid integer")
    return value


def _matches(pattern, value):
    if type(value) is not str or pattern.fullmatch(value) is None:
        raise ValueError("invalid string")
    value.encode("utf-8", "strict")
    return value


def _unicode(value):
    if type(value) is str:
        value.encode("utf-8", "strict")
    elif type(value) is list:
        for item in value:
            _unicode(item)
    elif type(value) is dict:
        for key, item in value.items():
            _unicode(key)
            _unicode(item)


class _Connection:
    def __init__(self, input_stream: BinaryIO, output_stream: BinaryIO, frame_bytes: int):
        if (type(frame_bytes) is not int or frame_bytes < 1024
                or frame_bytes > 1024 * 1024):
            raise ValueError("invalid frame limit")
        self.input = input_stream
        self.output = output_stream
        self.frame_bytes = frame_bytes
        self.sent = 0
        self.received = 0
        self.connection_id = None
        self.apply_parent = None
        self.nested_parent = None

    def receive(self):
        line = self.input.readline(self.frame_bytes + 1)
        if not line or len(line) > self.frame_bytes or not line.endswith(b"\n"):
            raise EOFError("invalid or closed frame")
        value = json.loads(
            line[:-1].decode("utf-8", "strict"),
            object_pairs_hook=_pairs,
            parse_constant=lambda _value: (_ for _ in ()).throw(ValueError("constant")),
        )
        _unicode(value)
        if type(value) is not dict:
            raise ValueError("message must be an object")
        _integer(value.get("version"))
        if value["version"] != PROTOCOL_VERSION:
            raise ValueError("unsupported protocol")
        if self.connection_id is not None and value.get("connectionId") != self.connection_id:
            raise ValueError("wrong connection")
        message_id = _integer(value.get("id"))
        if message_id != self.received + 1:
            raise ValueError("non-monotone peer id")
        self.received = message_id
        return value

    def send(self, kind, fields):
        self.sent += 1
        if self.connection_id is None:
            raise ValueError("connection is not initialized")
        value = {"version": PROTOCOL_VERSION, "connectionId": self.connection_id,
                 "id": self.sent, "kind": kind, **fields}
        frame = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8") + b"\n"
        if len(frame) > self.frame_bytes:
            raise ValueError("outgoing frame exceeds limit")
        self.output.write(frame)
        self.output.flush()
        return self.sent

    def request(self, kind, fields, response_kind):
        request_id = self.send(kind, fields)
        response = self.receive()
        _exact(response, ["version", "connectionId", "id", "kind", "parentId", "value"])
        if response["kind"] != response_kind or response["parentId"] != request_id:
            raise ValueError("uncorrelated response")
        return response["value"]


def _binding(value):
    fields = ["actorId", "collectionId", "deviceId", "policyRevision", "operationId",
              "parentRef", "childName", "acceptedPlanSha256"]
    _exact(value, fields)
    return CreationBinding(
        _matches(_ID, value["actorId"]),
        _matches(_ID, value["collectionId"]),
        _matches(_ID, value["deviceId"]),
        _integer(value["policyRevision"]),
        _matches(_ID, value["operationId"]),
        _matches(_ID, value["parentRef"]),
        _matches(_NAME, value["childName"]),
        _matches(_DIGEST, value["acceptedPlanSha256"]),
    )


def _binding_wire(value):
    return {
        "actorId": value.actor_id, "collectionId": value.collection_id,
        "deviceId": value.device_id, "policyRevision": value.policy_revision,
        "operationId": value.operation_id, "parentRef": value.parent_ref,
        "childName": value.child_name, "acceptedPlanSha256": value.accepted_plan_sha256,
    }


def _namespace(value):
    _exact(value, ["namespaceKey", "childKey", "stageId", "continuityId"])
    return CreationNamespaceIdentity(*(
        _matches(_ID, value[key])
        for key in ["namespaceKey", "childKey", "stageId", "continuityId"]
    ))


def _namespace_wire(value):
    return {
        "namespaceKey": value.namespace_key, "childKey": value.child_key,
        "stageId": value.stage_id, "continuityId": value.continuity_id,
    }


def _snapshot(value):
    _exact(value, ["binding", "phase", "namespace"])
    if value["phase"] not in _PHASES:
        raise ValueError("invalid phase")
    return CreationReceiptSnapshot(
        _binding(value["binding"]), value["phase"], _namespace(value["namespace"])
    )


def _snapshot_wire(value):
    return {
        "binding": _binding_wire(value.binding), "phase": value.phase,
        "namespace": _namespace_wire(value.namespace),
    }


def _port_value(value):
    if value is None:
        return None
    if type(value) is not dict:
        raise ValueError("invalid receipt result")
    if set(value) == {"code", "reason", "phase"}:
        if (type(value["code"]) is not str or type(value["reason"]) is not str
                or (value["phase"] is not None and value["phase"] not in _FAILURE_PHASES)):
            raise ValueError("invalid receipt refusal")
        return CreationApplyFailure(value["code"], value["reason"], value["phase"])
    return _snapshot(value)


class _ReceiptPort:
    def __init__(self, connection):
        self.connection = connection

    def _call(self, operation, binding, namespace, **fields):
        value = self.connection.request("receipt", {
            "parentId": self.connection.apply_parent, "operation": operation,
            "binding": _binding_wire(binding),
            "namespace": _namespace_wire(namespace),
            **fields,
        }, "receipt-result")
        return _port_value(value)

    def load(self, binding, namespace):
        return self._call("load", binding, namespace)

    def prepare(self, binding, namespace):
        return self._call("prepare", binding, namespace)

    def transition(self, binding, snapshot, namespace, expected_phase, next_phase):
        return self._call(
            "transition", binding, namespace, snapshot=_snapshot_wire(snapshot),
            expectedPhase=expected_phase, nextPhase=next_phase,
        )

    def admit_and_execute(self, binding, snapshot, namespace, effect, execute):
        if effect not in _EFFECTS:
            raise ValueError("invalid effect")
        request_id = self.connection.send("receipt", {
            "parentId": self.connection.apply_parent,
            "operation": "admit", "binding": _binding_wire(binding),
            "namespace": _namespace_wire(namespace), "snapshot": _snapshot_wire(snapshot),
            "effect": effect,
        })
        local_value = None
        invoked = False
        while True:
            response = self.connection.receive()
            kind = response.get("kind")
            if kind == "effect-invoke":
                _exact(response, ["version", "connectionId", "id", "kind", "parentId", "effect"])
                if invoked or response["parentId"] != request_id or response["effect"] != effect:
                    raise ValueError("invalid effect invocation")
                invoked = True
                ok = False
                previous_parent = self.connection.nested_parent
                self.connection.nested_parent = response["id"]
                try:
                    local_value = execute()
                    ok = True
                except Exception:
                    local_value = None
                finally:
                    self.connection.nested_parent = previous_parent
                self.connection.send("effect-complete", {
                    "parentId": response["id"], "ok": ok,
                })
                continue
            _exact(response, ["version", "connectionId", "id", "kind", "parentId", "value"])
            if kind != "receipt-result" or response["parentId"] != request_id:
                raise ValueError("uncorrelated receipt result")
            result = response["value"]
            if type(result) is dict and set(result) == {"executed"}:
                if result["executed"] is not True or not invoked or local_value is None:
                    raise ValueError("invalid effect completion")
                return local_value
            return _port_value(result)


def _authority_resolver(connection):
    value = connection.request("authority-read", {
        "parentId": connection.nested_parent,
    }, "authority-result")
    if value is None:
        return ObservationFailure("denied", "creation-facts-unavailable")
    fields = ["actorId", "collectionId", "deviceId", "policyRevision", "member",
              "capabilities", "creatableParents"]
    _exact(value, fields)
    if (type(value["member"]) is not bool or type(value["capabilities"]) is not list
            or type(value["creatableParents"]) is not list
            or len(value["capabilities"]) > 128 or len(value["creatableParents"]) > 128):
        raise ValueError("invalid authority facts")
    capabilities = [_matches(_ID, item) for item in value["capabilities"]]
    parents = [_matches(_ID, item) for item in value["creatableParents"]]
    if len(set(capabilities)) != len(capabilities) or len(set(parents)) != len(parents):
        raise ValueError("duplicate authority facts")
    return ResolvedCreationAuthority(
        _matches(_ID, value["actorId"]), _matches(_ID, value["collectionId"]),
        _matches(_ID, value["deviceId"]), _integer(value["policyRevision"]),
        value["member"], frozenset(capabilities), frozenset(parents),
    )


def _claims(value):
    fields = ["operationId", "parentRef", "childName", "acceptedPlanSha256",
              "expectedPolicyRevision", "preset", "adapters", "activeContext"]
    _exact(value, fields)
    if (type(value["adapters"]) is not list or len(value["adapters"]) > 16
            or any(type(item) is not str for item in value["adapters"])
            or len(set(value["adapters"])) != len(value["adapters"])
            or (value["activeContext"] is not None and type(value["activeContext"]) is not str)):
        raise ValueError("invalid apply options")
    return {
        "operation_id": _matches(_ID, value["operationId"]),
        "parent_ref": _matches(_ID, value["parentRef"]),
        "child_name": _matches(_NAME, value["childName"]),
        "accepted_plan_sha256": _matches(_DIGEST, value["acceptedPlanSha256"]),
        "expected_policy_revision": _integer(value["expectedPolicyRevision"]),
        "preset": _matches(_ID, value["preset"]),
        "adapters": tuple(_matches(_ID, item) for item in value["adapters"]),
        "active_context": None if value["activeContext"] is None
        else _matches(_ID, value["activeContext"]),
    }


def _apply_wire(value):
    if type(value) is CreationApplyFailure:
        return {"code": value.code, "reason": value.reason, "phase": value.phase}
    if type(value) is not CreationApplyResult:
        raise ValueError("invalid creation result")
    return {
        "code": value.code, "operationId": value.operation_id, "phase": value.phase,
        "replayed": value.replayed, "targetPresent": value.target_present,
        "registered": value.registered,
    }


def serve(input_stream: BinaryIO, output_stream: BinaryIO,
          composition: CreationProviderComposition | None = None,
          *, frame_bytes: int = DEFAULT_FRAME_BYTES) -> int:
    """Serve one apply using trusted composition, or refuse when unconfigured."""
    if type(composition) is not CreationProviderComposition:
        return 1
    authority = None
    try:
        connection = _Connection(input_stream, output_stream, frame_bytes)
        initialize = connection.receive()
        _exact(initialize, ["version", "connectionId", "id", "kind"])
        if (initialize["kind"] != "initialize"
                or type(initialize["connectionId"]) is not str
                or _ID.fullmatch(initialize["connectionId"]) is None):
            raise ValueError("initialization required")
        connection.connection_id = initialize["connectionId"]
        connection.send("ready", {"parentId": initialize["id"]})

        authority = CreationAuthority(
            lambda: _authority_resolver(connection), parents=composition.parents
        )
        receipts = _ReceiptPort(connection)
        engine = CreationApply(
            authority, receipts, composition.operations, namespace=composition.namespace
        )
        request = connection.receive()
        _exact(request, ["version", "connectionId", "id", "kind", "claims"])
        if request["kind"] != "apply":
            raise ValueError("apply required")
        connection.apply_parent = request["id"]
        claims = _claims(request["claims"])
        lease = authority.acquire(
            operation_id=claims["operation_id"], parent_ref=claims["parent_ref"],
            child_name=claims["child_name"],
            accepted_plan_sha256=claims["accepted_plan_sha256"],
            expected_policy_revision=claims["expected_policy_revision"],
        )
        if isinstance(lease, ObservationFailure):
            result = CreationApplyFailure(lease.code, lease.reason)
        elif type(lease) is CreationLease:
            result = engine.apply(
                lease, preset=claims["preset"], adapters=claims["adapters"],
                active_context=claims["active_context"],
            )
        else:
            raise ValueError("invalid lease result")
        connection.send("apply-result", {
            "parentId": request["id"], "value": _apply_wire(result),
        })
        # The bridge is deliberately one-shot. Any pipelined or second apply is invalid.
        return 0
    except (EOFError, OSError, TypeError, ValueError, RecursionError):
        return 1
    finally:
        if authority is not None:
            authority.close()


if __name__ == "__main__":
    # No ordinary executable composition can be selected by input or environment.
    raise SystemExit(serve(sys.stdin.buffer, sys.stdout.buffer))
