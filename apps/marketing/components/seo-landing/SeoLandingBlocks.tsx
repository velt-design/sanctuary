import Image from 'next/image';
import Link from 'next/link';
import {
  Button,
  Container,
  Eyebrow,
  Heading,
  ProcessSteps,
  Section,
  Text,
} from '@/components/marketing-foundation';
import { projects } from '@/data/projects';
import SeoLandingMobileDisclosure from './SeoLandingMobileDisclosure';
import type { SeoLandingBlock, SeoLandingDisclosureGroup } from './types';

function sectionTone(tone: SeoLandingBlock['tone']) {
  return tone === 'canvas' || !tone ? undefined : tone;
}

function renderSeoLandingBlock(
  block: SeoLandingBlock,
  eagerProjectImages = false,
) {
    if (block.kind === 'split-intro') {
      return (
        <Section id={block.id} tone={sectionTone(block.tone)} className="acrylic-section acrylic-section--opening" aria-labelledby={`${block.id}-title`} key={block.id}>
          <Container width="wide" className="acrylic-intro-grid">
            <div><Eyebrow className="acrylic-eyebrow">{block.eyebrow}</Eyebrow><Heading id={`${block.id}-title`}>{block.title}</Heading></div>
            <div className="acrylic-prose acrylic-prose--large">{block.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
          </Container>
        </Section>
      );
    }

    if (block.kind === 'numbered-cards') {
      return (
        <Section id={block.id} tone={sectionTone(block.tone)} className="acrylic-section" aria-labelledby={`${block.id}-title`} key={block.id}>
          <Container width="wide">
            <header className="acrylic-section__header acrylic-section__header--wide">
              <Eyebrow className="acrylic-eyebrow">{block.eyebrow}</Eyebrow><Heading id={`${block.id}-title`}>{block.title}</Heading>
              {block.intro ? <Text size="large">{block.intro}</Text> : null}
            </header>
            <div className="acrylic-benefit-grid">
              {block.items.map((item, index) => <article className="acrylic-benefit" key={item.title}><span className="acrylic-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}
            </div>
          </Container>
        </Section>
      );
    }

    if (block.kind === 'editorial-image') {
      return (
        <Section id={block.id} tone={sectionTone(block.tone)} className="acrylic-section" aria-labelledby={`${block.id}-title`} key={block.id}>
          <Container width="wide" className="acrylic-editorial-grid">
            <div className="acrylic-editorial-media"><Image src={block.image.src} alt={block.image.alt} fill sizes="(max-width: 900px) 100vw, 48vw" style={{ objectPosition: block.image.objectPosition }} /></div>
            <div>
              <Eyebrow className="acrylic-eyebrow">{block.eyebrow}</Eyebrow><Heading id={`${block.id}-title`}>{block.title}</Heading>
              {block.lead || block.intro ? <p className="acrylic-lead">{block.lead ?? block.intro}</p> : null}
              <div className="acrylic-mini-grid">{block.items.map((item) => <article key={item.title}><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
            </div>
          </Container>
        </Section>
      );
    }

    if (block.kind === 'comparison') {
      return (
        <Section id={block.id} tone={sectionTone(block.tone)} className="acrylic-section seo-landing__comparison" aria-labelledby={`${block.id}-title`} key={block.id}>
          <Container width="wide">
            <header className="acrylic-section__header acrylic-section__header--wide">
              <Eyebrow className="acrylic-eyebrow">{block.eyebrow}</Eyebrow><Heading id={`${block.id}-title`}>{block.title}</Heading>
              {block.intro ? <Text size="large">{block.intro}</Text> : null}
            </header>
            <div className="seo-landing__comparison-matrix" role="table" aria-label={block.title}>
              <div className="seo-landing__comparison-head" role="row">
                <span aria-hidden="true" />
                {block.options.map((option) => <div role="columnheader" key={option.title}><h3>{option.title}</h3><p>{option.text}</p></div>)}
              </div>
              {block.rows.map((row) => (
                <div className="seo-landing__comparison-row" role="row" key={row.label}>
                  <h3 role="rowheader">{row.label}</h3>
                  {row.values.map((value, index) => <div role="cell" key={`${row.label}-${block.options[index].title}`}><span>{block.options[index].title}</span><p>{value}</p></div>)}
                </div>
              ))}
            </div>
            {block.note ? <aside className="seo-landing__comparison-note">{block.note}</aside> : null}
          </Container>
        </Section>
      );
    }

    if (block.kind === 'projects') {
      const projectItems = block.items.flatMap((proof) => {
        const project = projects.find((candidate) => candidate.slug === proof.slug);
        return project ? [{ ...proof, project, image: proof.image ?? project.heroImage }] : [];
      });
      return (
        <Section id={block.id} tone={sectionTone(block.tone)} className="acrylic-section" aria-labelledby={`${block.id}-title`} key={block.id}>
          <Container width="wide">
            <header className="acrylic-section__header acrylic-section__header--wide"><Eyebrow className="acrylic-eyebrow">{block.eyebrow}</Eyebrow><Heading id={`${block.id}-title`}>{block.title}</Heading>{block.intro ? <p>{block.intro}</p> : null}</header>
            <div className="acrylic-project-grid">{projectItems.map(({ project, label, role, summary, facts, image }) => (
              <Link href={`/projects/${project.slug}`} className="acrylic-project-card" key={project.slug}>
                <div className="acrylic-project-card__media"><Image src={image.src} alt={image.alt} fill loading={eagerProjectImages ? 'eager' : undefined} sizes="(max-width: 720px) 100vw, 50vw" style={{ objectPosition: image.objectPosition }} /></div>
                <div className="acrylic-project-card__body"><Eyebrow className="acrylic-eyebrow">{label}</Eyebrow><h3>{project.title}</h3><p className="acrylic-project-card__location">{project.location} / {project.roof}</p>{role ? <p className="seo-landing__project-role">{role}</p> : null}<p>{summary}</p>{facts?.length ? <ul className="seo-landing__project-facts">{facts.map((fact) => <li key={fact}>{fact}</li>)}</ul> : null}<span>Review the completed project</span></div>
              </Link>
            ))}</div>
            <div className="acrylic-section__action"><Button href="/projects" variant="outline">Browse completed projects</Button></div>
          </Container>
        </Section>
      );
    }

    if (block.kind === 'link-cards') {
      return (
        <Section id={block.id} tone={sectionTone(block.tone)} className="acrylic-section" aria-labelledby={`${block.id}-title`} key={block.id}>
          <Container width="wide"><header className="acrylic-section__header acrylic-section__header--wide"><Eyebrow className="acrylic-eyebrow">{block.eyebrow}</Eyebrow><Heading id={`${block.id}-title`}>{block.title}</Heading>{block.intro ? <p>{block.intro}</p> : null}</header>
            <div className="acrylic-form-grid">{block.items.map((item) => <Link className="acrylic-form-card" href={item.href} key={item.title}><h3>{item.title}</h3><p>{item.text}</p><span>{item.linkLabel}</span></Link>)}</div>
          </Container>
        </Section>
      );
    }

    if (block.kind === 'decision-cards') {
      return (
        <Section id={block.id} tone={sectionTone(block.tone)} className="acrylic-section seo-landing__decisions" aria-labelledby={`${block.id}-title`} key={block.id}>
          <Container width="wide"><header className="acrylic-section__header acrylic-section__header--wide"><Eyebrow className="acrylic-eyebrow">{block.eyebrow}</Eyebrow><Heading id={`${block.id}-title`}>{block.title}</Heading>{block.intro ? <Text size="large">{block.intro}</Text> : null}</header>
            <div className="seo-landing__decision-grid">{block.items.map((item) => <article className="seo-landing__decision-card" key={item.title}><h3>{item.title}</h3><dl><div><dt>What it resolves</dt><dd>{item.outcome}</dd></div><div><dt>What to check</dt><dd>{item.consider}</dd></div></dl>{item.href ? <Link href={item.href}>{item.linkLabel ?? 'Review this option'}</Link> : null}</article>)}</div>
          </Container>
        </Section>
      );
    }

    if (block.kind === 'dark-cards') {
      return (
        <Section id={block.id} tone="inverse" className="acrylic-section acrylic-section--dark" aria-labelledby={`${block.id}-title`} key={block.id}>
          <Container width="wide"><header className="acrylic-section__header acrylic-section__header--wide"><Eyebrow className="acrylic-eyebrow">{block.eyebrow}</Eyebrow><Heading id={`${block.id}-title`}>{block.title}</Heading>{block.intro ? <p>{block.intro}</p> : null}</header>
            <div className="acrylic-weather-grid acrylic-weather-grid--three">{block.items.map((item) => <article key={item.title}><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
            {block.links?.length ? <nav className="acrylic-inline-links" aria-label={`${block.title} related pages`}>{block.links.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}</nav> : null}
          </Container>
        </Section>
      );
    }

    if (block.kind === 'process') {
      return (
        <Section id={block.id} tone={sectionTone(block.tone) ?? 'warm'} className="acrylic-section acrylic-section--process" aria-labelledby={`${block.id}-title`} key={block.id}>
          <Container width="wide"><header className="acrylic-section__header acrylic-section__header--wide"><Eyebrow className="acrylic-eyebrow">{block.eyebrow}</Eyebrow><Heading id={`${block.id}-title`}>{block.title}</Heading>{block.intro ? <p>{block.intro}</p> : null}</header><ProcessSteps items={block.items.map(({ title, copy }) => ({ title, copy }))} /></Container>
        </Section>
      );
    }

    if (block.kind === 'scope') {
      return (
        <Section id={block.id} tone={sectionTone(block.tone)} className="acrylic-section" aria-labelledby={`${block.id}-title`} key={block.id}>
          <Container width="wide"><div className="acrylic-intro-grid"><div><Eyebrow className="acrylic-eyebrow">{block.eyebrow}</Eyebrow><Heading id={`${block.id}-title`}>{block.title}</Heading><p className="acrylic-lead">{block.lead}</p>{block.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div><div className="acrylic-price-grid">{block.factors.map(([title, text]) => <article key={title}><h3>{title}</h3><p>{text}</p></article>)}</div></div><aside className="acrylic-quote-note"><p>{block.checklistLead}</p><ul className="acrylic-two-column-list">{block.checklist.map((item) => <li key={item}>{item}</li>)}</ul></aside></Container>
        </Section>
      );
    }

    return (
      <Section id={block.id} tone={sectionTone(block.tone) ?? 'elevated'} className="acrylic-section acrylic-section--faq" aria-labelledby={`${block.id}-title`} key={block.id}>
        <Container width="wide"><header className="acrylic-section__header acrylic-section__header--wide"><Eyebrow className="acrylic-eyebrow">{block.eyebrow}</Eyebrow><Heading id={`${block.id}-title`}>{block.title}</Heading>{block.intro ? <p>{block.intro}</p> : null}</header><div className="acrylic-faq-list">{block.items.map((item, index) => <details key={item.question}><summary><span>{String(index + 1).padStart(2, '0')}</span><h3>{item.question}</h3><i aria-hidden="true" /></summary><div>{item.answer.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></details>)}</div></Container>
      </Section>
    );
}

function indexDisclosureGroups(
  blocks: readonly SeoLandingBlock[],
  groups: readonly SeoLandingDisclosureGroup[],
) {
  const groupsByStartIndex = new Map<number, SeoLandingDisclosureGroup>();
  const groupIds = new Set<string>();
  const claimedBlockIds = new Set<string>();

  groups.forEach((group) => {
    if (group.blockIds.length === 0) {
      throw new Error(`SEO landing disclosure group "${group.id}" must include at least one block.`);
    }

    const startIndex = blocks.findIndex((block) => block.id === group.blockIds[0]);
    const actualBlockIds = blocks
      .slice(startIndex, startIndex + group.blockIds.length)
      .map((block) => block.id);
    const isContiguous = startIndex >= 0
      && actualBlockIds.length === group.blockIds.length
      && actualBlockIds.every((blockId, index) => blockId === group.blockIds[index]);
    const overlapsAnotherGroup = group.blockIds.some((blockId) => claimedBlockIds.has(blockId));

    if (
      !isContiguous
      || groupIds.has(group.id)
      || overlapsAnotherGroup
      || groupsByStartIndex.has(startIndex)
    ) {
      throw new Error(
        `SEO landing disclosure group "${group.id}" must reference unique, contiguous blocks in DOM order.`,
      );
    }

    groupIds.add(group.id);
    group.blockIds.forEach((blockId) => claimedBlockIds.add(blockId));
    groupsByStartIndex.set(startIndex, group);
  });

  return groupsByStartIndex;
}

type SeoLandingBlocksProps = {
  blocks: readonly SeoLandingBlock[];
  disclosureGroups?: readonly SeoLandingDisclosureGroup[];
  eagerProjectImages?: boolean;
};

export default function SeoLandingBlocks({
  blocks,
  disclosureGroups = [],
  eagerProjectImages = false,
}: SeoLandingBlocksProps) {
  const groupsByStartIndex = indexDisclosureGroups(blocks, disclosureGroups);
  const output = [];

  for (let index = 0; index < blocks.length;) {
    const group = groupsByStartIndex.get(index);

    if (group) {
      const groupedBlocks = blocks.slice(index, index + group.blockIds.length);
      output.push(
        <SeoLandingMobileDisclosure
          groupId={group.id}
          key={group.id}
          summary={group.summary}
        >
          {groupedBlocks.map((block) => renderSeoLandingBlock(block, eagerProjectImages))}
        </SeoLandingMobileDisclosure>,
      );
      index += group.blockIds.length;
      continue;
    }

    output.push(renderSeoLandingBlock(blocks[index], eagerProjectImages));
    index += 1;
  }

  return output;
}
