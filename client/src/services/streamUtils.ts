// Drains a ReadableStream<Uint8Array> to completion and returns the full text.
// Using response.json() directly on large HF CDN payloads can call JSON.parse
// on a partial body — this ensures we wait for every chunk before parsing.

export async function drainResponseAsText(response: Response): Promise<string> {
  if (!response.body) {
    return response.text();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalBytes += value.byteLength;
  }

  // Reassemble into one contiguous buffer before decoding.
  // Decoding each chunk individually can corrupt multi-byte UTF-8 characters
  // that straddle chunk boundaries.
  const fullBuffer = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    fullBuffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder('utf-8').decode(fullBuffer);
}