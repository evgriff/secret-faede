import { useEffect, useMemo, useState } from 'react';

import type { PhotoAttachment } from '../domain';
import { useV2Services } from './V2ServicesContext';

export function usePhotoUrls(photos: readonly PhotoAttachment[]) {
  const services = useV2Services();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const paths = useMemo(
    () => [...new Set(photos.map((photo) => photo.storagePath))],
    [photos],
  );

  useEffect(() => {
    let active = true;
    for (const path of paths) {
      if (urls[path]) continue;
      if (/^(?:blob:|data:|https?:)/.test(path)) {
        setUrls((current) => ({ ...current, [path]: path }));
        continue;
      }
      void services
        .resolvePhotoUrl(path)
        .then((url) => {
          if (active) setUrls((current) => ({ ...current, [path]: url }));
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [paths, services, urls]);

  return {
    getPhotoUrl: (photo: PhotoAttachment) => urls[photo.storagePath] ?? null,
    rememberPhotoUrl: (storagePath: string, url: string) =>
      setUrls((current) => ({ ...current, [storagePath]: url })),
  };
}
