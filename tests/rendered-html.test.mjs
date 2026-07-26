import assert from "node:assert/strict";
import test from "node:test";

const runtimeEnv = {
  ASSETS: {
    fetch: async () => new Response("Not found", { status: 404 }),
  },
};

const executionContext = {
  waitUntil() {},
  passThroughOnException() {},
};

async function loadWorker(label) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${label}-${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker;
}

test("renders Morphly production metadata", async () => {
  const worker = await loadWorker("metadata");

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    runtimeEnv,
    executionContext,
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, /<title>Morphly — AI video, directed by you<\/title>/i);
  assert.match(
    html,
    /<meta(?=[^>]*\bname=["']description["'])(?=[^>]*\bcontent=["']Create cinematic AI video from text, images, or footage with Morphly and LTX 2\.3\.["'])[^>]*>/i,
  );
});

test("admin routes fail closed without a verified administrator session", async () => {
  const worker = await loadWorker("admin-security");

  const adminResponse = await worker.fetch(
    new Request("http://localhost/admin", {
      headers: { accept: "text/html" },
      redirect: "manual",
    }),
    runtimeEnv,
    executionContext,
  );

  assert.ok(
    [302, 303, 307, 308].includes(adminResponse.status),
    `expected an admin redirect, received ${adminResponse.status}`,
  );
  assert.match(
    adminResponse.headers.get("location") ?? "",
    /\/admin\/login\?reason=/,
  );

  const loginResponse = await worker.fetch(
    new Request("http://localhost/admin/login", {
      headers: { accept: "text/html" },
    }),
    runtimeEnv,
    executionContext,
  );
  assert.equal(loginResponse.status, 200);
  assert.match(await loginResponse.text(), /Administrator sign in/i);

  const sessionResponse = await worker.fetch(
    new Request("http://localhost/api/admin/session"),
    runtimeEnv,
    executionContext,
  );
  assert.notEqual(sessionResponse.status, 200);
  assert.equal((await sessionResponse.json()).authorized, false);
});
