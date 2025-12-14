import { useState } from 'react';
import GlobeViewer from './GlobeViewer';
import DetailsPanel from './DetailsPanel';
import type { FITSData } from './fits/types';

interface ViewerViewProps {
  fitsData: FITSData;
  fileName: string;
  onReset: () => void;
  currentCarringtonNumber?: number;
  onNavigate?: (direction: 'next' | 'prev') => void;
  isNavigating?: boolean;
}

export default function ViewerView({ 
  fitsData, 
  fileName, 
  onReset, 
  currentCarringtonNumber,
  onNavigate,
  isNavigating = false
}: ViewerViewProps) {
  const [showDetails, setShowDetails] = useState(true);
  const [show2DMap, setShow2DMap] = useState(false);
  const [isRotating, setIsRotating] = useState(true);

  const handleNavigate = (direction: 'next' | 'prev') => {
    // Don't pause rotation - let GlobeViewer handle it during transition
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
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-white text-xs font-light hover:text-gray-300 transition-colors bg-black/70 backdrop-blur px-3 py-2.5 rounded"
            >
              {showDetails ? 'Hide' : 'Show'} Details
            </button>
            <button
              onClick={onReset}
              className="text-white text-xs font-light hover:text-gray-300 transition-colors bg-black/70 backdrop-blur px-3 py-2.5 rounded"
            >
              View Another
            </button>
          </div>
        </div>
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
  );
}