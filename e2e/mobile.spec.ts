import { expect, test } from '@playwright/test'

test('core mobile flows fit the viewport and persist locally', async ({ page }) => {
  await page.goto('/')
  const selectedLocation = page.locator('[aria-label="Selected location"]')

  await expect(page.getByRole('heading', { name: 'Salah' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Prayer times' })).toBeVisible()
  await expect(selectedLocation).toContainText('Makkah, Saudi Arabia')

  await expect(async () => {
    const overflow = await page.evaluate(() => ({
      body: document.body.scrollWidth - document.body.clientWidth,
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }))

    expect(overflow.body).toBeLessThanOrEqual(1)
    expect(overflow.document).toBeLessThanOrEqual(1)
  }).toPass()

  const smallTargets = await page.locator('button, input, select').evaluateAll((elements) =>
    elements
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        const style = window.getComputedStyle(element)

        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden'
      })
      .map((element) => {
        const rect = element.getBoundingClientRect()

        return {
          label:
            element.getAttribute('aria-label') ||
            element.textContent?.trim() ||
            element.getAttribute('placeholder') ||
            element.tagName,
          width: rect.width,
          height: rect.height,
        }
      })
      .filter((target) => target.width < 40 || target.height < 40),
  )

  expect(smallTargets).toEqual([])

  await page.getByLabel('Search bundled cities').fill('london')
  await page.getByRole('button', { name: 'London, United Kingdom' }).click()
  await expect(selectedLocation).toContainText('London, United Kingdom')

  await page.getByLabel('Latitude').fill('40.7128')
  await page.getByLabel('Longitude').fill('-74.0060')
  await page.getByRole('button', { name: 'Save coordinates' }).click()
  await expect(selectedLocation).toContainText('40.7128, -74.0060')

  await page.getByLabel('Method').selectOption('NorthAmerica')
  await page.getByLabel('Asr').selectOption('hanafi')
  await page.getByLabel('Time').selectOption('24h')
  await page.reload()

  await expect(selectedLocation).toContainText('40.7128, -74.0060')
  await expect(page.getByLabel('Method')).toHaveValue('NorthAmerica')
  await expect(page.getByLabel('Asr')).toHaveValue('hanafi')
  await expect(page.getByLabel('Time')).toHaveValue('24h')
})

test('offline city search and manual coordinates work after app shell load', async ({ page }) => {
  await page.goto('/')
  const selectedLocation = page.locator('[aria-label="Selected location"]')
  await page.context().setOffline(true)

  await page.getByLabel('Search bundled cities').fill('karachi')
  await page.getByRole('button', { name: 'Karachi, Pakistan' }).click()
  await expect(selectedLocation).toContainText('Karachi, Pakistan')

  await page.getByLabel('Latitude').fill('21.3891')
  await page.getByLabel('Longitude').fill('39.8579')
  await page.getByRole('button', { name: 'Save coordinates' }).click()
  await expect(selectedLocation).toContainText('21.3891, 39.8579')
})

test('geolocation grant saves a local browser location', async ({ page, context }) => {
  await context.setGeolocation({ latitude: 40.7128, longitude: -74.006 })
  await context.grantPermissions(['geolocation'])

  await page.goto('/')
  await page.getByRole('button', { name: 'Use my location' }).click()

  await expect(page.getByText('Current location is saved locally.')).toBeVisible()
  await expect(page.locator('[aria-label="Selected location"]')).toContainText('Current location')
  await expect(page.locator('[aria-label="Selected location"]')).toContainText('Browser location')
})

test('geolocation denial keeps manual and offline alternatives available', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (
          _success: PositionCallback,
          error?: PositionErrorCallback | null,
        ) => {
          error?.({
            code: 1,
            message: 'Permission denied',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError)
        },
      },
    })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Use my location' }).click()

  await expect(
    page.getByText('Location permission was denied. You can still choose a city or enter coordinates.'),
  ).toBeVisible()
  await expect(page.getByLabel('Search bundled cities')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save coordinates' })).toBeVisible()
})
