'use client';
import { useState, type ReactNode } from 'react';
import { Drawer } from '@/components/ui/drawer/Drawer';
import { Button } from '@/components/ui/foundation/FoundationControls';
import { CircleHelp } from 'lucide-react';
import styles from './HubCharts.module.css';

export default function ReportDetail({title,children,label='About this chart'}:{title:string;children:ReactNode;label?:string}) {
  const [open,setOpen]=useState(false);
  return <><Button variant="quiet" className={styles.help} onClick={()=>setOpen(true)}><CircleHelp size={15} aria-hidden="true"/>{label}</Button>
    <Drawer title={title} open={open} onClose={()=>setOpen(false)}><div className={styles.explanation}>{children}</div></Drawer></>;
}
