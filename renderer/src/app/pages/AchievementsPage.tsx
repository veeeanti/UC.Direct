import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Trophy, Lock, RefreshCw, FolderSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAchievements, type Achievement } from '@/hooks/use-achievements'

function formatDate(ts: number | null): string {
  if (!ts) return ''
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(ts))
}

function AchievementRow({ ach }: { ach: Achievement & { name: string } }) {
  return (
    <div className={[
      'flex items-center gap-4 rounded-xl px-4 py-3 border transition-colors',
      ach.earned
        ? 'bg-yellow-500/5 border-yellow-500/20'
        : 'bg-zinc-900/40 border-white/5 opacity-60',
    ].join(' ')}>
      <div className={[
        'flex-shrink-0 rounded-lg p-2',
        ach.earned ? 'bg-yellow-500/20' : 'bg-zinc-800',
      ].join(' ')}>
        {ach.earned
          ? <Trophy className="h-5 w-5 text-yellow-400" />
          : <Lock className="h-5 w-5 text-zinc-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {ach.displayName || ach.name}
        </p>
        {ach.description && (
          <p className="text-xs text-zinc-400 truncate">{ach.description}</p>
        )}
        {ach.earnedAt && (
          <p className="text-xs text-yellow-500/70 mt-0.5">{formatDate(ach.earnedAt)}</p>
        )}
      </div>
      <div className="flex-shrink-0">
        <span className={[
          'text-xs font-semibold px-2 py-0.5 rounded-full',
          ach.earned ? 'bg-yellow-500/20 text-yellow-300' : 'bg-zinc-700 text-zinc-400',
        ].join(' ')}>
          {ach.earned ? 'Unlocked' : 'Locked'}
        </span>
      </div>
    </div>
  )
}

export function AchievementsPage() {
  const { appid } = useParams<{ appid?: string }>()
  const [inputAppid, setInputAppid] = useState(appid ?? '')
  const [activeAppid, setActiveAppid] = useState(appid ?? null)
  const [dataFiles, setDataFiles] = useState<string[]>([])
  const { achievements, watching, refresh } = useAchievements(activeAppid)

  const achList = Object.entries(achievements).map(([name, a]) => ({ name, ...a }))
  const unlocked = achList.filter((a) => a.earned)

  const findFiles = useCallback(async (id: string) => {
    if (!id || !window.ucAchievements) return
    const result = await window.ucAchievements.findFiles(id)
    setDataFiles(result?.files ?? [])
  }, [])

  useEffect(() => {
    if (activeAppid) findFiles(activeAppid)
  }, [activeAppid, findFiles])

  const handleSearch = () => {
    setActiveAppid(inputAppid.trim() || null)
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Trophy className="h-6 w-6 text-yellow-400" />
        <h1 className="text-xl font-bold text-white">Achievements</h1>
      </div>

      {/* App ID lookup */}
      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 rounded-lg bg-zinc-800 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Enter game App ID (e.g. 570)"
          value={inputAppid}
          onChange={(e) => setInputAppid(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button variant="outline" size="sm" onClick={handleSearch}>
          <FolderSearch className="h-4 w-4 mr-2" />
          Find
        </Button>
        {activeAppid && (
          <Button variant="ghost" size="sm" onClick={() => refresh()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Data source info */}
      {dataFiles.length > 0 && (
        <div className="rounded-lg bg-zinc-800/50 border border-white/5 px-4 py-3">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">
            Data source{dataFiles.length > 1 ? 's' : ''}
          </p>
          {dataFiles.map((f, i) => (
            <p key={i} className="text-xs text-zinc-500 font-mono truncate">{f}</p>
          ))}
          {watching && (
            <p className="text-xs text-green-400 mt-1">• Live watching for unlocks</p>
          )}
        </div>
      )}

      {/* Stats bar */}
      {achList.length > 0 && (
        <div className="flex items-center gap-4 rounded-xl bg-zinc-800/50 border border-white/5 px-4 py-3">
          <Trophy className="h-5 w-5 text-yellow-400 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-white font-medium">
                {unlocked.length} / {achList.length} unlocked
              </span>
              <span className="text-zinc-400">
                {Math.round((unlocked.length / achList.length) * 100)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-yellow-400 transition-all"
                style={{ width: `${(unlocked.length / achList.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Achievement list */}
      {!activeAppid ? (
        <div className="text-center text-zinc-500 text-sm py-12">
          Enter a game App ID above to view its achievements.<br />
          <span className="text-xs text-zinc-600">
            Supports Goldberg SteamEmu saves and Steam userdata.
          </span>
        </div>
      ) : achList.length === 0 ? (
        <div className="text-center text-zinc-500 text-sm py-12">
          No achievement data found for App ID <span className="text-zinc-400 font-mono">{activeAppid}</span>.<br />
          <span className="text-xs text-zinc-600">
            Make sure the game has been launched at least once with SteamEmu or real Steam.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Unlocked first */}
          {[...unlocked, ...achList.filter((a) => !a.earned)].map((ach) => (
            <AchievementRow key={ach.name} ach={ach} />
          ))}
        </div>
      )}
    </div>
  )
}
