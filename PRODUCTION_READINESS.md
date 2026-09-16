# Production readiness — September 2026

This update keeps the existing AI models and providers unchanged.

## Delivered

- Currency conversion caches the unit exchange rate, not an amount-specific result.
- Reencounter context derives absence from timestamps and includes overdue commitments. The proactive UI supplies the actual name, open commitments and entry timestamps.
- Client routine nudges use local hours; legacy sports tests now honor the documented runtime fallback. Upstream sports fixes retain user offset/profile timezone support.
- Financial prices no longer change randomly. Only changes supplied by the source can animate.
- Mobile zoom is enabled. Background reminder messages respect the existing do-not-disturb window.
- Offline caching is limited to public shell/static assets without query strings; API, OAuth and arbitrary same-origin resources are not cached. Cache misses return a real 503 response; old-cache cleanup is scoped to Michi.
- Runtime integration credentials are excluded from Git and Docker build context. The local credentials file is retained.
- CI validates types, tests and frontend build. Fly/Railway invoke the reusable CI job before deploy. Render auto-deployment is configured separately and is not gated by these jobs.

## Validation commands

```sh
npm ci
npx tsc --noEmit
npx vitest run
npx vite build
node --check public/sw.js
```

Live integrations are opt-in, not considered passing when skipped:

```sh
# Git Bash / Linux / macOS
OLLAMA_URL=http://your-ollama-host:11434 npx vitest run src/domain/router-intent-batch.test.ts
KORU_LIVE_API=1 npx vitest run src/test/audit-football-fixed.test.ts src/test/audit-football-v2.test.ts src/test/verify-tz-e2e.test.ts
```

The sports tests call real external services and may fail due to rate limits or changing fixtures. The mocked sports/timezone regression suites run normally in CI.

## Remaining limitations

- Removing the integration file from tracking does not remove earlier Git history or rotate credentials. Previously exposed OAuth tokens must be revoked/rotated by their owner.
- The failed-tool reply guard is narrow, not general fact-checking. Mixed tool success/failure and claims of persistence need broader follow-up coverage.
- Anonymous API access remains possible when `KORU_API_KEY` is unset. This update does not introduce per-user authentication, distributed rate limiting or deployment secret provisioning.
- Reminder scheduling still needs a dedicated review of server-side absolute times and daylight-saving transitions.
- Offline caching provides the application shell and previously fetched static resources; it cannot make AI/network operations work offline or guarantee every lazy asset was downloaded.
- The build reports an existing ineffective dynamic import of CreateScreen. It does not prevent the build but limits code splitting.
- Untracked experimental persona/name/antiSlop/fast-path modules have not been integrated or published.
