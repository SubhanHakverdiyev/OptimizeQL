import { NavBar } from "@/components/nav-bar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <NavBar />
      <main className="flex-1 p-8 overflow-auto min-h-screen bg-(--color-surface)">
        {children}
      </main>
    </div>
  );
}
