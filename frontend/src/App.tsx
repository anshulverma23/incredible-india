import { Outlet } from "react-router-dom"
import { AppProviders } from "@/app/providers/AppProviders"
import { ScrollToTop } from "@/components/common/scroll-to-top"

/** Root route element: global providers + scroll reset around whichever layout matched. */
export default function App() {
  return (
    <AppProviders>
      <ScrollToTop />
      <Outlet />
    </AppProviders>
  )
}
