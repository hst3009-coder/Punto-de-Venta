import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AlertProvider } from './context/AlertContext.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AlertProvider>
        <App />
      </AlertProvider>
    </ErrorBoundary>
  </StrictMode>,
);

