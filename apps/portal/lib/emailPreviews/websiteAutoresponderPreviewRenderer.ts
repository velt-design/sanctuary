import 'server-only';

import {
  getWebsiteAutoresponderPreviewFixture,
  renderWebsiteAutoresponderAlternative,
  WEBSITE_AUTORESPONDER_PREVIEW_LAYOUTS,
} from '@/lib/sharedEmails';
import type {
  WebsiteAutoresponderPreviewVariant,
} from '@/lib/sharedEmails';

export async function renderWebsiteAutoresponderPreviewPayload(
  variant: WebsiteAutoresponderPreviewVariant,
) {
  const fixture = getWebsiteAutoresponderPreviewFixture(variant);
  const renderedLayouts = await Promise.all(
    WEBSITE_AUTORESPONDER_PREVIEW_LAYOUTS.map(async (layout) => {
      const [light, dark] = await Promise.all([
        renderWebsiteAutoresponderAlternative(
          fixture.templateId,
          fixture.variables as unknown as Record<string, unknown>,
          layout.id,
          { previewTheme: 'light' },
        ),
        renderWebsiteAutoresponderAlternative(
          fixture.templateId,
          fixture.variables as unknown as Record<string, unknown>,
          layout.id,
          { previewTheme: 'dark' },
        ),
      ]);
      return {
        id: layout.id,
        name: layout.name,
        description: layout.description,
        bestFor: layout.bestFor,
        subject: light.subject,
        sendSubject: light.sendSubject,
        preheader: light.preheader,
        hero: light.hero,
        htmlLight: light.html,
        htmlDark: dark.html,
        text: light.text,
      };
    }),
  );
  const image = renderedLayouts[0]?.hero;
  if (!image) {
    throw new Error('Email preview image metadata is unavailable.');
  }

  return {
    variant,
    label: fixture.label,
    layouts: renderedLayouts.map(({ hero: _hero, ...layout }) => layout),
    image,
  };
}
