import {
  Panel,
  SkeletonBlock,
} from '../../features/shared/design/DesignPrimitives';

interface LoadingStateProps {
  message: string;
  title: string;
}

export function LoadingState({ message, title }: LoadingStateProps) {
  return (
    <div aria-live="polite" className="pageShell">
      <Panel>
        <div className="stack">
          <h1 className="pageTitle">{title}</h1>
          <p className="pageLead">{message}</p>
          <SkeletonBlock />
        </div>
      </Panel>
    </div>
  );
}
