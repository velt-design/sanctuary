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

    expect(raw).toContain('Shared specification');
    expect(raw).toContain('Module 1: Gable');
    expect(raw).toContain('Module 2: Pitched');
    expect(raw.match(/Roof: Acrylic/g)).toHaveLength(1);
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
