import { useEffect, useState } from 'react';

export function useChooserCardHeight(hasExpandedCard: boolean) {
  const [isMobileCard, setIsMobileCard] = useState(() =>
    typeof window === 'undefined' || typeof window.matchMedia !== 'function'
      ? false
      : window.matchMedia('(max-width: 58rem)').matches,
  );

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return undefined;
    }

    const query = window.matchMedia('(max-width: 58rem)');
    const update = () => setIsMobileCard(query.matches);

    update();
    query.addEventListener('change', update);

    return () => query.removeEventListener('change', update);
  }, []);

  if (hasExpandedCard) {
    return isMobileCard ? 540 : 420;
  }

  return isMobileCard ? 292 : 224;
}
