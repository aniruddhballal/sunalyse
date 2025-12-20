import { useRef, useEffect } from 'react';
import UploadView from './UploadView';
import ViewerView from './ViewerView';
import { useFitsData } from './hooks/useFitsData';
import { useCarringtonData } from './hooks/useCarringtonData';
import { useCoronalFieldLines } from './hooks/useCoronalFieldLines';

export default function SolarMagneticFieldGlobe() {
  const shouldAutoFetchCoronalRef = useRef(false);
  const pendingCoronalFetchRef = useRef<number | null>(null);
  
  const {
    isFetching,
    dataSource,
    fitsData,
    isProcessing,
    reset: resetFitsData,
    setDataSource,
    setFitsData,
    setIsProcessing,
    setIsFetching
  } = useFitsData();
  
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
      setDataSource,
      setFitsData,
      setIsFetching,
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
      setDataSource,
      setFitsData,
      setIsFetching,
      setIsProcessing
    );
  };

  const handleFetchCoronalData = (crNumber: number) => {
    fetchCoronalData(crNumber);
  };
  
  const handleReset = () => {
    resetFitsData();
    resetCarrington();
    clearCoronalData();
    shouldAutoFetchCoronalRef.current = false;
    pendingCoronalFetchRef.current = null;
  };
  
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden" style={{ minHeight: '100dvh' }}>
      {!fitsData ? (
        <UploadView
          isFetching={isFetching}
          isProcessing={isProcessing}
          dataSource={dataSource}
          carringtonNumber={carringtonNumber}
          onCarringtonChange={setCarringtonNumber}
          onCarringtonFetch={handleCarringtonFetch}
          fetchError={fetchError}
        />
      ) : (
        <ViewerView
          fitsData={fitsData}
          fileName={dataSource}
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