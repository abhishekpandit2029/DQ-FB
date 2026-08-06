/** Your original endorsement, kept verbatim. */
export default function Testimonial() {
  return (
    <section
      id="endorsements"
      className="scroll-mt-20 border-y border-line bg-surface-muted/40 px-5 py-16 tab:px-8 tab:py-24"
    >
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-sm font-bold uppercase tracking-wider text-brand">
          Workation
        </p>

        <figure className="mt-8">
          <blockquote className="text-xl font-semibold leading-relaxed text-content text-balance tab:text-2xl tab:leading-relaxed">
            <p>
              &ldquo;Our platform has transformed daily journaling into a secure,
              effortless experience. We&apos;re proud to provide a space where users can
              capture their thoughts with ease and confidence. Seeing our platform
              become a trusted part of people&apos;s lives is truly fulfilling.&rdquo;
            </p>
          </blockquote>

          <figcaption className="mt-8 flex flex-col items-center justify-center gap-x-3 gap-y-1 text-sm tab:flex-row">
            <span className="font-semibold text-content">Abhishek Pandit</span>
            <svg
              width={3}
              height={3}
              viewBox="0 0 2 2"
              aria-hidden="true"
              className="hidden fill-muted tab:block"
            >
              <circle r={1} cx={1} cy={1} />
            </svg>
            <span className="text-muted">Founder &amp; CEO of DailyQuill</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
