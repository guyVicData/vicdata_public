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

        <section>
          <h2 className="text-lg font-semibold">Post-16 points: what the figures mean</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            Every Post-16 points figure here is real and independently sourced. Each
            qualification type is converted using its own published table, never an
            estimate or a house scale: A-level and AS from DfE&rsquo;s own performance
            points guide; the International Baccalaureate from DfE&rsquo;s Table 2f for
            Higher and Standard level components and Table 2g for the Diploma Core; BTEC
            and OCR Cambridge Technical from DfE&rsquo;s four-, seven- and ten-grade
            structure tables, which follow the exam boards&rsquo; own grade structures;
            and T Level from DfE&rsquo;s Table 51 in its 16 to 18 technical guidance.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            <strong>A points figure is only comparable within the same qualification
            type.</strong> A category scoring 48.52 under the International Baccalaureate
            and one scoring 48.52 under A-level are not the same achievement, and must
            never be read as equivalent. The tables are separate, built for different
            qualifications, and the numbers they produce sit on different scales. That is
            why this site never blends them into a single average: where a school&rsquo;s
            results span more than one qualification type, it shows no combined figure at
            all rather than one that looks precise and means nothing.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            Some qualifications deliberately carry no points figure. VRQ entries are
            counted but never scored: DfE groups many different vocational awards, with
            different grade scales, under one VRQ label, so a grade cannot be matched to a
            table reliably enough to publish. The same applies to the Extended Project,
            Core Maths, Free-standing Maths, Pre-U and other general qualifications, which
            differ too much in size, level and purpose to average together. The
            International Baccalaureate Diploma&rsquo;s own total score, shown out of 45,
            is a separate whole-programme measure and is not comparable to any
            points-per-entry figure on this site.
          </p>
        </section>
      </div>
    </main>
  );
}
