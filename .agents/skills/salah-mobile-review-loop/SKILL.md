---
name: salah-mobile-review-loop
description: Run the scheduled no-code Salah mobile-first PWA review loop. Use for standalone Codex automations or manual audits that assess /home/abdlh/repos/salah, https://salah.abdlh.com, mobile Chrome/Android and mobile Safari/iPhone behavior, PWA/offline/privacy flows, and GitHub issue creation with salah-review and mobile-first labels. Do not use for implementing fixes.
---

# Salah Mobile Review Loop

Run a fresh assessment of Salah as a privacy-first, mobile-first PWA. Keep the loop bounded: observe current state, use recorded evidence, run or inspect checks, record findings as deduplicated GitHub issues, and stop. Never change app code while using this skill. Do not make claims that are not backed by a command log, browser observation, live-site observation, local file inspection, or issue snapshot.

## Workflow

1. Start from `/home/abdlh/repos/salah`. Verify the GitHub repo is `abdullahak/salah`, preserve unrelated work, fetch the latest `main`, and base the review on current `main`.
2. Read the current repo docs before judging behavior: `README.md`, `PRODUCT_SPEC.md`, `ARCHITECTURE.md`, `package.json`, and the relevant app/PWA files.
3. When an automation run provides an `evidence.md` file, read it first and cite only facts supported by it, check logs, local inspection, or live browser output. Do not infer failures from the prompt alone.
4. Create missing GitHub labels when the available GitHub tool or `gh` supports it: `salah-review`, `mobile-first`, `automation-ready`, `needs-human`, `priority-high`, `priority-medium`, and `priority-low`. If label creation is unavailable, continue and report that gap.
5. Run or inspect the local checks that exist without adding new dependencies: `npm run lint`, `npm run test`, `npm run build`, `npm run test:mobile`, and `npm run test:pwa`. Treat configured browser/PWA failures as evidence, not as optional coverage.
6. Inspect the production build artifacts in `dist/` after build. Check manifest, service worker generation, asset paths, installability basics, and offline fallback behavior.
7. Test the app as mobile-first. Prioritize Android/Chrome-sized and iPhone/Safari/WebKit-sized viewports; use desktop only as smoke coverage. Check layout, touch targets, text wrapping, viewport fit, horizontal scroll, and control ergonomics.
8. Exercise the core privacy and offline flows: offline city search, saved settings persistence, manual coordinates, geolocation grant and deny paths, calculation method, madhab, time format, reset behavior, and normal-load network behavior. The app must not require accounts, analytics, a backend, or automatic external location lookup.
9. Check live site health at `https://salah.abdlh.com`, including HTTP status, app shell load, manifest/service worker reachability, mobile viewport rendering, and obvious production-only regressions.
10. Deduplicate findings against open GitHub issues before writing. Compare symptom, affected flow, reproduction steps, and acceptance criteria. Prefer updating an existing issue when the same defect already exists. If running in an assessor pass, do not write issues; return proposed issue actions only.
11. For each material finding, create or update one GitHub issue with evidence, reproduction steps, priority, acceptance criteria, and labels: `salah-review`, `mobile-first`, and exactly one of `priority-high`, `priority-medium`, or `priority-low`. Add `needs-human` if safe automation is blocked by policy, secrets, permissions, infrastructure, or ambiguous product decisions.
12. If GitHub authorization, label creation, browser capability, live-site access, or required evidence is missing, do not invent results and do not write partial issues. Stop as blocked with the specific missing capability and next action.

## Priorities

- `priority-high`: broken production build or live site, install/offline failure, privacy leak, unusable primary mobile flow, or data persistence loss.
- `priority-medium`: degraded mobile UX, accessibility/touch-target issue, confusing settings behavior, partial PWA/offline defect, or flaky but reproducible core flow.
- `priority-low`: polish issue, secondary desktop defect, minor copy/layout problem, or non-blocking diagnostic improvement.

## Stop States

- `clean-no-op`: all checks pass and no material issue is found. Report the commands and live/mobile evidence reviewed.
- `findings-recorded`: issues were created or updated. Report issue links, priorities, and evidence summary.
- `blocked`: a required tool, permission, network, GitHub access, browser capability, or live-site access is missing. Report what was completed and what exact access is needed.

## Structured Output

When the caller requests JSON, return JSON only. Include `stop_state`, `summary`, non-empty `evidence`, non-empty `checks`, `issues`, and `blockers`. Include evidence paths or concise evidence strings for every finding. For `findings-recorded`, every issue entry must include a GitHub URL, priority, action, and evidence. For `blocked`, every blocker must include `area`, `detail`, and `next_step`.
