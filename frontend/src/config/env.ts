/**
 * Single place that reads Vite env vars. Only variables prefixed with VITE_ are
 * exposed to the browser bundle. Import `env` instead of touching import.meta.env.
 */
const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:8000/api").replace(/\/+$/, "")

export const env = {
  /** Base URL of the REST API, including the /api prefix. */
  API_URL,
  /** Socket.IO lives on the API's origin (no /api path). */
  SOCKET_URL: API_URL.replace(/\/api$/, ""),
  GOOGLE_CLIENT_ID:
    (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ||
    "placeholder_client_id",
  /** Public https URL of the website, no trailing slash (e.g. https://www.example.com). Used for canonical + social-share URLs. */
  SITE_URL: ((import.meta.env.VITE_SITE_URL as string | undefined) || "").replace(/\/+$/, ""),
  /** Optional: without it MapEmbed falls back to a plain Google Maps link. */
  GOOGLE_MAPS_API_KEY:
    (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || "",
} as const
