import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CardGrid, EditorialCard } from './Cards';
import {
  ActionGroup,
  Button,
  Container,
  FactList,
  Figure,
  MarketingPage,
  Rule,
  SectionHeader,
  Text,
  TextLink,
  type ContainerWidth,
} from './Primitives';

const readingWidth: ContainerWidth = 'reading';

function render(markup: React.ReactNode) {
  document.body.innerHTML = renderToStaticMarkup(markup);
}

describe('marketing foundation responsive primitives', () => {
  it('exposes one semantic page, section-heading, action and fact-list contract', () => {
    render(
      <MarketingPage>
        <SectionHeader eyebrow="Project context" heading="A section heading" headingId="section-heading">
          <Text>Supporting copy.</Text>
        </SectionHeader>
        <ActionGroup aria-label="Project actions">
          <Button href="/contact">Primary</Button>
          <Button href="/projects" variant="secondary">Secondary</Button>
          <Button href="/legacy" variant="outline">Legacy outline</Button>
          <TextLink href="/guides">Supporting link</TextLink>
        </ActionGroup>
        <FactList
          aria-label="Project facts"
          items={[
            { label: 'Footprint', value: '5 × 6 m' },
            { label: 'Roof form', value: 'Gable' },
          ]}
        />
        <Container width={readingWidth}><Rule /></Container>
      </MarketingPage>,
    );

    expect(document.querySelectorAll('main[data-marketing-foundation-page]')).toHaveLength(1);
    expect(document.querySelector('[data-section-header] h2')?.id).toBe('section-heading');
    expect(document.querySelector('[data-action-group]')?.getAttribute('role')).toBe('group');
    expect(document.querySelector('[data-action-variant="primary"]')?.textContent).toBe('Primary');
    expect(document.querySelectorAll('[data-action-variant="secondary"]')).toHaveLength(2);
    expect(document.querySelector('[data-action-variant="text"]')?.textContent).toBe('Supporting link');
    expect(document.querySelector('[data-fact-list="columns"]')?.tagName).toBe('DL');
    expect(document.querySelectorAll('[data-fact-list] dt')).toHaveLength(2);
    expect(document.querySelectorAll('[data-fact-list] dd')).toHaveLength(2);
    expect(document.querySelectorAll('hr')).toHaveLength(1);
  });

  it('renders responsive media with explicit ratio and focal-point data from one image', () => {
    render(
      <Figure
        image="/images/project-riverhead-gable-03.png"
        alt="Timber-lined gable detail"
        ratio="landscape"
        mobileRatio="standard"
        objectPosition="50% 50%"
        mobileObjectPosition="42% 50%"
        caption="Responsive media"
      />,
    );

    const figure = document.querySelector('figure[data-responsive-media]');
    const media = figure?.firstElementChild as HTMLElement | null;

    expect(figure?.getAttribute('data-mobile-ratio')).toBe('standard');
    expect(figure?.querySelectorAll('img')).toHaveLength(1);
    expect(figure?.querySelector('img')?.getAttribute('alt')).toBe('Timber-lined gable detail');
    expect(media?.style.getPropertyValue('--figure-object-position')).toBe('50% 50%');
    expect(media?.style.getPropertyValue('--figure-mobile-object-position')).toBe('42% 50%');
  });

  it('renders all card densities as single interactive elements in a reusable grid', () => {
    render(
      <CardGrid columns={3}>
        {(['image-led', 'balanced', 'compact'] as const).map((variant) => (
          <EditorialCard
            key={variant}
            href={`/projects/${variant}`}
            variant={variant}
            eyebrow="Project"
            title={`${variant} card`}
            copy="One concise card description."
            actionLabel="View project"
            media={{
              image: '/images/project-riverhead-gable-01.jpg',
              alt: '',
              mobileRatio: 'standard',
            }}
          />
        ))}
      </CardGrid>,
    );

    expect(document.querySelector('[data-card-grid="3"]')).not.toBeNull();
    expect(document.querySelectorAll('a[data-editorial-card]')).toHaveLength(3);
    expect(document.querySelectorAll('[data-editorial-card] a')).toHaveLength(0);
    expect(
      [...document.querySelectorAll('[data-editorial-card]')].map((card) => (
        card.getAttribute('data-editorial-card')
      )),
    ).toEqual(['image-led', 'balanced', 'compact']);
  });
});
