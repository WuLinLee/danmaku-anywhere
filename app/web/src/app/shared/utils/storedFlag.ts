export function readStoredFlag(key: string, fallback: boolean): boolean {
  if (typeof localStorage === 'undefined') {
    return fallback
  }
  try {
    const value = localStorage.getItem(key)
    if (value === null) {
      return fallback
    }
    return value === 'true'
  } catch {
    return fallback
  }
}

export function writeStoredFlag(key: string, value: boolean): void {
  if (typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // localStorage throws in private browsing, the caller's signal still holds the value
  }
}
