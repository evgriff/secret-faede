interface PlantIconProps {
  className?: string | undefined;
  title?: string | undefined;
}

export function PlantIcon({ className, title = 'Plant' }: PlantIconProps) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      className={className}
      focusable="false"
      role={title ? 'img' : undefined}
      viewBox="0 0 32 32"
    >
      {title ? <title>{title}</title> : null}
      <circle cx="16" cy="16" fill="currentColor" opacity="0.14" r="14" />
      <path
        d="M16 24V13"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
      <path
        d="M16 15c-5.5-.5-8-3.3-8-7 4.8 0 7.7 2.2 8 7Zm1 2c5.2-.8 7.6-3.5 7.6-7-4.5.1-7.2 2.4-7.6 7Z"
        fill="currentColor"
      />
      <path
        d="M11 25h10"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}
