import { describe, expect, it } from 'vitest';
import { parseProjectCreateRequest } from './createProjectContract';

const projectId = 'proj_11111111-1111-4111-8111-111111111111';
const contactId = 'ct_22222222-2222-4222-8222-222222222222';

describe('parseProjectCreateRequest', () => {
  it('normalizes a valid new-contact command', () => {
    expect(parseProjectCreateRequest({
      projectId,
      projectName: '  Courtyard roof  ',
      quoteRef: ' Q-18 ',
      region: ' North ',
      siteAddress: ' 12 Beach Road ',
      contact: {
        kind: 'new',
        contactId,
        displayName: ' Alex Mason ',
        email: ' alex@example.com ',
        phone: ' 021 ',
        allowDuplicate: true,
      },
    })).toEqual({
      ok: true,
      value: {
        projectId,
        projectName: 'Courtyard roof',
        quoteRef: 'Q-18',
        region: 'North',
        siteAddress: '12 Beach Road',
        contact: {
          kind: 'new',
          contactId,
          displayName: 'Alex Mason',
          email: 'alex@example.com',
          phone: '021',
          allowDuplicate: true,
        },
      },
    });
  });

  it.each([
    [{ projectId: 'proj_bad', projectName: 'Roof', contact: { kind: 'existing', contactId } }, 'Project command ID is invalid'],
    [{ projectId, projectName: 'Roof', contact: { kind: 'existing', contactId: 'ct_bad' } }, 'Contact command ID is invalid'],
    [{ projectId, projectName: '', contact: { kind: 'existing', contactId } }, 'Project name is required'],
    [{
      projectId,
      projectName: 'Roof',
      contact: { kind: 'new', contactId, displayName: 'Alex', email: 'alex.example.com' },
    }, 'Contact email is invalid'],
  ])('rejects invalid commands before any write', (input, error) => {
    expect(parseProjectCreateRequest(input)).toEqual({ ok: false, error });
  });
});
