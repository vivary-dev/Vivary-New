import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";

const moduleUrl = new URL("../../client/thread-save-queue.js", import.meta.resolve("@agent-native/core/client/agent-chat"));
const { saveThreadSnapshot } = await import(moduleUrl);
const receipt = (headId, headRevision, headApplied = true) => ({ headId, headRevision, headApplied });
const input = (key, observation, headId, save) => ({
  key, observation, headId, save, threadId: "thread-1",
  snapshot: { threadData: JSON.stringify({ headId }), title: "Thread", preview: "", messageCount: 1 },
});

test("snapshots share acknowledgements in order within the same observation", async t => {
  const observation = { revision: 3 };
  const first = Promise.withResolvers();
  t.after(() => first.resolve(receipt("a", 4)));
  const seen = [];
  const a = saveThreadSnapshot(input(t.name, observation, "a", async (_id, data) => {
    seen.push(data.expectedHeadRevision);
    return first.promise;
  }));
  const b = saveThreadSnapshot(input(t.name, observation, "b", async (_id, data) => {
    seen.push(data.expectedHeadRevision);
    return receipt("b", 5);
  }));
  await setImmediate();
  assert.deepEqual(seen, [3]);
  first.resolve(receipt("a", 4));
  await Promise.all([a, b]);
  assert.deepEqual(seen, [3, 4]);
  assert.equal(observation.revision, 5);
});

test("a remounted view waits for the old save without borrowing its revision", async t => {
  const oldObservation = { revision: 2 };
  const newObservation = { revision: 8 };
  const first = Promise.withResolvers();
  t.after(() => first.resolve(receipt("a", 3)));
  const a = saveThreadSnapshot(input(t.name, oldObservation, "a", () => first.promise));
  let sentRevision;
  const b = saveThreadSnapshot(input(t.name, newObservation, "b", async (_id, data) => {
    sentRevision = data.expectedHeadRevision;
    return receipt("b", 9);
  }));
  first.resolve(receipt("a", 3));
  await Promise.all([a, b]);
  assert.equal(sentRevision, 8);
  assert.equal(oldObservation.revision, 3);
  assert.equal(newObservation.revision, 9);
});

test("a newly imported observation cannot change a queued old snapshot", async t => {
  const oldObservation = { revision: 2 };
  const importedObservation = { revision: 10 };
  const first = Promise.withResolvers();
  t.after(() => first.resolve(receipt("other", 10, false)));
  const a = saveThreadSnapshot(input(t.name, oldObservation, "a", () => first.promise));
  let sentRevision;
  const b = saveThreadSnapshot(input(t.name, oldObservation, "b", async (_id, data) => {
    sentRevision = data.expectedHeadRevision;
    return receipt("other", 10, false);
  }));
  importedObservation.revision = 11;
  first.resolve(receipt("other", 10, false));
  await Promise.all([a, b]);
  assert.equal(sentRevision, 2);
  assert.equal(oldObservation.revision, 2);
});

test("another thread can save while the first thread is waiting", async t => {
  const first = Promise.withResolvers();
  t.after(() => first.resolve(receipt("a", 1)));
  const a = saveThreadSnapshot(input(t.name + ":a", { revision: 0 }, "a", () => first.promise));
  const b = await saveThreadSnapshot(input(t.name + ":b", { revision: 0 }, "b", async () => receipt("b", 1)));
  assert.equal(b.headId, "b");
  first.resolve(receipt("a", 1));
  await a;
});

test("failed saves do not advance the revision or block following snapshots", async t => {
  const observation = { revision: 4 };
  const rejected = saveThreadSnapshot(input(t.name, observation, "a", async () => { throw new Error("offline"); }));
  const failure = assert.rejects(rejected, /offline/);
  let sentRevision;
  const following = saveThreadSnapshot(input(t.name, observation, "b", async (_id, data) => {
    sentRevision = data.expectedHeadRevision;
    return receipt("b", 5);
  }));
  await Promise.all([failure, following]);
  assert.equal(sentRevision, 4);
  assert.equal(observation.revision, 5);
});

test("missing or mismatched receipts cannot advance an observation", async t => {
  const observation = { revision: 4 };
  for (const result of [undefined, receipt("other", 9), receipt("a", -1), receipt("a", 9, false)]) {
    await saveThreadSnapshot(input(t.name, observation, "a", async () => result));
    assert.equal(observation.revision, 4);
  }
});
