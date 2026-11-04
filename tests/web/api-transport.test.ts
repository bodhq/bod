import { client } from "@bod/api-client/client.gen";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getMe, login } from "@/core/auth/api";

beforeEach(() => client.setConfig({ baseUrl: "http://api:8000" }));
afterEach(() => {
  client.setConfig({ baseUrl: "" });
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
