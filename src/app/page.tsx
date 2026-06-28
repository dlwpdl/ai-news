export default function Home() {
  return (
    <main className="min-h-screen bg-background p-8 text-foreground">
      <section className="mx-auto flex max-w-3xl flex-col gap-6">
        <div>
          <p className="text-sm font-medium text-zinc-500">Telegram news bot</p>
          <h1 className="mt-2 text-3xl font-semibold">AI News</h1>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="border border-zinc-200 p-4 dark:border-zinc-800">
            <dt className="font-medium">Focus</dt>
            <dd className="mt-1 text-zinc-600 dark:text-zinc-400">
              AI, LLM, agents, papers, tooling, deployment
            </dd>
          </div>
          <div className="border border-zinc-200 p-4 dark:border-zinc-800">
            <dt className="font-medium">Levels</dt>
            <dd className="mt-1 text-zinc-600 dark:text-zinc-400">
              L1 general through L10 research frontier
            </dd>
          </div>
          <div className="border border-zinc-200 p-4 dark:border-zinc-800">
            <dt className="font-medium">Cron</dt>
            <dd className="mt-1 text-zinc-600 dark:text-zinc-400">
              08:00, 13:00, 19:00 KST
            </dd>
          </div>
          <div className="border border-zinc-200 p-4 dark:border-zinc-800">
            <dt className="font-medium">Manual test</dt>
            <dd className="mt-1 font-mono text-zinc-600 dark:text-zinc-400">
              GET /api/cron?limit=1
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
