import { useRef } from 'react';
import type { FITSData } from './fits/types';
import type { CoronalData } from './hooks/data/useCoronalFieldLines';
import { useThreeScene } from './hooks/scene/useThreeScene';
import { use2DRenderer } from './hooks/scene/use2DRenderer';

interface GlobeViewerProps {
  fitsData: FITSData;
  show2DMap: boolean;
  isRotating: boolean;
  coronalData: CoronalData | null;
  showCoronalLines: boolean;
  showOpenLines: boolean;
  showClosedLines: boolean;
  showSourceSurface: boolean;
  useFixedScale: boolean;
  fixedMin: number;
  fixedMax: number;
  showGeographicPoles: boolean;
  fieldLineMaxStrength: number;
  showPolarity: boolean;
  showGraticule: boolean;
  apexMinR: number;
  apexMaxR: number;
  showFootpoints: boolean;
  visibleLight: boolean;
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
  useFixedScale,
  fixedMin,
  fixedMax,
  showGeographicPoles,
  fieldLineMaxStrength,
  showPolarity,
  showGraticule,
  apexMinR,
  apexMaxR,
  showFootpoints,
  visibleLight
}: GlobeViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvas2DRef = useRef<HTMLCanvasElement | null>(null);

  // Use Three.js hook for 3D rendering (now with coronal field lines and geographic poles)
  useThreeScene(
    containerRef,
    fitsData,
    show2DMap,
    isRotating,
    useFixedScale,
    String(fixedMin),
    String(fixedMax),
    coronalData,
    showCoronalLines,
    showOpenLines,
    showClosedLines,
    showSourceSurface,
    showGeographicPoles,
    fieldLineMaxStrength,
    showPolarity,
    showGraticule,
    apexMinR,
    apexMaxR,
    showFootpoints,
    visibleLight
  );

  // Use 2D renderer hook for 2D canvas rendering
  use2DRenderer(
    canvas2DRef,
    fitsData,
    show2DMap,
    useFixedScale,
    String(fixedMin),
    String(fixedMax)
  );

  return (
    <>
      <div
        ref={containerRef}
        className={`absolute inset-0 transition-opacity duration-300 ${show2DMap ? 'hidden' : 'block'}`}
        style={{
          touchAction: 'none', // must be none — browser must not intercept any touch for our pointer handlers to work
          // On mobile shift the viewport up so the globe centre sits above the bottom sheet
          marginBottom: typeof window !== 'undefined' && window.innerWidth < 768 ? '10vh' : '0',
        }}
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