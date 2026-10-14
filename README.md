# Browser Input Frequency

A small, dependency-free experiment comparing `mousemove`, `pointermove`, and
`pointerrawupdate`. See both **callback frequency** and **browser-visible movement
sample frequency**, including samples exposed by `getCoalescedEvents()`.

**[Full online mouse polling rate tool →](https://mousepollingratetest.com/)**

This demo adapts the sampling approach used by MousePollingRateTest. It measures
what a webpage can observe. It does not read USB transactions or certify the
configured polling rate of your mouse.

## Run locally

Install Node.js 20 or newer, then run from this directory:

```sh
npm start
```

Open **http://127.0.0.1:4173**, choose **Start capture**, and move a physical mouse
continuously. The ten-second window starts with the first accepted mouse event.
All processing stays in the browser. No npm install, external fonts, analytics,
account, API key or network service is needed.

Use HTTPS when hosting remotely. Loopback is suitable for local development;
opening a remote HTTP page or a bare file may expose different capabilities.
The page detects API support rather than assuming a browser/version matrix.

The results table can scroll horizontally on small screens. A desktop mouse is
required for a meaningful capture; touch and pen Pointer Events are excluded.

## Why do some browser testers show 1,000 Hz or less?

**There is no universal browser rule limiting mouse events to 1,000 Hz.**
Three different quantities are often confused:

| Layer | Quantity | What this demo can establish |
| --- | --- | --- |
| Device / USB | Configured polling schedule and actual USB traffic | Neither is read here |
| Browser delivery | JavaScript callbacks per second | Counts callbacks independently for each API |
| Browser samples | Movement samples made visible to JavaScript | Counts available samples, including exposed coalesced children |

Chrome documents frame-aligned delivery for continuous input, including mouse
movement. A callback counter can therefore reflect display cadence rather than
all movement updates. That behavior is implementation-dependent, not a fixed
1,000 Hz cap. See [Chrome's explanation of aligned input events](https://developer.chrome.com/blog/aligning-input-events).

The Pointer Events standard allows `pointermove` delivery to be delayed or
coalesced. `getCoalescedEvents()` exposes the associated movement samples.
`pointerrawupdate` is intended for prompt, high-frequency delivery, but **raw
updates can also be coalesced**. See [raw update events](https://www.w3.org/TR/pointerevents3/#the-pointerrawupdate-event)
and [coalesced events](https://www.w3.org/TR/pointerevents3/#coalesced-events).

Other causes of low observations include movement pauses, device behavior,
OS/driver processing and scheduling. A low webpage reading alone does not identify
which layer lost or limited input.

Timestamp precision is a separate constraint. For example, an ideal 8,000 Hz
stream has 0.125 ms spacing. Rounded timestamps may repeat even when the browser
exposes many samples. The MDN [timeStamp documentation](https://developer.mozilla.org/en-US/docs/Web/API/Event/timeStamp)
describes privacy-related precision reduction. More capture time does not repair
timestamp granularity.

## How the online tool can observe more than legacy callback counting

The main tool prefers raw Pointer Events and expands coalesced batches. When raw
updates are unavailable or silent, its collection path can fall back to
`pointermove`. It counts one selected stream so the same movement is not counted
twice. The engine retains equal timestamps for sample counting and withholds
interval-based conclusions when precision is inadequate.

This is an API-based way to observe input that a legacy callback-only counter can
miss. **It cannot bypass the OS, recover samples that the browser does not expose,
or guarantee accurate USB-level measurements at 4K or 8K.** Capability support
alone does not establish sample completeness.

The full tool additionally provides capture-quality checks and other metrics.
This educational demo uses a smaller comparison accumulator, with its own version
and tests. It does not claim to duplicate all production metrics.

## The core algorithm

For each trusted mouse event:

1. Count one callback in that event's independent stream.
2. For Pointer Events, read `getCoalescedEvents()` when it is available.
3. If the returned list is nonempty, count its children. Otherwise count the parent.
4. Record valid sample timestamps. Keep equal timestamps; flag backward or invalid
   timestamps instead of inventing intervals.
5. Use sample count and callback count over the same elapsed arrival window.

The essential expansion rule is:

```js
let samples = event.getCoalescedEvents?.() ?? [];
if (!samples.length) samples = [event];
// Count samples OR parent. Do not append the parent to a nonempty batch.
```

The implementation also catches API errors. See [`src/measurement.js`](src/measurement.js)
for the complete standalone module, usable in a browser or via CommonJS:

```js
const { Measurement } = require('./src/measurement.js');
const capture = new Measurement({ durationMs: 10000, clockGrainMs: 0.1 });
// In a browser's trusted physical-mouse event handler:
// capture.ingest(event.type, event, performance.now());
// After the capture window:
// capture.stop(performance.now());
// const result = capture.snapshot(performance.now());
```

The demo collects all three streams simultaneously for comparison. Their counts
must **never be added**; raw and regular Pointer Events can describe the same
underlying movement. The extra listeners also add overhead, so the experiment
does not reproduce the performance of a production tool collecting one stream.

## Reading the numbers

| Field | Calculation / meaning |
| --- | --- |
| Callbacks / s | Accepted callback count divided by common elapsed seconds |
| Samples / s | Valid exposed sample count divided by common elapsed seconds |
| Samples | Number of accepted timestamps; duplicates remain in this count |
| Median interval | Upper-middle positive timestamp interval below 100 ms, only when eligible |
| Unsupported | API absent or raw updates unavailable in the current context |
| No events observed | Supported path has not delivered accepted samples |
| Short capture | Less than 3 seconds or fewer than 100 samples |
| Observed | Sufficient data for reporting the observed count rate; completeness remains unknown |
| Interrupted | Focus or visibility changed; partial count rates retained, intervals withheld |
| Invalid | Bad timestamps or the 200,000-sample limit was exceeded |

The common window starts at the first accepted callback from any stream and ends
at ten seconds, a manual stop, or an interruption. Subsequent movement pauses and
trailing idle time remain in the denominator. Callback arrivals outside the
half-open window `[start, start + duration)` are excluded.

This demo uses **N / T** over that common arrival window. The main tool uses
**(N − 1) / T** from its selected stream's first callback. The estimators have
different boundary conventions; they are not expected to agree exactly in short
captures. Samples in the first coalesced batch may predate the common window;
samples in a late batch can arrive after it. These boundary effects are not
corrected or hidden.

No frequencies are snapped to familiar device tiers. There is no device target
input, inferred missing samples, prediction, maximum-rate clamp or hardware grade.
An unusual measured rate stays unusual.

### Interval precision policy

The page probes `performance.now()` briefly and applies a conservative grain
floor of 0.1 ms, or 1 ms for detected Firefox/Safari families. This is a heuristic,
not calibration of `Event.timeStamp`, whose precision may differ. Unknown or
changed browser behavior can make this estimate inaccurate. The demo intentionally
does not relax the floor in cross-origin isolated contexts.

The median is withheld unless there are at least three elapsed seconds, 100
samples, 50 positive intervals shorter than 100 ms, no invalid timestamps, no
overflow, no API errors, no interruption, at most 1% equal adjacent timestamps,
and a median spanning at least four estimated grain units. An inconclusive probe
also withholds it. Count frequency can remain available when interval timing is
unavailable. Intervals of 100 ms or more are excluded from the median, while the
corresponding idle time still lowers the count rate.

`mousemove` lacks `pointerType`. The UI rejects known touch-generated mouse events
and suppresses legacy events following observed non-mouse Pointer Events. Where
those signals are missing, legacy device classification remains ambiguous. Use a
physical mouse for this comparison.

## Export and validation

**Export JSON** saves summary counts, rates, API availability, precision assumptions
and capture status locally. It does not upload anything or include coordinates,
raw timestamp arrays, device IDs, the user agent or a hardware-rate claim.

Run the deterministic regression tests:

```sh
npm test
```

They cover synthetic 125–8,000 Hz streams, coalescing, shared-window counting,
duplicate/coarse/invalid timestamps, missing samples, interruptions and bounded
storage. **Passing synthetic tests is not physical-device accuracy validation.**

For optional browser integration checks, install Playwright and its Chromium:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run test:browser
```

See [`docs/VALIDATION.md`](docs/VALIDATION.md) for the real-device protocol and
[`validation/results-template.csv`](validation/results-template.csv) for a blank
results ledger. No real-device results are claimed or fabricated in this release.

## Files and publishing

```text
index.html                 Comparison UI
style.css                  Local styles
src/measurement.js         Standalone sampling and summary module
src/demo.js                Trusted-event collection and JSON export
tools/serve.cjs             Loopback-only development server
tests/                     Algorithm and optional browser checks
docs/VALIDATION.md          Physical-device validation protocol
docs/PUBLISHING.md          Separate-repository publishing instructions
validation/                Blank real-device results ledger
.github/workflows/tests.yml Dependency-free CI
LICENSE                    MIT license
```

Publish this directory as its own repository. It has no build or deployment link
to the main site. GitHub Pages can serve the root static files if enabled manually.

## License and attribution

MIT. Maintained as a companion experiment to
[MousePollingRateTest](https://mousepollingratetest.com/). The sampling design is
adapted from that project's browser-visible movement estimator; this release
implements a simpler comparison contract documented above.
