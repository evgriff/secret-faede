import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useV2Workspace } from '../../app/WorkspaceProvider';
import type { GardenPlan, GardenStructure, PlantingGroup } from '../../domain';
import {
  Button,
  CheckboxField,
  ConflictState,
  ErrorState,
  LoadingState,
  SaveStatus,
  StatusBanner,
} from '../../ui';
import {
  InspectorEmpty,
  PlantingInspector,
  StructureInspector,
} from './PlanInspectors';
import {
  PlanPageModals,
  type PlanDeleteTarget,
  type PlanDialogName,
} from './PlanPageModals';
import type { GardenSetupInput } from './SetupGardenDialog';
import { PlotCanvas } from './PlotCanvas';
import {
  applyPlantingInspectorUpdate,
  createTemplateStructures,
  duplicatePlanting,
} from './planPageHelpers';
import {
  createLayoutProposal,
  findPlanIssues,
  movePlantingGroup,
  type LayoutProposal,
} from './planModel';
import inspectorStyles from './PlanInspector.module.css';
import styles from './PlanPage.module.css';

export function PlanPage() {
  const workspace = useV2Workspace();
  const [searchParams] = useSearchParams();
  const [dialog, setDialog] = useState<PlanDialogName>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [proposal, setProposal] = useState<LayoutProposal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlanDeleteTarget>(null);

  useEffect(() => {
    const requested =
      searchParams.get('plantingId') ?? searchParams.get('structureId');
    if (requested) setSelectedId(requested);
  }, [searchParams]);

  if (workspace.loadState === 'loading' || !workspace.activePlan) {
    return (
      <LoadingState detail="Loading the shared plan and your private draft." />
    );
  }

  if (workspace.loadState === 'error') {
    return (
      <ErrorState
        detail={workspace.error?.message}
        onRetry={workspace.reload}
        title="The garden plan could not be loaded"
      />
    );
  }

  const plan = workspace.activePlan;
  const issues = findPlanIssues(plan);
  const ignoredIssueIds = new Set(
    plan.reviewDecisions
      .filter(
        (decision) =>
          decision.decision === 'ignored' &&
          issues.some(
            (issue) =>
              issue.id === decision.issueId && issue.severity !== 'blocking',
          ),
      )
      .map((decision) => decision.issueId),
  );
  const activeIssues = issues.filter((issue) => !ignoredIssueIds.has(issue.id));
  const blockingIssues = activeIssues.filter(
    (issue) => issue.severity === 'blocking',
  );
  const selectedPlanting =
    plan.plantings.find((item) => item.id === selectedId) ?? null;
  const selectedStructure =
    plan.structures.find((item) => item.id === selectedId) ?? null;

  function updatePlan(update: (current: GardenPlan) => GardenPlan) {
    workspace.updatePlan((current) => ({
      ...update(current),
      updatedAtIso: new Date().toISOString(),
    }));
  }

  function closeDialog() {
    setDialog(null);
  }

  function completeSetup(input: GardenSetupInput) {
    updatePlan((current) => ({
      ...current,
      name: input.name,
      plot: {
        ...current.plot,
        climate: input.climate,
        depthFt: input.depthFt,
        location: input.location,
        widthFt: input.widthFt,
      },
      setupCompleted: true,
      structures: createTemplateStructures(input),
    }));
  }

  function addStructure(structure: GardenStructure) {
    const padding = Math.min(plan.plot.snapFt * 2, 0.5);
    const next = {
      ...structure,
      xFt: Math.min(
        padding,
        Math.max(plan.plot.widthFt - structure.widthFt, 0),
      ),
      yFt: Math.min(
        padding,
        Math.max(plan.plot.depthFt - structure.depthFt, 0),
      ),
    };
    updatePlan((current) => ({
      ...current,
      structures: [...current.structures, next],
    }));
    setSelectedId(next.id);
    closeDialog();
  }

  function addPlanting(group: PlantingGroup) {
    updatePlan((current) => ({
      ...current,
      plantings: [...current.plantings, group],
    }));
    setSelectedId(group.id);
    closeDialog();
  }

  function removeSelected() {
    if (!deleteTarget) return;
    updatePlan((current) =>
      deleteTarget.kind === 'planting'
        ? {
            ...current,
            plantings: current.plantings.filter(
              (item) => item.id !== deleteTarget.id,
            ),
          }
        : {
            ...current,
            plantings: current.plantings.map((item) =>
              item.growingAreaStructureId === deleteTarget.id
                ? { ...item, growingAreaStructureId: null }
                : item,
            ),
            structures: current.structures.filter(
              (item) => item.id !== deleteTarget.id,
            ),
          },
    );
    setSelectedId(null);
    setDeleteTarget(null);
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Private working plan</p>
          <h1 id="route-heading">{plan.name}</h1>
          <p>
            {plan.plot.widthFt} × {plan.plot.depthFt} ft ·{' '}
            {plan.plantings.length} crop group
            {plan.plantings.length === 1 ? '' : 's'} · {plan.structures.length}{' '}
            structure{plan.structures.length === 1 ? '' : 's'}
          </p>
        </div>
        <SaveStatus
          {...(workspace.isDirty && workspace.saveState === 'idle'
            ? { message: 'Unsaved changes' }
            : {})}
          status={workspace.saveState}
        />
      </header>

      {workspace.error && workspace.saveState === 'error' ? (
        <StatusBanner live tone="error" title="Changes are not saved">
          {workspace.error.message}
        </StatusBanner>
      ) : null}

      {workspace.saveState === 'conflict' ? (
        <ConflictState
          detail="The shared plan changed after this draft began. Keeping this version preserves it as a new unsaved draft. Using the latest version permanently deletes this account's private draft and unsaved edits before reloading the shared plan."
          onKeepMine={async () => {
            const currentPlan = structuredClone(plan);
            await workspace.reload();
            workspace.updatePlan(() => currentPlan);
          }}
          onUseLatest={async () => {
            await workspace.discardDraft();
            await workspace.reload();
          }}
          useLatestLabel="Discard my draft and use latest"
        />
      ) : null}

      <section aria-label="Plan actions" className={styles.actionBar}>
        <div className={styles.primaryActions}>
          <Button onClick={() => setDialog('addCrop')}>Add crop</Button>
          <Button onClick={() => setDialog('addStructure')} variant="secondary">
            Add structure
          </Button>
          <Button onClick={() => setDialog('plotSettings')} variant="quiet">
            Plot settings
          </Button>
        </div>
        <div className={styles.primaryActions}>
          <Button
            aria-label={`Review ${activeIssues.length} active plan issues`}
            onClick={() => setDialog('review')}
            variant={activeIssues.length > 0 ? 'secondary' : 'quiet'}
          >
            Review ({activeIssues.length})
          </Button>
          <Button
            onClick={() => {
              setProposal(createLayoutProposal(plan));
              setDialog('layout');
            }}
            variant="quiet"
          >
            Suggest layout
          </Button>
          <Button onClick={() => setDialog('history')} variant="quiet">
            History
          </Button>
          <Button
            disabled={!workspace.isDirty || workspace.saveState === 'saving'}
            isBusy={workspace.saveState === 'saving'}
            onClick={() => void workspace.saveDraft()}
            variant="secondary"
          >
            Save draft
          </Button>
          <Button
            disabled={
              blockingIssues.length > 0 || workspace.saveState === 'saving'
            }
            onClick={() => setDialog('publish')}
          >
            Publish
          </Button>
        </div>
      </section>

      {blockingIssues.length > 0 ? (
        <StatusBanner
          actions={
            <Button onClick={() => setDialog('review')} variant="secondary">
              Review blocking issues
            </Button>
          }
          tone="warning"
          title="Publishing is paused"
        >
          Resolve {blockingIssues.length} physical layout problem
          {blockingIssues.length === 1 ? '' : 's'} before sharing this plan.
        </StatusBanner>
      ) : null}

      <div className={styles.workspaceGrid}>
        <div className={styles.canvasColumn}>
          <div className={styles.canvasControls}>
            <CheckboxField
              checked={showGrid}
              onChange={(event) => setShowGrid(event.currentTarget.checked)}
            >
              Measurement grid
            </CheckboxField>
          </div>
          <PlotCanvas
            onMove={(id, position) =>
              updatePlan((current) => movePlantingGroup(current, id, position))
            }
            onSelect={setSelectedId}
            plan={plan}
            selectedId={selectedId}
            showGrid={showGrid}
          />
        </div>

        <aside
          aria-label="Plan inspector"
          className={inspectorStyles.inspector}
        >
          {selectedPlanting ? (
            <PlantingInspector
              group={selectedPlanting}
              onDelete={() =>
                setDeleteTarget({
                  id: selectedPlanting.id,
                  kind: 'planting',
                  label: selectedPlanting.cropName,
                })
              }
              onDuplicate={() => {
                const copy = duplicatePlanting(selectedPlanting, plan);
                updatePlan((current) => ({
                  ...current,
                  plantings: [...current.plantings, copy],
                }));
                setSelectedId(copy.id);
              }}
              onUpdate={(next) =>
                updatePlan((current) =>
                  applyPlantingInspectorUpdate(current, next),
                )
              }
              plan={plan}
            />
          ) : selectedStructure ? (
            <StructureInspector
              onDelete={() =>
                setDeleteTarget({
                  id: selectedStructure.id,
                  kind: 'structure',
                  label: selectedStructure.label,
                })
              }
              onUpdate={(next) =>
                updatePlan((current) => ({
                  ...current,
                  structures: current.structures.map((item) =>
                    item.id === next.id ? next : item,
                  ),
                }))
              }
              plan={plan}
              structure={selectedStructure}
            />
          ) : (
            <InspectorEmpty plan={plan} />
          )}
        </aside>
      </div>

      <PlanPageModals
        activeIssueCount={activeIssues.length}
        deleteTarget={deleteTarget}
        dialog={dialog}
        ignoredIssueIds={ignoredIssueIds}
        issues={issues}
        onAddPlanting={addPlanting}
        onAddStructure={addStructure}
        onClose={closeDialog}
        onRemove={removeSelected}
        onSetup={completeSetup}
        onUpdatePlan={updatePlan}
        plan={plan}
        proposal={proposal}
        setDeleteTarget={setDeleteTarget}
        workspace={workspace}
      />
    </div>
  );
}
