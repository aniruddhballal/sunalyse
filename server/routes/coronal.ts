import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

const router = express.Router();

// Path to coronal data directory
const CORONAL_DATA_DIR = path.join(__dirname, '..', 'coronal_data');

/**
 * GET /api/coronal/:crNumber
 * Fetch coronal field data for a specific Carrington rotation
 */
router.get('/:crNumber', async (req: Request, res: Response) => {
  try {
    const crNumber = parseInt(req.params.crNumber);

    // Validate CR number
    if (isNaN(crNumber) || crNumber < 2096 || crNumber > 2285) {
      return res.status(400).json({
        error: 'Invalid Carrington rotation number',
        message: 'CR number must be between 2096 and 2285'
      });
    }

    // Construct file path
    const filename = `cr${crNumber}_coronal.json`;
    const filePath = path.join(CORONAL_DATA_DIR, filename);

    // Check if file exists
    if (!existsSync(filePath)) {
      return res.status(404).json({
        error: 'Coronal data not found',
        message: `Coronal field data for CR ${crNumber} has not been computed yet`,
        crNumber
      });
    }

    // Read and send the JSON file
    const data = await fs.readFile(filePath, 'utf-8');
    const jsonData = JSON.parse(data);

    res.json(jsonData);
  } catch (error) {
    console.error('Error fetching coronal data:', error);
    res.status(500).json({
      error: 'Failed to read coronal data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/coronal/available/list
 * Get list of available Carrington rotations with coronal data
 */
router.get('/available/list', async (req: Request, res: Response) => {
  try {
    // Check if directory exists
    if (!existsSync(CORONAL_DATA_DIR)) {
      return res.json({
        availableCRNumbers: [],
        count: 0,
        message: 'Coronal data directory not found'
      });
    }

    // Read all files in coronal_data directory
    const files = await fs.readdir(CORONAL_DATA_DIR);

    // Extract CR numbers from filenames like "cr2240_coronal.json"
    const availableCRs: number[] = [];
    
    for (const file of files) {
      if (file.endsWith('_coronal.json')) {
        const match = file.match(/^cr(\d+)_coronal\.json$/);
        if (match) {
          const crNum = parseInt(match[1]);
          if (crNum >= 2096 && crNum <= 2285) {
            availableCRs.push(crNum);
          }
        }
      }
    }

    availableCRs.sort((a, b) => a - b);

    res.json({
      availableCRNumbers: availableCRs,
      count: availableCRs.length,
      range: {
        min: availableCRs.length > 0 ? availableCRs[0] : null,
        max: availableCRs.length > 0 ? availableCRs[availableCRs.length - 1] : null
      }
    });
  } catch (error) {
    console.error('Error listing available coronal data:', error);
    res.status(500).json({
      error: 'Failed to list available data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;