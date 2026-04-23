export type PageStructureType =
  | 'bed'
  | 'container'
  | 'inGroundBed'
  | 'path'
  | 'pathway'
  | 'raisedBed'
  | 'trellis';

export type LegacyUtilityStructureType =
  | 'compost'
  | 'fence'
  | 'fenceWall'
  | 'hoseBib'
  | 'other'
  | 'treeObstacle'
  | 'waterSource';

export type LegacyStructureType = LegacyUtilityStructureType;
export type StructureType = PageStructureType | LegacyUtilityStructureType;

export type AuthorableStructureType =
  | 'container'
  | 'inGroundBed'
  | 'pathway'
  | 'raisedBed'
  | 'trellis';

export type StructureMaterial =
  | 'gravel'
  | 'lumber'
  | 'metal'
  | 'mixed'
  | 'mulch'
  | 'none'
  | 'pavers'
  | 'soil'
  | 'stone'
  | 'wire'
  | 'woodChips';

export const pageStructureTypes = [
  'bed',
  'container',
  'inGroundBed',
  'path',
  'pathway',
  'raisedBed',
  'trellis',
] as const satisfies readonly PageStructureType[];

export const authorableStructureTypes = [
  'raisedBed',
  'inGroundBed',
  'container',
  'pathway',
  'trellis',
] as const satisfies readonly AuthorableStructureType[];

export const legacyUtilityStructureTypes = [
  'compost',
  'fence',
  'fenceWall',
  'hoseBib',
  'other',
  'treeObstacle',
  'waterSource',
] as const satisfies readonly LegacyUtilityStructureType[];

export function isPageStructureType(type: string): type is PageStructureType {
  return pageStructureTypes.includes(type as PageStructureType);
}

export function isAuthorableStructureType(
  type: string,
): type is AuthorableStructureType {
  return authorableStructureTypes.includes(type as AuthorableStructureType);
}

export function isLegacyUtilityStructureType(
  type: string,
): type is LegacyUtilityStructureType {
  return legacyUtilityStructureTypes.includes(
    type as LegacyUtilityStructureType,
  );
}
