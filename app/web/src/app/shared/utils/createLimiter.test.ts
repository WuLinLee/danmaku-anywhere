import { describe, expect, it, vi } from 'vitest'
import { createLimiter, StaleTaskError } from './createLimiter'

/**
 * Searches arrive from several callers over time rather than as one list, so
 * the limit has to live in a shared gate. A failing task must give its slot
 * back, a task that went stale while it waited must never run, and an urgent
 * waiting task takes the next free slot ahead of the others.
 */

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('createLimiter', () => {
  it('never runs more than the limit at once', async () => {
    const limit = createLimiter(2)
    const gates = [deferred(), deferred(), deferred()]
    let running = 0
    let peak = 0

    const runs = gates.map((gate) =>
      limit(async () => {
        running++
        peak = Math.max(peak, running)
        await gate.promise
        running--
      })
    )

    await vi.waitFor(() => expect(running).toBe(2))
    gates[0].resolve()
    await vi.waitFor(() => expect(running).toBe(2))
    gates[1].resolve()
    gates[2].resolve()
    await Promise.all(runs)

    expect(peak).toBe(2)
  })

  it('releases the slot when a task rejects', async () => {
    const limit = createLimiter(1)
    const gate = deferred()
    let running = 0

    const first = limit(async () => {
      running++
      await gate.promise
      running--
      throw new Error('search failed')
    })
    const second = limit(async () => {
      running++
      await gate.promise
      running--
      return 'ok'
    })

    await vi.waitFor(() => expect(running).toBe(1))
    gate.resolve()

    await expect(first).rejects.toThrow('search failed')
    await expect(second).resolves.toBe('ok')
  })

  it('skips a waiting task that went stale before its turn', async () => {
    const limit = createLimiter(1)
    const gate = deferred()
    let stale = false
    const staleTask = vi.fn(async () => 'stale')
    const fresh = vi.fn(async () => 'fresh')

    const first = limit(() => gate.promise)
    const second = limit(staleTask, { isStale: () => stale })
    const third = limit(fresh)

    stale = true
    gate.resolve()

    await expect(first).resolves.toBeUndefined()
    await expect(second).rejects.toBeInstanceOf(StaleTaskError)
    await expect(third).resolves.toBe('fresh')
    expect(staleTask).not.toHaveBeenCalled()
    expect(fresh).toHaveBeenCalledTimes(1)
  })

  it('rejects a task that is already stale without taking a slot', async () => {
    const limit = createLimiter(1)
    const task = vi.fn(async () => 'never')

    await expect(limit(task, { isStale: () => true })).rejects.toBeInstanceOf(
      StaleTaskError
    )
    await expect(limit(async () => 'next')).resolves.toBe('next')
    expect(task).not.toHaveBeenCalled()
  })

  it('hands the next free slot to an urgent task ahead of the queue', async () => {
    const limit = createLimiter(1)
    const gate = deferred()
    const order: string[] = []

    const first = limit(() => gate.promise)
    const rest = ['a', 'b', 'c'].map((name) =>
      limit(
        async () => {
          order.push(name)
        },
        { isUrgent: () => name === 'c' }
      )
    )

    gate.resolve()
    await first
    await Promise.all(rest)

    expect(order).toEqual(['c', 'a', 'b'])
  })
})
