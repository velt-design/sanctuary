import ProjectsIndexClient from './ProjectsIndexClient';
import { requireStaffPageAccess } from '@/lib/auth';

export default async function StaffProjectsPage() {
  await requireStaffPageAccess('/staff/projects');
  return <ProjectsIndexClient />;
}
