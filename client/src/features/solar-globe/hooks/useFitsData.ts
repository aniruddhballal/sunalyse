import { useState } from 'react';
import type { FITSData } from '../fits/types';

export const useFitsData = () => {
  const [isFetching, setIsFetching] = useState(false);
  const [dataSource, setDataSource] = useState('');
  const [fitsData, setFitsData] = useState<FITSData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const reset = () => {
    setIsFetching(false);
    setDataSource('');
    setFitsData(null);
    setIsProcessing(false);
  };

  return {
    isFetching,
    dataSource,
    fitsData,
    isProcessing,
    reset,
    setDataSource,
    setFitsData,
    setIsProcessing,
    setIsFetching
  };
};