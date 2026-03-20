import { useState, useEffect } from 'react';
import GlobeViewer from './GlobeViewer';
import DisplaySettingsPanel from './components/DisplaySettingsPanel';
import type { FITSData } from './fits/types';
import type { CoronalData } from './hooks/useCoronalFieldLines';

const CR_GAPS = [{ start: 2119, end: 2127 }];

const getNextValidCR = (current: number, direction: 'next' | 'prev'): number => {
  let next = direction === 'next' ? current + 1 : current - 1;
  for (const gap of CR_GAPS) {
    if (next >= gap.start && next <= gap.end) {
      next = direction === 'next' ? gap.end + 1 : gap.start - 1;
    }
  }
  return next;
};

interface ViewerViewProps {
  fitsData: FITSData;
  dataSource: string;
  onReset: () => void;
  currentCarringtonNumber?: number;
  onNavigate?: (direction: 'next' | 'prev', targetCR?: number) => void;
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
  onPlayingChange?: (playing: boolean) => void;
}

export default function ViewerView({
  fitsData, dataSource, onReset, currentCarringtonNumber,
  onNavigate, isNavigating = false,
  coronalData, isLoadingCoronal, coronalError,
  showCoronalLines, showOpenLines, showClosedLines, showSourceSurface,
  onToggleCoronalLines, onFetchCoronalData,
  setShowOpenLines, setShowClosedLines, setShowSourceSurface,
  onPlayingChange,
}: ViewerViewProps) {
  const [show2DMap,           setShow2DMap]           = useState(false);
  const [isRotating,          setIsRotating]          = useState(false);
  const [showGeographicPoles, setShowGeographicPoles] = useState(true);
  const [showGraticule,       setShowGraticule]       = useState(false);
  const [useFixedScale,       setUseFixedScale]       = useState(false);
  const [fixedMin,            setFixedMin]            = useState('-500');
  const [fixedMax,            setFixedMax]            = useState('500');
  const [fieldLineMaxStrength,setFieldLineMaxStrength]= useState(500);
  const [showPolarity,        setShowPolarity]        = useState(false);
  const [apexMinR,            setApexMinR]            = useState(1.0);
  const [apexMaxR,            setApexMaxR]            = useState(2.5);
  const [showFootpoints,      setShowFootpoints]      = useState(false);
  const [visibleLight,        setVisibleLight]        = useState(false);
  const [isPlaying,          setIsPlaying]          = useState(false);

  // Notify parent when play state changes so it can use replaceState vs pushState
  useEffect(() => {
    onPlayingChange?.(isPlaying);
  }, [isPlaying]);

  const handleNavigate = (direction: 'next' | 'prev') => {
    if (onNavigate && currentCarringtonNumber !== undefined) {
      onNavigate(direction, getNextValidCR(currentCarringtonNumber, direction));
    }
  };

  // Play/pause animation — advances one CR every 5s, waits for load to finish
  useEffect(() => {
    if (!isPlaying) return;
    // Stop at the end of the dataset
    if (currentCarringtonNumber !== undefined && currentCarringtonNumber >= 2285) {
      setIsPlaying(false);
      return;
    }
    const interval = setInterval(() => {
      // Only advance if previous CR has finished loading
      if (!isNavigating && currentCarringtonNumber !== undefined && currentCarringtonNumber < 2285) {
        handleNavigate('next');
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isPlaying, isNavigating, currentCarringtonNumber]);

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
        showGeographicPoles={showGeographicPoles}
        fieldLineMaxStrength={fieldLineMaxStrength}
        showPolarity={showPolarity}
        showGraticule={showGraticule}
        apexMinR={apexMinR}
        apexMaxR={apexMaxR}
        showFootpoints={showFootpoints}
        visibleLight={visibleLight}
      />

      <DisplaySettingsPanel
        show2DMap={show2DMap}                setShow2DMap={setShow2DMap}
        isRotating={isRotating}              setIsRotating={setIsRotating}
        showGeographicPoles={showGeographicPoles} setShowGeographicPoles={setShowGeographicPoles}
        showGraticule={showGraticule}        setShowGraticule={setShowGraticule}
        useFixedScale={useFixedScale}        setUseFixedScale={setUseFixedScale}
        fixedMin={fixedMin}                  setFixedMin={setFixedMin}
        fixedMax={fixedMax}                  setFixedMax={setFixedMax}
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
        fieldLineMaxStrength={fieldLineMaxStrength} setFieldLineMaxStrength={setFieldLineMaxStrength}
        showPolarity={showPolarity}          setShowPolarity={setShowPolarity}
        apexMinR={apexMinR}                  setApexMinR={setApexMinR}
        apexMaxR={apexMaxR}                  setApexMaxR={setApexMaxR}
        showFootpoints={showFootpoints}      setShowFootpoints={setShowFootpoints}
        visibleLight={visibleLight}         setVisibleLight={setVisibleLight}
        dataSource={dataSource}
      />

      {/* Desktop navigation + reset — bottom left, hidden on mobile */}
      <div
        className="absolute left-6 bottom-8 z-20 pointer-events-auto hidden md:block"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-2">
          {showNavigation && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleNavigate('prev')}
                disabled={isNavigating || currentCarringtonNumber! <= 2096}
                className="text-white text-xs font-light bg-black/70 backdrop-blur px-3 py-2.5 rounded hover:bg-black/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isNavigating ? '…' : '← Prev CR'}
              </button>
              <button
                onClick={() => handleNavigate('next')}
                disabled={isNavigating || currentCarringtonNumber! >= 2285}
                className="text-white text-xs font-light bg-black/70 backdrop-blur px-3 py-2.5 rounded hover:bg-black/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isNavigating ? '…' : 'Next CR →'}
              </button>
            </div>
          )}
          {showNavigation && (
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`w-full text-xs font-light backdrop-blur px-3 py-2.5 rounded transition-colors ${
                isPlaying
                  ? 'bg-orange-600/80 hover:bg-orange-700/80 text-white'
                  : 'bg-black/70 hover:bg-black/90 text-white'
              }`}
            >
              {isPlaying ? '⏸ Pause animation' : '▶ Play solar cycle'}
            </button>
          )}
          <button
            onClick={onReset}
            className="text-white text-xs font-light bg-black/70 backdrop-blur px-3 py-2.5 rounded hover:bg-black/90 transition-colors"
          >
            View another
          </button>
        </div>
      </div>

      {/* Mobile navigation — edge arrows, hidden on desktop */}
      {showNavigation && (
        <>
          <button
            onClick={() => handleNavigate('prev')}
            disabled={isNavigating || currentCarringtonNumber! <= 2096}
            onTouchStart={(e) => e.stopPropagation()}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 pointer-events-auto md:hidden
              flex items-center justify-center w-8 h-16
              text-white/50 hover:text-white/90 transition-colors
              disabled:opacity-20 disabled:cursor-not-allowed"
            style={{ paddingLeft: 4 }}
            aria-label="Previous CR"
          >
            <svg width="12" height="24" viewBox="0 0 12 24" fill="none">
              <path d="M10 2L2 12L10 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <button
            onClick={() => handleNavigate('next')}
            disabled={isNavigating || currentCarringtonNumber! >= 2285}
            onTouchStart={(e) => e.stopPropagation()}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 pointer-events-auto md:hidden
              flex items-center justify-center w-8 h-16
              text-white/50 hover:text-white/90 transition-colors
              disabled:opacity-20 disabled:cursor-not-allowed"
            style={{ paddingRight: 4 }}
            aria-label="Next CR"
          >
            <svg width="12" height="24" viewBox="0 0 12 24" fill="none">
              <path d="M2 2L10 12L2 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </>
      )}

      {/* Mobile play/pause — centred, above timeline, hidden on desktop */}
      {showNavigation && (
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          onTouchStart={(e) => e.stopPropagation()}
          className={`absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto md:hidden
            text-[10px] font-light px-3 py-1.5 rounded-full backdrop-blur border transition-colors ${
            isPlaying
              ? 'bg-orange-600/80 border-orange-500/50 text-white'
              : 'bg-black/70 border-gray-700 text-white/70'
          }`}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
      )}

      {/* Solar cycle timeline — desktop only, centered bottom */}
      {currentCarringtonNumber !== undefined && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none hidden md:block" style={{ width: 280 }}>
          <div className="text-gray-600 text-xs font-light text-center mb-1">
            {(() => {
              const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              const ms = (currentCarringtonNumber - 2097) * 27.3 * 24 * 3600 * 1000;
              const d  = new Date(Date.UTC(2010, 4, 19) + ms);
              return `CR ${currentCarringtonNumber} · ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} · Solar Cycle 24`;
            })()}
          </div>
          <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(to right, #1a1a2e, #e85d04, #1a1a2e)', opacity: 0.6 }} />
            <div className="absolute top-0 h-full w-0.5 bg-white" style={{ left: ((currentCarringtonNumber - 2096) / (2285 - 2096) * 100) + '%' }} />
          </div>
          <div className="flex justify-between text-gray-600 text-xs font-light mt-0.5">
            <span>CR 2096 · Apr 2010</span>
            <span>CR 2285 · Jun 2024</span>
          </div>
        </div>
      )}

      {/* Field line colour legend — desktop only, bottom right */}
      {showCoronalLines && coronalData && (
        <div className="absolute bottom-6 right-6 text-gray-500 text-xs font-light z-20 pointer-events-none hidden md:block">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-0.5" style={{ background: 'linear-gradient(to right, #006600, #80ff00)' }} />
            <span>Open (weak → strong)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5" style={{ background: 'linear-gradient(to right, #800000, #ff9900)' }} />
            <span>Closed (weak → strong)</span>
          </div>
        </div>
      )}
    </>
  );
}