import { useEffect, useState, useCallback } from 'react'

export interface Achievement {
  name: string
  displayName: string
  description: string
  earned: boolean
  earnedAt: number | null
}

export interface AchievementUnlock {
  appid: string
  name: string
  displayName: string
  description: string
  unlockedAt: number
}

export function useAchievements(appid: string | null | undefined) {
  const [achievements, setAchievements] = useState<Record<string, Achievement>>({})
  const [watching, setWatching] = useState(false)

  const refresh = useCallback(async () => {
    if (!appid || !window.ucAchievements) return
    const result = await window.ucAchievements.getKnown(appid)
    if (result?.ok) setAchievements(result.achievements ?? {})
  }, [appid])

  useEffect(() => {
    if (!appid || !window.ucAchievements) return

    refresh()
    window.ucAchievements.watch(appid).then(() => setWatching(true))

    return () => {
      window.ucAchievements?.unwatch(appid)
      setWatching(false)
    }
  }, [appid, refresh])

  return { achievements, watching, refresh }
}

export function useAchievementNotifications(
  onUnlock: (unlock: AchievementUnlock) => void
) {
  useEffect(() => {
    if (!window.ucAchievements) return
    return window.ucAchievements.onUnlocked(onUnlock)
  }, [onUnlock])
}
