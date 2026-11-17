import { Injectable, signal } from '@angular/core'
import {
  readStoredFlag,
  writeStoredFlag,
} from '../../../shared/utils/storedFlag'

const SEARCH_ALL_RULES_STORAGE_KEY = 'da-kazumi-search-all-rules'

// Kept apart from KazumiService so the settings panel can read the switch
// without constructing the rule database and the search queries.
@Injectable({ providedIn: 'root' })
export class KazumiSearchPreferences {
  private readonly $_searchAllRules = signal(
    readStoredFlag(SEARCH_ALL_RULES_STORAGE_KEY, false)
  )
  readonly $searchAllRules = this.$_searchAllRules.asReadonly()

  setSearchAllRules(enabled: boolean) {
    this.$_searchAllRules.set(enabled)
    writeStoredFlag(SEARCH_ALL_RULES_STORAGE_KEY, enabled)
  }
}
