import { useState, useCallback } from 'react';
import { api } from '../../../services/api';

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

    try {
      const data = await api.fetchCoronalData(crNumber);
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