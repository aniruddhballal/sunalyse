import express, { Request, Response } from 'express';
import cors from 'cors';
import fetch from 'node-fetch'; // npm i node-fetch@2

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Base URL for your HF dataset
const HF_USER = 'aniruddhballal';
const HF_REPO = 'fits-data';
const HF_API_FILES = `https://huggingface.co/api/datasets/${HF_USER}/${HF_REPO}/tree/main`;
const HF_BASE_URL = `https://huggingface.co/datasets/${HF_USER}/${HF_REPO}/resolve/main`;

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// List all FITS files dynamically
app.get('/api/fits/list', async (req: Request, res: Response) => {
  try {
    const response = await fetch(HF_API_FILES);
    const files = await response.json();

    // Filter only .fits files
    const fitsFiles = files.filter((file: any) => file.type === 'file' && file.rfilename.endsWith('.fits'))
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
app.get('/api/fits/carrington/:rotationNumber', async (req: Request, res: Response) => {
  try {
    const rotationNumber = parseInt(req.params.rotationNumber);
    if (isNaN(rotationNumber)) {
      return res.status(400).json({ error: 'Invalid rotation number' });
    }

    const filename = `hmi.Synoptic_Mr_small.${rotationNumber}.fits`;
    const url = `${HF_BASE_URL}/${filename}`;

    // Check if file exists
    const head = await fetch(url, { method: 'HEAD' });
    if (!head.ok) {
      return res.status(404).json({ error: `No FITS file found for rotation ${rotationNumber}` });
    }

    // Stream file to client
    const hfResponse = await fetch(url);
    res.setHeader('Content-Type', 'application/fits');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    hfResponse.body.pipe(res);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
