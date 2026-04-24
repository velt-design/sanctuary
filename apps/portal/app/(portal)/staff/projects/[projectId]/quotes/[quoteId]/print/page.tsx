export default async function QuotePrintPage({
  params,
}: {
  params: Promise<{ projectId: string; quoteId: string }>;
}) {
  void params;
  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ margin: 0 }}>Quote Print</h1>
      <p style={{ marginTop: 8, opacity: 0.75 }}>This module is not active yet.</p>
    </main>
  );
}
