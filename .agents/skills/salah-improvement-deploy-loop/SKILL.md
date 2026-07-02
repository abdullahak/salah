---
name: salah-improvement-deploy-loop
description: Run the scheduled Salah improvement and live deploy loop. Use for standalone Codex automations that pick one safe open abdullahak/salah issue labeled salah-review, implement one focused mobile-first PWA fix, verify it, merge it to latest main, deploy the static build to pi:/var/www/salah for https://salah.abdlh.com, close the issue, and clean up. Do not use for broad rewrites, dependency upgrades, privacy-sensitive behavior changes, or unsafe deployments.
---

# Salah Improvement Deploy Loop

Implement exactly one safe, high-value improvement from the Salah review backlog and roll it out automatically after current checks pass and deployment gates are healthy. Keep each run small enough to review and reverse. Use provided evidence and check logs before acting. Do not make claims that are not backed by a command log, browser observation, live-site observation, issue snapshot, remote state report, or deploy gate report.

## Workflow

1. Start from `/home/abdlh/repos/salah`. Preserve unrelated work, fetch the latest `main`, and confirm the GitHub repo is `abdullahak/salah`.
2. When an automation run provides an `evidence.md` file, read it first and use it to identify current checks, remote divergence, live-site state, and credential blockers.
3. Create missing GitHub labels when the available GitHub tool or `gh` supports it: `salah-review`, `mobile-first`, `automation-ready`, `needs-human`, `priority-high`, `priority-medium`, and `priority-low`. If label creation is unavailable, continue and report that gap.
4. Find open GitHub issues labeled `salah-review` and not labeled `needs-human`. Prefer `priority-high`, then `priority-medium`, then `priority-low`; within the same priority, prefer issues labeled `automation-ready`, then the oldest issue. Choose only an issue that can be fixed with a focused app-code change and verified locally.
5. Stop with a clean no-op if no safe issue exists. Add or suggest `needs-human` when an issue requires product judgment, secrets, DNS, nginx, Cloudflare, permissions, broad rewrites, dependency upgrades, privacy-sensitive behavior changes, or risky infrastructure work.
6. Create a fresh `codex/` branch from latest `main` when branch creation is available. Implement exactly one focused improvement for the chosen issue. Do not bundle unrelated cleanup, secondary fixes, broad rewrites, dependency upgrades, or product decisions not required by the issue.
7. Treat mobile-first behavior, PWA/offline behavior, and privacy invariants as acceptance gates. Normal app load must not add analytics, accounts, backend calls, automatic reverse geocoding, or unsolicited geolocation.
8. Run or inspect the available checks: `npm run lint`, `npm run test`, `npm run build`, `npm run test:mobile`, `npm run test:pwa`, and any other configured browser/PWA checks. Add or update focused tests when the fix changes calculation, persistence, city search, geolocation handling, settings behavior, or other logic that can be tested without brittle UI automation.
9. In verification passes, review the diff before reporting success. Return `prepared-fix` only when exactly one issue is addressed, the diff is focused, and required checks pass.
10. Rebase or merge latest `main` again before publishing. Resolve conflicts without dropping unrelated upstream work.
11. Push the branch and merge it only when checks pass and the diff remains focused. Use the repository's available merge path; do not force-push shared branches.
12. Deploy automatically after the fix is merged to `main` and the deployment gates are healthy: GitHub write access, clean branch state, deploy-target access, and live-site reachability. If running on host `pi`, deploy directly to local `/var/www/salah`; otherwise use SSH/rsync to `pi:/var/www/salah`. If local `main` and `origin/main` diverge, attempt normal reconciliation by fetching, rebasing, or merging latest `origin/main`; stop blocked only when conflicts, permissions, or failing checks prevent safe reconciliation. Build the final static assets from latest `main`, sync `dist/`, and verify `https://salah.abdlh.com` through Cloudflare on mobile-sized viewports.
13. Close the GitHub issue only after live verification passes. Include evidence: commit or merge reference, commands run, live URL checks, and mobile/PWA verification notes.
14. Clean up temporary local branches and Codex worktrees that this run created. Preserve branches or worktrees that contain user work or unresolved changes.

## Deployment Guardrails

Stop blocked instead of deploying when GitHub authorization, unreconcilable remote divergence, dirty or detached branch state, DNS, nginx, Cloudflare, SSH to `pi`, `/var/www/salah` write access, secrets, permissions, broad rewrites, dependency upgrades, privacy-sensitive behavior, flaky or failing checks, or uncertain issue scope block safe completion. Do not treat a failed deploy or unverified live site as success.

Do not ask for confirmation before push, merge, deploy, live verification, issue closure, or cleanup when the gates pass. Also block deployment when GitHub write credentials are unproven, the deploy target is not writable, or the live site cannot be reached.

## Stop States

- `deployed`: one issue was fixed, merged to `main`, deployed to `pi:/var/www/salah`, verified live at `https://salah.abdlh.com`, closed with evidence, and temporary work was cleaned up.
- `prepared-fix`: one issue has a focused local fix that passed required checks, but live deployment has not occurred because deployment was explicitly disabled or deployment gates prevented rollout.
- `clean-no-op`: no safe automation-ready issue exists.
- `blocked`: the selected issue, verification gates, or deployment path needs an external access, infrastructure, conflict-resolution, or product-scope change before automation can continue. Report the blocker, current branch, checks run, and exact next action needed.

## Structured Output

When the caller requests JSON, return JSON only. Include `stop_state`, `summary`, non-empty `evidence`, non-empty `checks`, `selected_issue`, `branch`, `verification`, `deploy`, and `blockers`. Include issue, branch, check, and evidence fields even for clean no-op or blocked results. For `prepared-fix` and `deployed`, include the selected issue URL and branch. For `deployed`, include live URL and commit or merge reference. For `blocked`, every blocker must include `area`, `detail`, and `next_step`.
