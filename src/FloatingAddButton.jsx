// src/FloatingAddButton.jsx
import React from 'react'
import { PlusIcon } from '@heroicons/react/24/solid' // or any other “+” icon you like

export default function FloatingAddButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="
        fixed
        bottom-6
        right-6
        z-50
        bg-indigo-600
        hover:bg-indigo-700
        text-white
        rounded-full
        p-4
        shadow-xl
        focus:outline-none focus:ring-2 focus:ring-indigo-300
        transition
      "
    >
      <PlusIcon className="h-6 w-6" />
    </button>
  )
}
