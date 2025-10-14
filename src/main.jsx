import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './AuthProvider.jsx'
import ScrollToTop from './ScrollToTop'
import HeadProvider from './components/HeadProvider.jsx'
import SlashGuard from './components/SlashGuard.jsx'
import { AppRoutes } from './routes.jsx'

import './index.css'

const HydrationReady = () => {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ourphilly:hydrated'))
    }
  }, [])
  return null
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <HeadProvider>
        <BrowserRouter>
          <HydrationReady />
          <ScrollToTop />
          <SlashGuard />
          <AppRoutes />
        </BrowserRouter>
      </HeadProvider>
    </AuthProvider>
  </React.StrictMode>
)
