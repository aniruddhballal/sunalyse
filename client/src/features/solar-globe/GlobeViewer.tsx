import { useRef, useState } from 'react';
import type { FITSData } from './fits/types';
import type { CoronalData } from './hooks/useCoronalFieldLines';
import { useThreeScene } from './hooks/useThreeScene';
import { use2DRenderer } from './hooks/use2DRenderer';
import Photosphere from './components/Photosphere';
import Corona from './components/Corona';

interface GlobeViewerProps {
  fitsData: FITSData;
  show2DMap: boolean;
  isRotating: boolean;
  coronalData: CoronalData | null;
  showCoronalLines: boolean;
  showOpenLines: boolean;
  showClosedLines: boolean;
  showSourceSurface: boolean;
  currentCarringtonNumber?: number;
  isLoadingCoronal: boolean;
  coronalError: string;
  onToggleCoronalLines: () => void;
  onFetchCoronalData: (crNumber: number) => void;
  setShowOpenLines: (show: boolean) => void;
  setShowClosedLines: (show: boolean) => void;
  setShowSourceSurface: (show: boolean) => void;
}

export default function GlobeViewer({ 
  fitsData, 
  show2DMap, 
  isRotating,
  coronalData,
  showCoronalLines,
  showOpenLines,
  showClosedLines,
  showSourceSurface,
  currentCarringtonNumber,
  isLoadingCoronal,
  coronalError,
  onToggleCoronalLines,
  onFetchCoronalData,
  setShowOpenLines,
  setShowClosedLines,
  setShowSourceSurface
}: GlobeViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvas2DRef = useRef<HTMLCanvasElement | null>(null);
  
  const [useFixedScale, setUseFixedScale] = useState(false);
  const [fixedMin, setFixedMin] = useState('-500');
  const [fixedMax, setFixedMax] = useState('500');
  
  // Use Three.js hook for 3D rendering (now with coronal field lines)
  useThreeScene(
    containerRef,
    fitsData,
    show2DMap,
    isRotating,
    useFixedScale,
    fixedMin,
    fixedMax,
    coronalData,
    showCoronalLines,
    showOpenLines,
    showClosedLines,
    showSourceSurface
  );
  
  // Use 2D renderer hook for 2D canvas rendering
  use2DRenderer(
    canvas2DRef,
    fitsData,
    show2DMap,
    useFixedScale,
    fixedMin,
    fixedMax
  );
  
  return (
    <>
      <Photosphere
        useFixedScale={useFixedScale}
        setUseFixedScale={setUseFixedScale}
        fixedMin={fixedMin}
        setFixedMin={setFixedMin}
        fixedMax={fixedMax}
        setFixedMax={setFixedMax}
        fitsData={fitsData}
      />

      <Corona
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
      />
      
      <div 
        ref={containerRef}
        className={`absolute inset-0 transition-opacity duration-300 ${show2DMap ? 'hidden' : 'block'}`}
        style={{ touchAction: 'pan-y pan-x pinch-zoom' }}
      />
      
      {show2DMap && (
        <div className="absolute inset-0 flex items-center justify-center bg-black p-8">
          <canvas 
            ref={canvas2DRef}
            style={{ 
              maxWidth: '100%',
              maxHeight: '100%',
              width: 'auto',
              height: 'auto',
              imageRendering: 'auto'
            }}
          />
        </div>
      )}
    </>
  );
}