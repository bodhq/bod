import { describe, expect, it } from "vitest";

import { parseApiError } from "@/core/api/api-errors";

describe("parseApiError", () => {
  it("uses the backend message and preserves its error code", () => {
    const error = parseApiError({
      error: {
        code: "AUTH_UNAUTHENTICATED",
        message: "Backend session expired",
      },
    }) as Error & { code?: string };

    expect(error.message).toBe("Backend session expired");
    expect(error.code).toBe("AUTH_UNAUTHENTICATED");
  });

  it("preserves HTTP status for global authentication handling", () => {
    const error = parseApiError({
      error: {
        code: "AUTH_UNAUTHENTICATED",
        message: "Authentication is required",
      },
      response: { status: 401 },
    }) as Error & { status?: number };

    expect(error.status).toBe(401);
  });

  it("includes backend validation details with their field locations", () => {
    const error = parseApiError({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: [
          {
            location: ["body", "username"],
            message: "String should match pattern",
            type: "string_pattern_mismatch",
          },
        ],
      },
    }) as Error & { code?: string };

    expect(error.message).toBe("Request validation failed — username: String should match pattern");
    expect(error.code).toBe("VALIDATION_ERROR");
  });
});
