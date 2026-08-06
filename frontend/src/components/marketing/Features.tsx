import {
  ChatIcon,
  FeedIcon,
  LockIcon,
  UserCheckIcon,
  VideoIcon,
  RestoreIcon,
} from "@/components/ui/icons";

/**
 * Your four original pillars, with two added for the features that now exist —
 * approval-based following and calling.
 */
const FEATURES = [
  {
    name: "Secure and Private",
    description:
      "Your diary, your privacy. Entries are served over TLS and, on a private account, are visible only to followers you've approved. Write freely, knowing your content is protected.",
    icon: LockIcon,
  },
  {
    name: "You approve every follower",
    description:
      "Nobody joins your circle without your yes. Follow requests wait for your approval, and that approved connection is what unlocks messaging and calling.",
    icon: UserCheckIcon,
  },
  {
    name: "Talk, don't just type",
    description:
      "Message, voice call and video call the people you're connected with — and turn any of those off whenever you like, for everyone or for all but your connections.",
    icon: VideoIcon,
  },
  {
    name: "Streamlined Entry Management",
    description:
      "Organize your thoughts effortlessly. Tag entries, revisit them by day, and move anything you'd rather not keep into Recycle instead of losing it.",
    icon: FeedIcon,
  },
  {
    name: "Nothing lost by accident",
    description:
      "Removed entries wait in Recycle until you decide. Restore them with a tap, or delete them for good when you're sure.",
    icon: RestoreIcon,
  },
  {
    name: "User-Friendly Interface",
    description:
      "Designed for ease of use, the platform is intuitive on any screen — no steep learning curves, just a smooth, enjoyable writing experience.",
    icon: ChatIcon,
  },
];

export default function Features() {
  return (
    <section id="features" className="scroll-mt-20 px-5 py-16 tab:px-8 tab:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand">
            Effortless Daily Journaling
          </h2>
          <p className="mt-4 text-3xl font-bold tracking-tight text-content text-balance tab:text-4xl">
            Seamlessly document and share your daily life with essential tools.
          </p>
          <p className="mt-5 text-base leading-relaxed text-muted text-balance tab:text-lg">
            Capture your thoughts, experiences, and ideas seamlessly. Our platform
            provides all the tools you need to maintain your daily diary or personal
            blog with just a few clicks.
          </p>
        </div>

        <dl className="mx-auto mt-14 grid max-w-5xl gap-x-8 gap-y-10 tab:grid-cols-2 lap:gap-y-12">
          {FEATURES.map((feature) => (
            <div key={feature.name} className="relative pl-16">
              <dt className="text-base font-semibold text-content">
                <span className="absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white">
                  <feature.icon className="h-5 w-5" />
                </span>
                {feature.name}
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted">
                {feature.description}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
