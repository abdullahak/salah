import { defaultSettingsForCountry } from '../calculation/defaults'
import type { PrayerSettings, ResolvedLocation } from '../calculation/types'
import { defaultLocation } from '../location/cities'

const STORAGE_KEY = 'salah:app-state:v1'
const STORAGE_VERSION = 1

export type AppState = {
  version: typeof STORAGE_VERSION
  location: ResolvedLocation
  settings: PrayerSettings
}

export function createInitialState(): AppState {
  const location = defaultLocation()

  return {
    version: STORAGE_VERSION,
    location,
    settings: defaultSettingsForCountry(location.countryCode),
  }
}

export function loadAppState(): AppState {
  if (typeof localStorage === 'undefined') {
    return createInitialState()
  }

  const rawState = localStorage.getItem(STORAGE_KEY)
  if (!rawState) {
    return createInitialState()
  }

  try {
    const parsedState = JSON.parse(rawState) as AppState

    if (parsedState.version !== STORAGE_VERSION) {
      return createInitialState()
    }

    return parsedState
  } catch {
    return createInitialState()
  }
}

export function saveAppState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
