import type {Metadata} from 'next';
import DesignEnquiry from './DesignEnquiry';
export const metadata:Metadata={title:'Your design enquiry | Sanctuary',robots:{index:false,follow:false}};
export default function Page(){return <DesignEnquiry/>;}
