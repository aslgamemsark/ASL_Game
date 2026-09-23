import { expect, it } from 'vitest';
import { broadcastEvent } from '../e2e/support/realtimeFrame';

it.each(['round-end', 'game-over', 'state-snapshot'])('identifies %s in JSON and binary Realtime frames', event => {
  const topic = 'realtime:mp-room-ABCDEFGH';
  expect(broadcastEvent(JSON.stringify([null, null, topic, 'broadcast', { event, payload: {} }]))).toBe(event);
  const binary = Buffer.concat([Buffer.from([4, topic.length, event.length, 0, 1]), Buffer.from(topic + event + '{}')]);
  expect(broadcastEvent(binary)).toBe(event);
});
it('does not interpret unrelated or truncated binary frames as completion', () => {
  expect(broadcastEvent(Buffer.from([1, 0, 0, 0, 0]))).toBeUndefined();
  expect(broadcastEvent(Buffer.from([4, 20, 10, 0, 1]))).toBeUndefined();
});
