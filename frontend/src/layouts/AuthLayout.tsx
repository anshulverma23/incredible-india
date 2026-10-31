import { Outlet, useLocation } from "react-router-dom"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { PageMeta } from "@/components/common/page-meta"
import { pageTitle } from "@/lib/seo"

const TITLES: Record<string, string> = {
  login: "Log In",
  register: "Create Account",
  "forgot-password": "Forgot Password",
  "reset-password": "Reset Password",
  "verify-email": "Verify Email",
}

/** Login / register / password flows: header + footer with the page centred in the viewport. Never indexed. */
export default function AuthLayout() {
  const { pathname } = useLocation()
  const title = TITLES[pathname.split("/")[1]] ?? "Account"

  return (
    <>
      <PageMeta title={pageTitle(title)} noindex />
      <Header />
      <main className="min-h-screen flex items-center justify-center px-4 pt-32 pb-16 bg-muted/40">
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
