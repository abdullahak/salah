#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${CODEX_AUTOMATION_ROOT:-/home/abdlh/repos/salah}"
REMOTE_URL="${CODEX_AUTOMATION_REMOTE_URL:-https://github.com/abdullahak/salah.git}"
REPO_SLUG="${CODEX_AUTOMATION_REPO:-abdullahak/salah}"
LIVE_URL="${CODEX_AUTOMATION_LIVE_URL:-https://salah.abdlh.com}"
PI_HOST="${CODEX_AUTOMATION_PI_HOST:-pi}"
PI_DEPLOY_PATH="${CODEX_AUTOMATION_PI_DEPLOY_PATH:-/var/www/salah}"
WORKTREE_BASE="${CODEX_AUTOMATION_WORKTREE_BASE:-/home/abdlh/repos/salah-automation-worktrees}"
LOG_DIR="${CODEX_AUTOMATION_LOG_DIR:-$ROOT_DIR/logs/codex-automation}"

: "${CODEX_AUTOMATION_TIMEOUT:=4h}"
: "${CODEX_AUTOMATION_BASE_REF:=main}"
: "${CODEX_AUTOMATION_AUTONOMY:=deploy}"
: "${CODEX_AUTOMATION_LOG_RETENTION_DAYS:=30}"

BASE_REF="$CODEX_AUTOMATION_BASE_REF"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_DIR="$SCRIPT_DIR/schemas"
RESULT_VALIDATOR="$SCRIPT_DIR/validate-result.mjs"

export PATH="$HOME/.npm-global/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

log() {
  printf '[%s] %s\n' "$(date -Is)" "$*"
}

append_summary() {
  if [[ -n "${RUN_DIR:-}" ]]; then
    printf '%s\n' "$*" >> "$RUN_DIR/summary.md"
  fi
}

finish_logging() {
  local exit_code=$?

  if [[ -n "${RUN_DIR:-}" && -d "$RUN_DIR" ]]; then
    {
      printf '\n## Final Status\n\n'
      printf -- '- exit_code: %s\n' "$exit_code"
      printf -- '- finished_at: %s\n' "$(date -Is)"
      printf -- '- run_log: %s\n' "$RUN_DIR/run.log"
    } >> "$RUN_DIR/summary.md"
  fi

  trap - EXIT
  exit "$exit_code"
}

cleanup_log_retention() {
  find "$LOG_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"$CODEX_AUTOMATION_LOG_RETENTION_DAYS" \
    -exec rm -rf {} + 2>/dev/null || log "log retention cleanup skipped"
}

is_local_deploy_host() {
  local short_hostname
  local full_hostname

  short_hostname="$(hostname 2>/dev/null || true)"
  full_hostname="$(hostname -f 2>/dev/null || true)"

  [[ "$PI_HOST" == "localhost" || "$PI_HOST" == "127.0.0.1" || "$PI_HOST" == "$short_hostname" || "$PI_HOST" == "$full_hostname" ]]
}

start_logging() {
  local name="$1"

  mkdir -p "$LOG_DIR"
  RUN_ID="$(date +%Y%m%dT%H%M%S%z)"
  RUN_DIR="$LOG_DIR/$name-$RUN_ID"
  mkdir -p "$RUN_DIR/checks"
  : > "$RUN_DIR/events.jsonl"

  cat > "$RUN_DIR/summary.md" <<EOF
# $name

- started_at: $(date -Is)
- autonomy: $CODEX_AUTOMATION_AUTONOMY
- base_ref: $BASE_REF
- live_url: $LIVE_URL

EOF

  exec > >(tee -a "$RUN_DIR/run.log") 2>&1
  trap finish_logging EXIT
  cleanup_log_retention
  log "run_dir=$RUN_DIR"
}

acquire_lock() {
  local name="$1"
  local lock_file="$LOG_DIR/$name.lock"

  exec 9>"$lock_file"
  if ! flock -n 9; then
    log "another $name run is already active"
    append_summary "## Stop State"
    append_summary
    append_summary "- blocked: another $name run is already active"
    exit 0
  fi
}

ensure_origin() {
  local current_remote

  current_remote="$(git -C "$ROOT_DIR" config --get remote.origin.url || true)"

  if [[ -z "$current_remote" ]]; then
    git -C "$ROOT_DIR" remote add origin "$REMOTE_URL"
    log "added origin=$REMOTE_URL"
    return
  fi

  if [[ "$current_remote" != "$REMOTE_URL" && "$current_remote" != "git@github.com:abdullahak/salah.git" ]]; then
    log "unexpected origin remote: $current_remote"
    exit 1
  fi
}

prepare_worktree() {
  local worktree_dir="$1"
  local overlay_marker="$worktree_dir/.codex-automation-prepare-only-overlay"

  ensure_origin
  mkdir -p "$WORKTREE_BASE"

  if git -C "$ROOT_DIR" fetch origin "$BASE_REF"; then
    local divergence
    divergence="$(git -C "$ROOT_DIR" rev-list --left-right --count "$BASE_REF...origin/$BASE_REF" 2>/dev/null || true)"
    if [[ -n "$divergence" ]]; then
      log "${BASE_REF}_vs_origin_${BASE_REF}=$divergence"
    fi
  else
    log "remote fetch failed; continuing from local $BASE_REF"
  fi

  if [[ ! -e "$worktree_dir/.git" ]]; then
    if [[ -e "$worktree_dir" ]]; then
      log "worktree path exists but is not a git worktree: $worktree_dir"
      exit 1
    fi
    git -C "$ROOT_DIR" worktree add --detach "$worktree_dir" "$BASE_REF"
  fi

  git -C "$worktree_dir" fetch origin "$BASE_REF" || log "worktree remote fetch failed; continuing from local $BASE_REF"
  rm -rf "$worktree_dir/.agents"

  if [[ -n "$(git -C "$worktree_dir" status --porcelain)" ]]; then
    if [[ -f "$overlay_marker" ]]; then
      log "discarding previous prepare-only overlay in $worktree_dir"
      git -C "$worktree_dir" reset --hard
      git -C "$worktree_dir" clean -ffd -e node_modules
    else
      log "worktree has existing changes; preserving them and stopping"
      git -C "$worktree_dir" status --short
      exit 1
    fi
  fi

  git -C "$worktree_dir" checkout --detach "$BASE_REF"
  git -C "$worktree_dir" reset --hard "$BASE_REF"
  git -C "$worktree_dir" clean -ffd -e node_modules

  if [[ -d "$ROOT_DIR/.agents" ]]; then
    mkdir -p "$worktree_dir/.agents"
    rsync -a --delete "$ROOT_DIR/.agents/" "$worktree_dir/.agents/"
  fi

  if [[ "${CODEX_AUTOMATION_PREPARE_ONLY:-0}" == "1" && "${CODEX_AUTOMATION_SYNC_LOCAL_OVERLAY:-1}" == "1" ]]; then
    log "prepare-only mode; syncing local automation/test overlay into $worktree_dir"
    for path in package.json package-lock.json playwright.config.ts e2e scripts/codex-automation; do
      if [[ -e "$ROOT_DIR/$path" ]]; then
        mkdir -p "$worktree_dir/$(dirname "$path")"
        if [[ -d "$ROOT_DIR/$path" ]]; then
          mkdir -p "$worktree_dir/$path"
          rsync -a --delete "$ROOT_DIR/$path/" "$worktree_dir/$path/"
        else
          rsync -a "$ROOT_DIR/$path" "$worktree_dir/$path"
        fi
      fi
    done
    touch "$overlay_marker"
  fi

  log "installing npm dependencies in $worktree_dir"
  if [[ -f "$worktree_dir/package-lock.json" ]]; then
    npm --prefix "$worktree_dir" ci
  else
    npm --prefix "$worktree_dir" install
  fi

  if command -v npx >/dev/null 2>&1 && [[ -f "$worktree_dir/package.json" ]]; then
    if (cd "$worktree_dir" && node -e "const p = require('./package.json'); process.exit(p.devDependencies?.['@playwright/test'] ? 0 : 1)"); then
      (cd "$worktree_dir" && npx playwright install chromium webkit >/dev/null 2>&1) || \
        log "playwright browser install skipped or failed; browser checks will report the blocker"
    fi
  fi
}

evidence_command() {
  local title="$1"
  shift

  printf '\n## %s\n\n' "$title"
  printf '```text\n'
  "$@" 2>&1 || printf 'command failed with exit code %s\n' "$?"
  printf '```\n'
}

collect_evidence() {
  local worktree_dir="$1"
  local phase="${2:-preflight}"
  local evidence_file="$RUN_DIR/evidence.md"
  local phase_file="$RUN_DIR/evidence-$phase.md"

  {
    printf '# Automation Evidence\n\n'
    printf -- '- phase: %s\n' "$phase"
    printf -- '- collected_at: %s\n' "$(date -Is)"
    printf -- '- root_dir: %s\n' "$ROOT_DIR"
    printf -- '- worktree_dir: %s\n' "$worktree_dir"
    printf -- '- base_ref: %s\n' "$BASE_REF"
    printf -- '- autonomy: %s\n' "$CODEX_AUTOMATION_AUTONOMY"
    printf -- '- live_url: %s\n' "$LIVE_URL"

    evidence_command "Root Git Status" git -C "$ROOT_DIR" status --short --branch
    evidence_command "Worktree Git Status" git -C "$worktree_dir" status --short --branch
    evidence_command "Root HEAD" git -C "$ROOT_DIR" log -1 --oneline --decorate
    evidence_command "Worktree HEAD" git -C "$worktree_dir" log -1 --oneline --decorate
    evidence_command "Remote Divergence" git -C "$ROOT_DIR" rev-list --left-right --count "$BASE_REF...origin/$BASE_REF"
    evidence_command "Configured Remote" git -C "$ROOT_DIR" remote -v
    evidence_command "Safe Cron Environment" bash -lc 'env | LC_ALL=C sort | awk -F= "/^(CODEX_AUTOMATION|HOME|LANG|LOGNAME|PATH|PWD|SHELL|TZ|USER)=/ { print }"'
    evidence_command "Tool Versions" bash -lc 'git --version; node --version; npm --version; npx playwright --version; codex --version; gh --version | head -n 1; ssh -V'
    evidence_command "Available NPM Scripts" bash -lc "cd '$worktree_dir' && node -e \"const p=require('./package.json'); for (const [name, cmd] of Object.entries(p.scripts || {})) console.log(name + ': ' + cmd)\""
    evidence_command "Live Site HTTP Status" curl --max-time 20 -L -sS -o /dev/null -w 'http_code=%{http_code}\neffective_url=%{url_effective}\ntime_total=%{time_total}\n' "$LIVE_URL"
    evidence_command "Cron Entries" bash -lc 'crontab -l 2>/dev/null | grep -E "salah|codex-automation|run-mobile-review|run-improvement-deploy" || true'
  } > "$phase_file"

  if [[ ! -f "$evidence_file" ]]; then
    cp "$phase_file" "$evidence_file"
  else
    {
      printf '\n\n---\n\n'
      cat "$phase_file"
    } >> "$evidence_file"
  fi

  log "evidence=$evidence_file"
  log "phase_evidence=$phase_file"
  append_summary "## Evidence"
  append_summary
  append_summary "- evidence: $evidence_file"
  append_summary "- $phase evidence: $phase_file"
}

run_check() {
  local worktree_dir="$1"
  local name="$2"
  shift 2

  local log_file="$RUN_DIR/checks/$name.log"
  log "running check $name: $*"

  if [[ "${CODEX_AUTOMATION_PREPARE_ONLY:-0}" == "1" ]]; then
    printf 'CODEX_AUTOMATION_PREPARE_ONLY=1; skipped check %s: %s\n' "$name" "$*" > "$log_file"
    log "prepare-only mode; skipped check $name"
    append_summary "- check skipped in prepare-only mode: $name ($log_file)"
    return 0
  fi

  set +e
  (cd "$worktree_dir" && "$@") > "$log_file" 2>&1
  local exit_code=$?
  set -e

  if [[ "$exit_code" -eq 0 ]]; then
    log "check passed: $name"
    append_summary "- check passed: $name ($log_file)"
    return 0
  fi

  log "check failed: $name (exit=$exit_code, log=$log_file)"
  append_summary "- check failed: $name ($log_file)"
  return "$exit_code"
}

run_optional_check() {
  local worktree_dir="$1"
  local name="$2"
  shift 2

  if run_check "$worktree_dir" "$name" "$@"; then
    return 0
  fi

  log "optional check failed without blocking: $name"
  append_summary "- optional check failed without blocking: $name"
  return 0
}

collect_open_issues() {
  local output_file="$RUN_DIR/open-issues.json"

  if ! command -v gh >/dev/null 2>&1; then
    printf '{"error":"gh CLI is not installed","issues":[]}\n' > "$output_file"
    log "open issues unavailable: gh CLI is not installed"
    return 0
  fi

  if ! gh issue list \
    --repo "$REPO_SLUG" \
    --state open \
    --label salah-review \
    --json number,title,url,labels,createdAt,updatedAt > "$output_file" 2>"$RUN_DIR/open-issues.err"; then
    printf '{"error":"gh issue list failed; see open-issues.err","issues":[]}\n' > "$output_file"
    log "open issues unavailable: gh issue list failed"
    return 0
  fi

  log "open_issues=$output_file"
  append_summary "- open issues: $output_file"
}

record_remote_state() {
  local state_file="$RUN_DIR/remote-state.md"
  local divergence

  ensure_origin

  {
    printf '# Remote State\n\n'
    printf -- '- checked_at: %s\n' "$(date -Is)"
    printf -- '- base_ref: %s\n' "$BASE_REF"
    printf '\n## Fetch\n\n```text\n'
    git -C "$ROOT_DIR" fetch origin "$BASE_REF"
    printf '```\n'
  } > "$state_file" 2>&1

  divergence="$(git -C "$ROOT_DIR" rev-list --left-right --count "$BASE_REF...origin/$BASE_REF" 2>/dev/null || true)"
  {
    printf '\n## Divergence\n\n```text\n%s\n```\n' "$divergence"
  } >> "$state_file"

  log "remote_state=$state_file"
  append_summary "- remote state: $state_file"

  if [[ "$divergence" != "0	0" && "$divergence" != "0 0" ]]; then
    append_summary "- remote state needs deploy-pass reconciliation: $BASE_REF...origin/$BASE_REF divergence is $divergence"
  fi

  return 0
}

require_deploy_access() {
  local worktree_dir="$1"
  local access_file="$RUN_DIR/deploy-access.md"
  local failures=0

  if [[ "${CODEX_AUTOMATION_PREPARE_ONLY:-0}" == "1" ]]; then
    {
      printf '# Deploy Access\n\n'
      printf -- '- checked_at: %s\n' "$(date -Is)"
      printf -- '- worktree_dir: %s\n' "$worktree_dir"
      printf -- '- target: %s:%s\n' "$PI_HOST" "$PI_DEPLOY_PATH"
      printf -- '- status: skipped\n'
      printf -- '- reason: CODEX_AUTOMATION_PREPARE_ONLY=1\n'
    } > "$access_file"

    log "deploy_access=$access_file"
    append_summary "- deploy access skipped in prepare-only mode: $access_file"
    return 0
  fi

  {
    printf '# Deploy Access\n\n'
    printf -- '- checked_at: %s\n' "$(date -Is)"
    printf -- '- worktree_dir: %s\n' "$worktree_dir"
    printf -- '- target: %s:%s\n' "$PI_HOST" "$PI_DEPLOY_PATH"

    printf '\n## GitHub Authentication\n\n```text\n'
    if command -v gh >/dev/null 2>&1 && gh auth status -h github.com; then
      printf 'status=pass\n'
    else
      printf 'status=fail\n'
      failures=$((failures + 1))
    fi
    printf '```\n'

    printf '\n## GitHub Write Permission\n\n```text\n'
    if command -v gh >/dev/null 2>&1 && [[ "$(gh api "repos/$REPO_SLUG" --jq '.permissions.push' 2>/dev/null)" == "true" ]]; then
      printf 'status=pass\n'
    else
      printf 'status=fail\n'
      failures=$((failures + 1))
    fi
    printf '```\n'

    printf '\n## Clean Worktree\n\n```text\n'
    git -C "$worktree_dir" status --short --branch
    if [[ -z "$(git -C "$worktree_dir" status --porcelain)" ]]; then
      printf 'status=pass\n'
    else
      printf 'status=fail\n'
      failures=$((failures + 1))
    fi
    printf '```\n'

    printf '\n## Deploy Target\n\n```text\n'
    if is_local_deploy_host; then
      printf 'mode=local\n'
      if test -d "$PI_DEPLOY_PATH" && test -w "$PI_DEPLOY_PATH"; then
        printf 'status=pass\n'
      else
        printf 'status=fail\n'
        failures=$((failures + 1))
      fi
    elif ssh -o BatchMode=yes -o ConnectTimeout=10 "$PI_HOST" "test -d '$PI_DEPLOY_PATH' && test -w '$PI_DEPLOY_PATH'"; then
      printf 'mode=ssh\n'
      printf 'status=pass\n'
    else
      printf 'mode=ssh\n'
      printf 'status=fail\n'
      failures=$((failures + 1))
    fi
    printf '```\n'

    printf '\n## Live Site Reachability\n\n```text\n'
    if curl --max-time 20 -L -sS -o /dev/null -w 'http_code=%{http_code}\neffective_url=%{url_effective}\ntime_total=%{time_total}\n' "$LIVE_URL"; then
      printf 'status=pass\n'
    else
      printf 'status=fail\n'
      failures=$((failures + 1))
    fi
    printf '```\n'
  } > "$access_file" 2>&1

  log "deploy_access=$access_file"
  append_summary "- deploy access: $access_file"

  if [[ "$failures" -ne 0 ]]; then
    append_summary "- deploy access blocked: $failures failed probe(s)"
    return 1
  fi
}

run_codex_json() {
  local worktree_dir="$1"
  local pass_name="$2"
  local schema_file="$3"
  local prompt="$4"
  local prompt_file="$RUN_DIR/$pass_name-prompt.md"
  local events_file="$RUN_DIR/$pass_name-events.jsonl"
  local last_message_file="$RUN_DIR/$pass_name-last-message.md"
  local result_file="$RUN_DIR/$pass_name-result.json"

  printf '%s\n' "$prompt" > "$prompt_file"
  log "codex_prompt=$prompt_file"

  if [[ "${CODEX_AUTOMATION_PREPARE_ONLY:-0}" == "1" ]]; then
    cat > "$last_message_file" <<EOF
{
  "stop_state": "blocked",
  "summary": "CODEX_AUTOMATION_PREPARE_ONLY=1; codex exec skipped for $pass_name.",
  "evidence": [
    {
      "source": "$RUN_DIR/evidence.md",
      "detail": "Preflight evidence was collected; Codex was not run in prepare-only mode."
    }
  ],
  "checks": [
    {
      "name": "$pass_name",
      "status": "skipped",
      "log": "$prompt_file"
    }
  ],
  "issues": [],
  "selected_issue": null,
  "branch": null,
  "verification": [],
  "deploy": null,
  "blockers": [
    {
      "area": "codex",
      "detail": "CODEX_AUTOMATION_PREPARE_ONLY=1 prevented the $pass_name Codex pass from running.",
      "next_step": "Unset CODEX_AUTOMATION_PREPARE_ONLY for a live automation run."
    }
  ]
}
EOF
    printf '{"event":"prepare-only","pass":"%s","prompt":"%s"}\n' "$pass_name" "$prompt_file" > "$events_file"
    log "prepare-only mode; skipped codex exec for $pass_name"
  else
    log "starting codex exec pass=$pass_name in $worktree_dir"
    timeout "$CODEX_AUTOMATION_TIMEOUT" codex exec \
      --cd "$worktree_dir" \
      --sandbox danger-full-access \
      --output-last-message "$last_message_file" \
      --json \
      "$prompt" > "$events_file"
    log "codex exec completed pass=$pass_name"
  fi

  node "$RESULT_VALIDATOR" "$schema_file" "$last_message_file" "$result_file"
  cat "$events_file" >> "$RUN_DIR/events.jsonl"
  cp "$last_message_file" "$RUN_DIR/last-message.md"
  cp "$result_file" "$RUN_DIR/result.json"

  log "codex_result=$result_file"
  append_summary "- codex result: $result_file"
}
