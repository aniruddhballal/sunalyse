import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE) {
  throw new Error('VITE_API_BASE_URL is not defined');
}

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  fetchCarringtonFits: async (crNumber: number): Promise<Blob> => {
    try {
      const response = await apiClient.get(`/api/fits/carrington/${crNumber}`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          error.response?.data?.message || 
          error.message || 
          `Failed to fetch CR${crNumber}`
        );
      }
      throw error;
    }
  },

  fetchCoronalData: async (crNumber: number) => {
    try {
      const response = await apiClient.get(`/api/coronal/${crNumber}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error(`Coronal data for CR ${crNumber} not found. May need to be computed.`);
        }
        throw new Error(
          error.response?.data?.message || 
          error.message || 
          'Failed to load coronal data'
        );
      }
      throw error;
    }
  },
};

export default apiClient;