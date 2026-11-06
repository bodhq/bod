import { Blob } from "node:buffer";

import { client as generatedClient } from "@bod/api-client/client.gen";
import { uploadMyAvatarApiV1UsersMeAvatarPut } from "@bod/api-client/sdk.gen";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/core/api/client";
import { getMe, login, revokeSession } from "@/core/auth/api";

beforeEach(() => apiClient.setConfig({ baseUrl: "http://api:8000" }));
afterEach(() => {
  apiClient.setConfig({ baseUrl: "" });
  vi.unstubAllGlobals();
});

describe("generated API client transport", () => {
  it("forwards the SSR session cookie and refresh policy to the API", async () => {
    let forwarded: Request | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        forwarded = new Request(input, init);
        return Response.json({ id: "test-user" });
      }),
    );

    await getMe({
      baseUrl: "http://api:8000",
      headers: { Cookie: "session_id=test-token", "X-Session-Refresh": "skip" },
    });

    expect(forwarded?.url).toBe("http://api:8000/api/v1/auth/me");
    expect(forwarded?.headers.get("Cookie")).toBe("session_id=test-token");
    expect(forwarded?.headers.get("X-Session-Refresh")).toBe("skip");
  });

  it("keeps a generated POST body and sends the mutation header", async () => {
    let forwarded: Request | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        forwarded = new Request(input, init);
        return Response.json({ id: "test-user" });
      }),
    );

    await login("test.user", "test-password");

    expect(forwarded?.method).toBe("POST");
    expect(forwarded?.headers.get("X-Requested-With")).toBe("bod");
    expect(await forwarded?.json()).toEqual({
      username: "test.user",
      password: "test-password",
    });
  });
});

describe("API result regressions", () => {
  it("keeps the HTTP status alongside the backend error code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: { code: "DATABASE_UNAVAILABLE", message: "Database temporarily unavailable" },
          },
          { status: 503 },
        ),
      ),
    );

    await expect(getMe()).rejects.toMatchObject({
      status: 503,
      code: "DATABASE_UNAVAILABLE",
      message: "Database temporarily unavailable",
    });
  });

  it("rejects a no-content response when user data is required", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(getMe()).rejects.toThrow();
  });

  it("accepts a no-content response when deleting a session", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(revokeSession("expired-session")).resolves.toBeUndefined();
  });

  it("preserves cancellation instead of turning it into a server error", async () => {
    const cancellation = new DOMException("Request cancelled", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(cancellation));
    await expect(getMe()).rejects.toBe(cancellation);
  });

  it("preserves the original network failure as the cause", async () => {
    const failure = new TypeError("fetch failed");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(failure));
    await expect(getMe()).rejects.toMatchObject({ cause: failure });
  });
});

it("keeps concurrent SSR cookies and internal URLs scoped to their own requests", async () => {
  const forwarded: Request[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      forwarded.push(request);
      await Promise.resolve();
      return Response.json({ id: request.headers.get("Cookie") });
    }),
  );

  const users = await Promise.all([
    getMe({ baseUrl: "http://school-one:8000", headers: { Cookie: "session_id=one" } }),
    getMe({ baseUrl: "http://school-two:8000", headers: { Cookie: "session_id=two" } }),
    getMe(),
  ]);

  expect(forwarded.map((request) => [request.url, request.headers.get("Cookie")])).toEqual([
    ["http://school-one:8000/api/v1/auth/me", "session_id=one"],
    ["http://school-two:8000/api/v1/auth/me", "session_id=two"],
    ["http://api:8000/api/v1/auth/me", null],
  ]);
  expect(users.map((user) => user.id)).toEqual(["session_id=one", "session_id=two", null]);
  expect(apiClient.getConfig().baseUrl).toBe("http://api:8000");
  expect(new Headers(apiClient.getConfig().headers as HeadersInit).has("Cookie")).toBe(false);
});

it("does not depend on the generated default client's mutable configuration", async () => {
  const previousBaseUrl = generatedClient.getConfig().baseUrl;
  generatedClient.setConfig({ baseUrl: "http://unrelated:8000" });
  let forwarded: Request | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      forwarded = new Request(input, init);
      return Response.json({ id: "user" });
    }),
  );
  try {
    await getMe();
    expect(forwarded?.url).toBe("http://api:8000/api/v1/auth/me");
  } finally {
    generatedClient.setConfig({ baseUrl: previousBaseUrl });
  }
});

it.each([
  "GET",
  "HEAD",
  "OPTIONS",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
] as const)("preserves the SDK's %s method and applies the mutation policy", async (method) => {
  let forwarded: Request | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      forwarded = new Request(input, init);
      return new Response(null, { status: 204 });
    }),
  );
  await apiClient.request({ url: "/api/v1/example", method });
  expect(forwarded?.method).toBe(method);
  expect(forwarded?.credentials).toBe("include");
  expect(forwarded?.cache).toBe("no-store");
  expect(forwarded?.headers.get("X-Requested-With")).toBe(
    ["GET", "HEAD", "OPTIONS"].includes(method) ? null : "bod",
  );
});

it("keeps the binary upload body and its content type", async () => {
  const bytes = new Uint8Array([137, 80, 78, 71, 0, 255]);
  let forwarded: Request | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      forwarded = new Request(input, init);
      return Response.json({ id: "user" });
    }),
  );
  await uploadMyAvatarApiV1UsersMeAvatarPut({
    client: apiClient,
    body: new Blob([bytes], { type: "image/png" }),
    headers: { "Content-Type": "image/png" },
  });
  expect(forwarded?.headers.get("Content-Type")).toBe("image/png");
  expect(forwarded?.headers.get("X-Requested-With")).toBe("bod");
  if (!forwarded) throw new Error("Upload did not reach fetch");
  expect(new Uint8Array(await forwarded.arrayBuffer())).toEqual(bytes);
});

it("passes an AbortSignal to fetch and propagates its custom cancellation reason", async () => {
  const controller = new AbortController();
  const reason = new Error("Navigation cancelled the request");
  controller.abort(reason);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      expect(request.signal.aborted).toBe(true);
      throw request.signal.reason;
    }),
  );
  await expect(getMe({ signal: controller.signal })).rejects.toBe(reason);
});

it("keeps a gateway's HTTP status without exposing its HTML response", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response("<html>Bad gateway</html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      }),
    ),
  );
  await expect(getMe()).rejects.toMatchObject({
    status: 502,
    message: "Neočekávaná chyba při komunikaci se serverem.",
  });
});

it("reports malformed success JSON as an error with its parsing cause", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response("{", {
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
  await expect(getMe()).rejects.toMatchObject({ status: 200, cause: expect.any(SyntaxError) });
});
