import { Link } from 'react-router-dom';

import { routePaths } from '../../shared/lib/routes';

export function NotFoundPage() {
  return (
    <section className="pageShell" data-route-shell="true">
      <div className="pageCard stack">
        <p className="pageLead">Not found</p>
        <h1 className="pageTitle">That route does not exist.</h1>
        <p className="pageLead">
          Secret Faeries only has sign-in, access denied, and the authenticated
          garden workspace.
        </p>
        <Link className="inkLink" to={routePaths.root}>
          Return to the app root
        </Link>
      </div>
    </section>
  );
}
