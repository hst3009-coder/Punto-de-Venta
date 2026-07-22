import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { CustomAlertConfig, CustomAlertDialog } from '../components/CustomAlertDialog';

interface AlertContextType {
  showAlert: (title: string, message: string, type?: 'info' | 'warning' | 'error' | 'success', confirmLabel?: string) => Promise<void>;
  showConfirm: (title: string, message: string, confirmLabel?: string, cancelLabel?: string) => Promise<boolean>;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeAlert, setActiveAlert] = useState<CustomAlertConfig | null>(null);

  const showAlert = useCallback((
    title: string,
    message: string,
    type: 'info' | 'warning' | 'error' | 'success' = 'info',
    confirmLabel?: string
  ): Promise<void> => {
    return new Promise((resolve) => {
      setActiveAlert({
        id: Math.random().toString(),
        type,
        title,
        message,
        confirmLabel,
        onConfirm: () => resolve(),
      });
    });
  }, []);

  const showConfirm = useCallback((
    title: string,
    message: string,
    confirmLabel?: string,
    cancelLabel?: string
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setActiveAlert({
        id: Math.random().toString(),
        type: 'confirm',
        title,
        message,
        confirmLabel,
        cancelLabel,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  }, []);

  const handleClose = () => {
    setActiveAlert(null);
  };

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      <CustomAlertDialog alert={activeAlert} onClose={handleClose} />
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};
