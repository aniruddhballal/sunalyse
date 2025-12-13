# Sunalyse Server

Backend server for fetching FITS files by Carrington Rotation number directly from Hugging Face.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
npm install node-fetch@2
```

### 2. Configure Hugging Face Dataset

No local FITS directory is required anymore. The server fetches files dynamically from your Hugging Face dataset.

Update the Hugging Face user/repo if needed:

```ts
const HF_USER = 'aniruddhballal';
const HF_REPO = 'fits-data';
const HF_API_FILES = `https://huggingface.co/api/datasets/${HF_USER}/${HF_REPO}/tree/main`;
const HF_BASE_URL = `https://huggingface.co/datasets/${HF_USER}/${HF_REPO}/resolve/main`;
```

### 3. Environment Variables

Optionally, specify a `PORT` in `.env`:

```
PORT=3001
```

## Running the Server

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

Server runs on `http://localhost:3001` (or the PORT specified in `.env`).

## API Endpoints

### 1. Health Check

```
GET /health
```

Returns server status.

### 2. Fetch FITS by Carrington Rotation

```
GET /api/fits/carrington/:rotationNumber
```

Example: `GET /api/fits/carrington/2097`

Returns the FITS file as a binary blob from Hugging Face.

**Response:**

* 200: FITS file (binary)
* 400: Invalid rotation number
* 404: File not found
* 500: Server error

### 3. List Available Files

```
GET /api/fits/list
```

Returns a list of all available FITS files in the Hugging Face repo.

**Response:**

```json
{
  "totalFiles": 183,
  "files": ["hmi.Synoptic_Mr_small.2097.fits", "hmi.Synoptic_Mr_small.2098.fits", ...]
}
```

## Project Structure

```
server/
├── src/
│   └── index.ts          # Main server file
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Frontend Integration

Use the Carrington endpoint in your frontend:

```ts
const response = await fetch(`${API_BASE}/api/fits/carrington/${rotationNum}`);
```

CORS is already configured in the server. Make sure frontend and backend ports match.

## Troubleshooting

### File Not Found

* Ensure the rotation number exists in your Hugging Face dataset.
* Use `/api/fits/list` to verify filenames.

### CORS Issues

* CORS is enabled in the server.
* Ensure the frontend is pointing to the correct backend URL.

### Port Already in Use

* Change the PORT in `.env` or `src/index.ts`.
* Kill any existing processes using port 3001.

---