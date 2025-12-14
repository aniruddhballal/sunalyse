import { useState, useRef } from 'react';
import GlobeViewer from './GlobeViewer';
import DetailsPanel from './DetailsPanel';
import { parseFITS } from './fits/fitsUtils';
import type { FITSData } from './fits/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL;
if (!API_BASE) {
  throw new Error('VITE_API_BASE_URL is not defined');
}

// UploadSection component
interface UploadSectionProps {
  isUploading: boolean;
  isProcessing: boolean;
  fitsData: FITSData | null;
  fileName: string;
  uploadProgress: number;
  onUploadClick: () => void;
  carringtonNumber: string;
  onCarringtonChange: (value: string) => void;
  onCarringtonFetch: () => void;
  fetchError: string;
}

function UploadSection({
  isUploading,
  isProcessing,
  fitsData,
  fileName,
  uploadProgress,
  onUploadClick,
  carringtonNumber,
  onCarringtonChange,
  onCarringtonFetch,
  fetchError
}: UploadSectionProps) {
  if (fitsData) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      <div className="text-center space-y-8 max-w-md px-6">
        <h1 className="text-3xl font-light text-white tracking-wide">
          Solar Magnetic Field Viewer
        </h1>
        
        <div className="space-y-6">
          {/* File Upload Section */}
          <div className="space-y-3">
            <p className="text-gray-400 text-sm font-light">
              Upload a FITS file to visualize solar magnetic field data
            </p>
            
            <button
              onClick={onUploadClick}
              disabled={isUploading || isProcessing}
              className="w-full px-8 py-3 bg-white/10 hover:bg-white/20 text-white font-light rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-white/20"
            >
              {isUploading ? 'Uploading...' : isProcessing ? 'Processing...' : 'Choose FITS File'}
            </button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-black text-gray-500">or</span>
            </div>
          </div>

          {/* Carrington Rotation Input Section */}
          <div className="space-y-3">
            <p className="text-gray-400 text-sm font-light">
              Enter Carrington Rotation Number (2096 - 2285)
            </p>
            
            <div className="flex gap-2">
              <input
                type="number"
                value={carringtonNumber}
                onChange={(e) => onCarringtonChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onCarringtonFetch()}
                placeholder="e.g., 2150"
                disabled={isUploading || isProcessing}
                className="flex-1 px-4 py-3 bg-white/10 text-white font-light rounded-lg border border-white/20 focus:outline-none focus:border-white/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed placeholder-gray-500"
              />
              <button
                onClick={onCarringtonFetch}
                disabled={isUploading || isProcessing || !carringtonNumber}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-light rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Fetch
              </button>
            </div>

            {fetchError && (
              <p className="text-red-400 text-xs font-light">{fetchError}</p>
            )}
          </div>
        </div>

        {(isUploading || isProcessing) && (
          <div className="space-y-3 pt-4">
            {fileName && (
              <p className="text-gray-400 text-sm font-light">{fileName}</p>
            )}
            {isUploading && (
              <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
                <div 
                  className="bg-white h-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
            {isProcessing && (
              <p className="text-gray-400 text-sm font-light animate-pulse">
                Processing FITS data...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Main Component
export default function SolarMagneticFieldGlobe() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fitsData, setFitsData] = useState<FITSData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [show2DMap, setShow2DMap] = useState(false);
  const [carringtonNumber, setCarringtonNumber] = useState('');
  const [fetchError, setFetchError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setFetchError('');
    setFileName(file.name);
    setIsUploading(true);
    setUploadProgress(0);
    setFitsData(null);

    const uploadInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(uploadInterval);
          return 100;
        }
        return prev + 10;
      });
    }, 100);

    setTimeout(async () => {
      setIsUploading(false);
      
      if (file.name.toLowerCase().endsWith('.fits')) {
        setIsProcessing(true);
        const parsed = await parseFITS(file);
        setFitsData(parsed);
        setIsProcessing(false);
      }
    }, 1200);
  };

  const handleCarringtonFetch = async () => {
    const rotationNum = parseInt(carringtonNumber);
    if (!rotationNum || rotationNum < 1 || rotationNum > 3000) {
      setFetchError('Please enter a valid Carrington rotation number (1-3000)');
      return;
    }

    setFetchError('');
    setIsUploading(true);
    setUploadProgress(0);
    setFitsData(null);
    setFileName(`CR${rotationNum}.fits`);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 15, 90));
      }, 200);

      // Fetch FITS file from backend
      const response = await fetch(
        `${API_BASE}/api/fits/carrington/${rotationNum}`
      );

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        throw new Error(`Failed to fetch CR${rotationNum}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const file = new File([blob], `CR${rotationNum}.fits`, { type: 'application/fits' });

      setIsUploading(false);
      setIsProcessing(true);
      
      const parsed = await parseFITS(file);
      setFitsData(parsed);
      setIsProcessing(false);
      
    } catch (error) {
      setIsUploading(false);
      setFetchError(error instanceof Error ? error.message : 'Failed to fetch FITS file');
      setUploadProgress(0);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleReset = () => {
    setUploadProgress(0);
    setIsUploading(false);
    setFileName('');
    setFitsData(null);
    setShowDetails(true);
    setShow2DMap(false);
    setCarringtonNumber('');
    setFetchError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden" style={{ minHeight: '100dvh' }}>
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        className="hidden"
        accept=".fits"
      />

      <UploadSection
        isUploading={isUploading}
        isProcessing={isProcessing}
        fitsData={fitsData}
        fileName={fileName}
        uploadProgress={uploadProgress}
        onUploadClick={handleButtonClick}
        carringtonNumber={carringtonNumber}
        onCarringtonChange={setCarringtonNumber}
        onCarringtonFetch={handleCarringtonFetch}
        fetchError={fetchError}
      />

      {fitsData && (
        <>
          <GlobeViewer
            fitsData={fitsData}
            show2DMap={show2DMap}
          />

          <div 
            className="absolute left-6 space-y-2 z-20 pointer-events-auto"
            style={{ bottom: '10vh' }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShow2DMap(!show2DMap)}
              className="block text-white text-xs font-light hover:text-gray-300 transition-colors bg-black/50 px-3 py-2 rounded backdrop-blur"
            >
              {show2DMap ? 'Show 3D Globe' : 'Show 2D Map'}
            </button>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="block text-white text-xs font-light hover:text-gray-300 transition-colors bg-black/50 px-3 py-2 rounded backdrop-blur"
            >
              {showDetails ? 'Hide' : 'Show'} Details
            </button>
            <button
              onClick={handleReset}
              className="block text-white text-xs font-light hover:text-gray-300 transition-colors bg-black/50 px-3 py-2 rounded backdrop-blur"
            >
              View Another
            </button>
          </div>

          <div className="absolute bottom-6 right-6 text-gray-500 text-xs font-light z-20 pointer-events-none">
            {show2DMap ? 'Viewing 2D Map' : 'Drag to rotate'}
          </div>

          {showDetails && (
            <DetailsPanel
              fitsData={fitsData}
              fileName={fileName}
              onClose={() => setShowDetails(false)}
            />
          )}
        </>
      )}
    </div>
  );
}