// hooks/useCarringtonData.ts

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
    setFileName: (name: string) => void,
    setFitsData: (data: FITSData | null) => void,
    setIsUploading: (value: boolean) => void,
    setUploadProgress: (value: number | ((prev: number) => number)) => void,
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
      setIsUploading(true);
      setUploadProgress(0);
      setFitsData(null);
    }
    
    setFileName(`CR${rotationNum}.fits`);

    try {
      if (!isNavigation) {
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => Math.min(prev + 15, 90));
        }, 200);

        const response = await fetch(
          `${API_BASE}/api/fits/carrington/${rotationNum}`
        );

        clearInterval(progressInterval);
        setUploadProgress(100);

        if (!response.ok) {
          throw new Error(`Failed to fetch CR${rotationNum}: ${response.statusText}`);
        }

        const blob = await response.blob();
        const file = new File([blob], `CR${rotationNum}.fits`, { type: 'application/fits' });

        setIsUploading(false);
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
      setIsUploading(false);
      setIsNavigating(false);
      setFetchError(error instanceof Error ? error.message : 'Failed to fetch FITS file');
      setUploadProgress(0);
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