import type { Metadata } from 'next';
import UIFoundationCatalogue from './UIFoundationCatalogue';

export const metadata: Metadata = {
  title: 'UI Foundation | Sanctuary Staff Portal',
};

export default function UIFoundationPage() {
  return <UIFoundationCatalogue />;
}
