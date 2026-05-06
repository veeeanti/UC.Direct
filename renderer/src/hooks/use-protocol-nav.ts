/**
 * union:// protocol navigation hook.
 *
 * Listens for incoming protocol URLs dispatched from the main process,
 * then navigates to the appropriate in-app route.
 *
 * Supported schemes:
 *   union://run/<appid>   → /game/<appid> and attempts auto-launch/download
 *   union://store/<appid> → /game/<appid> (detail page only)
 *   union://open/<page>   → /<page>  (launcher, library, downloads, settings, etc.)
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface ProtocolNav {
  action: string
  appid?: string | null
  page?: string | null
  params?: string[]
}

const PAGE_ALIASES: Record<string, string> = {
  home: '/',
  launcher: '/launcher',
  library: '/library',
  downloads: '/downloads',
  settings: '/settings',
  wishlist: '/wishlist',
  liked: '/liked',
  account: '/account',
  achievements: '/achievements',
  screenshots: '/screenshots',
}

export function useProtocolNav() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!window.ucProtocol) return

    const handleRunAction = async (appid: string) => {
      try {
        const result = await (window as any).electron?.invoke?.('uc:protocol-navigate-enhanced', 'union://run/' + appid)
        if (result && result.handled) {
          if (result.status === 'running') {
            navigate('/game/' + result.appid, { state: { autoLaunch: false } })
            return
          }
          if (result.status === 'installed') {
            navigate('/game/' + result.appid, { state: { autoLaunch: true } })
            return
          }
          if (result.status === 'not_installed') {
            navigate('/game/' + result.appid, { state: { autoLaunch: true } })
            return
          }
        }
      } catch (e) {
        console.debug('Enhanced protocol handling not available:', e)
      }
      navigate('/game/' + appid, { state: { autoLaunch: true } })
    }

    const dispatch = async (nav: ProtocolNav | null) => {
      if (!nav) return
      switch (nav.action) {
        case 'run':
          if (nav.appid) {
            await handleRunAction(nav.appid)
          }
          break
        case 'store':
          if (nav.appid) {
            navigate('/game/' + nav.appid)
          }
          break
        case 'open': {
          const pg = nav.page?.toLowerCase() || ''
          const route = PAGE_ALIASES[pg] || '/' + (nav.page || '')
          navigate(route)
          break
        }
        default:
          break
      }
    }

    // Handle URLs that arrived before the renderer was ready
    window.ucProtocol.getPending().then(dispatch)

    // Handle URLs while the app is running
    const cleanup = window.ucProtocol.onNavigate(dispatch)
    return cleanup
  }, [navigate])
}
