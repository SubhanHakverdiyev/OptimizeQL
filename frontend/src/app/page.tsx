"use client";

import LandingPage from "@/components/landing-page";
import DashboardPage from "@/components/dashboard-page";
import { NavBar } from "@/components/nav-bar";

const IS_HOSTED = !!(process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes("localhost"));

export default function HomePage() {
  if (IS_HOSTED) {
    return <LandingPage />;
  }

  // Self-hosted: dashboard with sidebar
  return (
    <div className="flex min-h-screen">
      <NavBar />
      <main className="flex-1 p-8 overflow-auto min-h-screen bg-(--color-surface)">
        <DashboardPage />
      </main>
    </div>
  );
}
