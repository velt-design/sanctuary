import {jsonOk,requireStaffContext} from '@/lib/api/staffApi';
export const dynamic='force-dynamic';
export async function GET(){const auth=await requireStaffContext();if(!auth.ok)return auth.response;return jsonOk({enabled:process.env.ENABLE_PORTAL_DESIGN_STUDIO==='1'&&(auth.session.role==='staff'||auth.session.role==='admin')});}
