# Real-device validation protocol

Status: **not yet physically validated**. Synthetic tests and automated browser
movement validate code paths, not USB measurement accuracy.

## Capture conditions

Record the date, mouse model, receiver, firmware, wired/wireless mode, configured
rate, DPI, OS/build, browser/version, screen refresh rate, and movement conditions.
Use a physical mouse on a consistent surface. Keep the tab visible and focused,
use steady large movements, and keep DevTools closed during the measurement.
Run at least five captures for each condition and retain every exported JSON file,
including interrupted, unsupported or inconclusive runs.

Test available 125/500/1000/4000/8000 Hz settings. Include multiple manufacturers,
wired and wireless paths, and 60/165/360 Hz displays when available. Changing a
setting records device configuration; it does not establish the actual delivered
hardware rate. Record conditions you cannot test instead of substituting results.

## Reference layer

For a browser comparison, name the other implementation and disclose that it may
share browser limitations. For OS-level comparison, record the native API/tool and
its acquisition method. For a USB-level accuracy claim, use an appropriate USB
reference and document how it observes the mouse's transactions.

If the reference and browser run sequentially, document this and repeat the runs
under matched movement conditions. If they run concurrently, document possible
additional load. Preserve reference logs and raw measurements when possible.
Do not interpret agreement between two web tools as USB-level validation.

## Reporting

Fill one CSV row per API and capture; keep exported JSON and reference logs
alongside it. Report callback Hz, sample Hz, capture status, timer grain assumption,
reference layer, and reference rate. Record the observed ratio only where the
reference is meaningful and matched to the capture. Do not round to device tiers.

Summarize the spread across repeated captures and disclose failures, missing raw
events, and unavailable intervals. Publish the evidence before claiming accuracy
at a particular rate. No tolerance or accuracy certification is implied here.
