import type { ProjectFinderHomepageMedia } from './projectFinderMedia';
import CinematicHero from './CinematicHero';

// The approved editorial page keeps the original, art-directed homepage opening.
export default function EditorialHomeHero({
  media,
}: {
  media: ProjectFinderHomepageMedia['hero'];
}) {
  return <CinematicHero media={media} />;
}
