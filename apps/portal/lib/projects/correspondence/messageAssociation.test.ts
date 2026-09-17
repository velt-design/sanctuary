import { describe, expect, it } from 'vitest';
import { associateProjectMessages } from './messageAssociation';
const root = '<sent@example.test>';
const anchor = { projectId: 'project-one', internetMessageId: root };
const mail = (id: string, inReplyTo: string[] = [], references: string[] = []) => ({ id,
  lineage: { internetMessageId: `<${id}@example.test>`, inReplyTo, references } });

describe('project message association', () => {
  it('does not link a reply with an unknown competing project ancestor', () => {
    expect(associateProjectMessages('project-one', [mail('mixed', [root], ['<other-project@example.test>'])], [anchor]).get('mixed')).toEqual({ state: 'unconfirmed' });
  });
  it('keeps direct sends but suppresses reply links when coverage is incomplete', () => {
    const result = associateProjectMessages('project-one', [mail('sent'), mail('reply', [root])], [anchor], false);
    expect(result.get('sent')).toEqual({ state: 'linked', basis: 'sent_message' });
    expect(result.get('reply')).toEqual({ state: 'unconfirmed' });
  });
  it('inspects ancestry on verified sends before linking descendants', () => {
    const result = associateProjectMessages('project-one', [mail('sent', ['<unknown@example.test>']), mail('reply', [root])], [anchor]);
    expect(result.get('sent')).toEqual({ state: 'linked', basis: 'sent_message' });
    expect(result.get('reply')).toEqual({ state: 'unconfirmed' });
  });
  it('does not turn an anchored cycle into a resolved reply chain', () => {
    const result = associateProjectMessages('project-one', [mail('sent', ['<reply@example.test>']), mail('reply', [root])], [anchor]);
    expect(result.get('reply')).toEqual({ state: 'unconfirmed' });
  });
  it('links a verified send and its reply chain independent of input order', () => {
    const result = associateProjectMessages('project-one', [mail('second', ['<reply@example.test>']), mail('reply', [root]), mail('sent')], [anchor]);
    expect(result.get('sent')).toEqual({ state: 'linked', basis: 'sent_message' });
    expect(result.get('reply')).toEqual({ state: 'linked', basis: 'reply_chain' });
    expect(result.get('second')).toEqual({ state: 'linked', basis: 'reply_chain' });
  });
  it('keeps customer-wide mail and unanchored cycles unconfirmed', () => {
    const result = associateProjectMessages('project-one', [{ id: 'no-headers' }, mail('a', ['<b@example.test>']), mail('b', ['<a@example.test>'])], [anchor]);
    expect([...result.values()]).toEqual(Array(3).fill({ state: 'unconfirmed' }));
  });
  it('detects mixed-project threads and propagates conflicts to later replies', () => {
    const result = associateProjectMessages('project-one', [mail('later', ['<mixed@example.test>']), mail('mixed', [root], ['<other@example.test>'])],
      [anchor, { projectId: 'project-two', internetMessageId: '<other@example.test>' }]);
    expect([...result.values()]).toEqual(Array(2).fill({ state: 'conflicting' }));
  });
  it('does not treat a different project or different-case ID as this project', () => {
    const result = associateProjectMessages('project-one', [mail('foreign', ['<other@example.test>']), mail('case', ['<Sent@example.test>'])],
      [anchor, { projectId: 'project-two', internetMessageId: '<other@example.test>' }]);
    expect([...result.values()]).toEqual(Array(2).fill({ state: 'unconfirmed' }));
  });
  it('detects an anchor identity attached to two projects', () => {
    expect(associateProjectMessages('project-one', [mail('sent')], [anchor, { ...anchor, projectId: 'project-two' }]).get('sent')).toEqual({ state: 'conflicting' });
  });
  it('refuses malformed or unbounded evidence', () => {
    expect(() => associateProjectMessages('project-one', [mail('reply', ['not-an-id'])], [anchor])).toThrow();
    expect(() => associateProjectMessages('project-one', Array.from({ length: 26 }, (_, n) => mail(String(n))), [anchor])).toThrow();
    expect(() => associateProjectMessages('project-one', [mail('same'), mail('same')], [anchor])).toThrow();
  });
});
