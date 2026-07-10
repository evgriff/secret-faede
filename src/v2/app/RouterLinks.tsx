import { Link } from 'react-router-dom';

import type { FeedLinkProps } from '../routes/feed';
import type { TodayLinkProps } from '../routes/today';
import type { AppNavigationLinkProps } from '../ui';

export function RouteLink({
  children,
  ...props
}: FeedLinkProps | TodayLinkProps) {
  return <Link {...props}>{children}</Link>;
}

export function ShellRouteLink({
  active,
  href,
  ...props
}: AppNavigationLinkProps) {
  return <Link {...props} data-active={active || undefined} to={href} />;
}
