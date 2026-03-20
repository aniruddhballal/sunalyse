const HF_USER = import.meta.env.VITE_HF_USER;
const HF_FITS = import.meta.env.VITE_HF_FITS;
const HF_CORONA = import.meta.env.VITE_HF_CORONA;

if (!HF_USER || !HF_FITS || !HF_CORONA) {
  throw new Error('VITE_HF_USER, VITE_HF_FITS, and VITE_HF_CORONA must be defined in your .env');
}

const HF_FITS_BASE = `https://huggingface.co/datasets/${HF_USER}/${HF_FITS}/resolve/main`;
const HF_CORONA_BASE = `https://huggingface.co/datasets/${HF_USER}/${HF_CORONA}/resolve/main`;

// ---------------------------------------------------------------------------
// Drains a ReadableStream<Uint8Array> to completion and returns the full text.
// Using response.json() directly on large HF CDN payloads can call JSON.parse
// on a partial body — this ensures we wait for every chunk before parsing.
// ---------------------------------------------------------------------------
async function drainResponseAsText(response: Response): Promise<string> {
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

// ---------------------------------------------------------------------------
// The Python generator writes bare NaN tokens (via json.dumps on numpy floats
// near poles where sin(theta)→0 cascades through spherical_to_cartesian).
// These are valid Python/JS values but illegal JSON — JSON.parse rejects them.
//
// Fix: replace all bare NaN / Infinity / -Infinity tokens with null BEFORE
// parsing, then strip out any field lines that contain null points entirely
// (they have no renderable geometry anyway).
// ---------------------------------------------------------------------------
function sanitizeNaNJSON(raw: string): string {
  // Replace bare NaN, Infinity, -Infinity with null.
  // Word-boundary anchors prevent matching substrings inside quoted strings.
  return raw.replace(/\bNaN\b|-?Infinity\b/g, 'null');
}

type RawPoint = ([number, number, number] | [null, null, null]);

interface RawFieldLine {
  points: RawPoint[];
  strengths: (number | null)[];
  polarity: 'open' | 'closed';
  apexR?: number | null;
  footpoints?: [[number | null, number | null], [number | null, number | null]];
}

interface RawCoronalData {
  metadata: {
    lmax: number;
    r_source: number;
    n_field_lines: number;
  };
  fieldLines: RawFieldLine[];
  polarityGrid?: {
    data: (number | null)[];
    n_theta: number;
    n_phi: number;
  };
}

// ---------------------------------------------------------------------------
// After parsing, drop any field line that has even one null coordinate —
// those points came from NaN in the Python output and have no valid geometry.
// Also replace any null strengths with 0 to keep array lengths consistent.
// ---------------------------------------------------------------------------
function cleanCoronalData(raw: RawCoronalData) {
  const cleanedLines = raw.fieldLines
    .filter(fl =>
      // Keep only lines where every point is a fully-finite [x, y, z] triple
      fl.points.every(p => p[0] !== null && p[1] !== null && p[2] !== null)
    )
    .map(fl => ({
      ...fl,
      points: fl.points as [number, number, number][],
      strengths: fl.strengths.map(s => s ?? 0),
      apexR: fl.apexR ?? undefined,
    }));

  const removedCount = raw.fieldLines.length - cleanedLines.length;
  if (removedCount > 0) {
    console.warn(
      `[coronal] Dropped ${removedCount} field line(s) with NaN coordinates ` +
      `(${cleanedLines.length} remain). This is a known upstream data issue.`
    );
  }

  return {
    ...raw,
    metadata: {
      ...raw.metadata,
      n_field_lines: cleanedLines.length,
    },
    fieldLines: cleanedLines,
    polarityGrid: raw.polarityGrid
      ? {
          ...raw.polarityGrid,
          // Replace any null polarity values (from NaN Br near poles) with 0
          data: raw.polarityGrid.data.map(v => v ?? 0),
        }
      : undefined,
  };
}

export const api = {
  fetchCarringtonFits: async (crNumber: number): Promise<Blob> => {
    const filename = `hmi.Synoptic_Mr_small.${crNumber}.fits`;
    const url = `${HF_FITS_BASE}/${filename}?download=true`;

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`No FITS file found for CR ${crNumber}`);
      }
      throw new Error(`Failed to fetch CR${crNumber}: ${response.statusText}`);
    }

    return response.blob();
  },

  fetchCoronalData: async (crNumber: number) => {
    const filename = `cr${crNumber}_coronal.json`;
    const url = `${HF_CORONA_BASE}/${filename}`;

    const response = await fetch(url, {
      headers: {
        // Disable compression to prevent partial-gunzip issues on HF CDN
        // chunked responses, which can corrupt the byte stream mid-payload.
        'Accept-Encoding': 'identity',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Coronal data for CR ${crNumber} not found. May need to be computed.`);
      }
      throw new Error(`Failed to load coronal data: ${response.statusText}`);
    }

    const rawText = await drainResponseAsText(response);

    // Replace bare NaN/Infinity tokens before handing to JSON.parse —
    // Python's json.dumps emits these for numpy NaN values near poles.
    const sanitizedText = sanitizeNaNJSON(rawText);

    let parsed: RawCoronalData;
    try {
      parsed = JSON.parse(sanitizedText);
    } catch (err) {
      const col = err instanceof SyntaxError
        ? err.message.match(/column (\d+)/)?.[1]
        : null;

      if (col) {
        const idx = parseInt(col, 10);
        const snippet = sanitizedText.slice(Math.max(0, idx - 60), idx + 60);
        throw new Error(
          `CR ${crNumber}: JSON still invalid after NaN sanitization at column ${col} ` +
          `(received ${rawText.length} chars).\n` +
          `Near failure: ...${snippet}...`
        );
      }
      throw err;
    }

    // Strip field lines with any remaining null (NaN-origin) coordinates
    return cleanCoronalData(parsed);
  },
};