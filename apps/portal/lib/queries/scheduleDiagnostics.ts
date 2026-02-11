import { getSupabaseBrowser, supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

export type ScheduleDiagnosticsResult = {
  host: string | null;
  crewsOk: boolean;
  crewsError?: string;
  itemsOk: boolean;
  itemsError?: string;
  projectsOk: boolean;
  projectsError?: string;
  estimatesOk: boolean;
  estimatesError?: string;
};

export async function runScheduleDiagnostics(): Promise<ScheduleDiagnosticsResult> {
  const supabase = getSupabaseBrowser();
  const host = supabaseHostFromUrl(supabaseRuntimeUrl());
  const crews = await supabase.from('schedule_crews').select('id').limit(1);
  const items = await supabase.from('schedule_items').select('id').limit(1);
  const projects = await supabase.from('projects').select('id').limit(1);
  const estimates = await supabase.from('estimates').select('id').limit(1);

  return {
    host,
    crewsOk: !crews.error,
    crewsError: crews.error ? JSON.stringify(crews.error) : undefined,
    itemsOk: !items.error,
    itemsError: items.error ? JSON.stringify(items.error) : undefined,
    projectsOk: !projects.error,
    projectsError: projects.error ? JSON.stringify(projects.error) : undefined,
    estimatesOk: !estimates.error,
    estimatesError: estimates.error ? JSON.stringify(estimates.error) : undefined,
  };
}
