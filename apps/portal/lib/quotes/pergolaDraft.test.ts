import { describe, expect, it } from 'vitest';
import {
  buildPergolaStructuredDescription,
  parsePergolaStructuredDescription,
  updateSharedPergolaField,
} from './pergolaDraft';

describe('pergolaDraft', () => {
  it('parses grouped multi-module pergola descriptions', () => {
    const parsed = parsePergolaStructuredDescription([
      'Pergola 1',
      '- Configuration: Gable + Pitched modules',
      '',
      'Shared specification',
      '- Roof: Acrylic',
      '- Colour: Black',
      '',
      'Module 1: Gable',
      '- Size: 4.83m x 4.68m',
      '- Pitch: 25°',
      '- Posts: 4',
      '',
      'Module 2: Pitched',
      '- Size: 4.93m x 2.65m',
      '- Pitch: 25°',
      '- Posts: 3',
    ].join('\n'));

    expect(parsed).toEqual({
      heading: 'Pergola 1',
      included: '',
      projectDelivery: '',
      configuration: 'Gable + Pitched modules',
      shared: {
        roof: 'Acrylic',
        colour: 'Black',
        houseConnection: '',
        postFixings: '',
      },
      modules: [
        {
          title: 'Module 1',
          style: 'Gable',
          size: '4.83m x 4.68m',
          pitch: '25°',
          posts: '4',
          roof: '',
          colour: '',
          houseConnection: '',
          postFixings: '',
          includedInfills: [],
        },
        {
          title: 'Module 2',
          style: 'Pitched',
          size: '4.93m x 2.65m',
          pitch: '25°',
          posts: '3',
          roof: '',
          colour: '',
          houseConnection: '',
          postFixings: '',
          includedInfills: [],
        },
      ],
      quoteDiscount: '',
    });
  });

  it('builds multi-module grouped descriptions', () => {
    const raw = buildPergolaStructuredDescription({
      heading: 'Pergola 1',
      configuration: 'Gable + Pitched modules',
      shared: {
        roof: 'Acrylic',
        colour: 'Black',
        houseConnection: 'None',
        postFixings: 'Deck brackets',
      },
      modules: [
        {
          title: 'Module 1',
          style: 'Gable',
          size: '4.83m x 4.68m',
          pitch: '25°',
          posts: '4',
          roof: '',
          colour: '',
          houseConnection: '',
          postFixings: '',
        },
        {
          title: 'Module 2',
          style: 'Pitched',
          size: '4.93m x 2.65m',
          pitch: '25°',
          posts: '3',
          roof: '',
          colour: '',
          houseConnection: '',
          postFixings: '',
        },
      ],
    });

    expect(raw).toContain('Shared across all roof sections');
    expect(raw).toContain('Roof section 1: Gable');
    expect(raw).toContain('Roof section 2: Pitched');
    expect(raw.match(/Roof covering: Acrylic/g)).toHaveLength(1);
  });

  it('round-trips value-led copy, included infills and discounts for a named pergola', () => {
    const raw = [
      'Courtyard cover',
      '- Included: Custom-designed pergola, supplied and installed',
      '- Roof form: Pitched',
      '- Overall size: 6m x 3m',
      '- Roof covering: Acrylic roofing — admits natural light while adding overhead shelter',
      '- Frame finish: Black',
      '- Roof pitch: 5°',
      '- Support posts: 2',
      '- Connection to home: Soffit brackets',
      '- Post foundations and fixings: Deck brackets',
      '',
      'Included infills',
      '- Side infill: 2.4m × 1.2m',
      '- Quote discount: 10% included in this item',
    ].join('\n');

    const parsed = parsePergolaStructuredDescription(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.included).toBe('Custom-designed pergola, supplied and installed');
    expect(parsed?.modules[0]?.includedInfills).toEqual(['Side infill: 2.4m × 1.2m']);
    expect(parsed?.quoteDiscount).toBe('10% included in this item');
    expect(parsed ? buildPergolaStructuredDescription(parsed) : null).toBe(raw);
  });

  it('preserves shared values when clearing a shared field', () => {
    const parsed = parsePergolaStructuredDescription([
      'Pergola 1',
      '- Configuration: Gable + Pitched modules',
      '',
      'Shared specification',
      '- Roof: Acrylic',
      '',
      'Module 1: Gable',
      '- Size: 4.83m x 4.68m',
      '',
      'Module 2: Pitched',
      '- Size: 4.93m x 2.65m',
    ].join('\n'));

    expect(parsed).not.toBeNull();
    const updated = updateSharedPergolaField(parsed!, 'roof', '');

    expect(updated.shared.roof).toBe('');
    expect(updated.modules[0]?.roof).toBe('Acrylic');
    expect(updated.modules[1]?.roof).toBe('Acrylic');
  });
});
