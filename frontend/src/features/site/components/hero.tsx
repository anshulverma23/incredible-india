
import { Button } from "@/components/ui/button"
import { ArrowUpRight } from "lucide-react"

export function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[#f5f1eb]">
      {/* Single Background Image */}
      <div className="absolute inset-0">
        <img
          src="/images/pond.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-5 pt-32 text-center">
        <div className="flex flex-col items-center">
          {/* Title */}
          <h1
  className="
    font-manrope
    text-[72px]
    font-bold
    leading-[0.85]
    tracking-[-0.055em]
    text-white
    [text-shadow:0px_4px_15px_rgba(0,0,0,0.75)]
    sm:text-[90px]
    md:text-[120px]
    lg:text-[150px]
    xl:text-[175px]
  "
>
  Incredible India
</h1>

          {/* Description */}
         {/* <p
  className="
    mt-4
    max-w-[650px]
    font-manrope
    text-base
    font-semibold
    leading-[1.15]
    text-white
    [text-shadow:0px_3px_10px_rgba(0,0,0,0.85)]
    sm:text-lg
    md:text-xl
    lg:text-2xl
  "
>
  From ancient temples to pristine beaches,
  <br className="hidden sm:block" />
  from vibrant cities to serene mountains
</p> */}

          {/* Button */}
          <Button
            className="
              z-10
              mt-8
              h-12
              rounded-full
              bg-white
              px-7
              text-lg
              font-bold
              text-[#171717]
              shadow-lg
              hover:bg-white/90
              font-manrope
            "
          >
            Explore Tours
            <ArrowUpRight className="ml-3 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2 animate-bounce">
        <div className="flex h-10 w-6 items-start justify-center rounded-full border-2 border-white/30 p-2">
          <div className="h-2 w-1 rounded-full bg-white/60" />
        </div>
      </div>
    </section>
  )
}
