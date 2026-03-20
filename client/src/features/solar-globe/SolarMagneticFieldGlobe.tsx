import { useRef, useEffect } from 'react';
import InputView from './InputView';
import ViewerView from './ViewerView';
import { useFitsData } from './hooks/data/useFitsData';
import { useCarringtonData } from './hooks/data/useCarringtonData';
import { useCoronalFieldLines } from './hooks/data/useCoronalFieldLines';
import { parseFITS } from './fits/fitsUtils';
import { api } from '../../services/api';
import type { FITSData } from './fits/types';
import type { CoronalData } from './hooks/data/useCoronalFieldLines';

// ── Prefetch cache — holds the next PREFETCH_AHEAD CRs ───────────────────
const PREFETCH_AHEAD = 6;

interface PrefetchEntry {
  crNumber: number;
  fitsData: FITSData | null;
  coronalData: CoronalData | null;
  fitsReady: boolean;
  coronalReady: boolean;
}

export default function SolarMagneticFieldGlobe() {
  const shouldAutoFetchCoronalRef = useRef(false);
  const pendingCoronalFetchRef = useRef<number | null>(null);
  // Map keyed by CR number — holds up to PREFETCH_AHEAD entries
  const prefetchMapRef = useRef<Map<number, PrefetchEntry>>(new Map());
  const prefetchingSetRef = useRef<Set<number>>(new Set()); // prevent duplicate fetches
  const isAnimatingRef = useRef(false); // replaceState vs pushState

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
    setCurrentCRNumber,
    fetchError,
    isNavigating,
    fetchCarringtonData,
    reset: resetCarrington,
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

  // ── Prefetch next PREFETCH_AHEAD CRs silently whenever current CR settles ─
  useEffect(() => {
    if (!currentCRNumber || isNavigating || isLoadingCoronal) return;

    for (let offset = 1; offset <= PREFETCH_AHEAD; offset++) {
      const targetCR = currentCRNumber + offset;
      if (targetCR > 2285) break;
      if (prefetchMapRef.current.has(targetCR)) continue;
      if (prefetchingSetRef.current.has(targetCR)) continue;

      prefetchingSetRef.current.add(targetCR);
      const entry: PrefetchEntry = {
        crNumber: targetCR,
        fitsData: null,
        coronalData: null,
        fitsReady: false,
        coronalReady: !coronalData,
      };
      prefetchMapRef.current.set(targetCR, entry);

      // Prefetch FITS
      (async () => {
        const t0 = performance.now();
        console.log(`[prefetch] CR ${targetCR} FITS started`);
        try {
          const blob = await api.fetchCarringtonFits(targetCR);
          const file = new File([blob], `CR${targetCR}.fits`, { type: 'application/fits' });
          const parsed = await parseFITS(file);
          const e = prefetchMapRef.current.get(targetCR);
          if (e) { e.fitsData = parsed; e.fitsReady = true; }
          console.log(`[prefetch] CR ${targetCR} FITS ready in ${(performance.now() - t0).toFixed(0)}ms`);
        } catch {
          const e = prefetchMapRef.current.get(targetCR);
          if (e) { e.fitsReady = true; e.fitsData = null; }
          console.warn(`[prefetch] CR ${targetCR} FITS failed after ${(performance.now() - t0).toFixed(0)}ms`);
        }
      })();

      // Prefetch coronal (only if coronal is currently loaded)
      if (coronalData) {
        (async () => {
          try {
            const data = await api.fetchCoronalData(targetCR);
            const e = prefetchMapRef.current.get(targetCR);
            if (e) { e.coronalData = data; e.coronalReady = true; }
          } catch {
            const e = prefetchMapRef.current.get(targetCR);
            if (e) { e.coronalReady = true; e.coronalData = null; }
          }
        })();
      }
    }

    // Evict entries that are too far behind to be useful (> PREFETCH_AHEAD behind current)
    for (const cr of prefetchMapRef.current.keys()) {
      if (cr < currentCRNumber - 1) {
        prefetchMapRef.current.delete(cr);
        prefetchingSetRef.current.delete(cr);
      }
    }
  }, [currentCRNumber, isNavigating, isLoadingCoronal]);

  // Auto-fetch coronal data when CR changes if coronal lines were visible
  useEffect(() => {
    if (currentCRNumber && shouldAutoFetchCoronalRef.current && !isNavigating && !isLoadingCoronal) {
      fetchCoronalData(currentCRNumber);
      shouldAutoFetchCoronalRef.current = false;
    }
  }, [currentCRNumber, isNavigating, isLoadingCoronal]);

  // ── Sync CR number to URL ────────────────────────────────────────────────
  useEffect(() => {
    if (currentCRNumber === undefined) return;
    // During animation use replaceState so history doesn't bloat
    // During manual navigation use pushState so back button works
    if (isAnimatingRef.current) {
      window.history.replaceState(null, '', `/cr/${currentCRNumber}`);
    } else {
      window.history.pushState(null, '', `/cr/${currentCRNumber}`);
    }
  }, [currentCRNumber]);

  // ── Read CR from URL on initial mount ────────────────────────────────────
  useEffect(() => {
    const match = window.location.pathname.match(/\/cr\/(\d+)/);
    if (!match) return;
    const crFromUrl = parseInt(match[1]);
    if (crFromUrl >= 2096 && crFromUrl <= 2285) {
      // Auto-load the CR from the URL
      setCarringtonNumber(String(crFromUrl));
      fetchCarringtonData(
        crFromUrl,
        false,
        setDataSource,
        setFitsData,
        setIsFetching,
        setIsProcessing
      );
    }
  }, []); // runs once on mount

  const handleCarringtonFetch = async () => {
    const rotationNum = parseInt(carringtonNumber);
    if (!rotationNum) return;
    clearCoronalData();
    shouldAutoFetchCoronalRef.current = false;
    pendingCoronalFetchRef.current = null;
    prefetchMapRef.current.clear();
    prefetchingSetRef.current.clear();
    await fetchCarringtonData(
      rotationNum,
      false,
      setDataSource,
      setFitsData,
      setIsFetching,
      setIsProcessing
    );
  };

  const handleNavigate = async (direction: 'next' | 'prev', targetCR?: number) => {
    if (currentCRNumber === undefined) return;

    const newCRNumber = targetCR ?? (direction === 'next'
      ? currentCRNumber + 1
      : currentCRNumber - 1);

    const prefetch = prefetchMapRef.current.get(newCRNumber);
    const prefetchHit = direction === 'next'
      && !!prefetch
      && prefetch.fitsReady
      && prefetch.coronalReady
      && prefetch.fitsData !== null;

    if (prefetchHit && prefetch) {
      // ── Fast path: data already in memory ───────────────────────────────
      console.log(`[navigate] CR ${newCRNumber} — prefetch HIT (instant)`);
      setDataSource(`CR${newCRNumber}.fits`);
      setFitsData(prefetch.fitsData);
      setCurrentCRNumber(newCRNumber);
      if (coronalData && prefetch.coronalData) {
        fetchCoronalData(newCRNumber);
      }
      // Remove consumed entry; the prefetch effect will queue the next one
      prefetchMapRef.current.delete(newCRNumber);
      prefetchingSetRef.current.delete(newCRNumber);
    } else {
      // ── Normal path: fetch live ──────────────────────────────────────────
      console.log(`[navigate] CR ${newCRNumber} — prefetch MISS (live fetch)`);
      if (coronalData !== null) {
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
    }
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
    prefetchMapRef.current.clear();
    prefetchingSetRef.current.clear();
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden" style={{ minHeight: '100dvh' }}>
      {!fitsData ? (
        <InputView
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
          dataSource={dataSource}
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
          onPlayingChange={(playing) => { isAnimatingRef.current = playing; }}
        />
      )}
    </div>
  );
}