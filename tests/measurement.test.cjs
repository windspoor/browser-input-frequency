const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Measurement } = require('../src/measurement.js');
const event = (timeStamp, extra = {}) => ({ timeStamp, isTrusted:true, pointerType:'mouse', ...extra });
for (const hz of [125, 500, 1000, 4000, 8000]) {
  test(`${hz} Hz synthetic samples are counted without tier snapping`, () => {
    const m = new Measurement({ clockGrainMs:.005 });
    for (let t = 0; t < 10000; t += 1000 / hz) m.ingest('pointerrawupdate', event(t), t);
    m.stop(10000);
    const s = m.snapshot(10000).streams.pointerrawupdate;
    assert.equal(s.sampleHz, hz);
    assert.equal(s.sampleCompleteness, 'not-established');
  });
}
test('coalesced children replace the parent; callback and sample frequencies differ', () => {
  const m = new Measurement();
  for (let t = 0; t < 10000; t += 10) {
    m.ingest('pointermove', event(t + 9, { getCoalescedEvents:() => Array.from({length:10}, (_, i) => event(t + i)) }), t);
    m.ingest('mousemove', event(t), t);
  }
  m.stop(10000);
  const s = m.snapshot(10000).streams;
  assert.equal(s.pointermove.samples, 10000);
  assert.equal(s.pointermove.callbackHz, 100);
  assert.equal(s.pointermove.sampleHz, 1000);
  assert.equal(s.mousemove.sampleHz, 100);
});
test('counts use one arrival window even if another stream starts late', () => {
  const m = new Measurement();
  m.ingest('mousemove', event(0), 0);
  m.ingest('pointermove', event(5000), 5000);
  m.stop(10000);
  assert.equal(m.snapshot(10000).streams.pointermove.sampleHz, .1);
});
test('raw and move streams are never combined; empty and throwing coalescing use the parent', () => {
  const m = new Measurement();
  m.ingest('pointerrawupdate', event(0, { getCoalescedEvents:() => [] }), 0);
  m.ingest('pointermove', event(0, { getCoalescedEvents:() => { throw Error('unsupported'); } }), 0);
  const s = m.snapshot(1000).streams;
  assert.equal(s.pointerrawupdate.samples, 1);
  assert.equal(s.pointermove.samples, 1);
  assert.equal(s.pointermove.apiErrors, 1);
});
test('coarse timestamps preserve counts and suppress misleading intervals', () => {
  const m = new Measurement();
  for (let t = 0; t < 10000; t += .125) m.ingest('pointerrawupdate', event(Math.floor(t)), t);
  const s = m.snapshot(10000).streams.pointerrawupdate;
  assert.equal(s.sampleHz, 8000);
  assert.equal(s.medianIntervalMs, null);
  assert.ok(s.duplicateTimestamps > 0);
});
test('8K intervals are withheld at a conservative 0.1 ms grain', () => {
  const m = new Measurement({ clockGrainMs:.1 });
  for (let t = 0; t < 10000; t += .125) m.ingest('pointerrawupdate', event(t), t);
  assert.equal(m.snapshot(10000).streams.pointerrawupdate.medianIntervalMs, null);
});
test('invalid timestamps invalidate a stream; zero intervals never yield infinity', () => {
  const m = new Measurement();
  for (const t of [1, 1, 0, NaN, Infinity]) m.ingest('pointermove', event(t), 1);
  const s = m.snapshot(10000).streams.pointermove;
  assert.equal(s.samples, 2);
  assert.equal(s.invalidTimestamps, 3);
  assert.equal(s.status, 'invalid');
  assert.equal(s.medianIntervalMs, null);
});
test('untrusted, pen, touch and touch-derived mouse events are rejected', () => {
  const m = new Measurement();
  m.ingest('pointermove', event(0, { isTrusted:false }), 0);
  m.ingest('pointermove', event(0, { pointerType:'pen' }), 0);
  m.ingest('pointerrawupdate', event(0, { pointerType:'touch' }), 0);
  m.ingest('mousemove', event(0, { sourceCapabilities:{ firesTouchEvents:true } }), 0);
  assert.equal(m.start, null);
});
test('end boundary is excluded and stop freezes results', () => {
  const m = new Measurement();
  m.ingest('mousemove', event(0), 0);
  m.ingest('mousemove', event(10000), 10000);
  m.stop(10000);
  m.ingest('mousemove', event(11000), 11000);
  assert.equal(m.snapshot(20000).elapsedMs, 10000);
  assert.equal(m.snapshot(20000).streams.mousemove.samples, 1);
});
test('pauses remain in elapsed time and missing samples are never reconstructed', () => {
  const m = new Measurement();
  for (let t = 0; t < 5000; t++) if (t % 5) m.ingest('pointerrawupdate', event(t), t);
  m.stop(10001);
  assert.ok(Math.abs(m.snapshot(10001).streams.pointerrawupdate.sampleHz - 400) < .1);
});
test('interruptions preserve partial observations and remove interval conclusions', () => {
  const m = new Measurement();
  for (let t = 0; t < 4000; t++) m.ingest('pointerrawupdate', event(t), t);
  m.stop(4000, 'blur');
  const s = m.snapshot(10000).streams.pointerrawupdate;
  assert.equal(s.sampleHz, 1000);
  assert.equal(s.status, 'interrupted');
  assert.equal(s.medianIntervalMs, null);
});
test('unsupported streams are distinguished from supported but silent streams', () => {
  const m = new Measurement({ supported:['mousemove', 'pointermove'] });
  const s = m.snapshot(10000).streams;
  assert.equal(s.pointerrawupdate.status, 'unsupported');
  assert.equal(s.pointermove.status, 'no-events');
  assert.equal(s.pointerrawupdate.sampleHz, null);
});
test('sample storage is bounded and overflow is explicit', () => {
  const m = new Measurement({ maxSamples:2 });
  for (let t = 0; t < 3; t++) m.ingest('pointerrawupdate', event(t), t);
  const s = m.snapshot(1000).streams.pointerrawupdate;
  assert.equal(s.samples, 2);
  assert.equal(s.overflow, true);
  assert.equal(s.status, 'invalid');
});
