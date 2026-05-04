import { useEffect, useCallback, useState } from 'react'
import { Trophy } from 'lucide-react'
import { useAchievementNotifications, type AchievementUnlock } from '@/hooks/use-achievements'

interface QueuedUnlock extends AchievementUnlock {
  id: number
  exiting: boolean
}

let notifCounter = 0

export function AchievementNotificationHost() {
  const [queue, setQueue] = useState<QueuedUnlock[]>([])

  const onUnlock = useCallback((unlock: AchievementUnlock) => {
    const id = ++notifCounter
    setQueue((q) => [...q, { ...unlock, id, exiting: false }])

    // Begin exit animation after 4s, remove after 4.4s
    setTimeout(() => {
      setQueue((q) => q.map((n) => n.id === id ? { ...n, exiting: true } : n))
    }, 4000)
    setTimeout(() => {
      setQueue((q) => q.filter((n) => n.id !== id))
    }, 4400)
  }, [])

  useAchievementNotifications(onUnlock)

  if (!queue.length) return null

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {queue.map((n) => (
        <AchievementToast key={n.id} unlock={n} exiting={n.exiting} />
      ))}
    </div>
  )
}

function AchievementToast({ unlock, exiting }: { unlock: QueuedUnlock; exiting: boolean }) {
  return (
    <div
      className={[
        'flex items-center gap-3 rounded-xl border border-yellow-500/30',
        'bg-zinc-900/95 shadow-2xl px-4 py-3 w-80 backdrop-blur-sm',
        'transition-all duration-400',
        exiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0',
      ].join(' ')}
    >
      <div className="flex-shrink-0 rounded-lg bg-yellow-500/20 p-2">
        <Trophy className="h-5 w-5 text-yellow-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-yellow-400 mb-0.5">
          Achievement Unlocked
        </p>
        <p className="text-sm font-medium text-white truncate">
          {unlock.displayName || unlock.name}
        </p>
        {unlock.description && (
          <p className="text-xs text-zinc-400 truncate">{unlock.description}</p>
        )}
      </div>
    </div>
  )
}

export function useAchievementWatcherForRunningGame() {
  const [runningAppid, setRunningAppid] = useState<string | null>(null)

  useEffect(() => {
    if (!window.ucDownloads) return

    const check = async () => {
      try {
        const games = await window.ucOverlay?.getRunningGames?.()
        const first = games?.[0]
        setRunningAppid(first?.appid ?? null)
      } catch { }
    }

    check()
    const interval = setInterval(check, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!runningAppid || !window.ucAchievements) return
    window.ucAchievements.watch(runningAppid)
    return () => { window.ucAchievements?.unwatch(runningAppid) }
  }, [runningAppid])
}
