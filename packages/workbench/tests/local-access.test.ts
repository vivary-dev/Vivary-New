import { VIVARY_OWNER_ACTIONS } from "../shared/owner-actions.ts";
import { VIVARY_OWNER_SESSION_STORAGE_KEY } from "../shared/owner-session.ts";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";

import { H3Event } from "h3";
import { COOKIE_NAME } from "@agent-native/core/server";

import { admitBrowserContext } from "../server/browser-request-context.mjs";
import {
  createVivaryLocalAuthOptions,
  createVivaryLocalSessionResolver,
  localAccessRequestRejection,
  readVivarySessionTokens,
  resolveVivaryLocalAccessConfig,
  VIVARY_LOCAL_OWNER_EMAIL,
  type VivaryLocalAccessConfig,
  type VivaryLocalAccessRequest,
  type VivaryLocalAccessSessionDependencies,
} from "../server/local-access.ts";
import {
  createVivaryOwnerSignIn,
  VIVARY_OWNER_SIGN_IN_FILE,
  VIVARY_OWNER_SIGN_IN_HTML,
} from "../server/owner-sign-in.ts";

const ORIGIN = "http://127.0.0.1:4317";
const PRIVATE_ORIGIN = "https://vivary.example.test";

function localEnvironment(
  patch: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    APP_URL: ORIGIN,
    HOST: "127.0.0.1",
    NODE_ENV: "production",
    PORT: "4317",
    VIVARY_ACCESS_MODE: "local",
    ...patch,
  };
}

function privateProxyEnvironment(
  patch: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    APP_URL: PRIVATE_ORIGIN,
    HOST: "127.0.0.1",
    NODE_ENV: "production",
    PORT: "4317",
    VIVARY_ACCESS_MODE: "private-proxy",
    VIVARY_TRUSTED_PROXY: "zo-owner-only",
    ...patch,
  };
}

function request(
  patch: Partial<VivaryLocalAccessRequest> = {},
): VivaryLocalAccessRequest {
  return {
    host: "127.0.0.1:4317",
    method: "GET",
    peerAddress: "127.0.0.1",
    secFetchSite: "same-origin",
    ...patch,
  };
}

function privateProxyRequest(
  patch: Partial<VivaryLocalAccessRequest> = {},
): VivaryLocalAccessRequest {
  return {
    forwardedFor: "192.0.2.10",
    forwardedHost: "vivary.example.test",
    forwardedPort: "443",
    forwardedProto: "https",
    host: "127.0.0.1:4317",
    method: "GET",
    peerAddress: "127.0.0.1",
    realIp: "192.0.2.10",
    secFetchSite: "same-origin",
    ...patch,
  };
}

type TestEvent = H3Event & {
  localRequest: VivaryLocalAccessRequest;
  sessionTokens: string[];
};

function event(
  localRequest: VivaryLocalAccessRequest,
  sessionTokens: string[] = [],
): TestEvent {
  return { localRequest, sessionTokens } as unknown as TestEvent;
}

function sessionFixture(initialSessions: ReadonlyArray<readonly [string, string]> = []) {
  const sessions = new Map(initialSessions);
  const persisted: Array<{ email: string; token: string }> = [];
  const cookies: string[] = [];
  let tokenNumber = 0;
  const dependencies: VivaryLocalAccessSessionDependencies = {
    addSession: async (token, email) => {
      sessions.set(token, email);
      persisted.push({ email, token });
    },
    createToken: () => `local-session-${String(++tokenNumber).padStart(32, "0")}`,
    getSessionEmail: async (token) => sessions.get(token) ?? null,
    readRequest: (value) => (value as TestEvent).localRequest,
    readSessionTokens: (value) => (value as TestEvent).sessionTokens,
    setSessionCookie: (_value, token) => {
      cookies.push(token);
    },
  };
  return { cookies, dependencies, persisted, sessions };
}

function ownerSignInFixture(origin = ORIGIN) {
  const saved: string[] = [];
  const signIn = createVivaryOwnerSignIn({
    origin,
    dataDir: "/unused",
    saveFile: (_file, contents) => {
      saved.push(contents);
    },
  });
  const currentSecret = () => (saved.at(-1) ?? "").trim().split("#")[1] ?? "";
  return { currentSecret, saved, signIn };
}

type PageStorage = Map<string, string> | "blocked" | "failing";
type SessionAnswer = object | Error | number;

// Runs a sign-in page script against a fake browser. A number answer is a
// non-OK status and an Error answer is a failed request.
async function openSignInPage(
  html: string,
  { hash = "", storage = new Map(), answer }: {
    hash?: string;
    storage?: PageStorage;
    answer: (headers: Record<string, string>) => SessionAnswer;
  },
) {
  const script = /<script>([\s\S]*)<\/script>/.exec(html)?.[1];
  assert.ok(script);
  const steps: string[] = [];
  const help = { hidden: true };
  let storageReads = 0;
  let onHashChange: (() => Promise<void>) | undefined;
  const location = {
    hash,
    pathname: "/sign-in",
    replace: (target: string) => { steps.push(`replace ${target}`); },
  };
  const failing = () => { throw new Error("storage is full"); };
  const browserStorage = () => {
    storageReads++;
    if (storage === "blocked") throw new Error("storage is blocked");
    if (storage === "failing") return { getItem: failing, setItem: failing, removeItem: failing };
    return {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        steps.push(`set ${key} ${value}`);
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        steps.push(`remove ${key}`);
        storage.delete(key);
      },
    };
  };
  const context = {
    addEventListener: (type: string, listener: () => Promise<void>) => {
      if (type === "hashchange") onHashChange = listener;
    },
    document: { getElementById: () => help },
    fetch: async (_target: string, init: { headers: Record<string, string> }) => {
      steps.push(`session ${JSON.stringify(init.headers)}`);
      const body = answer(init.headers);
      if (body instanceof Error) throw body;
      if (typeof body === "number") return { ok: false, status: body, json: async () => ({}) };
      return { ok: true, json: async () => body };
    },
    history: {
      replaceState: () => { location.hash = ""; },
    },
    location,
  };
  Object.defineProperty(context, "localStorage", { get: browserStorage });
  Object.defineProperty(context, "sessionStorage", { get: browserStorage });
  await runInNewContext(script, context);
  return {
    help: () => (help.hidden ? "hidden" : "shown"),
    steps,
    storageReads: () => storageReads,
    openAddress: async (next: string) => {
      assert.ok(onHashChange, "the page listens for an address opened in the same tab");
      location.hash = next;
      await onHashChange();
    },
  };
}

describe("Vivary local access configuration", () => {
  it("leaves unset and explicit hosted modes to Native's default auth plugin", () => {
    for (const environment of [
      { NODE_ENV: "production" },
      { NODE_ENV: "production", VIVARY_ACCESS_MODE: "hosted" },
    ]) {
      assert.equal(resolveVivaryLocalAccessConfig(environment), null);
    }
  });

  it("accepts only an exact production loopback origin", () => {
    assert.deepEqual(resolveVivaryLocalAccessConfig(localEnvironment()), {
      mode: "local",
      host: "127.0.0.1",
      origin: ORIGIN,
      ownerEmail: VIVARY_LOCAL_OWNER_EMAIL,
      port: 4317,
    });

    assert.deepEqual(
      resolveVivaryLocalAccessConfig(
        localEnvironment({ APP_URL: "http://127.0.0.1", PORT: "80" }),
      ),
      {
        mode: "local",
        host: "127.0.0.1",
        origin: "http://127.0.0.1",
        ownerEmail: VIVARY_LOCAL_OWNER_EMAIL,
        port: 80,
      },
    );

    for (const patch of [
      { VIVARY_ACCESS_MODE: "typo" },
      { NODE_ENV: "development" },
      { HOST: "0.0.0.0" },
      { HOST: "localhost", APP_URL: "http://localhost:4317" },
      { PORT: "0" },
      { PORT: "4318" },
      { APP_URL: "https://127.0.0.1:4317" },
      { APP_URL: "http://127.0.0.1:4318" },
      { APP_URL: "http://127.0.0.1:4317/path" },
      { APP_URL: "http://127.0.0.1:4317/" },
    ]) {
      assert.throws(
        () => resolveVivaryLocalAccessConfig(localEnvironment(patch)),
        /vivary-local-access/,
      );
    }
  });

  it("infers the local origin when Native's public URL is unset", () => {
    for (const appUrl of [undefined, ""]) {
      assert.deepEqual(
        resolveVivaryLocalAccessConfig(localEnvironment({ APP_URL: appUrl })),
        {
          mode: "local",
          host: "127.0.0.1",
          origin: ORIGIN,
          ownerEmail: VIVARY_LOCAL_OWNER_EMAIL,
          port: 4317,
        },
      );
    }
  });

  it("rejects an explicit local URL from a different origin", () => {
    assert.throws(
      () => resolveVivaryLocalAccessConfig(
        localEnvironment({ APP_URL: "http://127.0.0.2:4317" }),
      ),
      /must exactly match the configured numeric loopback HOST and PORT/,
    );
  });

  it("requires an explicit private ingress profile and canonical external HTTPS origin", () => {
    assert.deepEqual(resolveVivaryLocalAccessConfig(privateProxyEnvironment()), {
      mode: "private-proxy",
      host: "127.0.0.1",
      origin: PRIVATE_ORIGIN,
      ownerEmail: VIVARY_LOCAL_OWNER_EMAIL,
      port: 4317,
    });

    for (const patch of [
      { VIVARY_TRUSTED_PROXY: undefined },
      { VIVARY_TRUSTED_PROXY: "generic" },
      { HOST: "::1" },
      { HOST: "0.0.0.0" },
      { APP_URL: "http://vivary.example.test" },
      { APP_URL: "https://127.0.0.1" },
      { APP_URL: "https://[::1]" },
      { APP_URL: "https://localhost" },
      { APP_URL: "https://vivary.example.test/" },
      { APP_URL: "https://vivary.example.test/path" },
    ]) {
      assert.throws(
        () => resolveVivaryLocalAccessConfig(privateProxyEnvironment(patch)),
        /vivary-local-access/,
      );
    }
  });

  it("replaces Native credential pages with the unified workspace route on the desktop", () => {
    const config = resolveVivaryLocalAccessConfig(localEnvironment());
    assert.ok(config);
    const options = createVivaryLocalAuthOptions({ ...config, desktop: true });
    assert.equal(options.rootAuth, false);
    assert.match(options.loginHtml ?? "", /url=\/"/);
    assert.match(options.loginHtml ?? "", /location\.replace\("\/"\)/);
    assert.doesNotMatch(options.loginHtml ?? "", /email|password|signup/i);
  });

  it("replaces Native credential pages with the owner sign-in page in both self-hosted modes", () => {
    for (const environment of [localEnvironment(), privateProxyEnvironment()]) {
      const config = resolveVivaryLocalAccessConfig(environment);
      assert.ok(config);
      const options = createVivaryLocalAuthOptions(config);
      const html = options.loginHtml ?? "";
      assert.equal(options.rootAuth, false);
      assert.equal(html, VIVARY_OWNER_SIGN_IN_HTML[config.mode]);
      assert.match(html, /<meta name="referrer" content="no-referrer">/);
      assert.match(html, /<noscript>/);
      assert.match(html, /owner-sign-in\.txt/);
      assert.doesNotMatch(html, /http-equiv|src=|href=|https?:\/\//i);
      assert.doesNotMatch(html, /email|password|signup/i);
    }
    const pageCopy = (html: string) => html.replace(/<script>[\s\S]*<\/script>/, "");
    assert.equal(pageCopy(VIVARY_OWNER_SIGN_IN_HTML["private-proxy"]), pageCopy(VIVARY_OWNER_SIGN_IN_HTML.local));
  });

  it("removes the sign-in secret from the address before it requests a session", async () => {
    const script = /<script>([\s\S]*)<\/script>/.exec(VIVARY_OWNER_SIGN_IN_HTML.local)?.[1];
    assert.ok(script);
    const secret = "s".repeat(43);
    const signedIn = { email: VIVARY_LOCAL_OWNER_EMAIL };
    const signedOut = { error: "Not authenticated" };
    const visit = async (hash: string, body: object) => {
      const steps: string[] = [];
      const help = { hidden: true };
      const location = {
        hash,
        pathname: "/sign-in",
        replace: (target: string) => { steps.push(`replace ${target}`); },
      };
      await runInNewContext(script, {
        addEventListener: () => undefined,
        document: { getElementById: () => help },
        fetch: async (target: string, init: object) => {
          steps.push(`fetch ${target} ${JSON.stringify(init)} hash=${location.hash}`);
          return { ok: true, json: async () => body };
        },
        history: {
          replaceState: (_state: unknown, _title: string, target: string) => {
            location.hash = "";
            steps.push(`replaceState ${target}`);
          },
        },
        location,
      });
      return { help: help.hidden ? "hidden" : "shown", steps };
    };
    const sessionRequest = (headers: object) => `fetch /_agent-native/auth/session ${JSON.stringify({
      headers,
      credentials: "same-origin",
      cache: "no-store",
    })} hash=`;

    assert.deepEqual(await visit(`#${secret}`, signedIn), {
      help: "hidden",
      steps: ["replaceState /sign-in", sessionRequest({ "x-vivary-owner-sign-in": secret }), "replace /"],
    });
    assert.deepEqual(await visit(`#${secret}`, signedOut), {
      help: "shown",
      steps: ["replaceState /sign-in", sessionRequest({ "x-vivary-owner-sign-in": secret })],
    });
    assert.deepEqual(await visit(`#${secret.slice(1)}`, signedIn), {
      help: "shown",
      steps: ["replaceState /sign-in"],
    });
    assert.deepEqual(await visit("", signedIn), { help: "hidden", steps: [sessionRequest({}), "replace /"] });
    assert.deepEqual(await visit("", signedOut), { help: "shown", steps: [sessionRequest({})] });

    const steps: string[] = [];
    const help = { hidden: true };
    let body: object = signedOut;
    let onHashChange: (() => Promise<void>) | undefined;
    const location = {
      hash: "",
      pathname: "/sign-in",
      replace: (target: string) => { steps.push(`replace ${target}`); },
    };
    await runInNewContext(script, {
      addEventListener: (type: string, listener: () => Promise<void>) => {
        if (type === "hashchange") onHashChange = listener;
      },
      document: { getElementById: () => help },
      fetch: async (target: string, init: object) => {
        steps.push(`fetch ${target} ${JSON.stringify(init)} hash=${location.hash}`);
        return { ok: true, json: async () => body };
      },
      history: {
        replaceState: (_state: unknown, _title: string, target: string) => {
          location.hash = "";
          steps.push(`replaceState ${target}`);
        },
      },
      location,
    });
    assert.equal(help.hidden, false);
    assert.ok(onHashChange, "an address opened on the open sign-in page still signs in");
    location.hash = `#${secret}`;
    body = signedIn;
    await onHashChange();
    assert.deepEqual(steps, [
      sessionRequest({}),
      "replaceState /sign-in",
      sessionRequest({ "x-vivary-owner-sign-in": secret }),
      "replace /",
    ]);
  });

  describe("private proxy sign-in page storage", () => {
    const html = VIVARY_OWNER_SIGN_IN_HTML["private-proxy"];
    const key = VIVARY_OWNER_SESSION_STORAGE_KEY;
    const secret = "s".repeat(43);
    const signedOut = { error: "Not authenticated" };
    // Answers like the session resolver, which checks a known stored token before the one-time secret.
    const server = (known: string[], issued = "fresh-session-token") =>
      (headers: Record<string, string>): SessionAnswer => {
        const stored = headers["x-vivary-session"];
        if (stored !== undefined && known.includes(stored)) {
          return { email: VIVARY_LOCAL_OWNER_EMAIL, name: "Local owner", token: stored };
        }
        if (headers["x-vivary-owner-sign-in"] === secret) {
          return { email: VIVARY_LOCAL_OWNER_EMAIL, name: "Local owner", token: issued };
        }
        return signedOut;
      };

    it("stores the session token after a successful exchange", async () => {
      const storage = new Map<string, string>();
      const page = await openSignInPage(html, { hash: `#${secret}`, storage, answer: server([]) });
      assert.deepEqual(page.steps, [
        `session ${JSON.stringify({ "x-vivary-owner-sign-in": secret })}`,
        `set ${key} fresh-session-token`,
        "replace /",
      ]);
      assert.equal(page.help(), "hidden");
      assert.deepEqual([...storage], [[key, "fresh-session-token"]]);

      for (const issued of ["bad token", "bad\ntoken", "x".repeat(4097)]) {
        const unstored = new Map<string, string>();
        const malformed = await openSignInPage(html, { hash: `#${secret}`, storage: unstored, answer: server([], issued) });
        assert.equal(malformed.steps.at(-1), "replace /");
        assert.deepEqual([...unstored], [], "a malformed token is never stored");
      }
    });

    it("signs in with a stored token on a plain visit and sends it beside a secret", async () => {
      const storage = new Map([[key, "owner-session-token"]]);
      const plain = await openSignInPage(html, { storage, answer: server(["owner-session-token"]) });
      assert.deepEqual(plain.steps, [
        `session ${JSON.stringify({ "x-vivary-session": "owner-session-token" })}`,
        `set ${key} owner-session-token`,
        "replace /",
      ]);

      const withSecret = await openSignInPage(html, {
        hash: `#${secret}`,
        storage,
        answer: server(["owner-session-token"]),
      });
      assert.deepEqual(withSecret.steps, [
        `session ${JSON.stringify({ "x-vivary-session": "owner-session-token", "x-vivary-owner-sign-in": secret })}`,
        `set ${key} owner-session-token`,
        "replace /",
      ]);
      assert.deepEqual([...storage], [[key, "owner-session-token"]]);
    });

    it("forgets a stored token the server no longer knows", async () => {
      const storage = new Map([[key, "stale-session-token"]]);
      const page = await openSignInPage(html, { storage, answer: server([]) });
      assert.deepEqual(page.steps, [
        `session ${JSON.stringify({ "x-vivary-session": "stale-session-token" })}`,
        `remove ${key}`,
      ]);
      assert.equal(page.help(), "shown");
      assert.deepEqual([...storage], []);

      for (const malformed of ["bad token", "x".repeat(4097)]) {
        const unsent = await openSignInPage(html, { storage: new Map([[key, malformed]]), answer: server([]) });
        assert.deepEqual(unsent.steps, [`session ${JSON.stringify({})}`, `remove ${key}`]);
      }

      for (const failure of [new Error("offline"), 502]) {
        const kept = new Map([[key, "owner-session-token"]]);
        const page = await openSignInPage(html, { storage: kept, answer: () => failure });
        assert.equal(page.help(), "shown");
        assert.deepEqual([...kept], [[key, "owner-session-token"]], "a failed check keeps the stored token");
      }
    });

    it("still signs in when storage is blocked or failing", async () => {
      for (const storage of ["blocked", "failing"] as const) {
        const page = await openSignInPage(html, { hash: `#${secret}`, storage, answer: server([]) });
        assert.deepEqual(page.steps, [`session ${JSON.stringify({ "x-vivary-owner-sign-in": secret })}`, "replace /"]);
        assert.equal(page.help(), "hidden");

        const signedOutPage = await openSignInPage(html, { storage, answer: server([]) });
        assert.deepEqual(signedOutPage.steps, [`session ${JSON.stringify({})}`]);
        assert.equal(signedOutPage.help(), "shown");
      }
    });

    it("signs in from an address opened on the open page", async () => {
      const storage = new Map<string, string>();
      const page = await openSignInPage(html, { storage, answer: server([]) });
      assert.equal(page.help(), "shown");
      await page.openAddress(`#${secret}`);
      assert.deepEqual(page.steps, [
        `session ${JSON.stringify({})}`,
        `remove ${key}`,
        `session ${JSON.stringify({ "x-vivary-owner-sign-in": secret })}`,
        `set ${key} fresh-session-token`,
        "replace /",
      ]);
    });

    it("keeps the local page away from browser storage", async () => {
      for (const [hash, answer] of [
        ["", () => signedOut],
        ["", server(["owner-session-token"])],
        [`#${secret}`, server(["owner-session-token"])],
      ] as const) {
        const storage = new Map([[key, "owner-session-token"]]);
        const page = await openSignInPage(VIVARY_OWNER_SIGN_IN_HTML.local, { hash, storage, answer });
        await page.openAddress(`#${secret}`);
        assert.equal(page.storageReads(), 0);
        assert.ok(page.steps.every(step => !step.includes("x-vivary-session")));
        assert.deepEqual([...storage], [[key, "owner-session-token"]]);
      }
    });
  });
});

describe("Vivary local request boundary", () => {
  const config = resolveVivaryLocalAccessConfig(localEnvironment());
  assert.ok(config);

  it("accepts the configured raw loopback request", () => {
    assert.equal(localAccessRequestRejection(config, request()), null);
    assert.equal(
      localAccessRequestRejection(config, request({ peerAddress: "::ffff:127.0.0.1" })),
      null,
    );
  });

  it("rejects hostile peers, hosts, origins, proxy headers, and fetch sites", () => {
    const hostile: Array<[Partial<VivaryLocalAccessRequest>, string]> = [
      [{ peerAddress: "192.0.2.10" }, "non-loopback-peer"],
      [{ peerAddress: "127.not-an-address" }, "non-loopback-peer"],
      [{ peerAddress: "127.0.0.999" }, "non-loopback-peer"],
      [{ peerAddress: "::ffff:127.0.0.999" }, "non-loopback-peer"],
      [{ host: "attacker.example" }, "unexpected-host"],
      [{ host: "127.0.0.1:4318" }, "unexpected-host"],
      [{ origin: "https://attacker.example" }, "unexpected-origin"],
      [{ origin: "null" }, "unexpected-origin"],
      [{ forwardedProxyHeader: "x-forwarded-for" }, "forwarded-proxy-header"],
      [{ secFetchSite: "cross-site" }, "cross-site-request"],
      [{ secFetchSite: "same-site" }, "cross-site-request"],
    ];
    for (const [patch, reason] of hostile) {
      assert.equal(localAccessRequestRejection(config, request(patch)), reason);
    }
  });
});

describe("Vivary private proxy request boundary", () => {
  const config = resolveVivaryLocalAccessConfig(privateProxyEnvironment());
  assert.ok(config);

  it("accepts only canonical external or exact loopback-backend host shapes", () => {
    assert.equal(localAccessRequestRejection(config, privateProxyRequest()), null);
    assert.equal(
      localAccessRequestRejection(
        config,
        privateProxyRequest({
          forwardedHost: undefined,
          forwardedProto: undefined,
          host: "vivary.example.test",
        }),
      ),
      null,
    );
  });

  it("rejects foreign routing, origins, fetch sites, and proxy chains", () => {
    const hostile: Array<[Partial<VivaryLocalAccessRequest>, string]> = [
      [{ peerAddress: "192.0.2.20" }, "non-loopback-peer"],
      [{ host: "attacker.example" }, "unexpected-host"],
      [{ host: "127.0.0.1:4318" }, "unexpected-host"],
      [{ forwardedHost: undefined }, "unexpected-forwarded-host"],
      [{ forwardedHost: "attacker.example" }, "unexpected-forwarded-host"],
      [{ forwardedProto: undefined }, "unexpected-forwarded-proto"],
      [{ forwardedProto: "http" }, "unexpected-forwarded-proto"],
      [{ forwardedPort: "444" }, "unexpected-forwarded-port"],
      [{ origin: "https://attacker.example" }, "unexpected-origin"],
      [{ origin: "http://127.0.0.1:4317" }, "unexpected-origin"],
      [{ secFetchSite: "cross-site" }, "cross-site-request"],
      [{ forwardedProxyHeader: "forwarded" }, "unexpected-proxy-header"],
      [{ forwardedFor: "192.0.2.10, 127.0.0.1" }, "unexpected-proxy-chain"],
      [{ forwardedFor: "not-an-ip" }, "unexpected-proxy-chain"],
      [{ realIp: "192.0.2.11" }, "unexpected-proxy-chain"],
    ];
    for (const [patch, reason] of hostile) {
      assert.equal(
        localAccessRequestRejection(config, privateProxyRequest(patch)),
        reason,
      );
    }
  });
});

describe("Vivary local session provider", () => {
  const config = resolveVivaryLocalAccessConfig(localEnvironment());
  assert.ok(config);

  it("bootstraps on a safe page read and restores the persisted Native session", async () => {
    const fixture = sessionFixture();
    const signIn = ownerSignInFixture();
    const firstResolver = createVivaryLocalSessionResolver(config, fixture.dependencies, signIn.signIn);
    const firstSession = await firstResolver(event(request({ ownerSignIn: signIn.currentSecret() })));

    assert.equal(firstSession?.email, VIVARY_LOCAL_OWNER_EMAIL);
    assert.equal(firstSession?.token, fixture.cookies[0]);
    assert.deepEqual(fixture.persisted, [
      { email: VIVARY_LOCAL_OWNER_EMAIL, token: fixture.cookies[0] },
    ]);

    const restoredResolver = createVivaryLocalSessionResolver(config, {
      ...fixture.dependencies,
      createToken: () => {
        throw new Error("restored sessions must not mint another token");
      },
    });
    const restored = await restoredResolver(
      event(request({ method: "POST", origin: ORIGIN }), [fixture.cookies[0]]),
    );
    assert.deepEqual(restored, firstSession);
    assert.equal(fixture.persisted.length, 1);
  });

  it("does not create an identity for POST before the browser bootstrap", async () => {
    const fixture = sessionFixture();
    const resolver = createVivaryLocalSessionResolver(config, fixture.dependencies);
    const result = await resolver(event(request({ method: "POST", origin: ORIGIN })));

    assert.equal(result, null);
    assert.deepEqual(fixture.persisted, []);
    assert.deepEqual(fixture.cookies, []);
  });

  it("does not authenticate foreign sessions or bootstrap hostile requests", async () => {
    const fixture = sessionFixture([["foreign-token", "someone@example.test"]]);
    const resolver = createVivaryLocalSessionResolver(config, fixture.dependencies);

    assert.equal(await resolver(event(request(), ["foreign-token"])), null);
    assert.equal(
      await resolver(event(request({ origin: "https://attacker.example" }))),
      null,
    );
    assert.deepEqual(fixture.persisted, []);
    assert.deepEqual(fixture.cookies, []);
  });

  it("fails closed when persisted session lookup is unavailable", async () => {
    const fixture = sessionFixture();
    const resolver = createVivaryLocalSessionResolver(config, {
      ...fixture.dependencies,
      getSessionEmail: async () => {
        throw new Error("database unavailable");
      },
    });

    assert.equal(await resolver(event(request(), ["unreadable-token"])), null);
    assert.deepEqual(fixture.persisted, []);
  });
});

describe("Vivary private proxy session provider", () => {
  const config = resolveVivaryLocalAccessConfig(privateProxyEnvironment());
  assert.ok(config);

  it("bootstraps one reserved owner and restores only that Native session", async () => {
    const fixture = sessionFixture();
    const signIn = ownerSignInFixture(PRIVATE_ORIGIN);
    const resolver = createVivaryLocalSessionResolver(config, fixture.dependencies, signIn.signIn);
    const first = await resolver(event(privateProxyRequest({ ownerSignIn: signIn.currentSecret() })));

    assert.equal(first?.email, VIVARY_LOCAL_OWNER_EMAIL);
    assert.equal(fixture.persisted.length, 1);

    const restored = await resolver(
      event(
        privateProxyRequest({ method: "POST", origin: PRIVATE_ORIGIN }),
        [fixture.cookies[0]],
      ),
    );
    assert.deepEqual(restored, first);
    assert.equal(fixture.persisted.length, 1);
  });

  it("does not mint an owner on POST or accept a foreign Native session", async () => {
    const fixture = sessionFixture([["foreign-token", "someone@example.test"]]);
    const resolver = createVivaryLocalSessionResolver(config, fixture.dependencies);

    assert.equal(
      await resolver(event(privateProxyRequest({ method: "POST", origin: PRIVATE_ORIGIN }))),
      null,
    );
    assert.equal(
      await resolver(
        event(
          privateProxyRequest({ method: "POST", origin: PRIVATE_ORIGIN }),
          ["foreign-token"],
        ),
      ),
      null,
    );
    assert.deepEqual(fixture.persisted, []);
  });

  it("replaces a stale foreign cookie on a safe page read", async () => {
    const fixture = sessionFixture([["foreign-token", "someone@example.test"]]);
    const signIn = ownerSignInFixture(PRIVATE_ORIGIN);
    const resolver = createVivaryLocalSessionResolver(config, fixture.dependencies, signIn.signIn);

    const migrated = await resolver(
      event(
        privateProxyRequest({ ownerSignIn: signIn.currentSecret() }),
        ["invalid-token", "foreign-token"],
      ),
    );

    assert.equal(migrated?.email, VIVARY_LOCAL_OWNER_EMAIL);
    assert.equal(migrated?.token, fixture.cookies[0]);
    assert.deepEqual(fixture.persisted, [
      { email: VIVARY_LOCAL_OWNER_EMAIL, token: fixture.cookies[0] },
    ]);
  });
});


describe("Vivary owner session bootstrap secret", () => {
  // A local program, or another account on the same computer, can reach the
  // loopback port with the expected Host and no browser headers at all.
  const rawLocalProgram = { host: "127.0.0.1:4317", method: "GET", peerAddress: "127.0.0.1" };

  it("gives a loopback request with the expected Host, no Origin, and no secret no session", async () => {
    const config = resolveVivaryLocalAccessConfig(localEnvironment());
    assert.ok(config);
    const fixture = sessionFixture();
    const resolver = createVivaryLocalSessionResolver(config, fixture.dependencies);

    assert.equal(await resolver(event(rawLocalProgram)), null);
    assert.deepEqual(fixture.persisted, []);
    assert.deepEqual(fixture.cookies, []);
  });

  it("gives a private proxy backend request with no Origin and no secret no session", async () => {
    const config = resolveVivaryLocalAccessConfig(privateProxyEnvironment());
    assert.ok(config);
    const fixture = sessionFixture();
    const resolver = createVivaryLocalSessionResolver(config, fixture.dependencies);

    assert.equal(
      await resolver(event(privateProxyRequest({ origin: undefined, secFetchSite: undefined }))),
      null,
    );
    assert.deepEqual(fixture.persisted, []);
    assert.deepEqual(fixture.cookies, []);
  });

  for (const [mode, environment, makeRequest, origin] of [
    ["local", localEnvironment(), request, ORIGIN],
    ["private proxy", privateProxyEnvironment(), privateProxyRequest, PRIVATE_ORIGIN],
  ] as const) {
    it(`creates one session per saved address in ${mode} mode`, async () => {
      const config = resolveVivaryLocalAccessConfig(environment);
      assert.ok(config);
      const fixture = sessionFixture();
      const signIn = ownerSignInFixture(origin);
      const resolver = createVivaryLocalSessionResolver(config, fixture.dependencies, signIn.signIn);
      const secret = signIn.currentSecret();
      assert.match(secret, /^[\w-]{43}$/);

      for (const ownerSignIn of ["x".repeat(43), secret.slice(1), `${secret}=`, ` ${secret}`, ""]) {
        assert.equal(await resolver(event(makeRequest({ ownerSignIn }))), null);
      }
      assert.equal(signIn.saved.length, 1);

      assert.equal((await resolver(event(makeRequest({ ownerSignIn: secret }))))?.email, VIVARY_LOCAL_OWNER_EMAIL);
      assert.equal(await resolver(event(makeRequest({ ownerSignIn: secret }))), null);
      assert.equal(signIn.saved.length, 2);
      assert.notEqual(signIn.currentSecret(), secret);
      assert.equal(signIn.saved[1], `${origin}/sign-in#${signIn.currentSecret()}\n`);

      const next = await resolver(event(makeRequest({ ownerSignIn: signIn.currentSecret() })));
      assert.equal(next?.email, VIVARY_LOCAL_OWNER_EMAIL);
      assert.equal(fixture.persisted.length, 2);
    });
  }

  it("never spends the secret on a refused, write, or already signed-in request", async () => {
    const config = resolveVivaryLocalAccessConfig(localEnvironment());
    assert.ok(config);
    const fixture = sessionFixture([
      ["owner-token", VIVARY_LOCAL_OWNER_EMAIL],
      ["foreign-token", "someone@example.test"],
    ]);
    const signIn = ownerSignInFixture();
    let redeemCalls = 0;
    const resolver = createVivaryLocalSessionResolver(config, fixture.dependencies, {
      redeem: (presented) => {
        redeemCalls++;
        return signIn.signIn.redeem(presented);
      },
    });
    const ownerSignIn = signIn.currentSecret();

    assert.equal(await resolver(event(request({ ownerSignIn, origin: "https://attacker.example" }))), null);
    assert.equal(await resolver(event(request({ ownerSignIn, method: "POST", origin: ORIGIN }))), null);
    assert.equal(await resolver(event(request({ ownerSignIn }), ["foreign-token"])), null);
    assert.deepEqual(await resolver(event(request({ ownerSignIn }), ["owner-token"])), {
      email: VIVARY_LOCAL_OWNER_EMAIL,
      name: "Local owner",
      token: "owner-token",
    });
    assert.equal(redeemCalls, 0);
    assert.equal(signIn.saved.length, 1);
    assert.deepEqual(fixture.persisted, []);

    assert.equal((await resolver(event(request({ ownerSignIn }))))?.email, VIVARY_LOCAL_OWNER_EMAIL);
    assert.equal(redeemCalls, 1);
  });

  it("lets only one of several concurrent requests spend a secret", async () => {
    const config = resolveVivaryLocalAccessConfig(localEnvironment());
    assert.ok(config);
    const fixture = sessionFixture();
    const signIn = ownerSignInFixture();
    const resolver = createVivaryLocalSessionResolver(config, fixture.dependencies, signIn.signIn);
    const ownerSignIn = signIn.currentSecret();

    const results = await Promise.all(
      Array.from({ length: 4 }, () => resolver(event(request({ ownerSignIn }), ["stale-token"]))),
    );
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(fixture.persisted.length, 1);
    assert.equal(signIn.saved.length, 2);
  });

  it("saves each address in an owner-only file and replaces it after use", async (t) => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "vivary-owner-sign-in-"));
    t.after(() => rm(dataDir, { recursive: true, force: true }));
    const file = path.join(dataDir, VIVARY_OWNER_SIGN_IN_FILE);
    const readSecret = async () => {
      const address = await readFile(file, "utf8");
      assert.match(address, /^http:\/\/127\.0\.0\.1:4317\/sign-in#[\w-]{43}\n$/);
      if (process.platform !== "win32") assert.equal((await stat(file)).mode & 0o777, 0o600);
      return address.trim().split("#")[1];
    };

    const signIn = createVivaryOwnerSignIn({ origin: ORIGIN, dataDir });
    const first = await readSecret();
    assert.equal(signIn.redeem(first), true);
    assert.notEqual(await readSecret(), first);
    assert.equal(signIn.redeem(first), false);
    assert.deepEqual(await readdir(dataDir), [VIVARY_OWNER_SIGN_IN_FILE]);
  });

  it("still signs in once when the next address cannot be saved, and logs no secret", (t) => {
    const output: string[] = [];
    t.mock.method(process.stderr, "write", (chunk: string) => {
      output.push(chunk);
      return true;
    });
    const saved: string[] = [];
    const signIn = createVivaryOwnerSignIn({
      origin: ORIGIN,
      dataDir: "/unused",
      saveFile: (_file, contents) => {
        if (saved.length > 0) throw new Error(`could not save ${contents}`);
        saved.push(contents);
      },
    });
    const secret = saved[0].trim().split("#")[1];

    assert.equal(signIn.redeem(secret), true);
    assert.equal(signIn.redeem(secret), false);
    assert.equal(output.length, 1);
    assert.match(output[0], /^\[vivary-local-access\] [^\n]+\n$/);
    assert.doesNotMatch(output[0], /sign-in#|127\.0\.0\.1/);
    assert.ok(!output[0].includes(secret));
  });
});

describe("Vivary session diagnostics", () => {
  it("is opt-in and reports only cookie presence and token counts", async (t) => {
    const config = resolveVivaryLocalAccessConfig(localEnvironment());
    assert.ok(config);
    const resolveSession = createVivaryLocalSessionResolver(config);
    const output: string[] = [];
    t.mock.method(process.stderr, "write", (chunk: string) => {
      output.push(chunk);
      return true;
    });
    const previous = process.env.VIVARY_SESSION_DIAGNOSTICS; // guard:allow-env-credential - Deployment diagnostic toggle, not a credential.
    const makeRequest = (cookie?: string) => new H3Event(Object.assign(
      new Request(`${ORIGIN}/_agent-native/application-state/selection`, {
        method: "PUT",
        headers: { host: "127.0.0.1:4317", origin: ORIGIN, ...(cookie === undefined ? {} : { cookie }) },
      }),
      { context: { clientAddress: "127.0.0.1" } },
    ));
    try {
      delete process.env.VIVARY_SESSION_DIAGNOSTICS; // guard:allow-env-credential - Deployment diagnostic toggle, not a credential.
      assert.equal(await resolveSession(makeRequest()), null);
      assert.equal(output.length, 0);
      process.env.VIVARY_SESSION_DIAGNOSTICS = "1"; // guard:allow-env-credential - Deployment diagnostic toggle, not a credential.
      for (const [cookie, expectedCookieNamePresent] of [
        [undefined, false],
        ["other=private-value", false],
        [`${COOKIE_NAME}x`, false],
        [`${COOKIE_NAME}=`, true],
      ] as const) {
        assert.equal(await resolveSession(makeRequest(cookie)), null);
        assert.deepEqual(JSON.parse(output.at(-1) ?? ""), {
          cookieHeaderPresent: cookie !== undefined,
          expectedCookieNamePresent,
          recognizedTokenCount: 0,
        });
      }
      assert.equal(output.length, 4);
      assert.ok(output.every(line => !line.includes("private-value")));
    } finally {
      if (previous === undefined) delete process.env.VIVARY_SESSION_DIAGNOSTICS; // guard:allow-env-credential - Deployment diagnostic toggle, not a credential.
      else process.env.VIVARY_SESSION_DIAGNOSTICS = previous; // guard:allow-env-credential - Deployment diagnostic toggle, not a credential.
    }
  });
});

describe("Vivary private state session header", () => {
  const config = resolveVivaryLocalAccessConfig(privateProxyEnvironment());
  const localConfig = resolveVivaryLocalAccessConfig(localEnvironment());
  assert.ok(config);
  assert.ok(localConfig);

  function stateEvent(
    path = "/_agent-native/application-state/project-selection",
    method = "PUT",
    patch: Record<string, string | undefined> = {},
  ): H3Event {
    const headers = new Headers({
      origin: PRIVATE_ORIGIN,
      "sec-fetch-site": "same-origin",
      "x-vivary-session": "owner-token",
    });
    for (const [name, value] of Object.entries(patch)) {
      if (value === undefined) headers.delete(name);
      else headers.set(name, value);
    }
    return new H3Event(new Request(PRIVATE_ORIGIN + path, { method, headers }));
  }

  it("reads the header on same-origin private state writes and no other write", () => {
    assert.deepEqual(readVivarySessionTokens(stateEvent(), config), ["owner-token"]);
    assert.deepEqual(readVivarySessionTokens(stateEvent(), localConfig), []);
    for (const method of ["POST", "PATCH", "DELETE"]) {
      assert.deepEqual(readVivarySessionTokens(stateEvent(undefined, method), config), []);
    }
    for (const path of [
      "/_agent-native/actions/run",
      "/_agent-native/application-state",
      "/_agent-native/application-state/",
      "/_agent-native/application-state/compose",
      "/_agent-native/application-state/nested/key",
      "/_agent-native/application-state/nested%2Fkey",
      "/_agent-native/application-state/%",
      "/_agent-native/application-state/has%20space",
    ]) {
      assert.deepEqual(readVivarySessionTokens(stateEvent(path), config), []);
    }
    for (const patch of [
      { origin: undefined },
      { origin: "https://other.example.test" },
      { "sec-fetch-site": undefined },
      { "sec-fetch-site": "none" },
      { "sec-fetch-site": "cross-site" },
      { "x-vivary-session": "" },
      { "x-vivary-session": "x".repeat(4097) },
    ]) {
      assert.deepEqual(readVivarySessionTokens(stateEvent(undefined, undefined, patch), config), []);
    }
  });

  it("accepts only named owner action POSTs through the same-origin boundary", () => {
    for (const name of VIVARY_OWNER_ACTIONS) {
      const route = "/_agent-native/actions/" + name;
      assert.deepEqual(readVivarySessionTokens(stateEvent(route, "POST"), config), ["owner-token"]);
      assert.deepEqual(readVivarySessionTokens(stateEvent(route, "POST"), localConfig), []);
      for (const method of ["PUT", "DELETE"]) {
        assert.deepEqual(readVivarySessionTokens(stateEvent(route, method), config), []);
      }
      for (const patch of [{ origin: undefined }, { origin: "https://other.example.test" },
        { "sec-fetch-site": "cross-site" }, { "sec-fetch-site": undefined }]) {
        assert.deepEqual(readVivarySessionTokens(stateEvent(route, "POST", patch), config), []);
      }
      assert.deepEqual(readVivarySessionTokens(stateEvent(route + "/extra", "POST"), config), []);
    }
    assert.deepEqual(readVivarySessionTokens(stateEvent("/_agent-native/actions/unrelated-action", "POST"), config), []);
  });

  it("reads the header on every same-origin private read and never in local or desktop mode", () => {
    const cookieOnlyConfigs: VivaryLocalAccessConfig[] = [localConfig, { ...localConfig, desktop: true }];
    for (const method of ["GET", "HEAD"]) {
      for (const path of [
        "/",
        "/_agent-native/auth/session",
        "/_agent-native/application-state/compose",
        "/_agent-native/actions/unrelated-action",
        "/projects/any/nested/path",
      ]) {
        const read = (patch: Record<string, string | undefined>, target: VivaryLocalAccessConfig = config) =>
          readVivarySessionTokens(stateEvent(path, method, patch), target);
        assert.deepEqual(read({}), ["owner-token"]);
        assert.deepEqual(read({ origin: undefined }), ["owner-token"]);
        assert.deepEqual(read({ "x-vivary-session": "x".repeat(4096) }), ["x".repeat(4096)]);
        for (const patch of [
          { origin: "https://other.example.test" },
          { origin: "null" },
          { "sec-fetch-site": "cross-site" },
          { "sec-fetch-site": "same-site" },
          { "sec-fetch-site": "none" },
          { "sec-fetch-site": undefined },
          { "x-vivary-session": "" },
          { "x-vivary-session": "x".repeat(4097) },
        ]) {
          assert.deepEqual(read(patch), [], `${method} ${path} ${JSON.stringify(patch)}`);
        }
        for (const target of cookieOnlyConfigs) {
          for (const origin of [ORIGIN, undefined]) {
            assert.deepEqual(read({ origin }, target), []);
          }
        }
      }
    }
  });

  it("preserves cookie sessions and deduplicates matching header tokens", () => {
    const value = stateEvent(undefined, undefined, { cookie: `${COOKIE_NAME}=owner-token` });
    assert.deepEqual(readVivarySessionTokens(value, config), ["owner-token"]);
    assert.deepEqual(readVivarySessionTokens(value, localConfig), ["owner-token"]);
    const read = stateEvent("/", "GET", { cookie: `${COOKIE_NAME}=owner-token` });
    assert.deepEqual(readVivarySessionTokens(read, config), ["owner-token"]);
    const other = stateEvent("/", "GET", { cookie: `${COOKIE_NAME}=cookie-token` });
    assert.deepEqual(readVivarySessionTokens(other, config), ["cookie-token", "owner-token"]);
    assert.deepEqual(readVivarySessionTokens(other, localConfig), ["cookie-token"]);
  });

  it("resolves the owner from a read header before it spends a sign-in secret", async () => {
    for (const method of ["GET", "HEAD"]) {
      const fixture = sessionFixture([["owner-token", VIVARY_LOCAL_OWNER_EMAIL]]);
      const signIn = ownerSignInFixture(PRIVATE_ORIGIN);
      let redeemCalls = 0;
      const resolver = createVivaryLocalSessionResolver(config, {
        ...fixture.dependencies,
        readRequest: () => privateProxyRequest({ method, ownerSignIn: signIn.currentSecret() }),
        readSessionTokens: readVivarySessionTokens,
      }, {
        redeem: (presented) => {
          redeemCalls++;
          return signIn.signIn.redeem(presented);
        },
      });
      const sessionRead = (patch: Record<string, string | undefined> = {}) =>
        stateEvent("/_agent-native/auth/session", method, { origin: undefined, ...patch });

      assert.deepEqual(await resolver(sessionRead()), {
        email: VIVARY_LOCAL_OWNER_EMAIL,
        name: "Local owner",
        token: "owner-token",
      });
      assert.equal(redeemCalls, 0);
      assert.equal(signIn.saved.length, 1);
      assert.deepEqual(fixture.persisted, []);
      assert.deepEqual(fixture.cookies, []);

      const replaced = await resolver(sessionRead({ "x-vivary-session": "stale-token" }));
      assert.equal(replaced?.email, VIVARY_LOCAL_OWNER_EMAIL);
      assert.notEqual(replaced?.token, "owner-token");
      assert.equal(redeemCalls, 1, "an unknown header token falls through to the secret");
      assert.equal(fixture.persisted.length, 1);
    }
  });

  it("requires an existing reserved-owner session and never mints on a write", async () => {
    for (const email of [VIVARY_LOCAL_OWNER_EMAIL, "foreign@example.test", null]) {
      const fixture = sessionFixture(email ? [["owner-token", email]] : []);
      const resolver = createVivaryLocalSessionResolver(config, {
        ...fixture.dependencies,
        readRequest: () => privateProxyRequest({ method: "PUT", origin: PRIVATE_ORIGIN }),
        readSessionTokens: readVivarySessionTokens,
      });
      const result = await resolver(stateEvent());
      assert.equal(result?.email ?? null, email === VIVARY_LOCAL_OWNER_EMAIL ? email : null);
      assert.deepEqual(fixture.persisted, []);
      assert.deepEqual(fixture.cookies, []);
    }
  });

  it("rejects before token lookup when the request boundary fails", async () => {
    for (const patch of [
      { peerAddress: "192.0.2.20" },
      { host: "attacker.example.test" },
      { forwardedHost: "attacker.example.test" },
      { origin: "https://attacker.example.test" },
      { secFetchSite: "cross-site" },
    ]) {
      let lookups = 0;
      const fixture = sessionFixture();
      const resolver = createVivaryLocalSessionResolver(config, {
        ...fixture.dependencies,
        readRequest: () => privateProxyRequest({ method: "PUT", origin: PRIVATE_ORIGIN, ...patch }),
        readSessionTokens: readVivarySessionTokens,
        getSessionEmail: async () => { lookups++; return VIVARY_LOCAL_OWNER_EMAIL; },
      });
      assert.equal(await resolver(stateEvent()), null);
      assert.equal(lookups, 0);
      assert.deepEqual(fixture.persisted, []);
    }
  });

  it("fails closed when a header token lookup fails", async () => {
    const fixture = sessionFixture();
    const resolver = createVivaryLocalSessionResolver(config, {
      ...fixture.dependencies,
      readRequest: () => privateProxyRequest({ method: "PUT", origin: PRIVATE_ORIGIN }),
      readSessionTokens: readVivarySessionTokens,
      getSessionEmail: async () => { throw new Error("unavailable"); },
    });
    assert.equal(await resolver(stateEvent()), null);
    assert.deepEqual(fixture.persisted, []);
    assert.deepEqual(fixture.cookies, []);
  });
});

describe('desktop listener admission', () => {
  it('does not bootstrap an apparent loopback request without desktop admission', async () => {
    const config = resolveVivaryLocalAccessConfig(localEnvironment());
    assert.ok(config);
    const fixture = sessionFixture();
    const resolver = createVivaryLocalSessionResolver({ ...config, desktop: true }, fixture.dependencies);
    assert.equal(await resolver(event(request())), null);
    assert.equal(fixture.persisted.length, 0);
  });

  it('bootstraps with desktop admission and never spends a sign-in secret', async () => {
    const config = resolveVivaryLocalAccessConfig(localEnvironment());
    assert.ok(config);
    const fixture = sessionFixture();
    let redeemCalls = 0;
    const resolver = createVivaryLocalSessionResolver({ ...config, desktop: true }, fixture.dependencies, {
      redeem: () => {
        redeemCalls++;
        return true;
      },
    });
    const presented = request({ ownerSignIn: 's'.repeat(43) });

    assert.equal(await resolver(event(presented)), null);
    const admitted = Object.assign(event(presented), { context: {} });
    admitBrowserContext(admitted.context, { kind: 'desktop' });
    assert.equal((await resolver(admitted))?.email, VIVARY_LOCAL_OWNER_EMAIL);
    assert.equal(redeemCalls, 0);
    assert.equal(fixture.persisted.length, 1);
  });
});
