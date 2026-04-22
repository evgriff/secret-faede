import type { ChangeEvent, Dispatch, FormEvent, SetStateAction } from 'react';
import type {
  Garden,
  HarvestEvent,
  IssueSeverity,
  IssueStatus,
  JournalEntryType,
  JournalIssueCategory,
} from '../../../domain/gardens/GardenRepository';
import type { TargetOption } from '../logHelpers';
import { HarvestForm } from './HarvestForm';
import { LogEntryForm } from './LogEntryForm';
import formStyles from './LogForms.module.css';
import pageStyles from '../LogPage.module.css';

type HarvestUnit = HarvestEvent['unit'];

export function LogFormsPanel({
  entryBody,
  entryDate,
  entryTitle,
  entryType,
  garden,
  harvestAmountText,
  harvestDate,
  harvestNotes,
  harvestPlantingId,
  harvestQuantity,
  harvestUnit,
  isOffline,
  issueCategory,
  issueSeverity,
  issueStatus,
  onClearPhotos,
  onJournalSubmit,
  onPhotoChange,
  onSaveWithoutPhotos,
  onHarvestSubmit,
  photoFiles,
  setEntryBody,
  setEntryDate,
  setEntryTitle,
  setEntryType,
  setHarvestAmountText,
  setHarvestDate,
  setHarvestNotes,
  setHarvestPlantingId,
  setHarvestQuantity,
  setHarvestUnit,
  setIssueCategory,
  setIssueSeverity,
  setIssueStatus,
  setTargetId,
  targetId,
  targetOptions,
}: {
  entryBody: string;
  entryDate: string;
  entryTitle: string;
  entryType: JournalEntryType;
  garden: Garden;
  harvestAmountText: string;
  harvestDate: string;
  harvestNotes: string;
  harvestPlantingId: string;
  harvestQuantity: string;
  harvestUnit: HarvestUnit;
  isOffline: boolean;
  issueCategory: JournalIssueCategory;
  issueSeverity: IssueSeverity;
  issueStatus: IssueStatus;
  onClearPhotos(): void;
  onJournalSubmit(event: FormEvent<HTMLFormElement>): void;
  onPhotoChange(event: ChangeEvent<HTMLInputElement>): void;
  onSaveWithoutPhotos(): void;
  onHarvestSubmit(event: FormEvent<HTMLFormElement>): void;
  photoFiles: File[];
  setEntryBody: Dispatch<SetStateAction<string>>;
  setEntryDate: Dispatch<SetStateAction<string>>;
  setEntryTitle: Dispatch<SetStateAction<string>>;
  setEntryType(value: JournalEntryType): void;
  setHarvestAmountText: Dispatch<SetStateAction<string>>;
  setHarvestDate: Dispatch<SetStateAction<string>>;
  setHarvestNotes: Dispatch<SetStateAction<string>>;
  setHarvestPlantingId: Dispatch<SetStateAction<string>>;
  setHarvestQuantity: Dispatch<SetStateAction<string>>;
  setHarvestUnit(value: HarvestUnit): void;
  setIssueCategory(value: JournalIssueCategory): void;
  setIssueSeverity(value: IssueSeverity): void;
  setIssueStatus(value: IssueStatus): void;
  setTargetId: Dispatch<SetStateAction<string>>;
  targetId: string;
  targetOptions: TargetOption[];
}) {
  return (
    <div className={formStyles.formPanels}>
      <section className={pageStyles.panel} id="add-entry">
        <h2>Add feed entry</h2>
        <LogEntryForm
          canUseNativeCamera={false}
          entryBody={entryBody}
          entryDate={entryDate}
          entryTitle={entryTitle}
          entryType={entryType}
          isOffline={isOffline}
          issueCategory={issueCategory}
          issueSeverity={issueSeverity}
          issueStatus={issueStatus}
          onCapturePhoto={() => undefined}
          onClearPhotos={onClearPhotos}
          onPhotoChange={onPhotoChange}
          onSaveWithoutPhotos={onSaveWithoutPhotos}
          onSubmit={onJournalSubmit}
          photoFiles={photoFiles}
          setEntryBody={setEntryBody}
          setEntryDate={setEntryDate}
          setEntryTitle={setEntryTitle}
          setEntryType={setEntryType}
          setIssueCategory={setIssueCategory}
          setIssueSeverity={setIssueSeverity}
          setIssueStatus={setIssueStatus}
          setTargetId={setTargetId}
          targetId={targetId}
          targetOptions={targetOptions}
        />
      </section>

      <section className={pageStyles.panel} id="log-harvest">
        <h2>Log harvest</h2>
        <HarvestForm
          garden={garden}
          harvestAmountText={harvestAmountText}
          harvestDate={harvestDate}
          harvestNotes={harvestNotes}
          harvestPlantingId={harvestPlantingId}
          harvestQuantity={harvestQuantity}
          harvestUnit={harvestUnit}
          onSubmit={onHarvestSubmit}
          setHarvestAmountText={setHarvestAmountText}
          setHarvestDate={setHarvestDate}
          setHarvestNotes={setHarvestNotes}
          setHarvestPlantingId={setHarvestPlantingId}
          setHarvestQuantity={setHarvestQuantity}
          setHarvestUnit={setHarvestUnit}
        />
      </section>
    </div>
  );
}
