(function () {
  'use strict';
  const { Measurement, SOURCES } = InputFrequency;
  const $ = id => document.getElementById(id);
  const supported = ['mousemove'];
  if ('PointerEvent' in window) supported.push('pointermove');
  if (isSecureContext && 'onpointerrawupdate' in window) supported.push('pointerrawupdate');
  const supportsCoalesced = typeof window.PointerEvent?.prototype.getCoalescedEvents === 'function';
  $('capabilities').textContent = `${isSecureContext ? 'Secure context' : 'HTTPS / localhost required'} · Coalesced API ${supportsCoalesced ? 'available' : 'unavailable'}`;
  const rows = {};
  for (const source of SOURCES) {
    const row = document.createElement('tr');
    const notes = { mousemove:'Legacy callbacks', pointermove:'Includes coalesced samples', pointerrawupdate:'Includes coalesced samples' };
    row.innerHTML = `<td>${source}<span class="source-note">${notes[source]}</span></td><td class="rate">—</td><td class="rate">—</td><td>0</td><td>—</td><td>Ready</td>`;
    $('results').append(row);
    rows[source] = row;
  }
  let measurement = new Measurement({ supported });
  let running = false;
  let armedAt = null;
  let ticker = null;
  let latest = null;
  let lastPointerType = null;
  function estimateClockGrain() {
    // A short probe plus a conservative browser-family floor. Event.timeStamp
    // precision is not guaranteed to match performance.now() precision.
    const floor = /Firefox|Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Edg/.test(navigator.userAgent) ? 1 : .1;
    let previous = performance.now(), minimum = Infinity;
    for (let i = 0; i < 2000; i++) {
      const current = performance.now();
      if (current > previous) minimum = Math.min(minimum, current - previous);
      previous = current;
    }
    return Number.isFinite(minimum) ? Math.max(floor, minimum) : null;
  }
  const formatHz = value => value === null ? '—' : value.toLocaleString('en-US', { maximumFractionDigits:1 });
  const statusNames = {
    unsupported:'Unsupported', 'no-events':'No events observed', 'short-capture':'Short capture',
    observed:'Observed', invalid:'Invalid timestamps / sample limit', interrupted:'Interrupted'
  };
  function render(now = performance.now()) {
    latest = measurement.snapshot(now);
    for (const source of SOURCES) {
      const stats = latest.streams[source];
      const cells = rows[source].cells;
      cells[1].textContent = formatHz(stats.callbackHz);
      cells[2].textContent = formatHz(stats.sampleHz);
      cells[3].textContent = stats.samples.toLocaleString('en-US');
      cells[4].textContent = stats.medianIntervalMs === null ? '—' : `${stats.medianIntervalMs.toFixed(3)} ms`;
      cells[5].textContent = statusNames[stats.status];
      cells[4].title = stats.medianIntervalMs === null ? 'Insufficient data or timestamp precision; this does not improve merely by waiting longer.' : 'An estimate from event timestamps, not USB report timing.';
    }
    $('elapsed').textContent = `${(latest.elapsedMs / 1000).toFixed(1)} / 10.0 s`;
    $('progress-fill').style.width = `${latest.elapsedMs / 100}%`;
  }
  function finish(reason = null) {
    if (!running) return;
    running = false;
    clearInterval(ticker);
    measurement.stop(performance.now(), reason);
    render();
    $('start').disabled = false;
    $('stop').disabled = true;
    $('export').disabled = !SOURCES.some(source => latest.streams[source].samples > 0);
    $('status').textContent = reason ? `Interrupted: ${reason}. Partial results retained.` :
      measurement.start === null ? 'No mouse movement was captured.' : 'Capture complete. Browser-visible observations only.';
    $('instruction').textContent = 'Start another capture to compare your results.';
  }
  function input(event) {
    if (event.pointerType) lastPointerType = event.pointerType;
    if (!running || event.type === 'mousemove' && lastPointerType && lastPointerType !== 'mouse') return;
    measurement.ingest(event.type, event, performance.now());
  }
  SOURCES.forEach(source => document.addEventListener(source, input, { passive:true }));
  $('start').addEventListener('click', () => {
    measurement = new Measurement({ supported, clockGrainMs:estimateClockGrain() });
    lastPointerType = null;
    running = true;
    armedAt = performance.now();
    $('start').disabled = true;
    $('stop').disabled = false;
    $('export').disabled = true;
    $('status').textContent = 'Waiting for mouse movement…';
    $('instruction').textContent = 'Keep moving continuously. Timing begins with the first mouse event.';
    render();
    // Keep DOM work out of the input handlers. Four updates per second.
    ticker = setInterval(() => {
      const now = performance.now();
      if (measurement.start === null && now - armedAt >= 30000) { finish(); return; }
      if (measurement.start !== null && now - measurement.start >= measurement.durationMs) { finish(); return; }
      render(now);
      if (measurement.start !== null) $('status').textContent = 'Capturing all three streams independently…';
    }, 250);
  });
  $('stop').addEventListener('click', () => finish());
  window.addEventListener('blur', () => finish('page lost focus'));
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish('tab hidden'); });
  $('export').addEventListener('click', () => {
    const payload = {
      experiment:'Browser Input Frequency', recordedAt:new Date().toISOString(),
      measurementLayer:'browser-visible mouse movement',
      methodology:'independent streams; common arrival window; count / elapsed seconds',
      simultaneousListeners:true, coalescedApiAvailable:supportsCoalesced,
      clockPrecision:'heuristic only; event timestamp precision may differ',
      ...latest
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `browser-input-frequency-${Date.now()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  render();
})();
