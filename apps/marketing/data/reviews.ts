// data/reviews.ts
// Google review content + live-rating config.
//
// The aggregate numbers (average rating, review count) are fetched live via
// lib/googleReviews.ts. Review quotes are hand-curated here (added in a later
// pass) rather than synced from Google, so we keep editorial control of which
// quotes appear.

export type GoogleReview = {
  author: string;
  location?: string;
  quote: string;
  date?: string; // ISO date, for ordering / recency display
};

// Public Google Business Profile identity. None of this is secret.
export const GOOGLE_PLACE = {
  placeId: 'ChIJmbqE4PJ3yIoRS_OzDzK-EPI',
  // Public "all reviews" link used as the badge click target.
  reviewsUrl: 'https://search.google.com/local/reviews?placeid=ChIJmbqE4PJ3yIoRS_OzDzK-EPI',
  // Last-known-good baseline. Used as the fallback when the API key is absent
  // (local/CI) or a request fails, and as a monotonic floor on the count so a
  // transient blip can't make the displayed number visibly drop.
  floorRating: 5.0,
  floorCount: 61,
} as const;

// Hand-curated five-star Google reviews for the testimonial section.
// Verbatim text (apostrophes normalised to ASCII). Add `location` suburbs when
// available for extra credibility.
export const featuredReviews: GoogleReview[] = [
  {
    author: 'Scott Fitchett',
    quote:
      "Had a Sanctuary Pergola installed at Waiheke, great guys doing the job and the pergola looks amazing, very good quality materials and design. Very happy I got a bespoke design and not a mass production product.",
  },
  {
    author: 'Stuart Jones',
    quote:
      "What a great product and experience. We should have done this years ago. It has extended our living space and created an awesome outdoor entertainment area. Great people to work with and an excellent installer.",
  },
  {
    author: 'Rob Ebert',
    quote:
      "I am loving my new pergola! It truly enhances the outdoor area, providing a dry and light-filled space to enjoy.",
  },
  {
    author: 'Denys Coote',
    quote:
      "From start to finish it has been a pleasure to deal with the team at Sanctuary Pergolas. The end result is a great space we can use year round. A great result for us and a product which we highly recommend.",
  },
  {
    author: 'Kate Walker',
    quote:
      "Fabulous quality product, we are very pleased with the finished result. A big shout out to the installation crew who were very efficient and also extremely tidy. A great experience all round.",
  },
  {
    author: 'Rod Clough',
    quote:
      "Excellent communication and a professional approach with attention to detail. We have had 3 pergolas installed and are very happy with the outcome. Definitely recommended.",
  },
  {
    author: 'Helen Wanstall',
    quote:
      "Really happy with our new Pergola. The design and height makes it feel spacious and light. I have a whole new room to the house.",
  },
  {
    author: 'David Geary',
    quote:
      "I was more than impressed with our new pergola. It exceeded my expectations. Alistair was professional and efficient, and his work was precise. He took care to finish the job perfectly. We are very happy customers!",
  },
  {
    author: 'Pierre and Tracy',
    quote:
      "Delighted with an awesome outcome - top quality, looks great and value for money. Top installer made the whole process easy.",
  },
  {
    author: 'Lizette Meikle',
    quote:
      "We love our Sanctuary Pergola! It's like having an extra room. Great for when its raining and we can leave the French doors open and still have fresh air.",
  },
];
