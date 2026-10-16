import { TOKEN_KEY } from "@/constants/storage-keys"

/** localStorage can be missing (SSR) or throw (private mode / blocked cookies) - never let that crash the app. */
function getStore(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

export const storage = {
  get(key: string): string | null {
    try {
      return getStore()?.getItem(key) ?? null
    } catch {
      return null
    }
  },
  set(key: string, value: string): void {
    try {
      getStore()?.setItem(key, value)
    } catch {
      // storage full or unavailable - nothing useful to do
    }
  },
  remove(key: string): void {
    try {
      getStore()?.removeItem(key)
    } catch {
      // storage unavailable - nothing useful to do
    }
  },
}

// ---- auth token helpers ----
export const getToken = (): string | null => storage.get(TOKEN_KEY)
export const setToken = (token: string): void => storage.set(TOKEN_KEY, token)
export const clearToken = (): void => storage.remove(TOKEN_KEY)
