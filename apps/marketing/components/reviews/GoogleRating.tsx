import { Suspense, type ReactNode } from 'react';
import { getGoogleRating } from '../../lib/googleReviews';

type Rating = Awaited<ReturnType<typeof getGoogleRating>>;
type Props = { fallback: ReactNode; children: (rating: Rating) => ReactNode };

async function ResolvedRating({ children }: Pick<Props, 'children'>) {
  return children(await getGoogleRating());
}

/** Below-fold review data must not hold the page's navigation or hero hostage. */
export default function GoogleRating({ fallback, children }: Props) {
  return <Suspense fallback={fallback}><ResolvedRating>{children}</ResolvedRating></Suspense>;
}
