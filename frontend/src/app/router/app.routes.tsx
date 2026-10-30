/* eslint-disable react-refresh/only-export-components -- route table, not a fast-refresh boundary */
import { lazy, Suspense, type ComponentType } from "react"
import { createBrowserRouter } from "react-router-dom"
import App from "@/App"
import AuthLayout from "@/layouts/AuthLayout"
import PublicLayout from "@/layouts/PublicLayout"
import UserLayout from "@/layouts/UserLayout"

// ---------------- Site (static) pages ----------------
const Home = lazy(() => import("@/features/site/pages/Home"))
const About = lazy(() => import("@/features/site/pages/About"))
const Contact = lazy(() => import("@/features/site/pages/Contact"))
const FAQ = lazy(() => import("@/features/site/pages/FAQ"))
const Blog = lazy(() => import("@/features/blog/pages/Blog"))
const BlogDetail = lazy(() => import("@/features/blog/pages/BlogDetail"))
const NotFound = lazy(() => import("@/features/site/pages/NotFound"))

// ---------------- Catalogue ----------------
const Destinations = lazy(() => import("@/features/destinations/pages/Destinations"))
const DestinationDetail = lazy(() => import("@/features/destinations/pages/DestinationDetail"))
const Hotels = lazy(() => import("@/features/hotels/pages/Hotels"))
const HotelDetail = lazy(() => import("@/features/hotels/pages/HotelDetail"))
const Packages = lazy(() => import("@/features/packages/pages/Packages"))
const PackageDetail = lazy(() => import("@/features/packages/pages/PackageDetail"))

// ---------------- Auth ----------------
const Login = lazy(() => import("@/features/auth/pages/Login"))
const Register = lazy(() => import("@/features/auth/pages/Register"))
const ForgotPassword = lazy(() => import("@/features/auth/pages/ForgotPassword"))
const ResetPassword = lazy(() => import("@/features/auth/pages/ResetPassword"))
const VerifyEmail = lazy(() => import("@/features/auth/pages/VerifyEmail"))

// ---------------- Signed-in user ----------------
const Dashboard = lazy(() => import("@/features/profile/pages/Dashboard"))
const Profile = lazy(() => import("@/features/profile/pages/Profile"))
const Wishlist = lazy(() => import("@/features/wishlist/pages/Wishlist"))
const Bookings = lazy(() => import("@/features/bookings/pages/Bookings"))
const BookingDetail = lazy(() => import("@/features/bookings/pages/BookingDetail"))
const Checkout = lazy(() => import("@/features/payments/pages/Checkout"))
const PaymentSuccess = lazy(() => import("@/features/payments/pages/PaymentSuccess"))
const Notifications = lazy(() => import("@/features/notifications/pages/Notifications"))

// ---------------- Trip planner ----------------
const PlanTrip = lazy(() => import("@/features/itinerary/pages/PlanTrip"))

// ---------------- Admin ----------------
const AdminLayout = lazy(() => import("@/layouts/AdminLayout"))
const AdminDashboard = lazy(() => import("@/features/admin/pages/AdminDashboard"))
const AdminUsers = lazy(() => import("@/features/admin/pages/AdminUsers"))
const AdminHotels = lazy(() => import("@/features/admin/pages/AdminHotels"))
const AdminDestinations = lazy(() => import("@/features/admin/pages/AdminDestinations"))
const AdminPackages = lazy(() => import("@/features/admin/pages/AdminPackages"))
const AdminBookings = lazy(() => import("@/features/admin/pages/AdminBookings"))
const AdminReviews = lazy(() => import("@/features/admin/pages/AdminReviews"))
const AdminCoupons = lazy(() => import("@/features/admin/pages/AdminCoupons"))
const AdminReports = lazy(() => import("@/features/admin/pages/AdminReports"))
const AdminSettings = lazy(() => import("@/features/admin/pages/AdminSettings"))
const AdminBlog = lazy(() => import("@/features/admin/pages/AdminBlog"))
const AdminFaq = lazy(() => import("@/features/admin/pages/AdminFaq"))
const AdminPayments = lazy(() => import("@/features/admin/pages/AdminPayments"))

/** Suspense boundary for a lazily loaded page. */
function LazyRoute({ Component }: { Component: ComponentType }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <p>Loading...</p>
        </div>
      }
    >
      <Component />
    </Suspense>
  )
}

const page = (Component: ComponentType) => <LazyRoute Component={Component} />

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      // Public site: header + footer
      {
        element: <PublicLayout />,
        children: [
          { index: true, element: page(Home) },
          { path: "about", element: page(About) },
          { path: "contact", element: page(Contact) },
          { path: "faq", element: page(FAQ) },
          { path: "blog", element: page(Blog) },
          { path: "blog/:slug", element: page(BlogDetail) },
          { path: "destinations", element: page(Destinations) },
          { path: "destinations/:slug", element: page(DestinationDetail) },
          { path: "hotels", element: page(Hotels) },
          { path: "hotels/:slug", element: page(HotelDetail) },
          { path: "packages", element: page(Packages) },
          { path: "packages/:slug", element: page(PackageDetail) },
          { path: "plan-trip", element: page(PlanTrip) },
          { path: "*", element: page(NotFound) },
        ],
      },

      // Authentication: centred card layout
      {
        element: <AuthLayout />,
        children: [
          { path: "login", element: page(Login) },
          { path: "register", element: page(Register) },
          { path: "forgot-password", element: page(ForgotPassword) },
          { path: "reset-password/:token", element: page(ResetPassword) },
          { path: "verify-email/:token", element: page(VerifyEmail) },
        ],
      },

      // Signed-in user area (guarded by UserLayout)
      {
        element: <UserLayout />,
        children: [
          { path: "dashboard", element: page(Dashboard) },
          { path: "profile", element: page(Profile) },
          { path: "wishlist", element: page(Wishlist) },
          { path: "notifications", element: page(Notifications) },
          { path: "bookings", element: page(Bookings) },
          { path: "bookings/:id", element: page(BookingDetail) },
          { path: "checkout/:bookingId", element: page(Checkout) },
          { path: "payment-success/:bookingId", element: page(PaymentSuccess) },
        ],
      },

      // Admin panel (guarded inside AdminLayout)
      {
        path: "admin",
        element: page(AdminLayout),
        children: [
          { index: true, element: page(AdminDashboard) },
          { path: "users", element: page(AdminUsers) },
          { path: "hotels", element: page(AdminHotels) },
          { path: "destinations", element: page(AdminDestinations) },
          { path: "packages", element: page(AdminPackages) },
          { path: "bookings", element: page(AdminBookings) },
          { path: "reviews", element: page(AdminReviews) },
          { path: "coupons", element: page(AdminCoupons) },
          { path: "reports", element: page(AdminReports) },
          { path: "settings", element: page(AdminSettings) },
          { path: "blog", element: page(AdminBlog) },
          { path: "faq", element: page(AdminFaq) },
          { path: "payments", element: page(AdminPayments) },
        ],
      },
    ],
  },
])
