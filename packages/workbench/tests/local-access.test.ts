import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { H3Event } from "h3";
import { COOKIE_NAME } from "@agent-native/core/server";

import {
  createVivaryLocalAuthOptions,
  createVivaryLocalSessionResolver,
  localAccessRequestRejection,
  resolveVivaryLocalAccessConfig,
  VIVARY_LOCAL_OWNER_EMAIL,
  type VivaryLocalAccessRequest,
  type VivaryLocalAccessSessionDependencies,
} from "../server/local-access.ts";

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

describe("Vivary local access configuration", () => {
  it("leaves unset and explicit hosted modes to Native's default auth plugin", () => {
    for (const environment of [
      { NODE_ENV: "production" },
      { NODE_ENV: "production", VIVARY_ACCESS_MODE: "hosted" },
    ]) {
      assert.equal(resolveVivaryLocalAccessConfig(environment), null);
      assert.equal(createVivaryLocalAuthOptions(environment), null);
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

  it("replaces Native credential pages with the agent route in both self-hosted modes", () => {
    for (const environment of [localEnvironment(), privateProxyEnvironment()]) {
      const options = createVivaryLocalAuthOptions(environment);
      assert.ok(options);
      assert.equal(options.rootAuth, false);
      assert.match(options.loginHtml ?? "", /url=\/agent/);
      assert.match(options.loginHtml ?? "", /location\.replace\("\/agent"\)/);
      assert.doesNotMatch(options.loginHtml ?? "", /email|password|signup/i);
    }
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
    const firstResolver = createVivaryLocalSessionResolver(config, fixture.dependencies);
    const firstSession = await firstResolver(event(request()));

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
    const resolver = createVivaryLocalSessionResolver(config, fixture.dependencies);
    const first = await resolver(event(privateProxyRequest()));

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
    const resolver = createVivaryLocalSessionResolver(config, fixture.dependencies);

    const migrated = await resolver(
      event(privateProxyRequest(), ["invalid-token", "foreign-token"]),
    );

    assert.equal(migrated?.email, VIVARY_LOCAL_OWNER_EMAIL);
    assert.equal(migrated?.token, fixture.cookies[0]);
    assert.deepEqual(fixture.persisted, [
      { email: VIVARY_LOCAL_OWNER_EMAIL, token: fixture.cookies[0] },
    ]);
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
    const previous = process.env.VIVARY_SESSION_DIAGNOSTICS;
    const makeRequest = (cookie?: string) => new H3Event(Object.assign(
      new Request(`${ORIGIN}/_agent-native/application-state/selection`, {
        method: "PUT",
        headers: { host: "127.0.0.1:4317", origin: ORIGIN, ...(cookie === undefined ? {} : { cookie }) },
      }),
      { context: { clientAddress: "127.0.0.1" } },
    ));
    try {
      delete process.env.VIVARY_SESSION_DIAGNOSTICS;
      assert.equal(await resolveSession(makeRequest()), null);
      assert.equal(output.length, 0);
      process.env.VIVARY_SESSION_DIAGNOSTICS = "1";
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
      if (previous === undefined) delete process.env.VIVARY_SESSION_DIAGNOSTICS;
      else process.env.VIVARY_SESSION_DIAGNOSTICS = previous;
    }
  });
});
