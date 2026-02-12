import { runCommitmentMutation } from '../commitmentMutation';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  return runCommitmentMutation(req, 'lock');
}
