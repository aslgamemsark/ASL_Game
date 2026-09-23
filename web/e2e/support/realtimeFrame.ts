/** Test-only inspection of incoming Realtime broadcast envelopes. Binary v2 stores
 * the user event in the header, not as a quoted JSON value (realtime-js Serializer).
 * Forward the original bytes unchanged unless the test explicitly drops that event. */
export function broadcastEvent(message: string | Buffer): string | undefined {
  if (typeof message === 'string') {
    const frame = JSON.parse(message);
    return (Array.isArray(frame) ? frame[4] : frame.payload)?.event;
  }
  if (message.length < 5 || message[0] !== 4) return undefined;
  const offset = 5 + message[1]!;
  const end = offset + message[2]!;
  if (end > message.length) return undefined;
  return message.subarray(offset, end).toString('utf8');
}
