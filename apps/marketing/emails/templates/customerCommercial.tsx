import * as React from 'react';
import type { ResidentialOrCommercial } from '../types';
import { CustomerEstimateEmail } from './CustomerEstimateEmail';

export function CustomerCommercialEmail(props: ResidentialOrCommercial & { callWindowText: string }) {
  return <CustomerEstimateEmail {...props} enquiryType="commercial" />;
}
