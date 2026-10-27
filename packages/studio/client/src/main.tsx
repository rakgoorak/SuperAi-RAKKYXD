import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

import "./mission-control.css";

import "./composer.css";

import "./minimal-workspace.css";
import "./toast.css";

import "./comparison-arena.css";
import "./conversation-hub.css";
import "./minimal-interface.css";
import "./composer-balanced.css";
