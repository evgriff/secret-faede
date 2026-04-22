export type TodaySaveStatus = 'error' | 'idle' | 'queued' | 'saved' | 'saving';

export function TodaySaveState({
  error,
  isOffline,
  status,
}: {
  error: string | null;
  isOffline: boolean;
  status: TodaySaveStatus;
}) {
  if (status === 'saving') {
    return <span>Saving...</span>;
  }

  if (status === 'saved') {
    return <span>Saved</span>;
  }

  if (status === 'queued') {
    return <span>Saved locally</span>;
  }

  if (status === 'error' && error) {
    return <span role="alert">{error}</span>;
  }

  return isOffline ? <span>Offline changes will queue</span> : null;
}
