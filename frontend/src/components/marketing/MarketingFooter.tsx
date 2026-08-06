import Image from "next/image";
import Logo from "@/components/layout/Logo";
import facebook from "@/stuff/facebook.svg";
import twitter from "@/stuff/twitter.svg";
import linkedin from "@/stuff/linkedin.svg";
import instagram from "@/stuff/instagram.svg";
import youtube from "@/stuff/youtube.svg";

const LINK_COLUMNS = [
  {
    heading: "Products",
    links: [
      "Why DailyQuill?",
      "Product Updates",
      "Security",
      "Status",
      "Email Marketing",
      "Transactional Email",
    ],
  },
  {
    heading: "Community",
    links: ["Agencies", "Freelancers", "Developers", "Events"],
  },
];

const SOCIALS = [
  { icon: facebook, label: "Facebook" },
  { icon: twitter, label: "Twitter" },
  { icon: linkedin, label: "LinkedIn" },
  { icon: instagram, label: "Instagram" },
  { icon: youtube, label: "YouTube" },
];

const LEGAL = ["Privacy Policy", "Terms of Use", "Cookie Policy", "License"];

/**
 * Server component — no client JavaScript ships for the footer.
 *
 * The original used `useMediaQuery` to decide what to render, which meant the
 * markup changed after hydration. Here the columns are always present and CSS
 * decides what's visible, so nothing shifts on load.
 */
export default function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-surface-muted/40">
      <div className="mx-auto max-w-7xl px-5 py-12 tab:px-8 tab:py-16">
        <div className="grid gap-10 tab:grid-cols-2 lap:grid-cols-4">
          <div className="lap:col-span-1">
            <Logo />
            <p className="mt-4 max-w-[16rem] text-sm leading-relaxed text-muted">
              With new challenges, featured solutions, selected articles and our latest
              news.
            </p>

            <div className="mt-5 flex gap-3">
              {SOCIALS.map((social) => (
                <a
                  key={social.label}
                  href="#"
                  aria-label={social.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-line transition-colors hover:bg-surface"
                >
                  <Image
                    src={social.icon}
                    alt=""
                    width={18}
                    height={18}
                    className="h-[18px] w-[18px] opacity-70"
                  />
                </a>
              ))}
            </div>
          </div>

          {LINK_COLUMNS.map((column) => (
            <div key={column.heading}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-content">
                {column.heading}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-muted transition-colors hover:text-content"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-content">
              Contact Us
            </h2>
            <address className="mt-4 space-y-2 text-sm not-italic leading-relaxed text-muted">
              <p>
                <a
                  href="tel:+917350597368"
                  className="transition-colors hover:text-content"
                >
                  +91 73505 97368
                </a>
              </p>
              <p>
                <a
                  href="mailto:dailyquill.service@gmail.com"
                  className="break-all transition-colors hover:text-content"
                >
                  dailyquill.service@gmail.com
                </a>
              </p>
              <p>
                Sarmaspura, Achalpur
                <br />
                Dist. Amravati, Maharashtra
                <br />
                India — 444806
              </p>
            </address>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-4 border-t border-line pt-6 text-sm text-muted tab:flex-row tab:justify-between">
          <p className="text-center">
            © {year} DailyQuill Software, All rights reserved.
          </p>

          <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            {LEGAL.map((item) => (
              <li key={item}>
                <a href="#" className="transition-colors hover:text-content">
                  {item}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
