import { useState } from 'react';
import { parseFITS } from '../fits/fitsUtils';
import type { FITSData } from '../fits/types';

export const useFileUpload = () => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fitsData, setFitsData] = useState<FITSData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = async (file: File) => {
    setFileName(file.name);
    setIsUploading(true);
    setUploadProgress(0);
    setFitsData(null);

    const uploadInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(uploadInterval);
          return 100;
        }
        return prev + 10;
      });
    }, 100);

    setTimeout(async () => {
      setIsUploading(false);
      
      if (file.name.toLowerCase().endsWith('.fits')) {
        setIsProcessing(true);
        const parsed = await parseFITS(file);
        setFitsData(parsed);
        setIsProcessing(false);
      }
    }, 1200);
  };

  const reset = () => {
    setUploadProgress(0);
    setIsUploading(false);
    setFileName('');
    setFitsData(null);
    setIsProcessing(false);
  };

  return {
    uploadProgress,
    isUploading,
    fileName,
    fitsData,
    isProcessing,
    handleFileSelect,
    reset,
    setFileName,
    setFitsData,
    setIsProcessing,
    setIsUploading,
    setUploadProgress
  };
};