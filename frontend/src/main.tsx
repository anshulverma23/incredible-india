import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router-dom"
import { router } from "@/app/router/app.routes"
import "@/index.css"

/**
 * Application entry point.
 * Mounts into the #root div from index.html and hands URL handling to
 * React Router via the route table defined in src/routes.tsx.
 * (App is the root layout route - it renders <Outlet /> - so it must NOT be
 * rendered directly here.)
 */
const container = document.getElementById("root")

if (!container) {
  throw new Error("Root element #root not found - check index.html")
}

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
