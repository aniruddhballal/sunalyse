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
  const [isNavigating, setIsNavigating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCarringtonData = async (rotationNum: number, isNavigation = false) => {
    console.log('📡 [DEBUG] fetchCarringtonData called with CR:', rotationNum, 'isNavigation:', isNavigation);
    console.time(`⏱️ Total fetchCarringtonData (CR${rotationNum})`);
    
    if (rotationNum < 2096 || rotationNum > 2285) {
      setFetchError('Carrington rotation number must be between 2096 and 2285');
      console.timeEnd(`⏱️ Total fetchCarringtonData (CR${rotationNum})`);
      return;
    }

    setFetchError('');
    
    if (isNavigation) {
      setIsNavigating(true);
      console.log('🔄 [DEBUG] Set isNavigating to true');
    } else {
      setIsUploading(true);
      setUploadProgress(0);
      setFitsData(null);
      console.log('🔄 [DEBUG] Set isUploading to true, reset progress and data');
    }
    
    setFileName(`CR${rotationNum}.fits`);

    try {
      if (!isNavigation) {
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => Math.min(prev + 15, 90));
        }, 200);

        console.log('🌐 [DEBUG] Starting fetch request to:', `${API_BASE}/api/fits/carrington/${rotationNum}`);
        console.time('⏱️ Network Request (API)');
        
        const response = await fetch(
          `${API_BASE}/api/fits/carrington/${rotationNum}`
        );

        console.timeEnd('⏱️ Network Request (API)');
        console.log('✅ [DEBUG] Response received:', response.status, response.statusText);
        console.log('📦 [DEBUG] Response headers:', {
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length'),
        });

        clearInterval(progressInterval);
        setUploadProgress(100);

        if (!response.ok) {
          throw new Error(`Failed to fetch CR${rotationNum}: ${response.statusText}`);
        }

        console.time('⏱️ Blob Conversion');
        const blob = await response.blob();
        console.timeEnd('⏱️ Blob Conversion');
        console.log('💾 [DEBUG] Blob size:', (blob.size / 1024 / 1024).toFixed(2), 'MB');

        console.time('⏱️ File Object Creation');
        const file = new File([blob], `CR${rotationNum}.fits`, { type: 'application/fits' });
        console.timeEnd('⏱️ File Object Creation');

        console.log('🔄 [DEBUG] Setting isUploading to false, isProcessing to true');
        setIsUploading(false);
        setIsProcessing(true);
        
        console.time('⏱️ FITS Parsing (parseFITS)');
        const parsed = await parseFITS(file);
        console.timeEnd('⏱️ FITS Parsing (parseFITS)');
        
        if (!parsed) {
          throw new Error('Failed to parse FITS file - parseFITS returned null');
        }
        
        console.log('✨ [DEBUG] Parsed FITS data:', {
          width: parsed.width,
          height: parsed.height,
          dataLength: parsed.data?.length,
          dataType: typeof parsed.data,
        });

        console.time('⏱️ State Update (setFitsData)');
        setFitsData(parsed);
        setCurrentCRNumber(rotationNum);
        setIsProcessing(false);
        console.timeEnd('⏱️ State Update (setFitsData)');
        console.log('✅ [DEBUG] State updated successfully');
      } else {
        // For navigation, fetch and process in background
        console.log('🌐 [DEBUG] Navigation fetch to:', `${API_BASE}/api/fits/carrington/${rotationNum}`);
        console.time('⏱️ Navigation Network Request');
        
        const response = await fetch(
          `${API_BASE}/api/fits/carrington/${rotationNum}`
        );

        console.timeEnd('⏱️ Navigation Network Request');
        console.log('✅ [DEBUG] Navigation response:', response.status);

        if (!response.ok) {
          throw new Error(`Failed to fetch CR${rotationNum}: ${response.statusText}`);
        }

        console.time('⏱️ Navigation Blob Conversion');
        const blob = await response.blob();
        console.timeEnd('⏱️ Navigation Blob Conversion');
        console.log('💾 [DEBUG] Navigation blob size:', (blob.size / 1024 / 1024).toFixed(2), 'MB');

        const file = new File([blob], `CR${rotationNum}.fits`, { type: 'application/fits' });
        
        console.time('⏱️ Navigation FITS Parsing');
        const parsed = await parseFITS(file);
        console.timeEnd('⏱️ Navigation FITS Parsing');
        
        if (!parsed) {
          throw new Error('Failed to parse FITS file during navigation');
        }
        
        setFitsData(parsed);
        setCurrentCRNumber(rotationNum);
        setIsNavigating(false);
        console.log('✅ [DEBUG] Navigation complete');
      }

      console.timeEnd(`⏱️ Total fetchCarringtonData (CR${rotationNum})`);
      console.log('🎉 [DEBUG] fetchCarringtonData completed successfully');
      
    } catch (error) {
      console.error('❌ [DEBUG] Error in fetchCarringtonData:', error);
      console.timeEnd(`⏱️ Total fetchCarringtonData (CR${rotationNum})`);
      setIsUploading(false);
      setIsNavigating(false);
      setFetchError(error instanceof Error ? error.message : 'Failed to fetch FITS file');
      setUploadProgress(0);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('📁 [DEBUG] File select triggered');
    const file = e.target.files?.[0];
    if (!file) return;
    
    console.log('📁 [DEBUG] File selected:', file.name, 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    
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
        console.log('🔧 [DEBUG] Processing FITS file');
        setIsProcessing(true);
        console.time('⏱️ File Upload FITS Parsing');
        const parsed = await parseFITS(file);
        console.timeEnd('⏱️ File Upload FITS Parsing');
        
        if (!parsed) {
          console.error('❌ [DEBUG] parseFITS returned null');
          setIsProcessing(false);
          return;
        }
        
        setFitsData(parsed);
        setIsProcessing(false);
        console.log('✅ [DEBUG] File processing complete');
      }
    }, 1200);
  };

  const handleCarringtonFetch = async () => {
    console.log('🎯 [DEBUG] handleCarringtonFetch called');
    const rotationNum = parseInt(carringtonNumber);
    if (!rotationNum) {
      setFetchError('Please enter a valid Carrington rotation number');
      return;
    }
    await fetchCarringtonData(rotationNum, false);
  };

  const handleNavigate = async (direction: 'next' | 'prev') => {
    console.log('🧭 [DEBUG] Navigation requested:', direction);
    if (currentCRNumber === undefined) return;
    
    const newCRNumber = direction === 'next' 
      ? currentCRNumber + 1 
      : currentCRNumber - 1;
    
    console.log('🧭 [DEBUG] Navigating from CR', currentCRNumber, 'to CR', newCRNumber);
    await fetchCarringtonData(newCRNumber, true);
  };

  const handleButtonClick = () => {
    console.log('🖱️ [DEBUG] Upload button clicked');
    fileInputRef.current?.click();
  };

  const handleReset = () => {
    console.log('🔄 [DEBUG] Reset triggered');
    setUploadProgress(0);
    setIsUploading(false);
    setFileName('');
    setFitsData(null);
    setCarringtonNumber('');
    setCurrentCRNumber(undefined);
    setFetchError('');
    setIsNavigating(false);
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
          isNavigating={isNavigating}
        />
      )}
    </div>
  );
}