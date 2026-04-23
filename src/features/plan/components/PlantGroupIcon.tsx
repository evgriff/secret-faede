import type { PlantGroupIconKey } from '../plantVisuals';

export function PlantGroupIcon({
  className,
  icon,
}: {
  className?: string | undefined;
  icon: PlantGroupIconKey;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      viewBox="0 0 32 32"
    >
      {icon === 'tomato' ? (
        <>
          <circle cx="13.5" cy="18" fill="currentColor" r="6.6" />
          <circle cx="19.2" cy="18.8" fill="currentColor" opacity="0.9" r="5" />
          <path
            d="M16 10.4c-1.3 2-3.2 3-5.8 3 .8-2 2.6-3.2 5.8-3Zm.8 0c3.1.1 4.9 1.3 5.6 3.2-2.4-.1-4.3-1.2-5.6-3.2Z"
            fill="currentColor"
            opacity="0.62"
          />
        </>
      ) : null}
      {icon === 'pepper' ? (
        <>
          <path
            d="M17.4 8.6c-1.5 1.5-2 3.1-1.4 4.8"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2.4"
          />
          <path
            d="M13.5 12.4c4.9-.9 8 1.5 8 6.1 0 4.5-2.8 7.5-6.7 7.5-3 0-5.3-2.4-5.3-5.9 0-2.9 1.4-6.8 4-7.7Z"
            fill="currentColor"
          />
          <path
            d="M15.5 14.6c1.7 1.2 2.3 4.8.3 8.5"
            fill="none"
            opacity="0.36"
            stroke="#fffdf7"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </>
      ) : null}
      {icon === 'root' ? (
        <>
          <path
            d="M16 13.5c4.6 2.2 5 7.8 0 12.4-5-4.6-4.6-10.2 0-12.4Z"
            fill="currentColor"
          />
          <path
            d="M16 13.5c-4.3-.2-6.5-2.2-7-5 3.4-.1 5.8 1.4 7 5Zm.4 0c4.1-.7 6.4-2.8 6.7-5.6-3.4.2-5.7 1.9-6.7 5.6Z"
            fill="currentColor"
            opacity="0.72"
          />
        </>
      ) : null}
      {icon === 'vine' ? (
        <>
          <path
            d="M8.5 21.5c5.8-1.8 10.8-5.9 15-12"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2.4"
          />
          <path
            d="M10.3 16.4c-2.1-3.8-.9-6.7 3-8.4 1.6 3.8.6 6.7-3 8.4Zm8.4 1.2c4.4-.4 6.7 1.4 7.2 5.5-4 .2-6.4-1.6-7.2-5.5Z"
            fill="currentColor"
          />
          <path
            d="M8.8 23.5c4.4 2.2 8.6-.5 6.2-3.4-1.4-1.7-4.1-.6-3.4 1.1"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </>
      ) : null}
      {icon === 'herb' ? (
        <>
          <path
            d="M16 25V8.2"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2.3"
          />
          <path
            d="M15.6 12.6c-4.6.5-6.8-1.2-7.4-4.7 4 .1 6.4 1.6 7.4 4.7Zm.8 3.8c4.8-.2 7.1 1.6 7.6 5.3-4.2-.2-6.5-1.9-7.6-5.3Zm-.7 4.4c-4.1.5-6.4-.9-7.2-4.1 3.7-.1 6.1 1.2 7.2 4.1Z"
            fill="currentColor"
          />
        </>
      ) : null}
      {icon === 'flower' ? (
        <>
          <path
            d="M16 26v-8"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2.2"
          />
          <circle cx="16" cy="13.8" fill="currentColor" r="3.2" />
          <path
            d="M16 5.6c2.1 2.1 2.1 4.1 0 6.1-2.1-2-2.1-4 0-6.1Zm0 10.2c2.1 2.1 2.1 4.1 0 6.1-2.1-2-2.1-4 0-6.1Zm-8.2-2c2.1-2.1 4.1-2.1 6.1 0-2 2.1-4 2.1-6.1 0Zm10.2 0c2.1-2.1 4.1-2.1 6.1 0-2 2.1-4 2.1-6.1 0Z"
            fill="currentColor"
            opacity="0.76"
          />
        </>
      ) : null}
      {icon === 'brassica' ? (
        <>
          <circle cx="13" cy="13" fill="currentColor" r="4.8" />
          <circle
            cx="19.2"
            cy="13.8"
            fill="currentColor"
            opacity="0.92"
            r="5"
          />
          <circle
            cx="16.2"
            cy="19.4"
            fill="currentColor"
            opacity="0.82"
            r="5.4"
          />
          <path
            d="M12 25c1.9-2 6.1-2 8 0"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </>
      ) : null}
      {icon === 'grain' ? (
        <>
          <path
            d="M16 26V7"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2.2"
          />
          <path
            d="M15.8 10.5c-3.4.5-5.2-.9-5.8-3.5 3.1.1 5 1.2 5.8 3.5Zm.3 4.2c3.4-.5 5.2-1.9 5.8-4.5-3.1.1-5 1.4-5.8 4.5Zm-.3 3.5c-3.3.5-5.1-.9-5.7-3.4 3 .1 4.9 1.2 5.7 3.4Zm.3 4.1c3.3-.5 5.1-1.9 5.7-4.4-3 .1-4.9 1.4-5.7 4.4Z"
            fill="currentColor"
          />
        </>
      ) : null}
      {icon === 'fruit' ? (
        <>
          <path
            d="M17.8 9.6c1.1-2.1 2.9-3.2 5.3-3.2-.3 2.4-2.1 4.1-5.3 3.2Z"
            fill="currentColor"
            opacity="0.7"
          />
          <path
            d="M16 12.2c5.5-2.2 9.3 1.7 7.6 7.7-1.2 4.3-4.2 6.5-7.6 4.7-3.4 1.8-6.4-.4-7.6-4.7-1.7-6 2.1-9.9 7.6-7.7Z"
            fill="currentColor"
          />
          <path
            d="M16 11.9c-.2-1.9-.9-3.4-2.1-4.6"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </>
      ) : null}
      {icon === 'leafy' ? (
        <>
          <path
            d="M16 25V13"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2.4"
          />
          <path
            d="M15.7 15.2c-5.6-.4-8.1-3.1-8.2-7 4.8.1 7.6 2.4 8.2 7Zm1 2.1c5.3-.7 7.9-3.4 8-7.3-4.6.2-7.4 2.7-8 7.3Zm-.8 3.5c-4 .5-6.5-.8-7.6-3.7 3.6-.3 6.2.8 7.6 3.7Z"
            fill="currentColor"
          />
        </>
      ) : null}
    </svg>
  );
}
