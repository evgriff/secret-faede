import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { AppProviders } from './app/providers';
import { createRuntimeServices } from './infrastructure/runtime/services';
import './styles/tokens.css';
import './styles/base.css';
import './styles/utilities.css';

const services = createRuntimeServices();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders services={services}>
      <App />
    </AppProviders>
  </StrictMode>,
);
