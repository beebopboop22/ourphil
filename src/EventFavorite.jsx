import React, { useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import useEventFavorite from './utils/useEventFavorite'
import { AuthContext } from './AuthProvider'

export default function EventFavorite({ event_id, source_table, count, onCountChange, className = '' }) {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const { isFavorite, toggleFavorite, loading } = useEventFavorite({ event_id, source_table })

  const handle = async e => {
    if (e?.preventDefault) e.preventDefault()
    if (e?.stopPropagation) e.stopPropagation()
    if (!user) {
      navigate('/login')
      return
    }
    const wasFav = isFavorite
    await toggleFavorite()
    if (onCountChange) onCountChange(wasFav ? -1 : 1)
  }

  return (
    <span className={`flex items-center space-x-1 ${className}`}>
      <button
        onClick={handle}
        disabled={loading}
        className="text-lg"
        aria-label={isFavorite ? 'Remove favorite' : 'Add favorite'}
      >
        {isFavorite ? '❤️' : '🤍'}
      </button>
      {typeof count === 'number' && (
        <span className="font-[Barrio] text-lg text-gray-800">{count}</span>
      )}
    </span>
  )
}
