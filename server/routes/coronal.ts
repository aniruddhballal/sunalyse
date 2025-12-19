import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';

const router = Router();

// Validate required env vars
const HF_USER = process.env.HF_USER;
const HF_CORONA = process.env.HF_CORONA;

if (!HF_USER || !HF_CORONA) {
  throw new Error('HF_USER and HF_CORONA must be set in environment variables');
}

const HF_RESOLVE_BASE =
  `https://huggingface.co/datasets/${HF_USER}/${HF_CORONA}/resolve/main`;

const HF_TREE_API =
  `https://huggingface.co/api/datasets/${HF_USER}/${HF_CORONA}/tree/main`;

/**
 * GET /api/coronal/:crNumber
 * Fetch coronal PFSS JSON for a specific Carrington rotation
 */
router.get('/:crNumber', async (req: Request, res: Response) => {
  try {
    const crNumber = Number(req.params.crNumber);

    if (!Number.isInteger(crNumber) || crNumber < 2096 || crNumber > 2285) {
      return res.status(400).json({
        error: 'Invalid Carrington rotation number',
        message: 'CR number must be between 2096 and 2285',
      });
    }

    const filename = `cr${crNumber}_coronal.json`;
    const url = `${HF_RESOLVE_BASE}/${filename}`;

    const hfResponse = await fetch(url);

    if (!hfResponse.ok) {
      return res.status(404).json({
        error: 'Coronal data not found',
        message: `No coronal field data available for CR ${crNumber}`,
        crNumber,
      });
    }

    const json = await hfResponse.json();
    res.json(json);
  } catch (error) {
    console.error('Error fetching coronal data from Hugging Face:', error);
    res.status(500).json({
      error: 'Failed to fetch coronal data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/coronal/available/list
 * List all available Carrington rotations in Hugging Face dataset
 */
router.get('/available/list', async (_req: Request, res: Response) => {
  try {
    const response = await fetch(HF_TREE_API);
    const files = await response.json();

    const availableCRs = files
      .filter((f: any) =>
        typeof f.rfilename === 'string' &&
        /^cr\d+_coronal\.json$/.test(f.rfilename)
      )
      .map((f: any) => Number(f.rfilename.match(/\d+/)[0]))
      .filter((cr: number) => cr >= 2096 && cr <= 2285)
      .sort((a: number, b: number) => a - b);

    res.json({
      availableCRNumbers: availableCRs,
      count: availableCRs.length,
      range: {
        min: availableCRs[0] ?? null,
        max: availableCRs[availableCRs.length - 1] ?? null,
      },
    });
  } catch (error) {
    console.error('Error listing coronal data from Hugging Face:', error);
    res.status(500).json({
      error: 'Failed to list available data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;