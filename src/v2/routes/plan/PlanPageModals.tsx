import type { WorkspaceContextValue } from '../../app/WorkspaceProvider';
import type { GardenPlan, GardenStructure, PlantingGroup } from '../../domain';
import { Button, Modal } from '../../ui';
import {
  AddCropDialog,
  AddStructureDialog,
  HistoryDialog,
  LayoutProposalDialog,
  PlotSettingsDialog,
  PublishDialog,
  ReviewDialog,
  SetupGardenDialog,
  type GardenSetupInput,
} from './PlanDialogs';
import {
  applyLayoutProposal,
  recordReviewDecision,
  restoreReviewIssue,
  type LayoutProposal,
  type PlanIssue,
} from './planModel';

export type PlanDialogName =
  | 'addCrop'
  | 'addStructure'
  | 'history'
  | 'layout'
  | 'plotSettings'
  | 'publish'
  | 'review'
  | null;

export type PlanDeleteTarget =
  | { id: string; kind: 'planting'; label: string }
  | { id: string; kind: 'structure'; label: string }
  | null;

export function PlanPageModals({
  activeIssueCount,
  deleteTarget,
  dialog,
  ignoredIssueIds,
  issues,
  onAddPlanting,
  onAddStructure,
  onClose,
  onRemove,
  onSetup,
  onUpdatePlan,
  plan,
  proposal,
  setDeleteTarget,
  workspace,
}: {
  activeIssueCount: number;
  deleteTarget: PlanDeleteTarget;
  dialog: PlanDialogName;
  ignoredIssueIds: Set<string>;
  issues: PlanIssue[];
  onAddPlanting(group: PlantingGroup): void;
  onAddStructure(structure: GardenStructure): void;
  onClose(): void;
  onRemove(): void;
  onSetup(input: GardenSetupInput): void;
  onUpdatePlan(update: (plan: GardenPlan) => GardenPlan): void;
  plan: GardenPlan;
  proposal: LayoutProposal | null;
  setDeleteTarget(target: PlanDeleteTarget): void;
  workspace: WorkspaceContextValue;
}) {
  return (
    <>
      <SetupGardenDialog isOpen={!plan.setupCompleted} onCreate={onSetup} />
      <AddCropDialog
        isOpen={dialog === 'addCrop'}
        onAdd={onAddPlanting}
        onClose={onClose}
        plan={plan}
      />
      <AddStructureDialog
        isOpen={dialog === 'addStructure'}
        onAdd={onAddStructure}
        onClose={onClose}
        plan={plan}
      />
      <PlotSettingsDialog
        isOpen={dialog === 'plotSettings'}
        onClose={onClose}
        onSave={(next) => {
          onUpdatePlan(() => next);
          onClose();
        }}
        plan={plan}
      />
      <ReviewDialog
        ignoredIssueIds={ignoredIssueIds}
        isOpen={dialog === 'review'}
        issues={issues}
        onClose={onClose}
        onIgnore={(issueId) =>
          onUpdatePlan((current) =>
            recordReviewDecision(current, issueId, 'ignored'),
          )
        }
        onRestore={(issueId) =>
          onUpdatePlan((current) => restoreReviewIssue(current, issueId))
        }
      />
      <LayoutProposalDialog
        isOpen={dialog === 'layout'}
        onApply={() => {
          if (proposal) {
            onUpdatePlan((current) => applyLayoutProposal(current, proposal));
          }
          onClose();
        }}
        onClose={onClose}
        plan={plan}
        proposal={proposal}
      />
      <PublishDialog
        isOpen={dialog === 'publish'}
        issueCount={activeIssueCount}
        onClose={onClose}
        onPublish={async (summary) => {
          const outcome = await workspace.publish(summary);
          if (outcome?.status === 'committed') onClose();
        }}
      />
      <HistoryDialog
        currentRevisionId={workspace.workspace!.published.revisionId}
        isOpen={dialog === 'history'}
        onClose={onClose}
        onRevert={async (revisionId) => {
          const outcome = await workspace.revert(revisionId);
          if (outcome?.status === 'committed') onClose();
        }}
        revisions={workspace.workspace!.recentRevisions}
      />
      <Modal
        footer={
          <>
            <Button onClick={() => setDeleteTarget(null)} variant="quiet">
              Cancel
            </Button>
            <Button onClick={onRemove} variant="danger">
              Delete{' '}
              {deleteTarget?.kind === 'planting' ? 'crop group' : 'structure'}
            </Button>
          </>
        }
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.label ?? 'selection'}?`}
      >
        <p>
          This change stays in your private draft until published. Deleting a
          structure leaves its crop groups in the plot but marks their growing
          area unassigned.
        </p>
      </Modal>
    </>
  );
}
