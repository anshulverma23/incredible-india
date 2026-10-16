import { Compass, Heart, Shield, Sparkles, Utensils, Camera } from "lucide-react"

const experiences = [
  {
    icon: Compass,
    title: "Cultural Immersion",
    description:
      "Live with local families, participate in traditional ceremonies, and learn ancient crafts passed down through generations.",
  },
  {
    icon: Utensils,
    title: "Culinary Adventures",
    description:
      "Savor authentic regional cuisines, take cooking classes with local chefs, and explore vibrant street food scenes.",
  },
  {
    icon: Heart,
    title: "Spiritual Journeys",
    description:
      "Meditate in ancient ashrams, witness sacred rituals along the Ganges, and find inner peace in Himalayan retreats.",
  },
  {
    icon: Camera,
    title: "Wildlife Safaris",
    description:
      "Track Bengal tigers in their natural habitat, spot exotic birds, and witness the incredible biodiversity of India.",
  },
  {
    icon: Sparkles,
    title: "Wellness Retreats",
    description:
      "Experience authentic Ayurvedic treatments, practice yoga with masters, and rejuvenate body, mind, and soul.",
  },
  {
    icon: Shield,
    title: "Heritage Walks",
    description:
      "Explore UNESCO World Heritage sites with expert guides, uncovering stories of emperors, poets, and artisans.",
  },
]

export function Experiences() {
  return (
    <section id="experiences" className="py-20 md:py-32 bg-[#0b2b22] text-primary-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-primary-foreground/70 font-medium text-sm uppercase tracking-widest mb-4">
            Unique Experiences
          </p>
          <h2 className="font-manrope text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-[#fbf8f2]">
            More Than Just Sightseeing
          </h2>
          <p className="text-primary-foreground/80 text-lg text-pretty">
            We believe travel should transform you. Our experiences are designed
            to create meaningful connections with India&apos;s culture, people, and
            traditions.
          </p>
        </div>

        {/* Experiences Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {experiences.map((experience) => (
            <div
              key={experience.title}
              className="group p-8 rounded-2xl   bg-[#07241c]  transition-all duration-300"
            >
              <div className="w-14 h-14 rounded-xl  flex items-center justify-center mb-6  transition-colors">
                <experience.icon className="w-7 h-7 text-primary-foreground" />
              </div>
              <h3 className="font-manrope text-xl font-bold mb-3">
                {experience.title}
              </h3>
              <p className="text-primary-foreground/70 text-pretty">
                {experience.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
