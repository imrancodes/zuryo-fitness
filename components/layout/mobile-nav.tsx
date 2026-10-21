"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ROLE_HOME, type Role } from "@/lib/roles";

export function MobileNav({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" />}>
        <Menu />
      </SheetTrigger>
      <SheetContent side="left" className="p-4">
        <SheetHeader className="p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Brand href={ROLE_HOME[role]} />
        </SheetHeader>
        <SidebarNav role={role} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
