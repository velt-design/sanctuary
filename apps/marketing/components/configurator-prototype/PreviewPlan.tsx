'use client';
import { PreviewPlan } from '@sp/configurator/react';
import {useRail} from './RailProvider';
import styles from './prototype.module.css';
export default function MarketingPlan(props: React.ComponentProps<typeof PreviewPlan>){return <PreviewPlan {...props} section={useRail().section} className={styles.plan}/>;}
