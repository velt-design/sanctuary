'use client';
import { getSupabaseBrowser } from '@/lib/supabase/browserClient';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

type AuthObserver = (event: AuthChangeEvent, session: Session | null) => void;

/** Auth transport only. Events can retire an admission; they cannot grant one. */
export function observeStudioDocumentAuth(onChange: AuthObserver, onInitialized: () => void): () => void {
  const { auth } = getSupabaseBrowser();
  // Observe transitions before joining the SDK's public initialization promise.
  const { data } = auth.onAuthStateChange(onChange);
  // A failed cached transport must still allow the fresh server access guard.
  void Promise.resolve().then(() => auth.initialize()).then(onInitialized, onInitialized);
  return () => data.subscription.unsubscribe();
}
