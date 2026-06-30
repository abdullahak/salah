import type { ResolvedLocation } from '../calculation/types'

export type GeolocationResult =
  | { ok: true; location: ResolvedLocation }
  | { ok: false; message: string }

export function getBrowserLocation(): Promise<GeolocationResult> {
  if (!navigator.geolocation) {
    return Promise.resolve({
      ok: false,
      message: 'Browser geolocation is not available on this device.',
    })
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          ok: true,
          location: {
            id: 'browser-geolocation',
            label: 'Current location',
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            source: 'browser-geolocation',
          },
        })
      },
      (error) => {
        resolve({
          ok: false,
          message: geolocationErrorMessage(error),
        })
      },
      {
        enableHighAccuracy: false,
        maximumAge: 15 * 60 * 1000,
        timeout: 10 * 1000,
      },
    )
  })
}

function geolocationErrorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return 'Location permission was denied. You can still choose a city or enter coordinates.'
  }

  if (error.code === error.TIMEOUT) {
    return 'Location lookup timed out. You can try again or enter a location manually.'
  }

  return 'Location is unavailable right now. You can choose a city or enter coordinates.'
}
