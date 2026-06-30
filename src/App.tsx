import { useMemo, useState } from 'react'
import { defaultSettingsForCountry } from './calculation/defaults'
import {
  calculatePrayerTimes,
  calculateQiblahBearing,
  formatBearing,
} from './calculation/prayerTimes'
import type { CalculationMethodId, MadhabId, ResolvedLocation, TimeFormat } from './calculation/types'
import { searchOfflineCities } from './location/cities'
import { getBrowserLocation } from './location/geolocation'
import { createManualLocation, isValidLatitude, isValidLongitude } from './location/manual'
import { createInitialState, loadAppState, saveAppState, type AppState } from './settings/storage'
import './App.css'

const calculationMethods: { id: CalculationMethodId; label: string }[] = [
  { id: 'MuslimWorldLeague', label: 'Muslim World League' },
  { id: 'NorthAmerica', label: 'North America' },
  { id: 'Egyptian', label: 'Egyptian' },
  { id: 'UmmAlQura', label: 'Umm al-Qura' },
  { id: 'Karachi', label: 'Karachi' },
  { id: 'Singapore', label: 'Singapore' },
  { id: 'Turkey', label: 'Turkey' },
]

function App() {
  const [state, setState] = useState<AppState>(() => loadAppState())
  const [cityQuery, setCityQuery] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [locationMessage, setLocationMessage] = useState('')

  const today = useMemo(() => new Date(), [])
  const prayerTimes = useMemo(
    () => calculatePrayerTimes(state.location, today, state.settings, state.location.timezone),
    [state.location, state.settings, today],
  )
  const qiblahBearing = useMemo(() => calculateQiblahBearing(state.location), [state.location])
  const cityMatches = useMemo(() => searchOfflineCities(cityQuery), [cityQuery])

  function updateState(nextState: AppState) {
    setState(nextState)
    saveAppState(nextState)
  }

  function setLocation(location: ResolvedLocation) {
    updateState({
      ...state,
      location,
      settings: {
        ...state.settings,
        ...defaultSettingsForCountry(location.countryCode),
      },
    })
    setLocationMessage(`${location.label} is saved locally.`)
  }

  async function useCurrentLocation() {
    setLocationMessage('Requesting browser location...')
    const result = await getBrowserLocation()

    if (result.ok) {
      setLocation(result.location)
      return
    }

    setLocationMessage(result.message)
  }

  function saveManualCoordinates() {
    const parsedLatitude = Number(latitude)
    const parsedLongitude = Number(longitude)

    if (!isValidLatitude(parsedLatitude) || !isValidLongitude(parsedLongitude)) {
      setLocationMessage('Enter a latitude from -90 to 90 and longitude from -180 to 180.')
      return
    }

    setLocation(createManualLocation(parsedLatitude, parsedLongitude))
  }

  function updateSettings(partialSettings: Partial<AppState['settings']>) {
    updateState({
      ...state,
      settings: {
        ...state.settings,
        ...partialSettings,
      },
    })
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Private by default</p>
          <h1>Salah</h1>
          <p className="lede">
            Prayer times and qiblah direction calculated locally on this device.
          </p>
        </div>
        <div className="status-panel" aria-label="Selected location">
          <span>Saved location</span>
          <strong>{state.location.label}</strong>
          <small>
            {locationSourceLabel(state.location.source)} · {state.location.timezone}
          </small>
        </div>
      </section>

      <section className="dashboard" aria-label="Prayer dashboard">
        <div className="prayer-list">
          <div className="section-heading">
            <p>Today</p>
            <h2>Prayer times</h2>
          </div>
          <ul>
            {prayerTimes.map((prayer) => (
              <li key={prayer.name}>
                <span>{prayer.label}</span>
                <strong>{prayer.formatted}</strong>
              </li>
            ))}
          </ul>
        </div>

        <div className="qiblah-panel">
          <div className="section-heading">
            <p>Qiblah</p>
            <h2>{formatBearing(qiblahBearing)}</h2>
          </div>
          <div className="compass" style={{ '--bearing': `${qiblahBearing}deg` } as React.CSSProperties}>
            <div className="needle" aria-hidden="true" />
            <span>N</span>
          </div>
          <p>Face this bearing clockwise from true north.</p>
        </div>
      </section>

      <section className="controls" aria-label="Location and settings">
        <div className="control-group">
          <div className="section-heading">
            <p>Offline</p>
            <h2>Choose a city</h2>
          </div>
          <input
            type="search"
            value={cityQuery}
            onChange={(event) => setCityQuery(event.target.value)}
            placeholder="Search bundled cities"
            aria-label="Search bundled cities"
          />
          <div className="city-grid">
            {cityMatches.map((city) => (
              <button key={city.id} type="button" onClick={() => setLocation(city)}>
                {city.label}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <div className="section-heading">
            <p>Manual</p>
            <h2>Coordinates</h2>
          </div>
          <div className="coordinate-grid">
            <label>
              Latitude
              <input
                inputMode="decimal"
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
                placeholder="40.7128"
              />
            </label>
            <label>
              Longitude
              <input
                inputMode="decimal"
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
                placeholder="-74.0060"
              />
            </label>
          </div>
          <button type="button" className="primary-action" onClick={saveManualCoordinates}>
            Save coordinates
          </button>
        </div>

        <div className="control-group">
          <div className="section-heading">
            <p>Permission based</p>
            <h2>Current location</h2>
          </div>
          <p className="muted">The browser prompt appears only after pressing this button.</p>
          <button type="button" className="primary-action" onClick={useCurrentLocation}>
            Use my location
          </button>
          {locationMessage ? <p className="message">{locationMessage}</p> : null}
        </div>

        <div className="control-group settings-group">
          <div className="section-heading">
            <p>Local settings</p>
            <h2>Calculation</h2>
          </div>
          <label>
            Method
            <select
              value={state.settings.calculationMethod}
              onChange={(event) =>
                updateSettings({ calculationMethod: event.target.value as CalculationMethodId })
              }
            >
              {calculationMethods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Asr
            <select
              value={state.settings.madhab}
              onChange={(event) => updateSettings({ madhab: event.target.value as MadhabId })}
            >
              <option value="shafi">Standard</option>
              <option value="hanafi">Hanafi</option>
            </select>
          </label>
          <label>
            Time
            <select
              value={state.settings.timeFormat}
              onChange={(event) => updateSettings({ timeFormat: event.target.value as TimeFormat })}
            >
              <option value="12h">12 hour</option>
              <option value="24h">24 hour</option>
            </select>
          </label>
          <button type="button" onClick={() => updateState(createInitialState())}>
            Reset local data
          </button>
        </div>
      </section>
    </main>
  )
}

function locationSourceLabel(source: ResolvedLocation['source']): string {
  if (source === 'browser-geolocation') {
    return 'Browser location'
  }

  if (source === 'manual-coordinates') {
    return 'Manual coordinates'
  }

  return 'Offline city'
}

export default App
