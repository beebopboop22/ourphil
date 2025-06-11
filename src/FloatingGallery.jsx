// src/components/FloatingGallery.jsx
import React from 'react'

export default function FloatingGallery({ images }) {
  const layout = [
    { top: '10%', left: '60%', rotate: '-12deg', scale: 1.1 },
    { top: '25%', left: '65%', rotate: '8deg',  scale: 1.0 },
    { top: '40%', left: '65%', rotate: '-6deg', scale: 1.05 },
    { top: '15%', left: '70%', rotate: '12deg', scale: 0.95 },
    { top: '50%', left: '55%', rotate: '4deg',  scale: 1.0 },
    { top: '30%', left: '54%', rotate: '-8deg', scale: 1.1 },
    { top: '50%', left: '70%', rotate: '8deg', scale: .60 },
  ]

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      {images.slice(0, 7).map((src, i) => {
        const { top, left, rotate, scale } = layout[i]
        return (
          <img
            key={i}
            src={src}
            alt=""
            style={{
              position: 'absolute',
              top,
              left,
              transform: `rotate(${rotate}) scale(${scale})`,
              width: '160px',
              height: '100px',
              objectFit: 'cover',
              borderRadius: '8px',
              boxShadow: '0 10px 20px rgba(0,0,0,0.15)',
              transition: 'transform 0.3s ease',
            }}
            className="hover:shadow-xl"
          />
        )
      })}
    </div>
  )
}
