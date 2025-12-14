import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';

const router = Router();

// Validate environment variables
if (!process.env.HF_USER || !process.env.HF_REPO) {
  throw new Error('HF_USER and HF_REPO must be set');
}

const HF_USER = process.env.HF_USER;
const HF_REPO = process.env.HF_REPO;
const HF_API_FILES = `https://huggingface.co/api/datasets/${HF_USER}/${HF_REPO}/tree/main`;
const HF_BASE_URL = `https://huggingface.co/datasets/${HF_USER}/${HF_REPO}/resolve/main`;

// List all FITS files dynamically
router.get('/list', async (req: Request, res: Response) => {
  try {
    const response = await fetch(HF_API_FILES);
    const files = await response.json();
    
    // Filter only .fits files
    const fitsFiles = files
      .filter((file: any) => file.type === 'file' && file.rfilename.endsWith('.fits'))
      .map((file: any) => file.rfilename);
    
    res.json({
      totalFiles: fitsFiles.length,
      files: fitsFiles,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch FITS files list' });
  }
});

// Fetch FITS by Carrington rotation number
router.get('/carrington/:rotationNumber', async (req: Request, res: Response) => {
  try {
    const rotationNumber = parseInt(req.params.rotationNumber);
    
    if (isNaN(rotationNumber)) {
      return res.status(400).json({ error: 'Invalid rotation number' });
    }
    
    const filename = `hmi.Synoptic_Mr_small.${rotationNumber}.fits`;
    const url = `${HF_BASE_URL}/${filename}`;
    
    const hfResponse = await fetch(url);
    
    if (!hfResponse.ok) {
      return res
        .status(404)
        .json({ error: `No FITS file found for rotation ${rotationNumber}` });
    }
    
    res.setHeader('Content-Type', 'application/fits');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    hfResponse.body.pipe(res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;