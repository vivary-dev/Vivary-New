import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { waitForWorkspace } from "../bin/desktop-server.mjs";
import { startupOptions } from "../bin/start.mjs";

test("local startup stays on this computer despite a hosted environment", () => {
  const options = startupOptions(["--port", "4317", "--data-dir", "/tmp/vivary-test"], {
    APP_URL: "https://unrelated.example.test",
  });
  assert.equal(options.mode, "local");
  assert.equal(options.appUrl, "http://127.0.0.1:4317");
  assert.equal(options.port, 4317);
  assert.equal(startupOptions(["--port", "80"], {}).appUrl, "http://127.0.0.1");
});

test("hosted startup requires a persistent directory and exact HTTPS origin", () => {
  const options = startupOptions(["--hosted", "--port", "57861"], {
    VIVARY_DATA_DIR: "/tmp/vivary-host-test",
    APP_URL: "https://vivary.example.test",
  });
  assert.equal(options.mode, "hosted");
  assert.equal(options.appUrl, "https://vivary.example.test");
  assert.throws(() => startupOptions(["--hosted"], {}), /data-dir/);
  assert.throws(() => startupOptions(["--hosted", "--data-dir", "/tmp/vivary-test"], {}), /APP_URL/);
  for (const url of ["http://vivary.example.test", "https://vivary.example.test/path", "https://user:secret@vivary.example.test"]) {
    assert.throws(() => startupOptions(["--hosted", "--data-dir", "/tmp/vivary-test", "--url", url], {}), /HTTPS origin/);
  }
});

test("invalid ports and local external URLs fail before touching runtime data", () => {
  for (const port of ["0", "65536", "5173evil"]) {
    assert.throws(() => startupOptions(["--port", port], {}), /port/);
  }
  assert.throws(() => startupOptions(["--url", "https://example.test"], {}), /only used with --hosted/);
});


test("private Zo startup requires its explicit access boundary and DNS origin", () => {
  const env = {
    VIVARY_TRUSTED_PROXY: "zo-owner-only",
    VIVARY_DATA_DIR: "/tmp/vivary-private-test",
    APP_URL: "https://vivary.example.test",
  };
  const options = startupOptions(["--private-proxy", "--port", "57861"], env);
  assert.equal(options.mode, "private-proxy");
  assert.equal(options.appUrl, env.APP_URL);
  assert.throws(() => startupOptions(["--private-proxy"], {}), /VIVARY_TRUSTED_PROXY/);
  assert.throws(() => startupOptions(["--private-proxy", "--hosted"], env), /not both/);
  for (const url of ["https://10.0.0.2", "https://[2001:db8::1]"]) {
    assert.throws(() => startupOptions(["--private-proxy", "--url", url], env), /DNS hostname/);
  }
});

test("desktop readiness opens the unified workspace without depending on its legacy redirect", async () => {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push(request.url);
    if (request.url === "/") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<!doctype html><title>Vivary</title>");
    } else {
      response.writeHead(302, { location: "/" });
      response.end();
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    await waitForWorkspace(`http://127.0.0.1:${server.address().port}`);
    assert.deepEqual(requests, ["/"]);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
