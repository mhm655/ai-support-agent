import { afterEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();

// api.ts imports the real supabase client module at load time, which would
// otherwise construct a real supabase-js client from env vars. Mocking the
// module keeps this test fully offline and focused on apiFetch's own logic
// (attaching the JWT, throwing ApiError on non-2xx) rather than supabase-js.
vi.mock("@/lib/supabase/client", () => ({
  supabase: { auth: { getSession } },
}));

const { apiFetch, ApiError } = await import("./api");

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  getSession.mockReset();
});

describe("apiFetch", () => {
  it("throws ApiError(401) when there is no active session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    await expect(apiFetch("/businesses/me")).rejects.toMatchObject({
      status: 401,
    });
  });

  it("attaches the session's access token as a Bearer header", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "token-123" } } });
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "biz-1" }) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiFetch<{ id: string }>("/businesses/me");

    expect(result).toEqual({ id: "biz-1" });
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer token-123");
  });

  it("throws ApiError with the server's detail message on non-2xx", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "token-123" } } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ detail: "No business found for this account" }),
      })
    );

    await expect(apiFetch("/businesses/me")).rejects.toThrow(
      "No business found for this account"
    );
  });

  it("falls back to a generic message when the error body isn't JSON", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "token-123" } } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("not json");
        },
      })
    );

    await expect(apiFetch("/businesses/me")).rejects.toThrow("Request failed (500)");
  });

  it("returns undefined for a 204 No Content response", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "token-123" } } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204 }));

    const result = await apiFetch("/businesses/me", { method: "DELETE" });
    expect(result).toBeUndefined();
  });

  it("ApiError carries both status and message", () => {
    const err = new ApiError(403, "Forbidden");
    expect(err.status).toBe(403);
    expect(err.message).toBe("Forbidden");
  });
});
