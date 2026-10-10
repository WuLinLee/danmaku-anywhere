/**
 * Adaptive danmaku density filtering.
 *
 * This is a soft visual-load filter, not a per-second or on-screen count cap.
 * Similar/repeated text is normalized separately for the existing collapse pass.
 */

export type DensityMode = 'ltr' | 'rtl' | 'top' | 'bottom'

export interface DensityCandidate {
  /** Index in the original, time-sorted comment array. */
  index: number
  time: number
  text: string
  mode: DensityMode
  /** Whitelisted comments and collapse heads contribute to load but are never dropped. */
  protected: boolean
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/**
 * Normalize common repeat-spam variants for collapse grouping.
 * Examples: "哈哈哈哈" and "哈哈哈" both become "哈哈"; "233333" becomes "233".
 * NFKC also unifies full-width Latin letters/digits with their ASCII equivalents.
 */
export function normalizeDanmakuText(raw: string): string {
  const text = (raw ?? '').normalize('NFKC').trim().toLocaleLowerCase()
  if (!text) return ''
  return text.replace(/(.)\1{2,}/gu, '$1$1')
}

function visualCost(comment: DensityCandidate, fontSize: number): number {
  const length = Array.from(comment.text.trim()).length
  // Length is a proxy for occupied visual space; unlike a count cap, a long
  // comment consumes more of the local budget than a short one.
  const widthCost = 0.7 + Math.min(48, length) * 0.032
  const fontScale = clamp(fontSize / 25, 0.65, 1.75)
  const modeScale = comment.mode === 'top' || comment.mode === 'bottom' ? 1.3 : 1
  return widthCost * fontScale * modeScale
}

function informationScore(text: string): number {
  const original = Array.from((text ?? '').trim())
  if (original.length === 0) return 0.1

  const normalized = (text ?? '').normalize('NFKC').toLocaleLowerCase()
  const compressed = normalized.replace(/(.)\1{2,}/gu, '$1$1')
  const chars = Array.from(compressed)
  const diversity = new Set(chars).size / Math.max(1, chars.length)
  const variety = Math.min(1, new Set(chars).size / 8)
  const repeatPenalty = 1 - Math.min(1, chars.length / original.length)
  const symbolOnly = /^[\p{P}\p{S}\s]+$/u.test(normalized)

  // This is an intentionally light heuristic, not a claim to understand meaning.
  return clamp(
    0.2 + diversity * 0.4 + variety * 0.35 - repeatPenalty * 0.3 - (symbolOnly ? 0.15 : 0),
    0.05,
    1
  )
}

function stableUnitHash(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 0x100000000
}

/**
 * Returns source indices to skip. The rolling, centered window estimates the
 * visual load around each comment's display time. The slider changes a soft
 * budget continuously; comments are not queued, and rejected comments are not
 * replayed later.
 */
export function selectDensityDrops(
  candidates: readonly DensityCandidate[],
  density: number,
  stageDurationSec: number,
  fontSize: number,
  areaRatio: number
): Set<number> {
  const level = clamp(Number.isFinite(density) ? density : 50, 0, 100)
  const drops = new Set<number>()
  if (level >= 100 || candidates.length < 2) return drops

  const sorted = candidates
    .map((candidate) => ({
      ...candidate,
      cost: visualCost(candidate, fontSize),
    }))
    .sort((a, b) => a.time - b.time || a.index - b.index)

  const prefix = new Array<number>(sorted.length + 1).fill(0)
  for (let i = 0; i < sorted.length; i++) {
    prefix[i + 1] = prefix[i] + sorted[i].cost
  }

  // Use one display-lifetime-wide window. A centered window makes comments
  // with the same timestamp receive the same pressure score.
  const windowSec = Math.max(0.75, stageDurationSec)
  const halfWindow = windowSec / 2
  let left = 0
  let right = 0

  // Higher slider values permit greater visual load. This is a weighted load
  // budget, not a limit on how many comments can fit on screen.
  const areaFactor = clamp(areaRatio / 0.8, 0.4, 1.3)
  const budget = (8 + Math.pow(level / 100, 1.4) * 42) * areaFactor

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]
    const start = current.time - halfWindow
    const end = current.time + halfWindow

    while (left < sorted.length && sorted[left].time < start) left++
    if (right < left) right = left
    while (right < sorted.length && sorted[right].time <= end) right++

    const localLoad = prefix[right] - prefix[left]
    if (current.protected || localLoad <= budget) continue

    const overload = localLoad / budget - 1
    const pressure = 1 - Math.exp(-1.05 * Math.pow(overload, 1.25))
    const priority = informationScore(current.text)
    // Distinctive comments are somewhat more likely to survive than repeated
    // characters or punctuation-only spam, while no single threshold abruptly
    // turns the filter on or off.
    const dropChance = clamp(pressure * (1.08 - priority * 0.5), 0, 0.96)
    const stableRoll = stableUnitHash(
      `${Math.round(current.time * 1000)}|${current.mode}|${current.text}|${current.index}`
    )
    if (stableRoll < dropChance) drops.add(current.index)
  }

  return drops
}
