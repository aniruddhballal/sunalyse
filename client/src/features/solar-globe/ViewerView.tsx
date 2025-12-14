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

  const showNavigation = currentCarringtonNumber !== undefined && onNavigate;

  return (
    <>
      <GlobeViewer
        fitsData={fitsData}
        show2DMap={show2DMap}
        isRotating={isRotating}
      />

      <div 
        className="absolute left-6 space-y-2 z-20 pointer-events-auto"
        style={{ bottom: '10vh' }}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {showNavigation && (
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => onNavigate('prev')}
              disabled={isNavigating || currentCarringtonNumber <= 2096}
              className="flex-1 text-white text-xs font-light hover:text-gray-300 transition-colors bg-black/50 px-3 py-2 rounded backdrop-blur disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isNavigating ? '...' : '← Prev CR'}
            </button>
            <button
              onClick={() => onNavigate('next')}
              disabled={isNavigating || currentCarringtonNumber >= 2285}
              className="flex-1 text-white text-xs font-light hover:text-gray-300 transition-colors bg-black/50 px-3 py-2 rounded backdrop-blur disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isNavigating ? '...' : 'Next CR →'}
            </button>
          </div>
        )}
        <button
          onClick={() => setShow2DMap(!show2DMap)}
          className="block w-full text-white text-xs font-light hover:text-gray-300 transition-colors bg-black/50 px-3 py-2 rounded backdrop-blur"
        >
          {show2DMap ? 'Show 3D Globe' : 'Show 2D Map'}
        </button>
        <button
          onClick={() => setIsRotating(!isRotating)}
          className="block w-full text-white text-xs font-light hover:text-gray-300 transition-colors bg-black/50 px-3 py-2 rounded backdrop-blur"
        >
          {isRotating ? 'Pause Rotation' : 'Resume Rotation'}
        </button>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="block w-full text-white text-xs font-light hover:text-gray-300 transition-colors bg-black/50 px-3 py-2 rounded backdrop-blur"
        >
          {showDetails ? 'Hide' : 'Show'} Details
        </button>
        <button
          onClick={onReset}
          className="block w-full text-white text-xs font-light hover:text-gray-300 transition-colors bg-black/50 px-3 py-2 rounded backdrop-blur"
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
  );
}