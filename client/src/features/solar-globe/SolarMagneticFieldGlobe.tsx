import { useRef, useEffect } from 'react';
import UploadView from './UploadView';
import ViewerView from './ViewerView';
import { useFileUpload } from './hooks/useFileUpload';
import { useCarringtonData } from './hooks/useCarringtonData';
import { useCoronalFieldLines } from './hooks/useCoronalFieldLines';

export default function SolarMagneticFieldGlobe() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shouldAutoFetchCoronalRef = useRef(false);
  const pendingCoronalFetchRef = useRef<number | null>(null);
  
  const {
    uploadProgress,
    isUploading,
    fileName,
    fitsData,
    isProcessing,
    handleFileSelect,
    reset: resetFileUpload,
    setFileName,
    setFitsData,
    setIsProcessing,
    setIsUploading,
    setUploadProgress
  } = useFileUpload();
  
  const {
    carringtonNumber,
    setCarringtonNumber,
    currentCRNumber,
    fetchError,
    isNavigating,
    fetchCarringtonData,
    reset: resetCarrington
  } = useCarringtonData();

  const {
    coronalData,
    isLoadingCoronal,
    coronalError,
    showCoronalLines,
    showOpenLines,
    showClosedLines,
    showSourceSurface,
    setShowOpenLines,
    setShowClosedLines,
    setShowSourceSurface,
    fetchCoronalData,
    clearCoronalData,
    toggleCoronalLines,
  } = useCoronalFieldLines();
  
  // Auto-fetch coronal data when CR changes if coronal lines were visible
  useEffect(() => {
    if (currentCRNumber && shouldAutoFetchCoronalRef.current && !isNavigating && !isLoadingCoronal) {
      fetchCoronalData(currentCRNumber);
      shouldAutoFetchCoronalRef.current = false;
    }
  }, [currentCRNumber, isNavigating, isLoadingCoronal]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      resetCarrington();
      clearCoronalData();
      shouldAutoFetchCoronalRef.current = false;
      pendingCoronalFetchRef.current = null;
      handleFileSelect(file);
    }
  };
  
  const handleCarringtonFetch = async () => {
    const rotationNum = parseInt(carringtonNumber);
    if (!rotationNum) {
      return;
    }
    clearCoronalData();
    shouldAutoFetchCoronalRef.current = false;
    pendingCoronalFetchRef.current = null;
    await fetchCarringtonData(
      rotationNum,
      false,
      setFileName,
      setFitsData,
      setIsUploading,
      setUploadProgress,
      setIsProcessing
    );
  };
  
  const handleNavigate = async (direction: 'next' | 'prev') => {
    if (currentCRNumber === undefined) return;
    
    const newCRNumber = direction === 'next' 
      ? currentCRNumber + 1 
      : currentCRNumber - 1;
    
    // If coronal data is currently loaded, fetch it simultaneously with FITS data
    if (coronalData !== null) {
      // Start fetching coronal data immediately
      fetchCoronalData(newCRNumber);
      shouldAutoFetchCoronalRef.current = false;
    }
    
    await fetchCarringtonData(
      newCRNumber,
      true,
      setFileName,
      setFitsData,
      setIsUploading,
      setUploadProgress,
      setIsProcessing
    );
  };

  const handleFetchCoronalData = (crNumber: number) => {
    fetchCoronalData(crNumber);
  };
  
  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleReset = () => {
    resetFileUpload();
    resetCarrington();
    clearCoronalData();
    shouldAutoFetchCoronalRef.current = false;
    pendingCoronalFetchRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden" style={{ minHeight: '100dvh' }}>
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
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
          coronalData={coronalData}
          isLoadingCoronal={isLoadingCoronal}
          coronalError={coronalError}
          showCoronalLines={showCoronalLines}
          showOpenLines={showOpenLines}
          showClosedLines={showClosedLines}
          showSourceSurface={showSourceSurface}
          onToggleCoronalLines={toggleCoronalLines}
          onFetchCoronalData={handleFetchCoronalData}
          setShowOpenLines={setShowOpenLines}
          setShowClosedLines={setShowClosedLines}
          setShowSourceSurface={setShowSourceSurface}
        />
      )}
    </div>
  );
}