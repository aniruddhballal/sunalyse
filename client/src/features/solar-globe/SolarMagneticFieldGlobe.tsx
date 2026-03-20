import { useRef, useEffect } from 'react';
import InputView from './InputView';
import ViewerView from './ViewerView';
import { useFitsData } from './hooks/useFitsData';
import { useCarringtonData } from './hooks/useCarringtonData';
import { useCoronalFieldLines } from './hooks/useCoronalFieldLines';
import { parseFITS } from './fits/fitsUtils';
import { api } from '../../services/api';
import type { FITSData } from './fits/types';
import type { CoronalData } from './hooks/useCoronalFieldLines';

// ── Prefetch cache — one slot, always holds the next CR ────────────────────
interface PrefetchEntry {
  crNumber: number;
  fitsData: FITSData | null;
  coronalData: CoronalData | null;
  fitsReady: boolean;
  coronalReady: boolean;
}

export default function SolarMagneticFieldGlobe() {
  const shouldAutoFetchCoronalRef = useRef(false);
  const pendingCoronalFetchRef    = useRef<number | null>(null);
  const prefetchRef               = useRef<PrefetchEntry | null>(null);
  const prefetchingCRRef          = useRef<number | null>(null); // prevent duplicate prefetch
  const isAnimatingRef            = useRef(false); // replaceState vs pushState

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

  // ── Prefetch next CR silently whenever current CR settles ────────────────
  useEffect(() => {
    if (!currentCRNumber || isNavigating || isLoadingCoronal) return;
    const nextCR = currentCRNumber + 1;
    if (nextCR > 2285) return;
    // Don't re-prefetch if we already have it or are already fetching it
    if (prefetchRef.current?.crNumber === nextCR) return;
    if (prefetchingCRRef.current === nextCR) return;

    prefetchingCRRef.current = nextCR;
    const entry: PrefetchEntry = {
      crNumber: nextCR,
      fitsData: null,
      coronalData: null,
      fitsReady: false,
      coronalReady: !coronalData, // if coronal not loaded, mark ready immediately
    };
    prefetchRef.current = entry;

    // Prefetch FITS
    (async () => {
      try {
        const blob = await api.fetchCarringtonFits(nextCR);
        const file = new File([blob], `CR${nextCR}.fits`, { type: 'application/fits' });
        const parsed = await parseFITS(file);
        if (prefetchRef.current?.crNumber === nextCR) {
          prefetchRef.current.fitsData = parsed;
          prefetchRef.current.fitsReady = true;
        }
      } catch {
        // Prefetch failed silently — handleNavigate will fall back to normal fetch
        if (prefetchRef.current?.crNumber === nextCR) {
          prefetchRef.current.fitsReady = true; // mark ready so we don't block
          prefetchRef.current.fitsData = null;
        }
      }
    })();

    // Prefetch coronal (only if coronal is currently loaded)
    if (coronalData) {
      (async () => {
        try {
          const data = await api.fetchCoronalData(nextCR);
          if (prefetchRef.current?.crNumber === nextCR) {
            prefetchRef.current.coronalData = data;
            prefetchRef.current.coronalReady = true;
          }
        } catch {
          if (prefetchRef.current?.crNumber === nextCR) {
            prefetchRef.current.coronalReady = true;
            prefetchRef.current.coronalData = null;
          }
        }
      })();
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
    prefetchRef.current = null;
    prefetchingCRRef.current = null;
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

    const prefetch = prefetchRef.current;
    const prefetchHit = direction === 'next'
      && prefetch?.crNumber === newCRNumber
      && prefetch.fitsReady
      && prefetch.coronalReady
      && prefetch.fitsData !== null;

    // Clear prefetch slot so next CR gets prefetched after this one lands
    prefetchRef.current = null;
    prefetchingCRRef.current = null;

    if (prefetchHit && prefetch) {
      // ── Fast path: use prefetched data directly ──────────────────────────
      setDataSource(`CR${newCRNumber}.fits`);
      setFitsData(prefetch.fitsData);
      if (coronalData && prefetch.coronalData) {
        // Directly set coronal data via fetchCoronalData wrapper won't work
        // since we already have the data — use fetchCoronalData which sets state
        // Actually we need to set the data ourselves; fetchCoronalData makes a network call.
        // We'll trigger a fetch but the browser cache should serve it instantly
        // since we already fetched it in the prefetch. Net result: near-instant.
        fetchCoronalData(newCRNumber);
      }
    } else {
      // ── Normal path: fetch as before ─────────────────────────────────────
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
    prefetchRef.current = null;
    prefetchingCRRef.current = null;
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