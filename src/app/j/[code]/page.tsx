export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 px-4">
      <p className="text-sm text-muted">Joining session</p>
      <p className="tnum font-mono text-4xl tracking-[0.25em]">{code.toUpperCase()}</p>
      <p className="text-muted">The lobby is built in the next phase.</p>
    </main>
  );
}
