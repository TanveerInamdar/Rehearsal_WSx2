# REFLECTIONS.md

## What We Built

A minimal bug reporting MVP that captures telemetry, submits structured reports, and provides AI-powered analysis with suggested fixes. The system consists of a browser snippet, Express API, SQLite database, and background worker.

## Key Tradeoffs

### SQLite + Polling vs. PostgreSQL + WebSockets
- **Chose**: SQLite with 5-second polling
- **Why**: Simpler deployment, no external dependencies, atomic job processing
- **Tradeoff**: Slight delay vs. real-time updates, but acceptable for bug reports

### Fallback AI vs. Required API Keys
- **Chose**: Deterministic fallback when no Anthropic key provided
- **Why**: Demo works out-of-the-box, graceful degradation
- **Tradeoff**: Less sophisticated analysis, but consistent and predictable

### Inline HTML vs. Template Engine
- **Chose**: Server-side HTML generation with inline CSS/JS
- **Why**: Zero dependencies, faster loading, easier to review
- **Tradeoff**: Less maintainable, but appropriate for demo pages

### Single Project Model vs. Multi-tenant
- **Chose**: Simple project-based auth with public/secret keys
- **Why**: MVP scope, easy to understand and implement
- **Tradeoff**: No user management, but sufficient for initial validation

## Prompting Strategy

The AI analysis uses a structured prompt that:
1. **Context**: Provides bug details, console logs, network errors
2. **Format**: Requests markdown analysis under 250 words
3. **Output**: Asks for unified diff or "NONE" if no fix suggested
4. **Confidence**: Requires 0-1 confidence score

This produces consistent, actionable output suitable for developers.

## Risks & Mitigations

### Security
- **Risk**: Secret keys in demo page
- **Mitigation**: Clear warnings, demo-only usage, production would use server-side auth

### Rate Limiting
- **Risk**: Abuse in public demo
- **Mitigation**: 10 requests/minute per IP, generic error messages

### Data Privacy
- **Risk**: Screenshots and logs in database
- **Mitigation**: Local SQLite, no external services, clear data retention

## What We'd Do Next

### Immediate (Week 1)
- GitHub App integration for real PR creation
- User dashboard for bug management
- Email notifications for new bugs

### Short-term (Month 1)
- Multi-project support with proper auth
- Linear/Jira integrations
- Enhanced AI prompting with codebase context

### Long-term (Quarter 1)
- Real-time updates via WebSockets
- Advanced telemetry (performance, user sessions)
- Team collaboration features

## Technical Debt

- **Worker polling**: Could be replaced with job queues (Bull, Agenda)
- **HTML generation**: Should use proper templating (Handlebars, EJS)
- **Error handling**: Needs structured logging and monitoring
- **Testing**: Requires integration tests and E2E coverage

## Success Metrics

- **Setup time**: < 5 minutes from clone to working demo
- **Bundle size**: < 20KB snippet (achieved: ~12KB)
- **Analysis time**: < 30 seconds from submission to analyzed
- **Demo flow**: < 90 seconds for complete Loom recording

The MVP successfully validates the core concept while maintaining simplicity and ease of review.

