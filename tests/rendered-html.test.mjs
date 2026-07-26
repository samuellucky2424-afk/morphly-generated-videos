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
  assert.match(
    html,
    /<title>Morphly — AI Video Generation Powered by LTX 2\.3<\/title>/i,
  );
  assert.match(
    html,
    /<meta(?=[^>]*\bname=["']description["'])(?=[^>]*\bcontent=["']Create cinematic videos from text, images and existing footage with Morphly’s LTX 2\.3-powered creative studio\.["'])[^>]*>/i,
  );
  assert.match(html, /rel=["']canonical["']/i);
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

  const protectedAdminRequests = [
    new Request("http://localhost/api/admin/users?query=user@example.com"),
    new Request("http://localhost/api/admin/credits", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "00000000-0000-4000-8000-000000000000",
        amount: 100,
        reason: "Account adjustment",
        requestId: "00000000-0000-4000-8000-000000000001",
      }),
    }),
  ];

  for (const request of protectedAdminRequests) {
    const response = await worker.fetch(request, runtimeEnv, executionContext);
    assert.ok(
      [401, 403].includes(response.status),
      `${new URL(request.url).pathname} should reject an anonymous request`,
    );
    assert.equal(typeof (await response.json()).error, "string");
  }
});

test("authenticated product APIs return 401 instead of 500 without a session", async () => {
  const worker = await loadWorker("product-auth");
  const resourceId = "00000000-0000-4000-8000-000000000000";
  const requests = [
    new Request("http://localhost/api/wallet"),
    new Request("http://localhost/api/wallet/transactions"),
    new Request("http://localhost/api/generation/jobs"),
    new Request("http://localhost/api/generation/jobs", { method: "POST" }),
    new Request(`http://localhost/api/generation/jobs/${resourceId}`, {
      method: "DELETE",
    }),
    new Request(`http://localhost/api/generation/jobs/${resourceId}/cancel`, {
      method: "POST",
    }),
    new Request("http://localhost/api/assets"),
    new Request("http://localhost/api/assets", { method: "POST" }),
    new Request(`http://localhost/api/assets/${resourceId}`, {
      method: "DELETE",
    }),
    new Request(`http://localhost/api/assets/${resourceId}/complete`, {
      method: "POST",
    }),
    new Request("http://localhost/api/profile"),
    new Request("http://localhost/api/profile", { method: "PATCH" }),
    new Request("http://localhost/api/notifications"),
    new Request("http://localhost/api/notifications", { method: "PATCH" }),
    new Request("http://localhost/api/auth/bootstrap", { method: "POST" }),
  ];

  for (const request of requests) {
    const response = await worker.fetch(request, runtimeEnv, executionContext);
    assert.equal(
      response.status,
      401,
      `${new URL(request.url).pathname} should reject an anonymous request`,
    );
    const payload = await response.json();
    assert.equal(typeof payload.error, "string");
  }
});
