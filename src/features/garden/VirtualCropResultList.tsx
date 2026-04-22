import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { CropProfile } from '../../domain/gardens/GardenRepository';
import styles from './CropPickerPanels.module.css';

interface VirtualCropResultListProps {
  className?: string | undefined;
  crops: CropProfile[];
  empty: ReactNode;
  itemHeightPx: number;
  renderCrop(crop: CropProfile): ReactNode;
}

const OVERSCAN_ROWS = 4;

export function VirtualCropResultList({
  className,
  crops,
  empty,
  itemHeightPx,
  renderCrop,
}: VirtualCropResultListProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(itemHeightPx * 6);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const updateViewportHeight = () => {
      setViewportHeight(viewport.clientHeight || itemHeightPx * 6);
    };

    updateViewportHeight();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateViewportHeight);
    observer.observe(viewport);

    return () => observer.disconnect();
  }, [itemHeightPx]);

  useLayoutEffect(() => {
    setScrollTop(0);
    if (viewportRef.current) {
      viewportRef.current.scrollTop = 0;
    }
  }, [crops]);

  const totalHeight = crops.length * itemHeightPx;
  const startIndex = Math.max(
    Math.floor(scrollTop / itemHeightPx) - OVERSCAN_ROWS,
    0,
  );
  const rowCount = Math.ceil(viewportHeight / itemHeightPx) + OVERSCAN_ROWS * 2;
  const endIndex = Math.min(startIndex + rowCount, crops.length);
  const visibleCrops = useMemo(
    () => crops.slice(startIndex, endIndex),
    [crops, endIndex, startIndex],
  );

  return (
    <div
      className={[styles.virtualList, className].filter(Boolean).join(' ')}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      ref={viewportRef}
    >
      {crops.length > 0 ? (
        <div
          className={styles.virtualSpacer}
          style={{ height: `${totalHeight}px` }}
        >
          <div
            className={styles.virtualWindow}
            style={{
              transform: `translateY(${startIndex * itemHeightPx}px)`,
            }}
          >
            {visibleCrops.map((crop) => (
              <div
                className={styles.virtualItem}
                key={crop.id}
                style={{ height: `${itemHeightPx}px` }}
              >
                {renderCrop(crop)}
              </div>
            ))}
          </div>
        </div>
      ) : (
        empty
      )}
    </div>
  );
}
