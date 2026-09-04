export default function SourcesPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-2xl font-semibold">Sources & methodology</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Every figure on VicData comes from one of three public data sources, kept
        clearly separate rather than blended into one number.
      </p>

      <div className="mt-10 space-y-8">
        <section>
          <h2 className="text-lg font-semibold">DfE School Census</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            Pupil numbers by age and gender, collected termly from every state and
            independent school in England. This is the primary source for the roll,
            shape, and age-profile figures throughout the site.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">GIAS (Get Information about Schools)</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            The Department for Education&rsquo;s own public school register. This is the
            source for sector, phase, location, and the local-authority pupil-count
            snapshots used in &ldquo;where this school sits locally&rdquo; comparisons. It is a
            separate dataset from the Census, on its own refresh schedule, so
            GIAS-sourced counts won&rsquo;t always match Census-sourced counts exactly.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">ILR (Individualised Learner Record)</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            DfE&rsquo;s own experimental &ldquo;in development&rdquo; statistics (Individualised
            Learner Record) — not the DfE school census figure. A count of learners
            participating in further education courses across the academic year, not a
            single-day headcount, shown here because these institutions — further
            education colleges and sixth-form/post-16 institutions — report through the
            Individualised Learner Record (ILR), not DfE school census, which
            structurally never covers them. Shown separately, never combined with the
            census figure — they measure different things.
          </p>
        </section>
      </div>
    </main>
  );
}
