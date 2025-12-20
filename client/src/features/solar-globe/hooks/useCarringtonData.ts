import { useState } from 'react';
import { parseFITS } from '../fits/fitsUtils';
import type { FITSData } from '../fits/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE) {
  throw new Error('VITE_API_BASE_URL is not defined');
}

export const useCarringtonData = () => {
  const [carringtonNumber, setCarringtonNumber] = useState('');
  const [currentCRNumber, setCurrentCRNumber] = useState<number | undefined>(undefined);
  const [fetchError, setFetchError] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);

  const fetchCarringtonData = async (
    rotationNum: number,
    isNavigation: boolean,
    setDataSource: (name: string) => void,
    setFitsData: (data: FITSData | null) => void,
    setIsFetching: (value: boolean) => void,
    setIsProcessing: (value: boolean) => void
  ) => {
    if (rotationNum < 2096 || rotationNum > 2285) {
      setFetchError('Carrington rotation number must be between 2096 and 2285');
      return;
    }

    setFetchError('');
    
    if (isNavigation) {
      setIsNavigating(true);
    } else {
      setIsFetching(true);
      setFitsData(null);
    }
    
    setDataSource(`CR${rotationNum}.fits`);

    try {
      if (!isNavigation) {
        const response = await fetch(
          `${API_BASE}/api/fits/carrington/${rotationNum}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch CR${rotationNum}: ${response.statusText}`);
        }

        const blob = await response.blob();
        const file = new File([blob], `CR${rotationNum}.fits`, { type: 'application/fits' });

        setIsFetching(false);
        setIsProcessing(true);
        
        const parsed = await parseFITS(file);
        setFitsData(parsed);
        setCurrentCRNumber(rotationNum);
        setIsProcessing(false);
      } else {
        // For navigation, fetch and process in background
        const response = await fetch(
          `${API_BASE}/api/fits/carrington/${rotationNum}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch CR${rotationNum}: ${response.statusText}`);
        }

        const blob = await response.blob();
        const file = new File([blob], `CR${rotationNum}.fits`, { type: 'application/fits' });
        
        const parsed = await parseFITS(file);
        setFitsData(parsed);
        setCurrentCRNumber(rotationNum);
        setIsNavigating(false);
      }
      
    } catch (error) {
      setIsFetching(false);
      setIsNavigating(false);
      setFetchError(error instanceof Error ? error.message : 'Failed to fetch FITS file');
    }
  };

  const reset = () => {
    setCarringtonNumber('');
    setCurrentCRNumber(undefined);
    setFetchError('');
    setIsNavigating(false);
  };

  return {
    carringtonNumber,
    setCarringtonNumber,
    currentCRNumber,
    fetchError,
    isNavigating,
    fetchCarringtonData,
    reset
  };
};