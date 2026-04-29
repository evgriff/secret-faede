import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

import {
  Banner,
  Button,
  Panel,
} from '../../features/shared/design/DesignPrimitives';
import { routePaths } from '../../shared/lib/routes';

export function RouteErrorPage() {
  const error = useRouteError();
  const message = getRouteErrorMessage(error);
  const isStaleChunk = /dynamically imported module|failed to fetch/i.test(
    message,
  );

  return (
    <div className="pageShell" role="alert">
      <Panel>
        <div className="stack">
          <Banner tone="warning">
            {isStaleChunk
              ? 'A new app version is available.'
              : 'The workspace hit an unexpected error.'}
          </Banner>
          <h1 className="pageTitle">
            {isStaleChunk ? 'Reload Secret Faeries.' : 'Something went wrong.'}
          </h1>
          <p className="pageLead">
            {isStaleChunk
              ? 'Reload the app to pick up the latest workspace files. Saved drafts stay in garden storage.'
              : 'Reload the app and try again. Saved drafts remain available.'}
          </p>
          <div className="inlineCluster">
            <Button onClick={() => window.location.reload()} tone="primary">
              Reload app
            </Button>
            <a className="inkLink" href={routePaths.plan}>
              Open Plan
            </a>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function getRouteErrorMessage(error: unknown) {
  if (isRouteErrorResponse(error)) {
    return error.statusText || String(error.status);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
