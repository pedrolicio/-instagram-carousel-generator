import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { AppProvider } from './app/providers/AppProvider.jsx';
import { AccessGate } from './app/components/AccessGate.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <AccessGate>
        <App />
      </AccessGate>
    </AppProvider>
  </React.StrictMode>
);
