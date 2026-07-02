#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'

const [schemaPath, messagePath, outputPath] = process.argv.slice(2)

if (!schemaPath || !messagePath || !outputPath) {
  console.error('usage: validate-result.mjs <schema.json> <last-message.md> <output.json>')
  process.exit(2)
}

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
const message = readFileSync(messagePath, 'utf8')
const result = parseJsonFromMessage(message)
const kind = schema['x-result-kind'] || basename(schemaPath, '.schema.json')
const errors = validateResult(schema, kind, result)

if (errors.length > 0) {
  console.error(`invalid structured result for ${kind}:`)
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`)

function parseJsonFromMessage(text) {
  const trimmed = text.trim()
  const candidates = []
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)

  if (fence?.[1]) {
    candidates.push(fence[1].trim())
  }

  candidates.push(trimmed)

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1))
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch {
      // Try the next representation.
    }
  }

  throw new Error(`last message does not contain parseable JSON: ${text.slice(0, 160)}`)
}

function validateResult(schemaDefinition, kind, result) {
  const errors = []
  const stopStates = schemaDefinition.properties?.stop_state?.enum ?? []

  for (const field of schemaDefinition.required ?? []) {
    if (!(field in result)) {
      errors.push(`missing required field: ${field}`)
    }
  }

  if (!stopStates.includes(result.stop_state)) {
    errors.push(`stop_state must be one of ${stopStates.join(', ')}`)
  }

  if (typeof result.summary !== 'string' || result.summary.trim() === '') {
    errors.push('summary must be a non-empty string')
  }

  if (!isNonEmptyArray(result.evidence)) {
    errors.push('evidence must be a non-empty array')
  }

  if (!isNonEmptyArray(result.checks)) {
    errors.push('checks must be a non-empty array')
  } else {
    for (const [index, check] of result.checks.entries()) {
      if (!check || typeof check !== 'object') {
        errors.push(`checks[${index}] must be an object`)
        continue
      }

      if (typeof check.name !== 'string' || check.name.trim() === '') {
        errors.push(`checks[${index}].name must be a non-empty string`)
      }

      if (!['passed', 'failed', 'skipped', 'blocked'].includes(check.status)) {
        errors.push(`checks[${index}].status must be passed, failed, skipped, or blocked`)
      }
    }
  }

  if (result.stop_state === 'blocked') {
    validateBlockers(result.blockers, errors)
  }

  if (kind === 'review-final') {
    validateReviewFinal(result, errors)
  }

  if (kind === 'deploy-result') {
    validateDeployResult(result, errors)
  }

  return errors
}

function validateReviewFinal(result, errors) {
  if (!Array.isArray(result.issues)) {
    errors.push('issues must be an array')
    return
  }

  if (result.stop_state !== 'findings-recorded') {
    return
  }

  if (result.issues.length === 0) {
    errors.push('findings-recorded requires at least one issue entry')
  }

  for (const [index, issue] of result.issues.entries()) {
    if (!['created', 'updated', 'deduped'].includes(issue?.action)) {
      errors.push(`issues[${index}].action must be created, updated, or deduped`)
    }

    if (!isHttpUrl(issue?.url)) {
      errors.push(`issues[${index}].url must be a GitHub issue URL`)
    }

    if (!['priority-high', 'priority-medium', 'priority-low'].includes(issue?.priority)) {
      errors.push(`issues[${index}].priority must be priority-high, priority-medium, or priority-low`)
    }

    if (typeof issue?.evidence !== 'string' || issue.evidence.trim() === '') {
      errors.push(`issues[${index}].evidence must describe the evidence used`)
    }
  }
}

function validateDeployResult(result, errors) {
  if (['prepared-fix', 'deployed'].includes(result.stop_state)) {
    if (!result.selected_issue || typeof result.selected_issue !== 'object') {
      errors.push(`${result.stop_state} requires selected_issue`)
    } else if (!isHttpUrl(result.selected_issue.url)) {
      errors.push(`${result.stop_state} requires selected_issue.url`)
    }

    if (typeof result.branch !== 'string' || result.branch.trim() === '') {
      errors.push(`${result.stop_state} requires branch`)
    }

    if (!isNonEmptyArray(result.verification)) {
      errors.push(`${result.stop_state} requires non-empty verification`)
    }
  }

  if (result.stop_state === 'deployed') {
    if (!result.deploy || typeof result.deploy !== 'object') {
      errors.push('deployed requires deploy details')
    } else {
      if (!isHttpUrl(result.deploy.live_url)) {
        errors.push('deployed requires deploy.live_url')
      }

      if (typeof result.deploy.commit_or_merge !== 'string' || result.deploy.commit_or_merge.trim() === '') {
        errors.push('deployed requires deploy.commit_or_merge')
      }
    }
  }
}

function validateBlockers(blockers, errors) {
  if (!isNonEmptyArray(blockers)) {
    errors.push('blocked stop_state requires non-empty blockers')
    return
  }

  for (const [index, blocker] of blockers.entries()) {
    if (!blocker || typeof blocker !== 'object') {
      errors.push(`blockers[${index}] must be an object`)
      continue
    }

    for (const field of ['area', 'detail', 'next_step']) {
      if (typeof blocker[field] !== 'string' || blocker[field].trim() === '') {
        errors.push(`blockers[${index}].${field} must be a non-empty string`)
      }
    }
  }
}

function isNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0
}

function isHttpUrl(value) {
  if (typeof value !== 'string') {
    return false
  }

  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}
