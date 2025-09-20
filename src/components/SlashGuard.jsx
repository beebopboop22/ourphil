import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const needsSlash = pathname =>
  pathname === '/this-weekend-in-philadelphia' ||
  /^\/philadelphia-events-[a-z]+-\d{4}$/.test(pathname) ||
  /^\/family-friendly-events-in-philadelphia-[a-z-]+-\d{4}$/.test(pathname)

export default function SlashGuard() {
  const { pathname, search, hash } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (needsSlash(pathname)) {
      navigate(`${pathname}/${search}${hash}`, { replace: true })
    }
  }, [pathname, search, hash, navigate])

  return null
}
