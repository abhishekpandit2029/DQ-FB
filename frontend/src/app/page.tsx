import type { Metadata } from "next";
import { APP_DESCRIPTION, APP_NAME } from "@/constants/app";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import Hero from "@/components/marketing/Hero";
import Features from "@/components/marketing/Features";
import Testimonial from "@/components/marketing/Testimonial";
import Newsletter from "@/components/marketing/Newsletter";

export const metadata: Metadata = {
  title: `${APP_NAME} — your private daily diary`,
  description: APP_DESCRIPTION,
};

export default function LandingPage() {
  return (
    <div className="min-h-dvh-safe bg-bg">
      <MarketingNav />

      <main>
        <Hero />
        <Features />
        <Testimonial />
        <Newsletter />
      </main>

      <MarketingFooter />
    </div>
  );
}
