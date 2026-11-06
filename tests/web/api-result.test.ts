import { describe, expect, it } from "vitest";

import { apiData, apiVoid } from "@/core/api/result";

describe("SDK result handling", () => {
  it("accepts an empty success for commands but rejects it for required data", () => {
    const result = { data: {}, response: new Response(null, { status: 204 }) };
    expect(() => apiVoid(result)).not.toThrow();
    expect(() => apiData(result)).toThrow("Server nevrátil očekávaná data.");
  });

  it("does not substitute a successful response without data with an empty list", () => {
    expect(() => apiData({ response: new Response(null) })).toThrow();
    expect(apiData({ data: [], response: Response.json([]) })).toEqual([]);
  });

  it.each([false, 0, ""])("keeps a legitimate falsy data value: %j", (data) => {
    expect(apiData({ data, response: Response.json(data) })).toBe(data);
  });

  it("rejects an unsuccessful response even when its error payload is missing", () => {
    try {
      apiVoid({ response: new Response(null, { status: 503 }) });
      throw new Error("Expected failure");
    } catch (error) {
      expect(error).toMatchObject({ status: 503 });
    }
  });

  it("uses the HTTP response status over a status embedded in an error payload", () => {
    try {
      apiVoid({
        error: { status: 200, error: { code: "AUTH_UNAUTHENTICATED" } },
        response: new Response(null, { status: 401 }),
      });
      throw new Error("Expected failure");
    } catch (error) {
      expect(error).toMatchObject({ status: 401, code: "AUTH_UNAUTHENTICATED" });
    }
  });
});
