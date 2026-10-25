'use client';

import {lazy,Suspense,type ComponentProps} from 'react';
import type ContactsIndexClientType from './ContactsIndexClient';

const ContactsIndexClient=lazy(()=>import('./ContactsIndexClient'));

/** Private code/read owner only. The actual public frame is already mounted. */
export default function GuardedContactsIndexClient(props:ComponentProps<typeof ContactsIndexClientType>){
 return <Suspense fallback={null}><ContactsIndexClient {...props}/></Suspense>;
}
