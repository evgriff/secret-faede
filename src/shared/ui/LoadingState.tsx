interface LoadingStateProps {
  message: string;
  title: string;
}

export function LoadingState({ message, title }: LoadingStateProps) {
  return (
    <section aria-live="polite" className="pageShell pageCard stack">
      <h1 className="pageTitle">{title}</h1>
      <p className="pageLead">{message}</p>
    </section>
  );
}
