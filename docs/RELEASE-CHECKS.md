# Release checks — 2026-10-14

Version: 1.0.0.

- 17 deterministic algorithm tests passed, including synthetic 125–8,000 Hz input.
- The initial GitHub Actions test run also passed on Node.js 22 / Ubuntu.
- Chromium integration passed for browser-generated movement, synthetic-event
  rejection, JSON download, manual stop, focus interruption, empty restart and
  automatic ten-second stop.
- Desktop, 768 px and 390 px layouts checked. The comparison table scrolls within
  its container on narrow screens; the document does not overflow horizontally.
- Desktop and mobile screenshots visually inspected; no JavaScript runtime errors.
- Test browser blocked non-local requests. The application has no remote resources.
- Development server only serves the four public application files; internal docs
  are not exposed by that server.

These are software checks. No physical device, USB analyzer or calibrated timing
reference was used; real-device accuracy is unvalidated. See VALIDATION.md.
