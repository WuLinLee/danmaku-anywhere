export class StaleTaskError extends Error {
  constructor() {
    super('task skipped because it went stale while waiting')
    this.name = 'StaleTaskError'
  }
}

export interface LimiterTaskOptions {
  // Checked when the task's turn comes. A stale task is skipped and rejects
  // with StaleTaskError instead of taking a slot.
  isStale?: () => boolean
  // A waiting task that is urgent when a slot frees up takes it ahead of the
  // tasks queued before it.
  isUrgent?: () => boolean
}

interface Waiter {
  start: () => void
  isUrgent?: () => boolean
}

export type Limiter = <T>(
  task: () => Promise<T>,
  options?: LimiterTaskOptions
) => Promise<T>

// One gate shared by every caller, so a burst of tasks from different places
// still runs at most `limit` at a time.
export function createLimiter(limit: number): Limiter {
  let active = 0
  const waiting: Waiter[] = []

  function takeNext(): Waiter | undefined {
    const urgent = waiting.findIndex((waiter) => waiter.isUrgent?.() === true)
    if (urgent !== -1) {
      return waiting.splice(urgent, 1)[0]
    }
    return waiting.shift()
  }

  function release() {
    const next = takeNext()
    if (next) {
      next.start()
      return
    }
    active--
  }

  function acquire(isUrgent?: () => boolean) {
    if (active < limit) {
      active++
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      waiting.push({ start: resolve, isUrgent })
    })
  }

  return async function run<T>(
    task: () => Promise<T>,
    options: LimiterTaskOptions = {}
  ): Promise<T> {
    if (options.isStale?.()) {
      throw new StaleTaskError()
    }
    await acquire(options.isUrgent)
    try {
      if (options.isStale?.()) {
        throw new StaleTaskError()
      }
      return await task()
    } finally {
      release()
    }
  }
}
