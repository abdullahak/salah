#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

NAME="daily-salah-improvement-deploy"
WORKTREE_DIR="$WORKTREE_BASE/improvement-deploy"

start_logging "$NAME"
acquire_lock "$NAME"
prepare_worktree "$WORKTREE_DIR"
collect_evidence "$WORKTREE_DIR" "preflight"
collect_open_issues

run_check "$WORKTREE_DIR" baseline-lint npm run lint
run_check "$WORKTREE_DIR" baseline-test npm run test
run_check "$WORKTREE_DIR" baseline-build npm run build
run_check "$WORKTREE_DIR" baseline-test-mobile npm run test:mobile
run_check "$WORKTREE_DIR" baseline-test-pwa npm run test:pwa

IMPLEMENT_PROMPT="$(cat <<EOF
Goal: Run the implementation pass for the Daily Salah Improvement cron automation in this dedicated worktree.

Use \$salah-improvement-deploy-loop. Select at most one safe open issue from $RUN_DIR/open-issues.json.

Inputs:
- Evidence file: $RUN_DIR/evidence.md
- Open issue snapshot: $RUN_DIR/open-issues.json
- Baseline check logs: $RUN_DIR/checks/
- Autonomy: $CODEX_AUTOMATION_AUTONOMY

Requirements:
- Implement exactly one focused fix for one issue labeled salah-review and not needs-human.
- Prefer priority-high, then priority-medium, then priority-low. Within the same priority, prefer automation-ready, then oldest issue.
- Do not implement broad rewrites, dependency upgrades, privacy-sensitive behavior changes, infrastructure changes, or ambiguous product decisions.
- Preserve privacy invariants: no analytics, no accounts, no backend, no automatic reverse geocoding, and no unsolicited geolocation.
- You may create a local codex/ branch and commit the focused fix, but do not push, merge, deploy, close issues, or clean up branches in this implementation pass.
- If no safe issue exists, stop "clean-no-op". If permissions, GitHub access, unreconcilable remote divergence, Pi SSH, Cloudflare, nginx, secrets, broad scope, or failing checks block safe work, stop "blocked" with exact next steps.
- If a focused fix is prepared locally, stop "prepared-fix".

Output JSON only. It must match $SCHEMA_DIR/deploy-result.schema.json.
EOF
)"

run_codex_json "$WORKTREE_DIR" "improvement-implementation" "$SCHEMA_DIR/deploy-result.schema.json" "$IMPLEMENT_PROMPT"

collect_evidence "$WORKTREE_DIR" "post-implementation"

run_check "$WORKTREE_DIR" post-lint npm run lint
run_check "$WORKTREE_DIR" post-test npm run test
run_check "$WORKTREE_DIR" post-build npm run build
run_check "$WORKTREE_DIR" post-test-mobile npm run test:mobile
run_check "$WORKTREE_DIR" post-test-pwa npm run test:pwa

VERIFY_PROMPT="$(cat <<EOF
Goal: Run the verification pass for the Daily Salah Improvement cron automation.

Use \$salah-improvement-deploy-loop. Review the current worktree, implementation result, and post-implementation check evidence. Do not deploy in this verification pass.

Inputs:
- Evidence file: $RUN_DIR/evidence.md
- Implementation JSON: $RUN_DIR/improvement-implementation-result.json
- Implementation last message: $RUN_DIR/improvement-implementation-last-message.md
- Open issue snapshot: $RUN_DIR/open-issues.json
- All check logs: $RUN_DIR/checks/
- Autonomy: $CODEX_AUTOMATION_AUTONOMY

Requirements:
- Confirm the run selected at most one issue and prepared at most one focused fix.
- Review the diff for unrelated cleanup, broad rewrites, dependency upgrades, privacy-sensitive behavior, and unverified product decisions.
- Confirm lint, unit tests, build, required Android Chromium mobile checks, required iPhone WebKit mobile checks, PWA/offline checks, and privacy gates.
- If the worktree has no safe issue or no change was needed, stop "clean-no-op".
- If the fix is locally prepared and verified but not deployed, stop "prepared-fix" only when deployment was explicitly disabled or a concrete deploy prerequisite failed. Include issue URL, branch, evidence, checks, and remaining deployment gate status.
- If anything blocks safe rollout or safe local preparation, stop "blocked" with exact blocker details and next steps.
- Do not push, merge, deploy, close issues, or clean up branches here. A separate deploy pass runs automatically when CODEX_AUTOMATION_AUTONOMY=deploy and shell deploy gates pass.

Output JSON only. It must match $SCHEMA_DIR/deploy-result.schema.json.
EOF
)"

run_codex_json "$WORKTREE_DIR" "improvement-verification" "$SCHEMA_DIR/deploy-result.schema.json" "$VERIFY_PROMPT"

if [[ "$CODEX_AUTOMATION_AUTONOMY" != "deploy" ]]; then
  log "autonomy=$CODEX_AUTOMATION_AUTONOMY; deployment pass skipped"
  append_summary "- deployment skipped: autonomy is $CODEX_AUTOMATION_AUTONOMY"
  exit 0
fi

record_remote_state
require_deploy_access "$WORKTREE_DIR"

DEPLOY_PROMPT="$(cat <<EOF
Goal: Run the final deploy pass for the Daily Salah Improvement and Live Deploy cron automation.

Use \$salah-improvement-deploy-loop. Deployment is authorized because CODEX_AUTOMATION_AUTONOMY=deploy and the shell deploy access gates passed. Do not ask for confirmation before pushing, merging, deploying, verifying, closing the issue, or cleaning up; perform those steps automatically when the evidence supports them.

Inputs:
- Evidence file: $RUN_DIR/evidence.md
- Verification JSON: $RUN_DIR/improvement-verification-result.json
- Deploy access evidence: $RUN_DIR/deploy-access.md
- Remote state evidence: $RUN_DIR/remote-state.md
- Check logs: $RUN_DIR/checks/
- Live URL: $LIVE_URL
- Deploy target: $PI_HOST:$PI_DEPLOY_PATH

Requirements:
- Reconcile with latest origin/$BASE_REF before merge or deploy. Remote divergence in $RUN_DIR/remote-state.md is not a human-approval blocker by itself; attempt a normal fetch/rebase/merge workflow and stop blocked only if conflicts or permissions prevent safe reconciliation.
- Deploy only from latest verified main. Never deploy from a dirty or detached worktree.
- Push and merge only the one verified focused fix. Do not force-push shared branches.
- Build final static assets from latest main, sync dist/ to $PI_HOST:$PI_DEPLOY_PATH when running remotely, or directly to $PI_DEPLOY_PATH when this job is already running on host $PI_HOST. Ensure deployed static files are readable by nginx, for example with rsync chmod flags or `chmod -R u=rwX,g=rX,o=rX $PI_DEPLOY_PATH`. Verify $LIVE_URL through the live site, close the selected GitHub issue with evidence, and clean up temporary branches/worktrees created by this run.
- If GitHub write access, Pi SSH, nginx/Cloudflare, unreconcilable remote divergence, dirty branch state, failing checks, or live verification blocks safe rollout, stop "blocked" and include exact next steps.
- Stop "deployed" only after merge, deploy, live verification, issue closure, and cleanup are complete.

Output JSON only. It must match $SCHEMA_DIR/deploy-result.schema.json.
EOF
)"

run_codex_json "$WORKTREE_DIR" "improvement-deploy" "$SCHEMA_DIR/deploy-result.schema.json" "$DEPLOY_PROMPT"
