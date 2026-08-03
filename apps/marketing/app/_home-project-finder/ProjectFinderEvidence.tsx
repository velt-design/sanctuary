import Image from 'next/image';
import Link from 'next/link';
import { Container } from '../../components/marketing-foundation/Primitives';
import { buildProjectFinderProjectHref } from '../../lib/projectFinderContinuation';
import type {
  CommercialProfessionalPath,
  ProjectFinderHomeDirection,
  ProjectPriority,
  ResidentialProjectFinderHomeDirection,
} from '../../lib/projectFinderContract';
import type { ProjectEvidence } from './projectFinderMedia';
import styles from './projectFinderHomepage.module.css';

type ProjectFinderEvidenceProps = {
  direction: ProjectFinderHomeDirection;
  priorities: readonly ProjectPriority[];
  professionalPath?: CommercialProfessionalPath;
  projects: readonly ProjectEvidence[];
};

function isResidentialDirection(
  direction: ProjectFinderHomeDirection,
): direction is ResidentialProjectFinderHomeDirection {
  return direction === 'cover' || direction === 'bespoke';
}

export default function ProjectFinderEvidence({
  direction,
  priorities,
  professionalPath,
  projects,
}: ProjectFinderEvidenceProps) {
  return (
    <section
      className={styles.evidence}
      aria-labelledby="project-evidence-heading"
    >
      <Container width="wide">
        <header className={styles.evidenceHeader}>
          <div>
            <p className={styles.eyebrow}>Relevant built work</p>
            <h2 id="project-evidence-heading">Built work in this direction.</h2>
          </div>
          <p>
            Explore how comparable briefs, constraints and architectural
            details were resolved before deciding what belongs in your project.
          </p>
        </header>
        <div className={styles.projectGrid}>
          {projects.map((project) => {
            const projectHref = isResidentialDirection(direction)
              ? buildProjectFinderProjectHref(
                direction,
                priorities,
                project.projectSlug,
              )
              : `/projects/${project.projectSlug}`;
            return (
              <article
                className={styles.projectCard}
                data-project-evidence={project.projectSlug}
                key={project.projectSlug}
              >
                <div className={styles.projectImage}>
                  <Image
                    alt={project.alt}
                    fill
                    loading="lazy"
                    sizes="(max-width: 760px) calc(100vw - 2.5rem), 46vw"
                    src={project.src}
                    style={{ objectPosition: project.objectPosition }}
                  />
                </div>
                <div className={styles.projectCardContent}>
                  <p className={styles.projectLocation}>{project.location}</p>
                  <h3>{project.projectTitle}</h3>
                  <p>{project.reason}</p>
                  <div className={styles.projectActions}>
                    <Link
                      data-project-finder-event="project_view_click"
                      data-project-direction={direction}
                      data-project-priorities={priorities.join(',')}
                      data-professional-path={professionalPath}
                      data-selected-project={project.projectSlug}
                      data-source-component="project_card"
                      href={projectHref}
                    >
                      View project
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
