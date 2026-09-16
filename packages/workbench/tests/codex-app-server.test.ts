import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

type Request = { requestId: string; method: string; params: Record<string, unknown> };
const workbench = fileURLToPath(new URL("../", import.meta.url));
const core = process.env.VIVARY_CORE_TEST_ROOT ?? path.join(workbench, "node_modules/@agent-native/core");
const { runCodexAppServer } = await import(pathToFileURL(path.join(core, "dist/cli/codex-app-server-executor.js")).href);

async function fixture(t: { after(fn: () => Promise<void>): void }, mode = "complete") {
  const root = await mkdtemp(path.join(tmpdir(), "vivary app server "));
  t.after(() => rm(root, { recursive: true, force: true }));
  const script = path.join(root, "fake codex app server.mjs");
  const receipt = path.join(root, "messages.json");
  await writeFile(script, `
import { createInterface } from "node:readline";
import { writeFileSync } from "node:fs";
const mode=process.env.FIXTURE_MODE, messages=[];
const emit=message=>process.stdout.write(JSON.stringify(message)+"\\n");
const reply=(id,result)=>emit({id,result});
const notify=(method,params)=>emit({method,params});
const threadId="native-thread-1", turnId="native-turn-1";
const scope={threadId,turnId};
const done=(status="completed")=>notify("turn/completed",{threadId,turn:{id:turnId,status,items:[]}});
const request=(method,params={})=>emit({id:17,method,params:{...scope,itemId:"item-1",...params}});
const rl=createInterface({input:process.stdin});
rl.on("line",line=>{
 const message=JSON.parse(line); messages.push(message);
 writeFileSync(process.env.FIXTURE_RECEIPT,JSON.stringify({pid:process.pid,args:process.argv.slice(2),messages}));
 if (message.method==="initialize") reply(message.id,{});
 if (message.method==="thread/start" || message.method==="thread/resume") {
  const p=message.params;
  reply(message.id,{thread:{id:threadId},cwd:p.cwd,model:mode==="bad-model"?"other-model":p.model,
   modelProvider:"openai",approvalPolicy:p.approvalPolicy,approvalsReviewer:"user",
   sandbox:p.sandbox==="read-only"?{type:"readOnly",networkAccess:false}:p.sandbox==="danger-full-access"?{type:"dangerFullAccess"}:
   {type:"workspaceWrite",networkAccess:false,writableRoots:mode==="wide-roots"?["/outside-project"]:[]}});
 }
 if (message.method==="turn/start") {
  reply(message.id,{turn:{id:turnId,status:"inProgress",items:[]}});
  notify("turn/started",{threadId,turn:{id:turnId,status:"inProgress",items:[]}});
  notify("item/completed",{...scope,item:{id:"commentary-1",type:"agentMessage",phase:"commentary",text:"Reading the project."}});
  if(mode==="command" || mode==="readonly-request") request("item/commandExecution/requestApproval",{command:"echo fixture",cwd:process.cwd(),reason:"Command access"});
  else if(mode==="file") {
   notify("item/started",{...scope,item:{id:"item-1",type:"fileChange",status:"inProgress",changes:[]}});
   notify("item/fileChange/patchUpdated",{...scope,itemId:"item-1",changes:[{path:"note.txt",diff:"+approved",kind:{type:"add"}}]});
   request("item/fileChange/requestApproval",{reason:"Write note"});
  } else if(mode==="permissions") request("item/permissions/requestApproval",{cwd:process.cwd(),permissions:{network:{enabled:true}}});
  else if(mode==="nullable-elicitation") request("mcpServer/elicitation/request",{turnId:null,serverName:"fixture",mode:"form",message:"Name",requestedSchema:{type:"object",properties:{name:{type:"string"}}}});
  else if(mode==="resolved") { request("item/tool/requestUserInput",{questions:[]}); notify("serverRequest/resolved",{threadId,requestId:17}); done(); }
  else if(mode==="unsupported") request("unknown/request",{});
  else if(mode==="abort" || mode==="disconnect") { if(mode==="disconnect") process.exit(2); }
  else {
   notify("item/completed",{...scope,item:{id:"collab-1",type:"collabAgentToolCall",tool:"spawnAgent",status:"completed",senderThreadId:threadId,receiverThreadIds:["child-1"],agentsStates:{"child-1":{status:"running"}}}});
   notify("item/completed",{...scope,item:{id:"final-1",type:"agentMessage",phase:"final_answer",text:"Done."}});
   done();
  }
 }
 if(message.method==="turn/interrupt") { reply(message.id,{}); done("interrupted"); }
 if(message.id===17 && ("result" in message || "error" in message)) done();
});
`);
  const calls: Request[] = [];
  const resolved: string[] = [];
  const notifications: { method: string; params: Record<string, unknown> }[] = [];
  const options = {
    command: process.execPath, argsPrefix: [script], env: { ...process.env, FIXTURE_MODE: mode, FIXTURE_RECEIPT: receipt },
    cwd: root, prompt: "Read the project.", model: "gpt-6-astra", permissionMode: "normal",
    onRequest: async (request: Request) => { calls.push(request); return { decision: "accept" }; },
    onRequestResolved: (requestId: string) => { resolved.push(requestId); },
    onNotification: (method: string, params: Record<string, unknown>) => { notifications.push({ method, params }); },
  };
  return { root, options, calls, resolved, notifications,
    receipt: async () => JSON.parse(await readFile(receipt, "utf8")) };
}

test("app-server starts a bounded native thread and preserves commentary and agent notifications", async t => {
  const f = await fixture(t);
  let session;
  const result = await runCodexAppServer({ ...f.options, onThread: value => { session = value; } });
  assert.equal(result.status, "completed");
  assert.deepEqual(session, { threadId: "native-thread-1", model: "gpt-6-astra" });
  const receipt = await f.receipt();
  assert.deepEqual(receipt.args, ["app-server", "--listen", "stdio://"]);
  const setup = receipt.messages.find(message => message.method === "thread/start").params;
  assert.equal(setup.approvalPolicy, "on-request");
  assert.equal(setup.approvalsReviewer, "user");
  assert.equal(setup.sandbox, "workspace-write");
  assert.deepEqual(setup.config.sandbox_workspace_write.writable_roots, []);
  assert.equal(receipt.messages.find(message => message.method === "turn/start").params.collaborationMode.mode, "default");
  assert.ok(f.notifications.some(({params}) => params.item?.phase === "commentary"));
  assert.ok(f.notifications.some(({params}) => params.item?.type === "collabAgentToolCall"));
  assert.throws(() => process.kill(receipt.pid, 0), { code: "ESRCH" });
});

test("follow-up resumes the exact native session and applies the selected mode", async t => {
  const f = await fixture(t);
  const result = await runCodexAppServer({ ...f.options, threadId: "native-thread-1", permissionMode: "yolo" });
  assert.equal(result.status, "completed");
  const messages = (await f.receipt()).messages;
  assert.equal(messages.some(message => message.method === "thread/start"), false);
  const resumed = messages.find(message => message.method === "thread/resume").params;
  assert.equal(resumed.threadId, "native-thread-1");
  assert.equal(resumed.sandbox, "danger-full-access");
  assert.equal(resumed.approvalPolicy, "never");
  assert.deepEqual(messages.find(message => message.method === "turn/start").params.sandboxPolicy, { type: "dangerFullAccess" });
});

test("command approval waits for a decision and replies using the original wire ID", async t => {
  const f = await fixture(t, "command");
  let answer;
  const decision = new Promise(resolve => { answer = resolve; });
  let settled = false;
  const result = runCodexAppServer({ ...f.options, onRequest: async request => {
    f.calls.push(request); return decision;
  } }).then(value => { settled = true; return value; });
  for (let i = 0; i < 100 && !f.calls.length; i++) await delay(10);
  assert.equal(f.calls.length, 1);
  assert.match(f.calls[0].requestId, /^[a-f0-9-]{36}$/);
  await delay(50);
  assert.equal(settled, false);
  answer({ decision: "decline" });
  assert.equal((await result).status, "completed");
  assert.deepEqual((await f.receipt()).messages.find(message => message.id === 17).result, { decision: "decline" });
  assert.deepEqual(f.resolved, [f.calls[0].requestId]);
});

test("file approval includes the exact observed patch", async t => {
  const f = await fixture(t, "file");
  assert.equal((await runCodexAppServer(f.options)).status, "completed");
  assert.deepEqual(f.calls[0].params.item.changes, [{ path: "note.txt", diff: "+approved", kind: { type: "add" } }]);
});

test("permission requests grant only the callback response", async t => {
  const f = await fixture(t, "permissions");
  const response = { permissions: {}, scope: "turn" };
  assert.equal((await runCodexAppServer({ ...f.options, onRequest: async request => {
    f.calls.push(request); return response;
  } })).status, "completed");
  assert.deepEqual((await f.receipt()).messages.find(message => message.id === 17).result, response);
});

test("read-only denies unexpected action approval without asking the host", async t => {
  const f = await fixture(t, "readonly-request");
  assert.equal((await runCodexAppServer({ ...f.options, permissionMode: "read-only" })).status, "completed");
  assert.equal(f.calls.length, 0);
  assert.deepEqual((await f.receipt()).messages.find(message => message.id === 17).result, { decision: "decline" });
});

test("resolved server requests are cleared once and do not block turn completion", async t => {
  const f = await fixture(t, "resolved");
  const result = await runCodexAppServer({ ...f.options, onRequest: request => {
    f.calls.push(request); return new Promise(() => {});
  } });
  assert.equal(result.status, "completed");
  assert.deepEqual(f.resolved, [f.calls[0].requestId]);
});

test("Stop interrupts the active turn before terminating the child", async t => {
  const f = await fixture(t, "abort");
  const controller = new AbortController();
  const result = await runCodexAppServer({ ...f.options, signal: controller.signal,
    onNotification: method => { if (method === "turn/started") controller.abort(); } });
  assert.equal(result.status, "interrupted");
  const receipt = await f.receipt();
  assert.deepEqual(receipt.messages.find(message => message.method === "turn/interrupt").params,
    { threadId: "native-thread-1", turnId: "native-turn-1" });
  assert.throws(() => process.kill(receipt.pid, 0), { code: "ESRCH" });
});

for (const mode of ["wide-roots", "bad-model"]) test(`effective ${mode} mismatch refuses the turn`, async t => {
  const f = await fixture(t, mode);
  assert.equal((await runCodexAppServer(f.options)).status, "failed");
  assert.equal((await f.receipt()).messages.some(message => message.method === "turn/start"), false);
});

test("unsupported requests and disconnections fail visibly", async t => {
  for (const mode of ["unsupported", "disconnect"]) {
    const f = await fixture(t, mode);
    const result = await runCodexAppServer(f.options);
    assert.equal(result.status, "failed");
    assert.ok(result.error);
    assert.equal(f.calls.length, 0);
  }
});


test("MCP elicitation accepts a nullable turn correlation", async t => {
  const f = await fixture(t, "nullable-elicitation");
  const result = await runCodexAppServer({ ...f.options, onRequest: async request => {
    f.calls.push(request); return { action: "decline" };
  } });
  assert.equal(result.status, "completed");
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].params.turnId, null);
  assert.deepEqual((await f.receipt()).messages.find(message => message.id === 17).result, { action: "decline" });
});
