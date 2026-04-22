import { getCropById } from '../../domain/crops/cropCatalog';
import {
  formatCropSpacing,
  formatGlyph,
  getCropIconTone,
} from './cropPickerHelpers';

describe('cropPickerHelpers', () => {
  it('uses specific crop icons before family/category fallbacks', () => {
    const tomato = getCropById('tomato');
    const basil = getCropById('basil');

    if (!tomato || !basil) {
      throw new Error('Expected catalog fixtures.');
    }

    expect(formatGlyph(tomato)).toBe('🍅');
    expect(formatGlyph(basil)).toBe('🌿');
    expect(getCropIconTone(basil)).toBe('herb');
    expect(formatCropSpacing(tomato)).toBe('24 in');
  });
});
