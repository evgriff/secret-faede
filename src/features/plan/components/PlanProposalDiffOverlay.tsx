import { pixelsPerFoot } from '../../garden/gardenMath';
import type { AutoLayoutPreviewRect } from '../autoLayoutProposalDiff';
import type { ProposalDiffOverlayModel } from '../proposalDiffOverlay';
import { footprintStyle } from './planCanvasGeometry';
import itemStyles from './PlanCanvasItems.module.css';

export function PlanProposalDiffOverlay({
  overlay,
  plotDepthFt,
  plotWidthFt,
}: {
  overlay: ProposalDiffOverlayModel;
  plotDepthFt: number;
  plotWidthFt: number;
}) {
  return (
    <div
      aria-label={`Layout diff overlay: ${overlay.title}`}
      className={itemStyles.diffOverlay}
      role="img"
    >
      <svg
        aria-hidden="true"
        className={itemStyles.diffArrowLayer}
        viewBox={`0 0 ${plotWidthFt * pixelsPerFoot} ${plotDepthFt * pixelsPerFoot}`}
      >
        {overlay.connectors.map((connector) => (
          <line
            className={itemStyles.diffArrow}
            key={connector.id}
            x1={connector.from.xFt * pixelsPerFoot}
            x2={connector.to.xFt * pixelsPerFoot}
            y1={connector.from.yFt * pixelsPerFoot}
            y2={connector.to.yFt * pixelsPerFoot}
          />
        ))}
      </svg>

      {overlay.beforeRects.map((rect) => (
        <DiffRect key={`before-${rect.id}`} rect={rect} phase="before" />
      ))}
      {overlay.afterRects.map((rect) => (
        <DiffRect key={`after-${rect.id}`} rect={rect} phase="after" />
      ))}
    </div>
  );
}

function DiffRect({
  phase,
  rect,
}: {
  phase: 'after' | 'before';
  rect: AutoLayoutPreviewRect;
}) {
  const isAfter = phase === 'after';
  const className = [
    itemStyles.diffRect,
    isAfter ? itemStyles.diffAfter : itemStyles.diffBefore,
    rect.kind === 'removed' ? itemStyles.diffRemoved : '',
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={className} style={footprintStyle(rect.rect)} />;
}
