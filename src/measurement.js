/* Adapted from MousePollingRateTest's browser-visible sampling approach.
 * This demo counts three independent streams over ONE shared arrival window.
 * No USB access, inferred missing samples, predictions, or rate-tier snapping. */
(function (root) {
  'use strict';
  const SOURCES = ['mousemove', 'pointermove', 'pointerrawupdate'];
  class Measurement {
    constructor({ supported = SOURCES, durationMs = 10000, clockGrainMs = .1, maxSamples = 200000 } = {}) {
      if (!Number.isFinite(durationMs) || durationMs <= 0) throw new RangeError('Invalid duration');
      this.durationMs = durationMs;
      this.clockGrainMs = clockGrainMs;
      this.maxSamples = maxSamples;
      this.start = null;
      this.end = null;
      this.interruption = null;
      this.streams = Object.fromEntries(SOURCES.map(source => [source, {
        supported: supported.includes(source), callbacks: 0, timestamps: [],
        expanded: 0, invalid: 0, duplicates: 0, overflow: false,
        coalescedCallbacks: 0, apiErrors: 0
      }]));
    }
    ingest(source, event, arrival) {
      const stream = this.streams[source];
      if (!stream || !stream.supported || this.end !== null || this.interruption ||
          event.isTrusted !== true || !Number.isFinite(arrival)) return;
      if (source === 'mousemove') {
        if (event.sourceCapabilities?.firesTouchEvents) return;
      } else if (event.pointerType !== 'mouse') return;
      if (this.start === null) this.start = arrival;
      if (arrival < this.start || arrival >= this.start + this.durationMs) return;
      stream.callbacks++;
      let batch = [];
      if (source !== 'mousemove' && typeof event.getCoalescedEvents === 'function') {
        try { batch = event.getCoalescedEvents(); } catch (_) { stream.apiErrors++; }
      }
      if (batch.length) stream.coalescedCallbacks++;
      // Parent is a summary of the batch, not one extra sample.
      if (!batch.length) batch = [event];
      stream.expanded += Math.max(0, batch.length - 1);
      for (const sample of batch) {
        if (stream.timestamps.length >= this.maxSamples) { stream.overflow = true; break; }
        const t = sample.timeStamp;
        const previous = stream.timestamps.at(-1);
        if (!Number.isFinite(t) || t < 0 || (previous !== undefined && t < previous)) {
          stream.invalid++; continue;
        }
        if (t === previous) stream.duplicates++;
        stream.timestamps.push(t);
      }
    }
    stop(now, reason = null) {
      if (this.end !== null) return;
      this.end = this.start === null ? now : Math.max(this.start, Math.min(now, this.start + this.durationMs));
      this.interruption = reason;
    }
    snapshot(now) {
      const end = this.end ?? now;
      const elapsedMs = this.start === null ? 0 : Math.max(0, Math.min(end - this.start, this.durationMs));
      return {
        version: '1.0.0', elapsedMs, plannedDurationMs: this.durationMs,
        interruption: this.interruption, clockGrainMs: this.clockGrainMs,
        streams: Object.fromEntries(SOURCES.map(source => {
          const stream = this.streams[source];
          const count = stream.timestamps.length;
          const intervals = [];
          for (let i = 1; i < count; i++) {
            const dt = stream.timestamps[i] - stream.timestamps[i - 1];
            if (dt > 0 && dt < 100) intervals.push(dt);
          }
          // Sorting happens only in a snapshot, never in the input handler.
          intervals.sort((a, b) => a - b);
          const median = intervals.length ? intervals[Math.floor(intervals.length / 2)] : null;
          const duplicateShare = count > 1 ? stream.duplicates / (count - 1) : 0;
          const timingOK = elapsedMs >= 3000 && count >= 100 && intervals.length >= 50 &&
            !this.interruption && !stream.invalid && !stream.overflow && !stream.apiErrors &&
            Number.isFinite(this.clockGrainMs) && this.clockGrainMs > 0 &&
            median >= this.clockGrainMs * 4 && duplicateShare <= .01;
          let status = !stream.supported ? 'unsupported' : !count ? 'no-events' :
            elapsedMs < 3000 || count < 100 ? 'short-capture' : 'observed';
          if (stream.supported && (stream.invalid || stream.overflow)) status = 'invalid';
          if (stream.supported && this.interruption) status = 'interrupted';
          return [source, {
            supported: stream.supported, status, callbacks: stream.callbacks, samples: count,
            expandedSamples: stream.expanded, coalescedCallbacks: stream.coalescedCallbacks,
            apiErrors: stream.apiErrors, invalidTimestamps: stream.invalid,
            duplicateTimestamps: stream.duplicates, overflow: stream.overflow,
            callbackHz: elapsedMs > 0 && stream.callbacks ? stream.callbacks * 1000 / elapsedMs : null,
            sampleHz: elapsedMs > 0 && count ? count * 1000 / elapsedMs : null,
            medianIntervalMs: timingOK ? median : null,
            intervalStatus: timingOK ? 'available-estimate' : 'unavailable',
            sampleCompleteness: 'not-established'
          }];
        }))
      };
    }
  }
  const api = { Measurement, SOURCES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.InputFrequency = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
