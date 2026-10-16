import { Outlet } from "react-router-dom"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"

/** Login / register / password flows: header + footer with the page centred in the viewport. */
export default function AuthLayout() {
  return (
    <>
      <Header />
      <main className="min-h-screen flex items-center justify-center px-4 pt-32 pb-16 bg-muted/40">
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
