import { Button } from "@/components/ui/button"
import { ArrowUpRight } from "lucide-react"

export function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[#f5f1eb]">
      {/* ================= BACKGROUND ================= */}
      <div className="absolute inset-0 overflow-hidden">

        {/* Image 1 - TOP */}
        <img
          src="/images/hero_1.png"
          alt=""
          className="
            absolute
            top-0
            left-0
            w-full
            h-auto
            min-w-full
            block
            z-0
          "
        />
      </div>

      {/* ================= CONTENT ================= */}
        <div className="relative z-10 min-h-screen flex pt-32 items-center justify-center px-5 text-center">

        <div className="flex flex-col items-center">

          {/* TITLE */}
          <h1
            className="
              font-manrope
              font-bold
              text-white
              text-[72px]
              sm:text-[90px]
              md:text-[120px]
              lg:text-[150px]
              xl:text-[175px]
              leading-[0.85]
              tracking-[-0.055em]
              drop-shadow-[0_4px_15px_rgba(0,0,0,0.35)]
            "
          >
            Incredible India
          </h1>

          {/* DESCRIPTION */}
          <p
            className="
              mt-4
              max-w-[650px]
              font-manrope
              font-semibold
              text-white
              text-base
              sm:text-lg
              md:text-xl
              lg:text-2xl
              leading-[1.15]
              drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]
            "
          >
            From ancient temples to pristine beaches,
            <br className="hidden sm:block" />
            from vibrant cities to serene mountains 
          </p>

          {/* BUTTON */}
          <Button
            className="
            z-10
              mt-8
              h-12
              px-7
              rounded-full
              bg-white
              text-[#171717]
              hover:bg-white/90
              font-manrope
              font-bold
              text-lg
              shadow-lg
            "
          >
            Explore Tours
            <ArrowUpRight className="ml-3 h-4 w-4" />
          </Button>

        </div>
        
         <img
          src="/images/hero_2.png"
          alt=""
          className="
            absolute
            left-0
            w-full
            h-auto
            min-w-full
            block
            z-0
          "
          style={{
            bottom: "-7px",
          }}
        />
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-white/60 rounded-full" />
        </div>
      </div>

    </section>
  )
}