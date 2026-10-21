# Game Analytics (P2, conditional)

Use only when a confirmed question needs measured player data and local testing/playtests are insufficient. A small single-player game does not need third-party analytics by default. Prefer local, aggregate development telemetry or test logs.

## Define before instrumenting

For every proposed metric, record the question it answers, event definition, sampling, retention, and decision it could change. Suitable examples include level completion/time, failure/retry counts, objective bottlenecks, resource use, and performance. Avoid collecting names, precise location, free-form text, device identifiers, or other personal data unless essential and explicitly approved.

- Explain exactly what data is collected, when, where stored/sent, who can access it, and how long retained.
- Do not add third-party tracking, SDKs, cookies, or network transmission by default. Obtain explicit user approval before selecting/enabling any external analytics provider; follow current terms and applicable privacy requirements.
- Make telemetry opt-in or disabled for local builds unless the user-approved design requires otherwise. Keep gameplay working when telemetry is absent/fails; do not send secrets, save contents, or sensitive player inputs.
- Validate event schemas and avoid unbounded/high-frequency events. Test that disabling telemetry disables collection/transmission.
- Report only measured data with sample size and limitations. Do not claim population-level conclusions from a few playtests.

Record the approved event/data policy in the existing requirements/HANDOFF source of truth. If analytics is not justified, explicitly skip this module without adding code or dependencies.