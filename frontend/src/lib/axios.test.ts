import axios from "axios"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { http, ApiError } from "@/lib/axios"
import { getToken, setToken } from "@/lib/storage"

type Cfg = { url?: string; headers: { get?: (k: string) => string | undefined } & Record<string, unknown> }
const ok = (cfg: Cfg, data: unknown, status = 200): never => ({ data, status, statusText: "OK", headers: {}, config: cfg }) as never
const fail = (cfg: Cfg, status: number, data: unknown) => {
  const err = new axios.AxiosError("failed", String(status), cfg as never, {}, { data, status, statusText: "", headers: {}, config: cfg as never })
  return Promise.reject(err)
}

describe("http client", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it("sends the access token on every request", async () => {
    setToken("tok-1")
    let seen = ""
    http.defaults.adapter = async (cfg) => {
      seen = String(cfg.headers.get("Authorization"))
      return ok(cfg as never, { ok: true })
    }
    await http.get("/anything")
    expect(seen).toBe("Bearer tok-1")
  })

  it("silently refreshes an expired access token once and replays the request", async () => {
    setToken("expired")
    const refresh = vi.spyOn(axios, "post").mockResolvedValue({ data: { token: "fresh" } })
    const calls: string[] = []
    http.defaults.adapter = async (cfg) => {
      const auth = String(cfg.headers.get("Authorization"))
      calls.push(auth)
      return auth === "Bearer fresh" ? ok(cfg as never, { bookings: [] }) : fail(cfg as never, 401, { message: "Token expired" })
    }
    const res = await http.get("/bookings/my")
    expect(res.data).toEqual({ bookings: [] })
    expect(calls).toEqual(["Bearer expired", "Bearer fresh"])
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(getToken()).toBe("fresh")
  })

  it("many parallel 401s trigger ONE refresh (single-flight)", async () => {
    setToken("expired")
    const refresh = vi.spyOn(axios, "post").mockResolvedValue({ data: { token: "fresh" } })
    http.defaults.adapter = async (cfg) => (String(cfg.headers.get("Authorization")) === "Bearer fresh" ? ok(cfg as never, {}) : fail(cfg as never, 401, { message: "x" }))
    await Promise.all([http.get("/a"), http.get("/b"), http.get("/c")])
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("if the refresh fails the session is cleared and the original error surfaces", async () => {
    setToken("expired")
    vi.spyOn(axios, "post").mockRejectedValue(new Error("refresh rejected"))
    http.defaults.adapter = async (cfg) => fail(cfg as never, 401, { message: "Token expired" })
    await expect(http.get("/bookings/my")).rejects.toBeInstanceOf(ApiError)
    expect(getToken()).toBeNull()
  })

  it("never tries to refresh on login failures", async () => {
    setToken("something")
    const refresh = vi.spyOn(axios, "post")
    http.defaults.adapter = async (cfg) => fail({ ...(cfg as never as Cfg), url: "/auth/login" }, 401, { message: "Invalid email or password" })
    await expect(http.post("/auth/login", {})).rejects.toMatchObject({ message: "Invalid email or password", status: 401 })
    expect(refresh).not.toHaveBeenCalled()
  })

  it("turns server errors into ApiError with the backend message", async () => {
    http.defaults.adapter = async (cfg) => fail(cfg as never, 409, { message: "Only 1 seat(s) left on this departure" })
    await expect(http.post("/bookings", {})).rejects.toMatchObject({ name: "Error", message: "Only 1 seat(s) left on this departure", status: 409 })
  })
})
