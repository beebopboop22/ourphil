// src/EventsMap.jsx
import React, { useState, useMemo } from 'react'
import Map, { Marker } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { getMapboxToken } from './config/mapboxToken.js'

const mascotUrl =
  'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/OurPhilly-CityHeart-1%20copy-min.png'

function formatDateLabel(dateStr) {
  const date = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d0 = new Date(date)
  d0.setHours(0, 0, 0, 0)
  const pretty = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric'
  })
  return d0.getTime() === today.getTime()
    ? `Today, ${pretty}`
    : pretty
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':')
  let hour = parseInt(h, 10)
  const minute = (m || '00').padStart(2, '0')
  const ampm = hour >= 12 ? 'p.m.' : 'a.m.'
  hour = hour % 12 || 12
  return `${hour}:${minute} ${ampm}`
}

export default function EventsMap({ events, height = '500px', showList = true }) {
  const mapboxToken = getMapboxToken()
  const [viewState, setViewState] = useState({
    latitude: 39.9526,
    longitude: -75.1652,
    zoom: 12
  })
  const [filter, setFilter] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(true)
  const [listOpen, setListOpen] = useState(false)

  const filtered = useMemo(
    () =>
      events.filter(evt =>
        (evt.title || evt.name)
          .toLowerCase()
          .includes(filter.toLowerCase())
      ),
    [events, filter]
  )

  const openEvent = evt => {
    setSelectedEvent(evt)
    setDrawerOpen(true)

    const latitudeRaw = evt.latitude ?? evt.lat
    const longitudeRaw = evt.longitude ?? evt.lng
    const latitude =
      latitudeRaw !== undefined && latitudeRaw !== null
        ? Number(latitudeRaw)
        : undefined
    const longitude =
      longitudeRaw !== undefined && longitudeRaw !== null
        ? Number(longitudeRaw)
        : undefined

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      setViewState(v => ({
        ...v,
        latitude,
        longitude,
        zoom: 13,
        transitionDuration: 500
      }))
    }
    if (showList && listOpen) setListOpen(false)
  }

  if (!mapboxToken) {
    return (
      <div className="mx-auto w-full max-w-screen-lg rounded-3xl border border-gray-200 bg-gray-50 p-6 text-center text-gray-600">
        Map view unavailable — missing Mapbox access token.
      </div>
    )
  }

  return (
    <div
      className={`mx-auto w-full max-w-screen-lg ${showList ? 'flex flex-col md:flex-row gap-6' : ''}`}
    >
      {showList && (
        <>
          {/* Mobile: toggle list */}
          <button
            className="md:hidden p-2 bg-indigo-600 text-white fixed top-4 left-4 z-30 rounded"
            onClick={() => setListOpen(o => !o)}
          >
            {listOpen ? 'Hide List' : 'Show List'}
          </button>

          {/* Left: event list */}
          <div
            className={`
              md:w-1/3 overflow-y-auto border-b md:border-b-0 md:border-r border-gray-200
              bg-white md:static fixed left-0 top-32 h-full z-20 transform
              ${listOpen ? 'translate-x-0' : '-translate-x-full'}
              md:translate-x-0 transition-transform
            `}
            style={{ maxHeight: height }}
          >
            <div className="sticky top-0 bg-white p-4 border-b border-gray-200 z-10">
              <input
                type="text"
                placeholder="Filter events..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            {filtered.map(evt => {
              const isSelected = selectedEvent?.id === evt.id
              return (
                <div
                  key={evt.id}
                  className={`
                    p-4 cursor-pointer flex items-center
                    ${isSelected
                      ? 'bg-indigo-100 border-l-4 border-indigo-600'
                      : 'hover:bg-gray-100'}
                    transition
                  `}
                  onClick={() => openEvent(evt)}
                >
                  {(evt.imageUrl || evt.image) && (
                    <img
                      src={evt.imageUrl || evt.image}
                      alt={evt.title || evt.name}
                      className="w-12 h-12 object-cover rounded mr-4"
                    />
                  )}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">
                      {evt.title || evt.name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {formatDateLabel(evt.start_date)}
                      {evt.start_time && <> • {formatTime(evt.start_time)}</>}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Right: map + controls */}
      <div
        className={`${showList ? 'md:w-2/3' : 'w-full'} relative rounded-3xl border border-gray-200 shadow-xl overflow-hidden`}
        style={{ height }}
      >
        <div className="absolute top-4 right-4 z-30 space-x-2">
          <button
            onClick={() => setDarkMode(d => !d)}
            className="px-3 py-1 bg-white bg-opacity-80 rounded shadow"
          >
            {darkMode ? 'Light Map' : 'Dark Map'}
          </button>
        </div>

        <Map
          {...viewState}
          onMove={e => setViewState(e.viewState)}
          style={{ width: '100%', height: '100%', borderRadius: 'inherit' }}
          mapStyle={
            darkMode
              ? 'mapbox://styles/mapbox/dark-v10'
              : 'mapbox://styles/mapbox/light-v10'
          }
          mapboxAccessToken={mapboxToken}
        >
          {filtered.map(evt => {
            const latitudeRaw = evt.latitude ?? evt.lat
            const longitudeRaw = evt.longitude ?? evt.lng
            const latitude =
              latitudeRaw !== undefined && latitudeRaw !== null
                ? Number(latitudeRaw)
                : undefined
            const longitude =
              longitudeRaw !== undefined && longitudeRaw !== null
                ? Number(longitudeRaw)
                : undefined

            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
              return null
            }

            return (
              <Marker
                key={evt.id}
                longitude={longitude}
                latitude={latitude}
                anchor="bottom"
                onClick={e => {
                  e.originalEvent.stopPropagation()
                  openEvent(evt)
                }}
              >
                <img
                  src={mascotUrl}
                  alt=""
                  role="presentation"
                  loading="lazy"
                  className="w-6 h-6 md:w-8 md:h-8 cursor-pointer"
                  style={{ transform: 'translateY(-50%)' }}
                />
              </Marker>
            )
          })}
        </Map>

        {selectedEvent && (
          <>
            {/* Drawer: desktop */}
            <div
              className={`
                fixed bg-white shadow-lg transition-transform duration-300 ease-out z-40
                hidden md:block
                ${drawerOpen ? 'transform translate-x-0' : 'transform -translate-x-full'}
                left-0 top-16 h-full w-80
              `}
            >
              <button
                onClick={() => setDrawerOpen(false)}
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
              >
                ×
              </button>
              <div className="p-6 overflow-y-auto h-full">
                {(selectedEvent.imageUrl || selectedEvent.image) && (
                  <img
                    src={selectedEvent.imageUrl || selectedEvent.image}
                    alt={selectedEvent.title || selectedEvent.name}
                    className="w-full h-40 object-cover rounded mb-4"
                  />
                )}
                <h3 className="text-2xl font-semibold text-gray-900 leading-tight mb-2">
                  {selectedEvent.title || selectedEvent.name}
                </h3>
                <p className="text-base text-gray-600 leading-snug mb-2">
                  {formatDateLabel(selectedEvent.start_date)}
                  {selectedEvent.start_time && (
                    <> • {formatTime(selectedEvent.start_time)}</>
                  )}
                </p>
                {selectedEvent.description && (
                  <p className="text-sm text-gray-700 leading-relaxed mb-4">
                    {selectedEvent.description}
                  </p>
                )}
                {selectedEvent.venues?.name && (
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">
                    Location: {selectedEvent.venues.name}
                  </p>
                )}
                {(() => {
                  const moreInfoHref =
                    selectedEvent.detailUrl ||
                    (selectedEvent.isBigBoard && selectedEvent.slug
                      ? `/big-board/${selectedEvent.slug}`
                      : selectedEvent.venues?.slug && selectedEvent.slug
                        ? `/${selectedEvent.venues.slug}/${selectedEvent.slug}`
                        : selectedEvent.url || '#')
                  const isExternal = /^https?:\/\//.test(moreInfoHref)
                  return (
                    <a
                      href={moreInfoHref || '#'}
                      target={isExternal ? '_blank' : undefined}
                      rel={isExternal ? 'noopener noreferrer' : undefined}
                      className="inline-block mt-2 px-4 py-2 bg-indigo-600 text-white rounded"
                    >
                      {selectedEvent.isSports ? 'Get Tickets' : 'More Info'}
                    </a>
                  )
                })()}
              </div>
            </div>

            {/* Drawer: mobile */}
            <div
              className={`
                fixed bg-white shadow-lg transition-transform duration-300 ease-out z-40
                md:hidden
                ${drawerOpen ? 'transform translate-y-0' : 'transform translate-y-full'}
                bottom-0 left-0 w-full h-1/2
              `}
            >
              <button
                onClick={() => setDrawerOpen(false)}
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
              >
                ×
              </button>
              <div className="p-4 overflow-y-auto h-full">
                {(selectedEvent.imageUrl || selectedEvent.image) && (
                  <img
                    src={selectedEvent.imageUrl || selectedEvent.image}
                    alt={selectedEvent.title || selectedEvent.name}
                    className="w-full h-32 object-cover rounded mb-4"
                  />
                )}
                <h3 className="text-xl font-semibold text-gray-900 leading-tight mb-2">
                  {selectedEvent.title || selectedEvent.name}
                </h3>
                <p className="text-base text-gray-600 leading-snug mb-2">
                  {formatDateLabel(selectedEvent.start_date)}
                  {selectedEvent.start_time && (
                    <> • {formatTime(selectedEvent.start_time)}</>
                  )}
                </p>
                {selectedEvent.description && (
                  <p className="text-sm text-gray-700 leading-relaxed mb-4">
                    {selectedEvent.description}
                  </p>
                )}
                {selectedEvent.venues?.name && (
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">
                    Location: {selectedEvent.venues.name}
                  </p>
                )}
                {(() => {
                  const moreInfoHref =
                    selectedEvent.detailUrl ||
                    (selectedEvent.isBigBoard && selectedEvent.slug
                      ? `/big-board/${selectedEvent.slug}`
                      : selectedEvent.venues?.slug && selectedEvent.slug
                        ? `/${selectedEvent.venues.slug}/${selectedEvent.slug}`
                        : selectedEvent.url || '#')
                  const isExternal = /^https?:\/\//.test(moreInfoHref)
                  return (
                    <a
                      href={moreInfoHref || '#'}
                      target={isExternal ? '_blank' : undefined}
                      rel={isExternal ? 'noopener noreferrer' : undefined}
                      className="inline-block mt-2 px-4 py-2 bg-indigo-600 text-white rounded"
                    >
                      {selectedEvent.isSports ? 'Get Tickets' : 'More Info'}
                    </a>
                  )
                })()}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
