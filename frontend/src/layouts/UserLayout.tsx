import { Outlet, useLocation } from "react-router-dom"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { PageMeta } from "@/components/common/page-meta"
import { RequireAuth } from "@/features/auth/components/route-guards"
import { pageTitle } from "@/lib/seo."

const TITLES: Record<string, string> = {
  dashboard: "My Dashboard",
  profile: "My Profile",
  wishlist: "My Wishlist",
  notifications: "Notifications",
  bookings: "My Bookings",
  checkout: "Checkout",
  "payment-success": "Payment Successful",
}

/** Signed-in area (dashboard, bookings, checkout...): redirects to /login when there is no session. Never indexed. */
export default function UserLayout() {
  const { pathname } = useLocation()
  const title = TITLES[pathname.split("/")[1]] ?? "My Account"

  return (
    <>
      <PageMeta title={pageTitle(title)} noindex />
      <Header />
      <RequireAuth>
        <Outlet />
      </RequireAuth>
      <Footer />
    </>
  )
}
