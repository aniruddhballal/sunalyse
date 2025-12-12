import { useState, useRef } from 'react';
import GlobeViewer from './GlobeViewer';
import DetailsPanel from './DetailsPanel';
import UploadSection from './UploadSection';
import { parseFITS } from './fitsUtils';
import type {FITSData } from './fitsUtils';

export default function SolarMagneticFieldGlobe() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fitsData, setFitsData] = useState<FITSData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [show2DMap, setShow2DMap] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
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
      />

      {fitsData && (
        <>
          <GlobeViewer
            fitsData={fitsData}
            show2DMap={show2DMap}
            onToggle2DMap={setShow2DMap}
          />

          <div className="absolute top-6 left-6 space-y-2">
            <h1 className="text-xl font-light text-white tracking-wide">
              Solar Magnetic Field
            </h1>
            <div className="text-gray-400 text-xs font-light">{fileName}</div>
          </div>

          <div className="absolute bottom-6 left-6 space-y-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-white text-xs font-light hover:text-gray-300 transition-colors"
            >
              {showDetails ? 'Hide' : 'Show'} Details
            </button>
            <button
              onClick={handleReset}
              className="block text-white text-xs font-light hover:text-gray-300 transition-colors"
            >
              Upload New
            </button>
          </div>

          <div className="absolute bottom-6 right-6 text-gray-500 text-xs font-light">
            {show2DMap ? 'Viewing 2D Map' : 'Drag to rotate'}
          </div>

          {showDetails && (
            <DetailsPanel
              fitsData={fitsData}
              onClose={() => setShowDetails(false)}
              onOpen2DMap={() => setShow2DMap(true)}
            />
          )}
        </>
      )}
    </div>
  );
}