import { expect, test } from '@playwright/test'

test('manifest and service worker support offline reload of saved state', async ({
  baseURL,
  page,
  request,
}) => {
  const appBaseURL = baseURL ?? 'http://127.0.0.1:4173'
  const appOrigin = new URL(appBaseURL).origin
  const externalRequests: string[] = []

  page.on('request', (requestEvent) => {
    const requestUrl = new URL(requestEvent.url())

    if (requestUrl.origin !== appOrigin && requestUrl.protocol.startsWith('http')) {
      externalRequests.push(requestEvent.url())
    }
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Salah' })).toBeVisible()

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(manifestHref).toBeTruthy()

  const manifestResponse = await request.get(new URL(manifestHref!, appBaseURL).toString())
  expect(manifestResponse.ok()).toBe(true)

  const manifest = await manifestResponse.json()
  expect(manifest).toMatchObject({
    name: 'Salah',
    short_name: 'Salah',
    start_url: '/',
    scope: '/',
    display: 'standalone',
  })
  expect(manifest.icons.length).toBeGreaterThan(0)

  await page.getByLabel('Search bundled cities').fill('madinah')
  await page.getByRole('button', { name: 'Madinah, Saudi Arabia' }).click()
  await expect(page.locator('[aria-label="Selected location"]')).toContainText('Madinah, Saudi Arabia')

  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          if (!('serviceWorker' in navigator)) {
            return 'unsupported'
          }

          const registrations = await navigator.serviceWorker.getRegistrations()
          if (registrations.some((registration) => registration.active)) {
            return navigator.serviceWorker.controller ? 'controlled' : 'ready'
          }

          return 'pending'
        }),
      { timeout: 20_000 },
    )
    .toMatch(/controlled|ready/)

  const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller))
  if (!controlled) {
    await page.reload()
    await expect
      .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
      .toBe(true)
  }

  await page.context().setOffline(true)
  await page.reload()

  await expect(page.getByRole('heading', { name: 'Salah' })).toBeVisible()
  await expect(page.locator('[aria-label="Selected location"]')).toContainText('Madinah, Saudi Arabia')
  expect(externalRequests).toEqual([])
})
