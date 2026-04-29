import { getCropById } from '../crops/cropCatalog';
import { getCropSupportNeed, getCropSupportProfile } from './supportNeeds';

describe('supportNeeds', () => {
  it('classifies plant-level supports separately from grid trellises', () => {
    const tomato = getRequiredCrop('tomato');
    const eggplant = getRequiredCrop('eggplant');
    const cucumber = getRequiredCrop('cucumber');
    const watermelon = getRequiredCrop('watermelon');

    expect(getCropSupportNeed(tomato)).toMatchObject({
      kind: 'cage',
      plantSupportType: 'cage',
      scope: 'plant',
    });
    expect(getCropSupportNeed(eggplant)).toMatchObject({
      kind: 'stake',
      plantSupportType: 'stake',
      scope: 'plant',
    });
    expect(getCropSupportNeed(cucumber)).toMatchObject({
      kind: 'trellis',
      plantSupportType: null,
      scope: 'structure',
    });
    expect(getCropSupportProfile(watermelon)).toMatchObject({
      kind: 'none',
      recommended: false,
      scope: 'none',
    });
  });

  it('keeps extension source tags with generated support guidance', () => {
    expect(getCropSupportProfile(getRequiredCrop('tomato')).sourceTags).toEqual(
      expect.arrayContaining([
        'extension:uga-tomato-staking',
        'extension:umn-trellises-cages',
      ]),
    );
    expect(
      getCropSupportProfile(getRequiredCrop('cucumber')).sourceTags,
    ).toEqual(
      expect.arrayContaining([
        'extension:umn-trellises-cages',
        'extension:uw-vertical-support',
      ]),
    );
  });
});

function getRequiredCrop(cropId: string) {
  const crop = getCropById(cropId);

  if (!crop) {
    throw new Error(`Expected ${cropId} in the crop catalog.`);
  }

  return crop;
}
