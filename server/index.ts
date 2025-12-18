import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import healthRoutes from './routes/health';
import fitsRoutes from './routes/fits';
import coronalRoutes from './routes/coronal';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? '*',
  })
);
app.use(express.json());

// Register routes
app.use('/health', healthRoutes);
app.use('/api/fits', fitsRoutes);
app.use('/api/coronal', coronalRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});