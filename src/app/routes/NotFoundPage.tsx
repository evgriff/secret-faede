import { Link } from 'react-router-dom';

import { RouteLineIllustration } from '../../assets/illustrations/GardenIllustrations';
import { routePaths } from '../../shared/lib/routes';

export function NotFoundPage() {
  return (
    <section className="pageShell" data-route-shell="true">
      <div className="pageCard stack">
        <p className="pageLead">Not found</p>
        <h1 className="pageTitle">That route does not exist.</h1>
        <RouteLineIllustration
          accentColor="var(--color-plant-sky)"
          animated
          title="Route line illustration"
        />
        <p className="pageLead">
          The milestone 1 shell only exposes sign-in, garden selection, and a
          minimal garden home route.
        </p>
        <Link className="inkLink" to={routePaths.root}>
          Return to the app root
        </Link>
      </div>
    </section>
  );
}
