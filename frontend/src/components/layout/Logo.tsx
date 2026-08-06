import Image from "next/image";
import Link from "next/link";
import brandMark from "@/stuff/Red_Illustrated_Bull_Stock_Broker_Logo__1_-removebg-preview.png";
import { cn } from "@/lib/cn";
import { APP_NAME } from "@/constants/app";

const SIZES = {
  sm: { box: "h-8 w-8", text: "text-base" },
  md: { box: "h-10 w-10", text: "text-xl" },
  lg: { box: "h-14 w-14", text: "text-2xl" },
};

export interface LogoProps {
  size?: keyof typeof SIZES;
  href?: string | null;
  showWordmark?: boolean;
  className?: string;
  /** Set on the logo above the fold so it isn't lazy-loaded. */
  priority?: boolean;
}

/**
 * The DailyQuill brand lockup — your mark plus the wordmark.
 *
 * The image is given explicit dimensions so the header never reflows while it
 * loads, and it's a static import so Next fingerprints and caches it.
 */
export default function Logo({
  size = "md",
  href = "/",
  showWordmark = true,
  className,
  priority = false,
}: LogoProps) {
  const { box, text } = SIZES[size];

  const content = (
    <>
      <Image
        src={brandMark}
        alt={`${APP_NAME} logo`}
        priority={priority}
        className={cn(box, "w-auto object-contain")}
      />
      {showWordmark && (
        <span className={cn("font-bold tracking-tight text-content", text)}>
          {APP_NAME}
        </span>
      )}
    </>
  );

  const classes = cn("flex items-center gap-2", className);

  if (!href) return <span className={classes}>{content}</span>;

  return (
    <Link href={href} className={cn(classes, "transition-opacity hover:opacity-80")}>
      {content}
    </Link>
  );
}
