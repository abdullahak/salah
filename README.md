# Salah

Salah is a privacy-first PWA for Muslim prayer times and qiblah direction. The v1 app is static, runs in the browser, and calculates prayer times locally on-device.

## Development

```bash
npm install
npm run dev -- --host 0.0.0.0
```

This project is developed on a Raspberry Pi over SSH. Access dev servers from another machine with the Pi hostname or network IP, for example:

```text
http://pi:5173
http://192.168.4.57:5173
```

Do not use `localhost` from the remote machine; it points at the remote machine, not the Pi.

## Scripts

```bash
npm run dev
npm run lint
npm run test
npm run test:run
npm run build
npm run preview -- --host 0.0.0.0
```

## Production Direction

The production app is a static PWA. `npm run build` writes deployable assets to `dist/`. The intended production path is nginx static hosting on the Raspberry Pi with `salah.abdlh.com` pointing to it through the existing Cloudflare/Pi setup.

No backend, account system, analytics, or automatic external location lookup is required for v1.

## Automation

The Salah improvement cron defaults to `CODEX_AUTOMATION_AUTONOMY=deploy`: after one focused fix passes lint, tests, build, mobile browser checks, PWA checks, GitHub write checks, deploy-target checks, and live-site reachability, it should push, merge, deploy to `pi:/var/www/salah` or the local `/var/www/salah` path when already running on `pi`, verify `https://salah.abdlh.com`, close the issue, and clean up without human confirmation. It stops blocked only when a concrete gate cannot be satisfied automatically.
