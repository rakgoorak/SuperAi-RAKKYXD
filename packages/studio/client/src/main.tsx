import React from 'react';
import ReactDOM from 'react-dom/client';
import { loadLocaleText } from './i18n.js';
import './index.css';

// The interface text of the chosen language comes first: some modules build their labels when
// they load, so the app is imported only once that text is here.
void loadLocaleText().catch(() => {})
  .then(() => Promise.all([import('./App.js'), import('./components/ErrorBoundary.js')]))
  .then(([{ App }, { ErrorBoundary }]) => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
  });

import "./mission-control.css";

import "./composer.css";

import "./minimal-workspace.css";
import "./toast.css";

import "./comparison-arena.css";
import "./conversation-hub.css";
import "./minimal-interface.css";
import "./mac-permissions.css";
import "./composer-balanced.css";
