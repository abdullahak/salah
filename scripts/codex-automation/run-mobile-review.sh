#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

NAME="daily-salah-mobile-review"
WORKTREE_DIR="$WORKTREE_BASE/mobile-review"
GITHUB_WRITE="${CODEX_AUTOMATION_GITHUB_WRITE:-1}"

start_logging "$NAME"
acquire_lock "$NAME"
prepare_worktree "$WORKTREE_DIR"
collect_evidence "$WORKTREE_DIR" "preflight"
collect_open_issues

run_check "$WORKTREE_DIR" lint npm run lint
run_check "$WORKTREE_DIR" test npm run test
run_check "$WORKTREE_DIR" build npm run build
run_check "$WORKTREE_DIR" test-mobile npm run test:mobile
run_check "$WORKTREE_DIR" test-pwa npm run test:pwa

ASSESSOR_PROMPT="$(cat <<EOF
Goal: Run the first assessor pass for the Daily Salah Mobile Review cron automation in this dedicated worktree.

Use \$salah-mobile-review-loop. Do not implement fixes. Do not create, update, or comment on GitHub issues in this assessor pass.

Inputs:
- Evidence file: $RUN_DIR/evidence.md
- Open issue snapshot for dedupe context: $RUN_DIR/open-issues.json
- Check logs: $RUN_DIR/checks/
- Live URL: $LIVE_URL

Requirements:
- Treat the deterministic shell checks and Playwright mobile/PWA checks as primary evidence.
- Make evidence-backed claims only. Cite the evidence file, check log, browser observation, or live-site observation behind every material claim.
- Assess Android-sized Chromium and iPhone-sized WebKit coverage as required evidence. Cover horizontal overflow, touch targets, settings persistence, offline city search, manual coordinates, geolocation grant/deny paths, manifest, service worker, and offline reload.
- Identify candidate findings only when they are material and reproducible.
- Deduplicate against $RUN_DIR/open-issues.json before calling something a new candidate.
- Stop with "clean-no-op" when no material finding remains, "findings-recorded" when candidate findings should proceed to the critic pass, or "blocked" when required evidence is missing.

Output JSON only. It must match $SCHEMA_DIR/review-assessment.schema.json. For assessor candidates, use issue entries with action "candidate"; do not claim a GitHub URL unless it already exists in the open issue snapshot.
EOF
)"

run_codex_json "$WORKTREE_DIR" "review-assessor" "$SCHEMA_DIR/review-assessment.schema.json" "$ASSESSOR_PROMPT"

collect_evidence "$WORKTREE_DIR" "pre-critic"

CRITIC_PROMPT="$(cat <<EOF
Goal: Run the critic, dedupe, and issue-writing pass for the Daily Salah Mobile Review cron automation.

Use \$salah-mobile-review-loop. Do not implement fixes.

Inputs:
- Evidence file: $RUN_DIR/evidence.md
- Assessor JSON: $RUN_DIR/review-assessor-result.json
- Assessor last message: $RUN_DIR/review-assessor-last-message.md
- Open issue snapshot: $RUN_DIR/open-issues.json
- Check logs: $RUN_DIR/checks/
- GitHub writes enabled: $GITHUB_WRITE

Requirements:
- Validate that each assessor finding is supported by deterministic evidence and is not a duplicate of an open issue.
- Before any GitHub write, deduplicate against open issues by symptom, affected flow, and acceptance criteria. Prefer updating an existing issue over creating a new one.
- If GitHub writes are disabled, GitHub authorization is missing, or labels cannot be applied for a material finding, stop as "blocked" and include exact blocker details and next steps.
- If no material validated finding remains, stop as "clean-no-op".
- If findings are created, updated, or deduped, stop as "findings-recorded" and include issue URLs, priorities, labels, evidence, reproduction steps, and acceptance criteria.
- Use labels: salah-review, mobile-first, and exactly one priority label. Add needs-human only for secrets, permissions, infrastructure, ambiguous product decisions, or unsafe automation scope.

Output JSON only. It must match $SCHEMA_DIR/review-result.schema.json.
EOF
)"

run_codex_json "$WORKTREE_DIR" "review-critic" "$SCHEMA_DIR/review-result.schema.json" "$CRITIC_PROMPT"
