import Image from "next/image";
import Link from "next/link";
import Creative from "@/stuff/Creative.svg";

/**
 * The hero. Your original headline and illustration, with the gradient blob
 * kept as the backdrop.
 */
export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden px-5 pb-16 pt-10 tab:px-8 tab:pb-24 tab:pt-16">
      {/* Decorative gradient wash behind the fold. */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl tab:-top-80"
        aria-hidden="true"
      >
        <div
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 tab:left-[calc(50%-30rem)] tab:w-[72.1875rem]"
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
        />
      </div>

      <div className="mx-auto grid max-w-7xl items-center gap-10 lap:grid-cols-2 lap:gap-16">
        <div className="text-center lap:text-left">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand ring-1 ring-inset ring-brand/20">
            Private by default
          </span>

          {/* The LCP element on this route — plain text, no webfont blocking. */}
          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-content text-balance tab:text-5xl lap:text-6xl">
            Today&apos;s Steps, Tomorrow&apos;s Memories: Your Daily Journey Companion.
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted text-balance tab:text-lg lap:mx-0">
            Capture life&apos;s moments, reflect, and cherish memories. Your personal
            journaling companion, making every day memorable.
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 tab:flex-row tab:justify-center lap:justify-start">
            <Link
              href="/auth/signup"
              className="w-full rounded-lg bg-brand px-7 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-brand-strong tab:w-auto"
            >
              Get started
            </Link>
            <Link
              href="#features"
              className="w-full rounded-lg px-7 py-3 text-base font-medium text-content ring-1 ring-inset ring-line transition-colors hover:bg-surface-muted tab:w-auto"
            >
              Learn more
            </Link>
          </div>
        </div>

        {/* Hidden on phones — it's decorative, and skipping it keeps the fold light. */}
        <div className="hidden justify-center lap:flex">
          <Image
            src={Creative}
            alt=""
            aria-hidden="true"
            priority
            className="h-auto w-full max-w-lg"
          />
        </div>
      </div>
    </section>
  );
}
