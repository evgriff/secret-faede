import { memo } from 'react';

import type { PlanInfluenceOverlayModel } from '../planInfluenceOverlay';
import { footprintStyle } from './planCanvasGeometry';
import styles from './PlanCanvasItems.module.css';

export const PlanInfluenceOverlay = memo(function PlanInfluenceOverlay({
  overlay,
}: {
  overlay: PlanInfluenceOverlayModel;
}) {
  return (
    <div
      aria-hidden="true"
      className={styles.influenceOverlay}
      data-influence-overlay="true"
    >
      {overlay.zones.map((zone) => (
        <div
          className={`${styles.influenceZone} ${
            zone.kind === 'spacing'
              ? styles.spacingInfluence
              : styles.shadeInfluence
          } ${zone.warning ? styles.warningInfluence : ''}`}
          data-influence-zone={zone.kind}
          key={zone.id}
          style={footprintStyle({
            depthFt: zone.depthFt,
            id: zone.id,
            itemType: 'planting',
            label: zone.label,
            widthFt: zone.widthFt,
            xFt: zone.xFt,
            yFt: zone.yFt,
          })}
          title={zone.label}
        />
      ))}
    </div>
  );
});
