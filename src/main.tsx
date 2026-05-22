import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Root element bulunamadı");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA Service Worker Registration
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const registerSW = () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('PWA Service Worker registered successfully:', reg.scope);
      })
      .catch(err => {
        console.warn('PWA Service Worker registration failed:', err);
      });
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    registerSW();
  } else {
    window.addEventListener('load', registerSW);
  }
}
