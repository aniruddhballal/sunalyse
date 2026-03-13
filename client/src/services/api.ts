const HF_USER = import.meta.env.VITE_HF_USER;
const HF_FITS = import.meta.env.VITE_HF_FITS;
const HF_CORONA = import.meta.env.VITE_HF_CORONA;

if (!HF_USER || !HF_FITS || !HF_CORONA) {
  throw new Error('VITE_HF_USER, VITE_HF_FITS, and VITE_HF_CORONA must be defined in your .env');
}

const HF_FITS_BASE = `https://huggingface.co/datasets/${HF_USER}/${HF_FITS}/resolve/main`;
const HF_CORONA_BASE = `https://huggingface.co/datasets/${HF_USER}/${HF_CORONA}/resolve/main`;

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

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Coronal data for CR ${crNumber} not found. May need to be computed.`);
      }
      throw new Error(`Failed to load coronal data: ${response.statusText}`);
    }

    return response.json();
  },
};