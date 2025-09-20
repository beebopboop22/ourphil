import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MONTHLY_GUIDE_CONFIGS, MONTHLY_GUIDE_ORDER } from '../monthlyGuideConfigs.js'

const guideRegexes = MONTHLY_GUIDE_ORDER.map(key => {
  const segment = MONTHLY_GUIDE_CONFIGS[key].pathSegment
  return new RegExp(`^\/${segment}-[a-z-]+-\d{4}$`)
})

const needsSlash = pathname =>
  pathname === '/this-weekend-in-philadelphia' ||
  /^\/philadelphia-events-[a-z]+-\d{4}$/.test(pathname) ||
  guideRegexes.some(regex => regex.test(pathname))

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
