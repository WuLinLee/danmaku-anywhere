import {
  createEnvironmentInjector,
  EnvironmentInjector,
  runInInjectionContext,
} from '@angular/core'
import { TestBed } from '@angular/core/testing'
import {
  type KazumiPolicy,
  zKazumiPolicy,
} from '@danmaku-anywhere/extension-protocol'
import {
  injectQuery,
  provideQueryClient,
  QueryClient,
} from '@tanstack/angular-query-experimental'
import { defer, finalize, from, type Observable, throwError } from 'rxjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ExtensionMessagingService } from '../../../core/extension/extension-messaging.service'
import { queryKeys } from '../../../shared/query/queryKeys'
import { KazumiService } from './kazumi.service'
import { KazumiSearchPreferences } from './kazumi-search-preferences'

/**
 * Importing a rule fetches its file and stores it for search. A rule the
 * scraper cannot run (api mode) must be refused with a reason the settings
 * panel can show next to that rule, and the reason must not bleed into
 * other rules or survive a retry of the same rule.
 *
 * Searching opens a browser window per rule, so by default only the rule tabs
 * the user opens for the current keyword are searched. The "search all rules"
 * switch searches every runnable rule through a shared three-slot cap, with
 * the active tab first. A keyword change drops the searches still waiting for
 * the old keyword, and leaving the page keeps the ones already started.
 */

const apiRule = {
  api: '8',
  type: 'anime',
  name: 'xfdmnext',
  version: '1.1',
  baseURL: 'https://next.xifanacg.com/',
  searchMode: 'api',
  chapterMode: 'api',
  searchURL: '',
  searchList: '',
  searchName: '',
  searchResult: '',
  chapterRoads: '',
  chapterResult: '',
  searchApiConfig: { request: { method: 'POST', url: 'https://example.com' } },
}

const brokenXPathRule = {
  api: '4',
  type: 'anime',
  name: 'broken',
  version: '1.0',
  baseURL: 'https://example.com/',
  searchURL: '',
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('KazumiService.addPolicyMutation', () => {
  let service: KazumiService
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    TestBed.configureTestingModule({
      providers: [
        provideQueryClient(
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        ),
      ],
    })
    service = TestBed.inject(KazumiService)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('refuses an api mode rule and records why', async () => {
    fetchMock.mockResolvedValue(jsonResponse(apiRule))

    await expect(
      service.addPolicyMutation.mutateAsync('xfdmnext')
    ).rejects.toThrow('API 模式')

    const requestedUrl = String(fetchMock.mock.calls[0][0])
    expect(requestedUrl).toContain('file=xfdmnext.json')
    expect(service.$importErrors().get('xfdmnext')).toContain('API 模式')
    expect(service.$inProgressImports().has('xfdmnext')).toBe(false)
  })

  it('keeps one reason per rule', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(apiRule))
    fetchMock.mockResolvedValueOnce(jsonResponse(brokenXPathRule))

    await expect(
      service.addPolicyMutation.mutateAsync('xfdmnext')
    ).rejects.toThrow()
    await expect(
      service.addPolicyMutation.mutateAsync('broken')
    ).rejects.toThrow()

    expect(service.$importErrors().get('xfdmnext')).toContain('API 模式')
    expect(service.$importErrors().get('broken')).toBe(
      'Schema validation failed'
    )
  })

  it("clears the rule's reason when it is imported again", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(apiRule))
    await expect(
      service.addPolicyMutation.mutateAsync('xfdmnext')
    ).rejects.toThrow()

    const neverResolves = new Promise<Response>(() => undefined)
    fetchMock.mockReturnValueOnce(neverResolves)
    service.addPolicyMutation.mutate('xfdmnext')
    await vi.waitFor(() => {
      expect(service.$inProgressImports().has('xfdmnext')).toBe(true)
    })

    expect(service.$importErrors().has('xfdmnext')).toBe(false)
  })
})

function makeXPathRule(name: string) {
  return zKazumiPolicy.parse({
    ...brokenXPathRule,
    name,
    searchURL: 'https://example.com/search?wd=@keyword',
    searchList: '//div',
    searchName: '//a',
    searchResult: '//a',
    chapterRoads: '//div',
    chapterResult: '//a',
  })
}

interface SearchPayload {
  keyword: string
  policy: KazumiPolicy
}

interface Gate {
  promise: Promise<unknown[]>
  resolve: (value: unknown[]) => void
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function gateKey(payload: SearchPayload) {
  return `${payload.policy.name}:${payload.keyword}`
}

describe('KazumiService rule search', () => {
  let service: KazumiService
  let preferences: KazumiSearchPreferences
  let queryClient: QueryClient

  const xpathRules = ['rule1', 'rule2', 'rule3', 'rule4', 'rule5'].map(
    makeXPathRule
  )
  const parsedApiRule = zKazumiPolicy.parse(apiRule)
  const allRules = [...xpathRules, parsedApiRule]

  let active = 0
  let peak = 0
  const searchCalls: SearchPayload[] = []
  const gates = new Map<string, Gate>()

  function single(action: string, payload: SearchPayload): Observable<unknown> {
    if (action !== 'kazumiSearch') {
      return throwError(() => new Error(`unexpected action: ${action}`))
    }
    searchCalls.push(payload)
    return defer(() => {
      active++
      peak = Math.max(peak, active)
      const gate = deferred<unknown[]>()
      gates.set(gateKey(payload), gate)
      return from(gate.promise).pipe(
        finalize(() => {
          active--
        })
      )
    })
  }

  function searched() {
    return searchCalls.map(gateKey)
  }

  function finish(key: string) {
    const gate = gates.get(key)
    if (!gate) {
      throw new Error(`no search in flight for ${key}`)
    }
    gate.resolve([])
  }

  // The tab badge and the result panel both observe the search through
  // injectQuery, so the test subscribes the same way the components do. The
  // observers live in their own injector so a test can destroy them the way
  // leaving the search page does.
  function observeAllRules() {
    const injector = createEnvironmentInjector(
      [],
      TestBed.inject(EnvironmentInjector)
    )
    runInInjectionContext(injector, () =>
      allRules.map((policy) =>
        injectQuery(() =>
          service.getSearchQueryOptions(service.$searchQuery(), policy)
        )
      )
    )
    return injector
  }

  function configureTestBed() {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    })
    queryClient.setQueryData(queryKeys.kazumi.local.all(), allRules)
    TestBed.configureTestingModule({
      providers: [
        provideQueryClient(queryClient),
        {
          provide: ExtensionMessagingService,
          useValue: { single: vi.fn(single) },
        },
      ],
    })
    service = TestBed.inject(KazumiService)
    preferences = TestBed.inject(KazumiSearchPreferences)
  }

  beforeEach(() => {
    localStorage.clear()
    active = 0
    peak = 0
    searchCalls.length = 0
    gates.clear()
    configureTestBed()
  })

  afterEach(() => {
    TestBed.resetTestingModule()
  })

  it('is off until the user turns it on, and remembers the choice', () => {
    expect(preferences.$searchAllRules()).toBe(false)

    preferences.setSearchAllRules(true)

    TestBed.resetTestingModule()
    configureTestBed()
    expect(preferences.$searchAllRules()).toBe(true)
  })

  it('searches only the rule tabs the user opens while the switch is off', async () => {
    observeAllRules()

    service.updateQuery('frieren')
    TestBed.tick()

    await vi.waitFor(() => {
      expect(searched()).toEqual(['rule1:frieren'])
    })
    finish('rule1:frieren')
    await vi.waitFor(() => {
      expect(active).toBe(0)
    })

    service.setActivePolicy(xpathRules[2])
    TestBed.tick()
    await vi.waitFor(() => {
      expect(searched()).toEqual(['rule1:frieren', 'rule3:frieren'])
    })
    finish('rule3:frieren')
    await vi.waitFor(() => {
      expect(active).toBe(0)
    })

    service.setActivePolicy(xpathRules[0])
    TestBed.tick()
    await Promise.resolve()
    expect(searched()).toEqual(['rule1:frieren', 'rule3:frieren'])
    expect(peak).toBe(1)
  })

  it('starts a new keyword with only the active tab while the switch is off', async () => {
    observeAllRules()

    service.updateQuery('frieren')
    TestBed.tick()
    await vi.waitFor(() => {
      expect(searched()).toEqual(['rule1:frieren'])
    })
    finish('rule1:frieren')

    for (const rule of [xpathRules[2], xpathRules[4]]) {
      service.setActivePolicy(rule)
      TestBed.tick()
      await vi.waitFor(() => {
        expect(searched()).toContain(`${rule.name}:frieren`)
      })
      finish(`${rule.name}:frieren`)
    }
    await vi.waitFor(() => {
      expect(active).toBe(0)
    })

    service.updateQuery('mushoku')
    TestBed.tick()
    await vi.waitFor(() => {
      expect(searched()).toContain('rule5:mushoku')
    })
    finish('rule5:mushoku')
    await vi.waitFor(() => {
      expect(active).toBe(0)
    })

    expect(searched().filter((key) => key.endsWith(':mushoku'))).toEqual([
      'rule5:mushoku',
    ])
    expect(peak).toBe(1)
  })

  it('searches every runnable rule at most three at a time while the switch is on', async () => {
    preferences.setSearchAllRules(true)
    observeAllRules()

    service.updateQuery('  frieren  ')
    TestBed.tick()

    await vi.waitFor(() => {
      expect(gates.size).toBe(3)
    })
    expect(searched()).toEqual([
      'rule1:frieren',
      'rule2:frieren',
      'rule3:frieren',
    ])
    expect(peak).toBe(3)

    finish('rule1:frieren')
    finish('rule2:frieren')
    finish('rule3:frieren')
    await vi.waitFor(() => {
      expect(gates.size).toBe(5)
    })
    expect(peak).toBe(3)

    finish('rule4:frieren')
    finish('rule5:frieren')
    await vi.waitFor(() => {
      expect(active).toBe(0)
    })
    expect(searched()).toEqual([
      'rule1:frieren',
      'rule2:frieren',
      'rule3:frieren',
      'rule4:frieren',
      'rule5:frieren',
    ])
  })

  it('keeps the searches running when every observer leaves and comes back', async () => {
    preferences.setSearchAllRules(true)
    const observers = observeAllRules()

    service.updateQuery('frieren')
    TestBed.tick()
    await vi.waitFor(() => {
      expect(gates.size).toBe(3)
    })

    observers.destroy()
    TestBed.tick()
    finish('rule1:frieren')
    await vi.waitFor(() => {
      expect(gates.size).toBe(4)
    })

    observeAllRules()
    TestBed.tick()
    finish('rule2:frieren')
    finish('rule3:frieren')
    finish('rule4:frieren')
    await vi.waitFor(() => {
      expect(gates.size).toBe(5)
    })
    finish('rule5:frieren')
    await vi.waitFor(() => {
      expect(active).toBe(0)
    })

    expect(searched()).toEqual([
      'rule1:frieren',
      'rule2:frieren',
      'rule3:frieren',
      'rule4:frieren',
      'rule5:frieren',
    ])
    for (const rule of xpathRules) {
      expect(
        queryClient.getQueryData(queryKeys.kazumi.search(rule.name, 'frieren'))
      ).toEqual([])
    }
  })

  it('lets the active tab take the next free slot ahead of the queue', async () => {
    preferences.setSearchAllRules(true)
    observeAllRules()

    service.updateQuery('frieren')
    TestBed.tick()
    await vi.waitFor(() => {
      expect(gates.size).toBe(3)
    })

    service.setActivePolicy(xpathRules[4])
    TestBed.tick()
    finish('rule1:frieren')
    await vi.waitFor(() => {
      expect(gates.size).toBe(4)
    })
    expect(searched()[3]).toBe('rule5:frieren')

    finish('rule2:frieren')
    finish('rule3:frieren')
    finish('rule5:frieren')
    await vi.waitFor(() => {
      expect(gates.size).toBe(5)
    })
    finish('rule4:frieren')
    await vi.waitFor(() => {
      expect(active).toBe(0)
    })
  })

  it('drops the searches still waiting for the old keyword when it changes', async () => {
    preferences.setSearchAllRules(true)
    observeAllRules()

    service.updateQuery('frieren')
    TestBed.tick()
    await vi.waitFor(() => {
      expect(gates.size).toBe(3)
    })

    service.updateQuery('mushoku')
    TestBed.tick()

    finish('rule1:frieren')
    finish('rule2:frieren')
    finish('rule3:frieren')
    await vi.waitFor(() => {
      expect(gates.size).toBe(6)
    })
    expect(searched()).not.toContain('rule4:frieren')
    expect(searched()).not.toContain('rule5:frieren')
    expect(searched().slice(3)).toEqual([
      'rule1:mushoku',
      'rule2:mushoku',
      'rule3:mushoku',
    ])
    expect(peak).toBe(3)

    finish('rule1:mushoku')
    finish('rule2:mushoku')
    finish('rule3:mushoku')
    await vi.waitFor(() => {
      expect(gates.size).toBe(8)
    })
    finish('rule4:mushoku')
    finish('rule5:mushoku')
    await vi.waitFor(() => {
      expect(active).toBe(0)
    })
    expect(searched().filter((key) => key.endsWith(':frieren'))).toEqual([
      'rule1:frieren',
      'rule2:frieren',
      'rule3:frieren',
    ])
    expect(peak).toBe(3)
  })

  it('uses the normalized keyword for the cache key and the search', () => {
    const options = service.getSearchQueryOptions('  frieren  ', xpathRules[0])

    expect(options.queryKey).toEqual(
      queryKeys.kazumi.search('rule1', 'frieren')
    )
  })

  it('never searches a rule the scraper cannot run', () => {
    preferences.setSearchAllRules(true)

    expect(
      service.getSearchQueryOptions('frieren', xpathRules[0]).enabled
    ).toBe(true)
    expect(
      service.getSearchQueryOptions('frieren', parsedApiRule).enabled
    ).toBe(false)
  })

  it('waits for a keyword', () => {
    preferences.setSearchAllRules(true)

    expect(service.getSearchQueryOptions('   ', xpathRules[0]).enabled).toBe(
      false
    )
  })
})
