import { Link } from "react-router-dom"
import { Compass } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 pt-24 pb-16">
      <div className="text-center max-w-md">
        <Compass className="mx-auto mb-6 size-14 text-primary" />
        <p className="font-serif text-6xl font-bold text-foreground">404</p>
        <h1 className="mt-2 font-serif text-2xl font-bold text-foreground">Looks like you&apos;ve wandered off the map</h1>
        <p className="mt-2 text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist or may have been moved.</p>
        <Button className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90" render={<Link to="/" />}>
          Back to Home
        </Button>
      </div>
    </main>
  )
}
