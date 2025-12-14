export type ProductImagePair = {
  primary: string;
  hover: string;
};

export function imagePairFor(href: string): ProductImagePair {
  const slug = href.split('/').pop() || '';
  switch (slug) {
    case 'pitched':
      return {
        primary: '/images/Pitched-111.jpg',
        hover: '/images/product-pitched-01.jpg',
      };
    case 'gable':
      return {
        primary: '/images/Gable-111.jpg',
        hover: '/images/product-gable-02.jpg',
      };
    case 'hip':
      return {
        primary: '/images/Hip-111.jpg',
        hover: '/images/product-hip-02.jpg',
      };
    case 'box-perimeter':
      return {
        primary: '/images/Box-perimeter-111.jpg',
        hover: '/images/project-waiheke-02.jpg',
      };
    case 'slat-screens':
      return {
        primary: '/images/product-slat-01.JPG',
        hover: '/images/product-slat-02.JPG',
      };
    case 'acrylic-infill-panels':
      return {
        primary: '/images/product-infill-01.jpg',
        hover: '/images/product-infill-02.JPG',
      };
    case 'drop-down-blinds':
      return {
        primary: '/images/product-blinds-01.jpg',
        hover: '/images/product-blinds-02.jpg',
      };
    case 'downlights':
      return {
        primary: '/images/product-downlight-01.jpg',
        hover: '/images/product-downlight-02.jpg',
      };
    case 'led-strip-lighting':
      return {
        primary: '/images/hero-2.jpg',
        hover: '/images/product-timber.jpg',
      };
    case 'patio-heaters':
      return {
        primary: '/images/project-goodhome-01.jpg',
        hover: '/images/project-goodhome-02.jpg',
      };
    default:
      return {
        primary: '/images/hero-1.jpg',
        hover: '/images/hero-2.jpg',
      };
  }
}

