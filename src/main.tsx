import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { AppProviders } from './app/providers';
import { createRuntimeServices } from './infrastructure/runtime/services';
import './styles/tokens.css';
import './styles/base.css';
import './styles/utilities.css';

const root = createRoot(document.getElementById('root')!);

void bootstrap().catch((error: unknown) => {
  console.error('Unable to start Secret Faeries', error);
  root.render(
    <div className="pageShell" role="alert">
      <h1 className="pageTitle">Unable to start the app.</h1>
      <p className="pageLead">Reload and try again.</p>
    </div>,
  );
});

async function bootstrap() {
  const services = await createRuntimeServices();

  root.render(
    <StrictMode>
      <AppProviders services={services}>
        <App />
      </AppProviders>
    </StrictMode>,
  );
}
