import { describe, expect, it } from "vitest";

import { loginSchema } from "@/core/auth/validations";

describe("loginSchema", () => {
  it("normalizes usernames the same way as the API", () => {
    expect(loginSchema.parse({ username: "  EliAS.Jan  ", password: "heslo" })).toEqual({
      username: "elias.jan",
      password: "heslo",
    });
  });

  it("requires both credentials", () => {
    expect(loginSchema.safeParse({ username: "student" }).success).toBe(false);
    expect(loginSchema.safeParse({ username: "student", password: "" }).success).toBe(false);
  });
});
