import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { AppProvider } from './context/AppContext.jsx';
import { AccessGate } from './components/AccessGate.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <AccessGate>
        <App />
      </AccessGate>
    </AppProvider>
  </React.StrictMode>
);
