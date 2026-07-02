import React from 'react';
import { createRoot } from 'react-dom/client';
import TTMIPIndex from './index.jsx';

// Mounts the converted TTMIP v8 dashboard as a React component.
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TTMIPIndex />
  </React.StrictMode>,
);
