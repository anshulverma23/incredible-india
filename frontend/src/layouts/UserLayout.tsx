import { Outlet } from "react-router-dom"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { RequireAuth } from "@/features/auth/components/route-guards"

/** Signed-in area (dashboard, bookings, checkout...): redirects to /login when there is no session. */
export default function UserLayout() {
  return (
    <>
      <Header />
      <RequireAuth>
        <Outlet />
      </RequireAuth>
      <Footer />
    </>
  )
}
