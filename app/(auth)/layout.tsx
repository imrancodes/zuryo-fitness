import { BadgeCheck, CalendarClock, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";

const HIGHLIGHTS = [
  { icon: BadgeCheck, text: "Certified, background-checked trainers" },
  { icon: CalendarClock, text: "Instant or scheduled sessions" },
  { icon: MapPin, text: "Training at your home, gym or park" },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <aside className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <Brand href="/login" inverted />
        <div className="max-w-md space-y-8">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            Certified trainers at your door, on your schedule.
          </h2>
          <ul className="space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-primary-foreground/85">
                <Icon className="size-5 shrink-0 text-brand-foreground/90" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-primary-foreground/60">Zuryo · On-demand fitness training</p>
      </aside>
      <main className="flex flex-col px-4 py-8 sm:px-8">
        <Brand href="/login" className="lg:hidden" />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  );
}
