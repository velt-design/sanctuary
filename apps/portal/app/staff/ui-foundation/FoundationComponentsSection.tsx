import {
  CheckCircle2,
  Download,
  Image,
  Plus,
  Search,
  Settings2,
  Share2,
  Trash2,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EstimateStatusBadge,
  IconButton,
  Input,
  ProjectStageBadge,
  QuoteStatusBadge,
  Radio,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from '@/components/ui/foundation';
import { PIPELINE_STAGES, type PipelineStageKey } from '@/lib/projects/pipelineDefinition';
import type { QuoteStatus } from '@/lib/quotes/types';
import type { EstimateStatus } from '@/lib/estimates/types';
import styles from './ui-foundation.module.css';

const quoteStatuses: QuoteStatus[] = ['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED'];
const estimateStatuses: EstimateStatus[] = ['draft', 'archived'];

const projects: Array<{
  project: string;
  client: string;
  stage: PipelineStageKey;
  value: string;
  updated: string;
}> = [
  { project: 'Remuera Residence', client: 'James & Anna Wilson', stage: 'quoting', value: '$78,940', updated: '24 May 2024' },
  { project: 'Herne Bay Residence', client: 'Sarah Johnson', stage: 'sent', value: '$62,300', updated: '24 May 2024' },
  { project: 'Takapuna Residence', client: 'Daniel Lee', stage: 'deposit', value: '$126,800', updated: '23 May 2024' },
  { project: 'Grey Lynn Courtyard', client: 'Maria Garcia', stage: 'scheduled', value: '$53,400', updated: '23 May 2024' },
  { project: 'Mission Bay Residence', client: 'James & Anna Wilson', stage: 'completed', value: '$45,120', updated: '22 May 2024' },
];

export function FoundationComponentsSection({ currentStage }: { currentStage: PipelineStageKey }) {
  return (
    <section
      className={styles.componentArea}
      id="components"
      aria-labelledby="components-heading"
      data-portal-shell-region="ui-foundation-components"
    >
      <div className={styles.sectionTitle}><h2 id="components-heading">3. Components</h2><small>Real reusable exports</small></div>
      <div className={styles.componentGrid}>
        <div className={styles.componentMain}>
          <Card title="Buttons" headingLevel={3} eyebrow="40px standard control" padding="compact">
            <div className={styles.buttonRows}>
              <span>Primary</span><Button>Create quote</Button><Button leadingIcon={<Plus />}>New project</Button>
              <span>Secondary</span><Button variant="secondary">View project</Button><Button variant="secondary" loading>Loading</Button>
              <span>Tertiary</span><Button variant="tertiary">Export</Button><Button variant="tertiary" leadingIcon={<Download />}>Download</Button>
              <span>Quiet</span><Button variant="quiet">More</Button><Button variant="quiet" leadingIcon={<Share2 />}>Share</Button>
              <span>Destructive</span><Button variant="destructive">Delete</Button><Button variant="destructive" leadingIcon={<Trash2 />}>Archive</Button>
            </div>
          </Card>

          <Card title="Form controls" headingLevel={3} eyebrow="Native, labelled, keyboard operable" padding="compact">
            <div className={styles.formGrid}>
              <Input label="Text input" placeholder="Enter project name…" helperText="Helper text goes here" />
              <Select label="Project stage" defaultValue={currentStage}>
                {PIPELINE_STAGES.map((stage) => <option key={stage.key} value={stage.key}>{stage.label}</option>)}
              </Select>
              <Input label="Date" type="date" defaultValue="2024-05-24" />
              <Input label="Error example" defaultValue="Remuera" error="Enter a complete project name" />
              <Textarea label="Textarea" placeholder="Enter project notes…" helperText="Visible to staff only" />
            </div>
            <div className={styles.choiceGrid}>
              <Checkbox label="Unchecked" />
              <Checkbox label="Checked" defaultChecked />
              <Radio label="Option one" name="foundation-radio" />
              <Radio label="Option two" name="foundation-radio" defaultChecked />
              <Switch label="Notifications off" />
              <Switch label="Notifications on" defaultChecked />
            </div>
          </Card>

          <Card title="Project stage badges" headingLevel={3} eyebrow="Canonical Sanctuary workflow" padding="compact">
            <div className={styles.stageBadges}>
              {PIPELINE_STAGES.map((stage) => <ProjectStageBadge key={stage.key} stage={stage.key} compact />)}
            </div>
          </Card>

          <Card title="Table foundation" headingLevel={3} eyebrow="Compact operational data" padding="none" id="table-foundations">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead><TableHead>Client</TableHead><TableHead>Stage</TableHead>
                  <TableHead>Value</TableHead><TableHead>Updated</TableHead><TableHead><span className="visually-hidden">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.project}>
                    <TableCell><strong>{project.project}</strong></TableCell>
                    <TableCell>{project.client}</TableCell>
                    <TableCell><ProjectStageBadge stage={project.stage} compact /></TableCell>
                    <TableCell>{project.value}</TableCell>
                    <TableCell>{project.updated}</TableCell>
                    <TableCell><IconButton aria-label={`Actions for ${project.project}`} size="small" variant="quiet"><Settings2 /></IconButton></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        <aside className={styles.componentAside}>
          <Card title="Quote status" headingLevel={3} padding="compact">
            <div className={styles.statusStack}>{quoteStatuses.map((status) => <QuoteStatusBadge key={status} status={status} />)}</div>
          </Card>
          <Card title="Estimate status" headingLevel={3} padding="compact">
            <div className={styles.statusStack}>{estimateStatuses.map((status) => <EstimateStatusBadge key={status} status={status} />)}</div>
          </Card>
          <Card title="Semantic badges" headingLevel={3} padding="compact">
            <div className={styles.badgeGrid}>
              <Badge tone="success">Success</Badge><Badge tone="warning">Warning</Badge><Badge tone="error">Error</Badge>
              <Badge tone="info">Info</Badge><Badge tone="neutral">Neutral</Badge><Badge tone="inverse">Inverse</Badge>
            </div>
          </Card>
          <Card title="Icon set" headingLevel={3} eyebrow="Lucide outline" padding="compact">
            <div className={styles.iconSet}>
              <span><Image /><small>16px</small></span>
              <span><Search /><small>20px</small></span>
              <span><CheckCircle2 /><small>24px</small></span>
              <span><Settings2 /><small>32px</small></span>
            </div>
          </Card>
        </aside>
      </div>
    </section>
  );
}
