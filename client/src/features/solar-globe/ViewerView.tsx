import { useState } from 'react';
import GlobeViewer from './GlobeViewer';
import DisplaySettingsPanel from './components/DisplaySettingsPanel';
import type { FITSData } from './fits/types';
import type { CoronalData } from './hooks/useCoronalFieldLines';

interface ViewerViewProps {
  fitsData: FITSData;
  dataSource: string;
  onReset: () => void;
  currentCarringtonNumber?: number;
  onNavigate?: (direction: 'next' | 'prev') => void;
  isNavigating?: boolean;
  coronalData: CoronalData | null;
  isLoadingCoronal: boolean;
  coronalError: string;
  showCoronalLines: boolean;
  showOpenLines: boolean;
  showClosedLines: boolean;
  showSourceSurface: boolean;
  onToggleCoronalLines: () => void;
  onFetchCoronalData: (crNumber: number) => void;
  setShowOpenLines: (show: boolean) => void;
  setShowClosedLines: (show: boolean) => void;
  setShowSourceSurface: (show: boolean) => void;
}

export default function ViewerView({ 
  fitsData, 
  dataSource, 
  onReset, 
  currentCarringtonNumber,
  onNavigate,
  isNavigating = false,
  coronalData,
  isLoadingCoronal,
  coronalError,
  showCoronalLines,
  showOpenLines,
  showClosedLines,
  showSourceSurface,
  onToggleCoronalLines,
  onFetchCoronalData,
  setShowOpenLines,
  setShowClosedLines,
  setShowSourceSurface
}: ViewerViewProps) {
  const [show2DMap, setShow2DMap] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [useFixedScale, setUseFixedScale] = useState(false);
  const [fixedMin, setFixedMin] = useState('-500');
  const [fixedMax, setFixedMax] = useState('500');

  const handleNavigate = (direction: 'next' | 'prev') => {
    if (onNavigate) {
      onNavigate(direction);
    }
  };

  const showNavigation = currentCarringtonNumber !== undefined && onNavigate;

  return (
    <>
      <GlobeViewer
        fitsData={fitsData}
        show2DMap={show2DMap}
        isRotating={isRotating}
        coronalData={coronalData}
        showCoronalLines={showCoronalLines}
        showOpenLines={showOpenLines}
        showClosedLines={showClosedLines}
        showSourceSurface={showSourceSurface}
        useFixedScale={useFixedScale}
        fixedMin={parseFloat(fixedMin)}
        fixedMax={parseFloat(fixedMax)}
      />

      {/* Unified Display Settings Panel */}
      <DisplaySettingsPanel
        useFixedScale={useFixedScale}
        setUseFixedScale={setUseFixedScale}
        fixedMin={fixedMin}
        setFixedMin={setFixedMin}
        fixedMax={fixedMax}
        setFixedMax={setFixedMax}
        fitsData={fitsData}
        coronalData={coronalData}
        isLoadingCoronal={isLoadingCoronal}
        coronalError={coronalError}
        showCoronalLines={showCoronalLines}
        showOpenLines={showOpenLines}
        showClosedLines={showClosedLines}
        showSourceSurface={showSourceSurface}
        onToggleCoronalLines={onToggleCoronalLines}
        onFetchCoronalData={onFetchCoronalData}
        setShowOpenLines={setShowOpenLines}
        setShowClosedLines={setShowClosedLines}
        setShowSourceSurface={setShowSourceSurface}
        currentCarringtonNumber={currentCarringtonNumber}
        dataSource={dataSource}
      />

      <div 
        className="absolute left-0 right-0 bottom-16 z-20 pointer-events-auto px-4 md:left-6 md:right-auto md:bottom-[10vh] md:px-0"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-2 max-w-md mx-auto md:max-w-none md:mx-0">
          {showNavigation && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleNavigate('prev')}
                disabled={isNavigating || currentCarringtonNumber <= 2096}
                className="text-white text-xs font-light hover:text-gray-300 transition-colors bg-black/70 backdrop-blur px-3 py-2.5 rounded disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isNavigating ? '...' : '← Prev CR'}
              </button>
              <button
                onClick={() => handleNavigate('next')}
                disabled={isNavigating || currentCarringtonNumber >= 2285}
                className="text-white text-xs font-light hover:text-gray-300 transition-colors bg-black/70 backdrop-blur px-3 py-2.5 rounded disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isNavigating ? '...' : 'Next CR →'}
              </button>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShow2DMap(!show2DMap)}
              className="text-white text-xs font-light hover:text-gray-300 transition-colors bg-black/70 backdrop-blur px-3 py-2.5 rounded"
            >
              {show2DMap ? '3D Globe' : '2D Map'}
            </button>
            <button
              onClick={() => setIsRotating(!isRotating)}
              className="text-white text-xs font-light hover:text-gray-300 transition-colors bg-black/70 backdrop-blur px-3 py-2.5 rounded"
            >
              {isRotating ? 'Pause' : 'Resume'}
            </button>
          </div>
          
          <button
            onClick={onReset}
            className="text-white text-xs font-light hover:text-gray-300 transition-colors bg-black/70 backdrop-blur px-3 py-2.5 rounded"
          >
            View Another
          </button>
        </div>
      </div>

      <div className="absolute bottom-6 right-6 text-gray-500 text-xs font-light z-20 pointer-events-none">
        {showCoronalLines && coronalData && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-green-500"></div>
              <span>Open</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-red-500"></div>
              <span>Closed</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}