import { describe, expect, it } from "vitest";
import { authReturnTo } from "./authRedirect";

describe("post-auth destinations", () => {
  it("preserves the complete internal deep link", () => {
    expect(
      authReturnTo({
        from: {
          pathname: "/tournaments/t/auction/a/live",
          search: "?view=compact",
          hash: "#squad",
        },
      }),
    ).toBe("/tournaments/t/auction/a/live?view=compact#squad");
  });
  it.each([
    null,
    undefined,
    "https://example.com",
    {},
    { from: null },
    { from: { pathname: "https://example.com" } },
    { from: { pathname: "//example.com" } },
    { from: { pathname: "/\\example.com" } },
    { from: { pathname: "/bad\npath" } },
    { from: { pathname: "/login" } },
    { from: { pathname: "/register" } },
    { from: { pathname: "/reset-password/token" } },
  ])("ignores malformed, external or auth-loop destinations: %j", (state) => {
    expect(authReturnTo(state, "/admin/dashboard")).toBe("/admin/dashboard");
  });
  it("ignores malformed optional query and hash values", () => {
    expect(
      authReturnTo({
        from: {
          pathname: "/dashboard",
          search: "https://example.com",
          hash: {},
        },
      }),
    ).toBe("/dashboard");
  });
});
