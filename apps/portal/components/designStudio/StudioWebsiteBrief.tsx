import type {StudioWebsiteBrief as Brief} from '@/lib/designStudio/websiteBrief';
import styles from './StudioWebsiteImport.module.css';

export default function StudioWebsiteBrief({brief,compact=false}:{brief:Brief;compact?:boolean}) {
  return <details className={`${styles.brief} ${compact?styles.compact:''}`} open={!compact}>
    <summary>Original website design</summary>
    <p>{brief.summary}</p>
    <a href={brief.reopenUrl} target="_blank" rel="noopener noreferrer">Open original website design ↗</a>
    <details className={styles.selections}><summary>All submitted choices</summary>
      <dl>{brief.selections.map((selection,index)=><div key={index}><dt>{selection.label}</dt><dd>{selection.value}</dd></div>)}</dl>
    </details>
  </details>;
}
