/**
 * App-wide controller navigation.
 *
 * Maps gamepad buttons to DOM focus movement and click so the entire
 * app is navigable with just a controller.
 *
 * Focusable elements are queried via standard selectors so any button,
 * link, input or element with tabIndex is automatically included.
 *
 * Button layout (Xbox / PlayStation cross-mapping):
 *   D-Pad / Left Stick → move focus
 *   A (Cross)          → click focused element
 *   B (Circle)         → browser back / close modal
 *   LB / RB            → horizontal tab scroll
 *   LT / RT            → vertical page scroll
 *   Start              → toggle controller nav mode (on/off)
 */

import { useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

// Indices in GCPad's button array (matches gcpad::Button enum order)
const BTN = {
  A: 0, B: 1, X: 2, Y: 3,
  START: 4, SELECT: 5, GUIDE: 6,
  L1: 7, R1: 8, L2: 9, R2: 10, L3: 11, R3: 12,
  DPAD_UP: 13, DPAD_DOWN: 14, DPAD_LEFT: 15, DPAD_RIGHT: 16,
  TOUCHPAD: 17,
} as const

// GCPad axis indices
const AXIS = {
  LEFT_X: 0, LEFT_Y: 1,
  RIGHT_X: 2, RIGHT_Y: 3,
  LEFT_TRIGGER: 4, RIGHT_TRIGGER: 5,
} as const

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])', '[role="button"]', '[role="menuitem"]',
  '[role="option"]', '[role="tab"]', '[role="listitem"][tabindex]',
].join(',')

const DEADZONE = 0.35          // activation threshold for navigation
const SCROLL_DEADZONE = 0.20   // right-stick scroll starts responding sooner
const SCROLL_SPEED = 22        // max pixels/frame at full deflection (~1320 px/s at 60 fps)
const SCROLL_CURVE = 1.8       // exponential feel: slow at low deflection, fast at full
const REPEAT_INITIAL_MS = 380
const REPEAT_INTERVAL_MS = 100

// Returns a curved, deadzone-removed value in [-1, 1].
function applyDeadzoneCurve(value: number, deadzone: number, curve: number): number {
  const abs = Math.abs(value)
  if (abs <= deadzone) return 0
  const norm = (abs - deadzone) / (1 - deadzone)
  const curved = Math.pow(Math.min(norm, 1), curve)
  return value < 0 ? -curved : curved
}

interface NavState {
  enabled: boolean
  buttonHeld: Record<number, { since: number; lastFire: number }>
  axisHeld: Record<number, { neg: boolean; since: number; lastFire: number }>
  scrollAccum: { x: number; y: number }
}

function getFocusable(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest('[aria-hidden="true"]') && el.offsetParent !== null
  )
}

function moveFocus(direction: 'up' | 'down' | 'left' | 'right') {
  const elements = getFocusable()
  if (!elements.length) return

  const active = document.activeElement as HTMLElement | null
  const idx = active ? elements.indexOf(active) : -1

  if (direction === 'down' || direction === 'right') {
    const next = elements[idx + 1] ?? elements[0]
    next?.focus()
  } else {
    const prev = elements[idx - 1] ?? elements[elements.length - 1]
    prev?.focus()
  }
}

function clickFocused() {
  const el = document.activeElement as HTMLElement | null
  if (!el) return
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return
  el.click()
}

export function useControllerNav(enabled = true) {
  const navigate = useNavigate()
  const stateRef = useRef<NavState>({
    enabled,
    buttonHeld: {},
    axisHeld: {},
    scrollAccum: { x: 0, y: 0 },
  })

  const handleInput = useCallback((states: Array<{
    slot: number
    connected: boolean
    buttons: boolean[]
    axes: number[]
  }>) => {
    if (!stateRef.current.enabled) return

    const now = Date.now()

    for (const pad of states) {
      if (!pad?.connected) continue
      const { buttons, axes } = pad

      // ── Button handling ────────────────────────────────────────────────

      const shouldFire = (btnIdx: number): boolean => {
        const pressed = buttons[btnIdx]
        const held = stateRef.current.buttonHeld[btnIdx]
        if (pressed) {
          if (!held) {
            stateRef.current.buttonHeld[btnIdx] = { since: now, lastFire: now }
            return true
          }
          if (now - held.since > REPEAT_INITIAL_MS && now - held.lastFire > REPEAT_INTERVAL_MS) {
            held.lastFire = now
            return true
          }
          return false
        }
        if (held) delete stateRef.current.buttonHeld[btnIdx]
        return false
      }

      // D-pad navigation
      if (shouldFire(BTN.DPAD_UP))    moveFocus('up')
      if (shouldFire(BTN.DPAD_DOWN))  moveFocus('down')
      if (shouldFire(BTN.DPAD_LEFT))  moveFocus('left')
      if (shouldFire(BTN.DPAD_RIGHT)) moveFocus('right')

      // A → click
      if (shouldFire(BTN.A)) clickFocused()

      // B → go back
      if (shouldFire(BTN.B)) {
        const el = document.activeElement as HTMLElement | null
        if (el && el !== document.body) {
          el.blur()
        } else {
          navigate(-1)
        }
      }

      // LB / RB → horizontal tab (shift-tab / tab)
      if (shouldFire(BTN.L1)) moveFocus('left')
      if (shouldFire(BTN.R1)) moveFocus('right')

      // ── Left stick navigation ──────────────────────────────────────────

      const lx = axes[AXIS.LEFT_X] ?? 0
      const ly = axes[AXIS.LEFT_Y] ?? 0

      const stickFire = (axisId: number, value: number, isNeg: boolean): boolean => {
        const active = Math.abs(value) > DEADZONE
        const held = stateRef.current.axisHeld[axisId]
        if (active) {
          if (!held || held.neg !== isNeg) {
            stateRef.current.axisHeld[axisId] = { neg: isNeg, since: now, lastFire: now }
            return true
          }
          if (now - held.since > REPEAT_INITIAL_MS && now - held.lastFire > REPEAT_INTERVAL_MS) {
            held.lastFire = now
            return true
          }
          return false
        }
        if (held) delete stateRef.current.axisHeld[axisId]
        return false
      }

      if (stickFire(AXIS.LEFT_Y, ly, ly < 0)) moveFocus(ly < 0 ? 'up' : 'down')
      if (stickFire(AXIS.LEFT_X, lx, lx < 0)) moveFocus(lx < 0 ? 'left' : 'right')

      // ── Right stick → scroll ──────────────────────────────────────────

      const rx = axes[AXIS.RIGHT_X] ?? 0
      const ry = axes[AXIS.RIGHT_Y] ?? 0
      const scrollTarget = (document.activeElement?.closest('[data-scroll]') ??
        document.scrollingElement ?? document.documentElement) as Element

      const rxC = applyDeadzoneCurve(rx, SCROLL_DEADZONE, SCROLL_CURVE)
      const ryC = applyDeadzoneCurve(ry, SCROLL_DEADZONE, SCROLL_CURVE)

      if (rxC !== 0) {
        stateRef.current.scrollAccum.x += rxC * SCROLL_SPEED
        const ticks = Math.trunc(stateRef.current.scrollAccum.x)
        if (ticks !== 0) {
          stateRef.current.scrollAccum.x -= ticks
          scrollTarget?.scrollBy({ left: ticks, behavior: 'instant' as ScrollBehavior })
        }
      } else {
        stateRef.current.scrollAccum.x = 0
      }

      if (ryC !== 0) {
        stateRef.current.scrollAccum.y += ryC * SCROLL_SPEED
        const ticks = Math.trunc(stateRef.current.scrollAccum.y)
        if (ticks !== 0) {
          stateRef.current.scrollAccum.y -= ticks
          scrollTarget?.scrollBy({ top: ticks, behavior: 'instant' as ScrollBehavior })
        }
      } else {
        stateRef.current.scrollAccum.y = 0
      }

      // ── Triggers → scroll pages ───────────────────────────────────────

      const lt = axes[AXIS.LEFT_TRIGGER] ?? 0
      const rt = axes[AXIS.RIGHT_TRIGGER] ?? 0
      if (lt > 0.5) window.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' })
      if (rt > 0.5) window.scrollBy({ top:  window.innerHeight * 0.8, behavior: 'smooth' })
    }
  }, [navigate])

  useEffect(() => {
    stateRef.current.enabled = enabled
  }, [enabled])

  useEffect(() => {
    if (!window.ucController) return

    const cleanup = window.ucController.onControllerInput((state) => {
      handleInput([state])
    })
    return cleanup
  }, [handleInput])
}
