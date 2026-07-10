import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { V2App } from './v2/app/V2App';
import { createV2Services } from './v2/app/services';
import { BootstrapScreen } from './v2/routes/system/RecoveryPages';
import './v2/ui/foundation.css';

const root = createRoot(document.getElementById('root')!);

void bootstrap();

async function bootstrap() {
  try {
    const services = await createV2Services();
    root.render(
      <StrictMode>
        <V2App services={services} />
      </StrictMode>,
    );
  } catch (error) {
    console.error('Unable to start Secret Faeries', error);
    root.render(
      <BootstrapScreen
        detail={
          error instanceof Error
            ? error.message
            : 'The app could not initialize its local services.'
        }
        onRetry={() => window.location.reload()}
        status="error"
      />,
    );
  }
}
