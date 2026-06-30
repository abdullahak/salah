import type { ResolvedLocation } from '../calculation/types'

export function createManualLocation(latitude: number, longitude: number): ResolvedLocation {
  return {
    id: 'manual-coordinates',
    label: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    latitude,
    longitude,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    source: 'manual-coordinates',
  }
}

export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90
}

export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180
}
