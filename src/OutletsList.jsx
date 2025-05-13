import React from 'react'
import OutletCard from './OutletCard'

export default function OutletsList({ outlets = [] }) {
  return (
    <section className="w-full bg-neutral-100 pt-12 pb-12">
      <h2 className="text-4xl text-center font-[Barrio] mb-6">
        Neighborhood Subscriptions You Might Like
      </h2>

      {/* full-bleed, horizontally scrollable */}
      <div className="relative w-screen left-1/2 right-1/2 mx-[-50vw] overflow-x-auto overflow-y-hidden">
        <div className="flex space-x-4 flex-nowrap px-4">
          {outlets.map((outlet) => (
            <OutletCard key={outlet.id} outlet={outlet} />
          ))}
        </div>
      </div>
    </section>
  )
}
