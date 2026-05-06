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

export interface SteamAchievementDefinition {
  name: string
  displayName: string
  description: string
  icon: string
  icongray: string
  hidden: number
}

export interface SteamAchievementDefinitions {
  gameName: string
  gameVersion: string
  availableGameStats: {
    achievements: SteamAchievementDefinition[]
    statname: string
  }
}

export function useAchievements(appid: string | null | undefined) {
  const [achievements, setAchievements] = useState<Record<string, Achievement>>({})
  const [watching, setWatching] = useState(false)
  const [steamDefinitions, setSteamDefinitions] = useState<SteamAchievementDefinitions | null>(null)

  const refresh = useCallback(async () => {
    if (!appid || !window.ucAchievements) return
    const result = await window.ucAchievements.getKnown(appid)
    if (result?.ok) setAchievements(result.achievements ?? {})
  }, [appid])

  const fetchSteamDefinitions = useCallback(async (appid: string) => {
    if (!appid || !window.ucAchievements?.getSteamDefinitions) return
    try {
      const result = await window.ucAchievements.getSteamDefinitions(appid)
      if (result?.ok && result.definitions) {
        setSteamDefinitions(result.definitions)
      }
    } catch (e) {
      console.debug('Steam API not available:', e)
    }
  }, [])

  useEffect(() => {
    if (!appid || !window.ucAchievements) return

    refresh()
    window.ucAchievements.watch(appid).then(() => setWatching(true))
    fetchSteamDefinitions(appid)

    return () => {
      window.ucAchievements?.unwatch(appid)
      setWatching(false)
      setSteamDefinitions(null)
    }
  }, [appid, refresh, fetchSteamDefinitions])

  return { achievements, watching, refresh, steamDefinitions }
}

export function useAchievementNotifications(
  onUnlock: (unlock: AchievementUnlock) => void
) {
  useEffect(() => {
    if (!window.ucAchievements) return
    return window.ucAchievements.onUnlocked(onUnlock)
  }, [onUnlock])
}

export function useSteamProfile(steamId: string | null | undefined) {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const fetchProfile = useCallback(async (id: string) => {
    if (!id || !window.ucAchievements?.getSteamProfile) return
    setLoading(true)
    try {
      const result = await window.ucAchievements.getSteamProfile(id)
      if (result?.ok) {
        setProfile(result.profile)
      }
    } catch (e) {
      console.debug('Failed to fetch Steam profile:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (steamId) {
      fetchProfile(steamId)
    } else {
      setProfile(null)
    }
  }, [steamId, fetchProfile])

  return { profile, loading, fetchProfile }
}
