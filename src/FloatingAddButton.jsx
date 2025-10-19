// src/FloatingAddButton.jsx
import React, { useContext, useState } from 'react'
import { PlusIcon } from '@heroicons/react/24/solid'
import { AuthContext } from './AuthProvider'
import LoginPromptModal from './LoginPromptModal'

export default function FloatingAddButton({ onClick, showMobile = true }) {
  const { user } = useContext(AuthContext)
  const [showLogin, setShowLogin] = useState(false)

  const handleClick = () => {
    if (user) {
      onClick()
    } else {
      setShowLogin(true)
    }
  }

  return (
    <>
      {/* Desktop: circular floating button */}
      <button
        onClick={handleClick}
        className="
          hidden md:block
          fixed bottom-6 right-6 z-50
          bg-indigo-600 hover:bg-indigo-700
          text-white rounded-full p-4
          shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-300
          transition
        "
      >
        <PlusIcon className="h-6 w-6" />
      </button>

      {/* Mobile: full-width sticky bar */}
      {showMobile && (
        <button
          onClick={handleClick}
          className="
            md:hidden
            fixed bottom-0 left-0 right-0 z-50
            bg-indigo-600 hover:bg-indigo-700
            text-white flex items-center justify-center space-x-2
            py-4 px-6
            shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-300
            transition
          "
        >
          <PlusIcon className="h-6 w-6" />
          <span className="font-semibold">Post Event</span>
        </button>
      )}

      {showLogin && <LoginPromptModal onClose={() => setShowLogin(false)} />}
    </>
  )
}
