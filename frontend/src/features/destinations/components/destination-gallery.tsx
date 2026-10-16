import { useState } from "react"

interface DestinationGalleryProps {
  images: string[]
  name: string
}

const imageDescriptions = [
  "Panoramic view of the destination landscape",
  "Cultural landmark and heritage site",
  "Local life and vibrant atmosphere",
  "Natural beauty and scenic viewpoint",
]

export function DestinationGallery({ images, name }: DestinationGalleryProps) {
  const [selectedImage, setSelectedImage] = useState(0)

  const getAltText = (index: number) => {
    const description = imageDescriptions[index] || `Gallery image ${index + 1}`
    return `${name}, India - ${description}`
  }

  return (
    <div>
      <h2 className="font-manrope text-2xl md:text-3xl font-bold text-foreground mb-6">
        Photo Gallery
      </h2>
      <div className="space-y-4">
        <div className="relative aspect-[16/9] rounded-xl overflow-hidden">
          <img
            loading="lazy" decoding="async"
            src={images[selectedImage]}
            alt={getAltText(selectedImage)}
            className="absolute inset-0 h-full w-full object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 66vw, 800px"
          />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => setSelectedImage(index)}
              className={`relative aspect-[4/3] rounded-lg overflow-hidden transition-all ${
                selectedImage === index
                  ? "ring-2 ring-primary ring-offset-2"
                  : "opacity-70 hover:opacity-100"
              }`}
              aria-label={`View ${getAltText(index)}`}
            >
              <img
                loading="lazy" decoding="async"
                src={image}
                alt={`${name} thumbnail ${index + 1}`}
                className="absolute inset-0 h-full w-full object-cover"
                sizes="(max-width: 768px) 25vw, 200px"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
