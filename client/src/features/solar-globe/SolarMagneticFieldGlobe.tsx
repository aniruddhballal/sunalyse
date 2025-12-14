import { useState, useRef } from 'react';
import UploadView from './UploadView';
import ViewerView from './ViewerView';
import { parseFITS } from './fits/fitsUtils';
import type { FITSData } from './fits/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL;
if (!API_BASE) {
  throw new Error('VITE_API_BASE_URL is not defined');
}

export default function SolarMagneticFieldGlobe() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fitsData, setFitsData] = useState<FITSData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [carringtonNumber, setCarringtonNumber] = useState('');
  const [currentCRNumber, setCurrentCRNumber] = useState<number | undefined>(undefined);
  const [fetchError, setFetchError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCarringtonData = async (rotationNum: number) => {
    if (rotationNum < 2096 || rotationNum > 2285) {
      setFetchError('Carrington rotation number must be between 2096 and 2285');
      return;
    }

    setFetchError('');
    setIsUploading(true);
    setUploadProgress(0);
    setFitsData(null);
    setFileName(`CR${rotationNum}.fits`);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 15, 90));
      }, 200);

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
      setCurrentCRNumber(rotationNum);
      setIsProcessing(false);
      
    } catch (error) {
      setIsUploading(false);
      setFetchError(error instanceof Error ? error.message : 'Failed to fetch FITS file');
      setUploadProgress(0);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setFetchError('');
    setFileName(file.name);
    setIsUploading(true);
    setUploadProgress(0);
    setFitsData(null);
    setCurrentCRNumber(undefined);

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
    if (!rotationNum) {
      setFetchError('Please enter a valid Carrington rotation number');
      return;
    }
    await fetchCarringtonData(rotationNum);
  };

  const handleNavigate = async (direction: 'next' | 'prev') => {
    if (currentCRNumber === undefined) return;
    
    const newCRNumber = direction === 'next' 
      ? currentCRNumber + 1 
      : currentCRNumber - 1;
    
    await fetchCarringtonData(newCRNumber);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleReset = () => {
    setUploadProgress(0);
    setIsUploading(false);
    setFileName('');
    setFitsData(null);
    setCarringtonNumber('');
    setCurrentCRNumber(undefined);
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

      {!fitsData ? (
        <UploadView
          isUploading={isUploading}
          isProcessing={isProcessing}
          fileName={fileName}
          uploadProgress={uploadProgress}
          onUploadClick={handleButtonClick}
          carringtonNumber={carringtonNumber}
          onCarringtonChange={setCarringtonNumber}
          onCarringtonFetch={handleCarringtonFetch}
          fetchError={fetchError}
        />
      ) : (
        <ViewerView
          fitsData={fitsData}
          fileName={fileName}
          onReset={handleReset}
          currentCarringtonNumber={currentCRNumber}
          onNavigate={handleNavigate}
          isNavigating={isUploading || isProcessing}
        />
      )}
    </div>
  );
}