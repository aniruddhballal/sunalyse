import { drainResponseAsText } from './streamUtils';
import { sanitizeNaNJSON, cleanCoronalData } from './coronalParser';
import type { RawCoronalData } from './coronalTypes';

const HF_USER   = import.meta.env.VITE_HF_USER;
const HF_FITS   = import.meta.env.VITE_HF_FITS;
const HF_CORONA = import.meta.env.VITE_HF_CORONA;

if (!HF_USER || !HF_FITS || !HF_CORONA) {
  throw new Error('VITE_HF_USER, VITE_HF_FITS, and VITE_HF_CORONA must be defined in your .env');
}

const HF_FITS_BASE   = `https://huggingface.co/datasets/${HF_USER}/${HF_FITS}/resolve/main`;
const HF_CORONA_BASE = `https://huggingface.co/datasets/${HF_USER}/${HF_CORONA}/resolve/main`;

export const api = {
  fetchCarringtonFits: async (crNumber: number): Promise<Blob> => {
    const url = `${HF_FITS_BASE}/hmi.Synoptic_Mr_small.${crNumber}.fits?download=true`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) throw new Error(`No FITS file found for CR ${crNumber}`);
      throw new Error(`Failed to fetch CR${crNumber}: ${response.statusText}`);
    }

    return response.blob();
  },

  fetchCoronalData: async (crNumber: number) => {
    const url = `${HF_CORONA_BASE}/cr${crNumber}_coronal.json`;
    const response = await fetch(url, {
      headers: { 'Accept-Encoding': 'identity' },
    });

    if (!response.ok) {
      if (response.status === 404) throw new Error(`Coronal data for CR ${crNumber} not found. May need to be computed.`);
      throw new Error(`Failed to load coronal data: ${response.statusText}`);
    }

    const rawText       = await drainResponseAsText(response);
    const sanitizedText = sanitizeNaNJSON(rawText);

    let parsed: RawCoronalData;
    try {
      parsed = JSON.parse(sanitizedText);
    } catch (err) {
      const col = err instanceof SyntaxError
        ? err.message.match(/column (\d+)/)?.[1]
        : null;
      if (col) {
        const idx     = parseInt(col, 10);
        const snippet = sanitizedText.slice(Math.max(0, idx - 60), idx + 60);
        throw new Error(
          `CR ${crNumber}: JSON still invalid after NaN sanitization at column ${col} ` +
          `(received ${rawText.length} chars).\nNear failure: ...${snippet}...`
        );
      }
      throw err;
    }

    return cleanCoronalData(parsed);
  },
};