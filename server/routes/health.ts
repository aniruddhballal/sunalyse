import { Router, Request, Response } from 'express';

const router = Router();

// Health check
router.get('/', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

export default router;