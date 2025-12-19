import { useState, useCallback } from 'react';

export interface FieldLine {
  points: [number, number, number][];
  strengths: number[];
  polarity: 'open' | 'closed';
}

export interface CoronalData {
  metadata: {
    lmax: number;
    r_source: number;
    n_field_lines: number;
  };
  fieldLines: FieldLine[];
}

export const useCoronalFieldLines = () => {
  const [coronalData, setCoronalData] = useState<CoronalData | null>(null);
  const [isLoadingCoronal, setIsLoadingCoronal] = useState(false);
  const [coronalError, setCoronalError] = useState<string>('');
  const [showCoronalLines, setShowCoronalLines] = useState(false);
  const [showOpenLines, setShowOpenLines] = useState(true);
  const [showClosedLines, setShowClosedLines] = useState(true);
  const [showSourceSurface, setShowSourceSurface] = useState(true);

  const fetchCoronalData = useCallback(async (crNumber: number) => {
    setIsLoadingCoronal(true);
    setCoronalError('');

    // Use environment variable or fallback to relative path
    const API_BASE = import.meta.env?.VITE_API_BASE_URL || '';

    try {
      const response = await fetch(`${API_BASE}/api/coronal/${crNumber}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Coronal data for CR ${crNumber} not found. May need to be computed.`);
        }
        throw new Error(`Failed to fetch coronal data: ${response.statusText}`);
      }

      const data = await response.json() as CoronalData;
      setCoronalData(data);
      setShowCoronalLines(true); // Auto-show after successful load
    } catch (err) {
      console.error('Error fetching coronal data:', err);
      setCoronalError(err instanceof Error ? err.message : 'Failed to load coronal data');
      setCoronalData(null);
    } finally {
      setIsLoadingCoronal(false);
    }
  }, []);

  const clearCoronalData = useCallback(() => {
    setCoronalData(null);
    setShowCoronalLines(false);
    setCoronalError('');
  }, []);

  const toggleCoronalLines = useCallback(() => {
    setShowCoronalLines(prev => !prev);
  }, []);

  return {
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
    setShowCoronalLines
  };
};