import { describe, expect, it } from 'vitest'
import { normalizeDanmakuText, selectDensityDrops, type DensityCandidate } from './density'

function candidate(
  index: number,
  time: number,
  text: string,
  protectedComment = false
): DensityCandidate {
  return {
    index,
    time,
    text,
    mode: 'rtl',
    protected: protectedComment,
  }
}

describe('adaptive danmaku density', () => {
  it('normalizes common repeated-character variants for collapse grouping', () => {
    expect(normalizeDanmakuText('哈哈哈哈')).toBe(normalizeDanmakuText('哈哈哈'))
    expect(normalizeDanmakuText('２３３３３３')).toBe(normalizeDanmakuText('233'))
  })

  it('keeps all candidates at density 100', () => {
    const comments = Array.from({ length: 80 }, (_, i) =>
      candidate(i, i * 0.05, `comment ${i}`)
    )
    expect(selectDensityDrops(comments, 100, 5, 25, 0.8).size).toBe(0)
  })

  it('does not thin naturally sparse parts, even at low density', () => {
    const comments = [0, 2, 4, 6, 8].map((time, i) =>
      candidate(i, time, `sparse comment ${i}`)
    )
    expect(selectDensityDrops(comments, 0, 5, 25, 0.8).size).toBe(0)
  })

  it('filters dense moments more aggressively at lower settings', () => {
    const comments = Array.from({ length: 100 }, (_, i) =>
      candidate(
        i,
        i * 0.05,
        i % 4 === 0 ? '哈哈哈哈哈哈' : `不同内容第${i}条评论`
      )
    )
    const low = selectDensityDrops(comments, 10, 5, 25, 0.8)
    const high = selectDensityDrops(comments, 85, 5, 25, 0.8)
    expect(low.size).toBeGreaterThan(high.size)
    expect(low.size).toBeGreaterThan(0)
  })

  it('keeps whitelisted or collapsed representatives while counting their load', () => {
    const comments = Array.from({ length: 40 }, (_, i) =>
      candidate(i, i * 0.05, `comment ${i}`, i === 0)
    )
    const drops = selectDensityDrops(comments, 0, 5, 25, 0.8)
    expect(drops.has(0)).toBe(false)
    expect(drops.size).toBeGreaterThan(0)
  })
})
