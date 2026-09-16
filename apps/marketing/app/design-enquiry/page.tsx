import type {Metadata} from 'next';
import DesignEnquiry from './DesignEnquiry';
import {parseEnquiryContext,type EnquiryContextSearchParams} from '../../lib/enquiryContext';
export const metadata:Metadata={title:'Your design enquiry | Sanctuary',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<EnquiryContextSearchParams>}){return <DesignEnquiry initialContext={parseEnquiryContext(await searchParams)}/>;}
