import { useState } from 'react';
import GlobeViewer from './GlobeViewer';
import DetailsPanel from './DetailsPanel';
import type { FITSData } from './fits/types';
import type { CoronalData } from './hooks/useCoronalFieldLines';

interface ViewerViewProps {
  fitsData: FITSData;
  fileName: string;
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
  fileName, 
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
  const [showDetails, setShowDetails] = useState(false);
  const [show2DMap, setShow2DMap] = useState(false);
  const [isRotating, setIsRotating] = useState(true);
  const [showCoronalControls, setShowCoronalControls] = useState(false);

  const handleNavigate = (direction: 'next' | 'prev') => {
    if (onNavigate) {
      onNavigate(direction);
    }
  };

  const handleCoronalToggle = () => {
    if (!coronalData && !isLoadingCoronal && currentCarringtonNumber) {
      // Fetch coronal data if not already loaded
      onFetchCoronalData(currentCarringtonNumber);
    } else {
      // Just toggle visibility
      onToggleCoronalLines();
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

          {/* Coronal Field Lines Toggle */}
          <button
            onClick={handleCoronalToggle}
            disabled={isLoadingCoronal}
            className={`text-white text-xs font-light transition-colors backdrop-blur px-3 py-2.5 rounded ${
              showCoronalLines 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-black/70 hover:text-gray-300'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoadingCoronal 
              ? 'Loading Coronal...' 
              : showCoronalLines 
                ? '✓ Coronal Field Lines' 
                : 'Show Coronal Field Lines'}
          </button>

          {/* Coronal Controls - Show when coronal lines are visible */}
          {showCoronalLines && coronalData && (
            <>
              <button
                onClick={() => setShowCoronalControls(!showCoronalControls)}
                className="text-white text-xs font-light hover:text-gray-300 transition-colors bg-black/70 backdrop-blur px-3 py-2.5 rounded"
              >
                {showCoronalControls ? 'Hide' : 'Show'} Coronal Options
              </button>

              {showCoronalControls && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowOpenLines(!showOpenLines)}
                    className={`text-white text-xs font-light transition-colors backdrop-blur px-3 py-2.5 rounded ${
                      showOpenLines ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'
                    }`}
                  >
                    Open Lines
                  </button>
                  <button
                    onClick={() => setShowClosedLines(!showClosedLines)}
                    className={`text-white text-xs font-light transition-colors backdrop-blur px-3 py-2.5 rounded ${
                      showClosedLines ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
                    }`}
                  >
                    Closed Lines
                  </button>
                  <button
                    onClick={() => setShowSourceSurface(!showSourceSurface)}
                    className={`col-span-2 text-white text-xs font-light transition-colors backdrop-blur px-3 py-2.5 rounded ${
                      showSourceSurface ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'
                    }`}
                  >
                    Source Surface
                  </button>
                </div>
              )}
            </>
          )}

          {/* Error display for coronal data */}
          {coronalError && (
            <div className="text-red-400 text-xs bg-red-900/30 backdrop-blur px-3 py-2 rounded">
              {coronalError}
            </div>
          )}
          
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

      <DetailsPanel
        fitsData={fitsData}
        fileName={fileName}
        showDetails={showDetails}
        setShowDetails={setShowDetails}
      />
    </>
  );
}