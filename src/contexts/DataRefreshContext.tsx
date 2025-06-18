import React, { createContext, useContext, useCallback, useState } from 'react';

interface DataRefreshContextType {
  requestDataRefresh: () => void;
  registerDataRefreshFunction: (refreshFn: () => Promise<void> | void) => void;
  isRefreshing: boolean; // Optional: to indicate global refresh state
}

const DataRefreshContext = createContext<DataRefreshContextType | undefined>(undefined);

export const useDataRefresh = (): DataRefreshContextType => {
  const context = useContext(DataRefreshContext);
  if (!context) {
    throw new Error('useDataRefresh must be used within a DataRefreshProvider');
  }
  return context;
};

interface DataRefreshProviderProps {
  children: React.ReactNode;
}

export const DataRefreshProvider: React.FC<DataRefreshProviderProps> = ({ children }) => {
  const [refreshFunction, setRefreshFunction] = useState<(() => Promise<void> | void) | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false); // Optional

  const registerDataRefreshFunction = useCallback((refreshFn: () => Promise<void> | void) => {
    // console.log('[DataRefreshContext] Registering refresh function');
    setRefreshFunction(() => refreshFn); // Store the function itself
  }, []);

  const requestDataRefresh = useCallback(async () => {
    // console.log('[DataRefreshContext] Requesting data refresh');
    if (refreshFunction) {
      setIsRefreshing(true); // Optional
      // console.log('[DataRefreshContext] Executing stored refresh function');
      try {
        await refreshFunction();
      } catch (error) {
        console.error("Error during data refresh:", error);
      } finally {
        setIsRefreshing(false); // Optional
      }
    } else {
      console.warn('[DataRefreshContext] No refresh function registered.');
    }
  }, [refreshFunction]);

  return (
    <DataRefreshContext.Provider value={{ requestDataRefresh, registerDataRefreshFunction, isRefreshing }}>
      {children}
    </DataRefreshContext.Provider>
  );
};
