import React from 'react'
import { Link } from 'react-router-dom'

export default function OutletCard({ outlet }) {
  return (
    <div className="flex-none w-56 h-96 mx-2 relative overflow-hidden rounded-2xl shadow-lg">
      {/* Background image */}
      <img
        src={outlet.image_url || 'https://via.placeholder.com/224x384'}
        alt={outlet.outlet}
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Dark overlay for white text */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Clickable link wrapper */}
      <Link to={`/outlets/${outlet.slug}`} className="absolute inset-0 z-10" />

      {/* Outlet name */}
      <h3 className="absolute bottom-10 left-4 right-4 text-white text-2xl font-bold text-center z-20 leading-tight">
        {outlet.outlet}
      </h3>
    </div>
  )
}
