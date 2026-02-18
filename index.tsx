import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';


// --- DEBUGGING: Global Error Handler ---
window.onerror = function (message, source, lineno, colno, error) {
  alert('Error: ' + message + '\nLine: ' + lineno + '\nColumn: ' + colno + '\nStack: ' + (error ? error.stack : 'N/A'));
};
window.onunhandledrejection = function (event) {
  alert('Unhandled Rejection: ' + event.reason);
};
// ---------------------------------------

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);