export default async function QuoteEditorPage({
  params,
}: {
  params: Promise<{ projectId: string; quoteId: string }>;
}) {
  void params;
  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ margin: 0 }}>Quote</h1>
      <p style={{ marginTop: 8, opacity: 0.75 }}>This module is not active yet.</p>
    </main>
  );
}
