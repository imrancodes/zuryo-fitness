"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function AdminBookingsError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState icon={TriangleAlert} title="Bookings couldn't be loaded" description="Something went wrong while loading bookings. Check the connection and try again.">
      <Button onClick={() => retry()}>
        <RotateCw aria-hidden />
        Try again
      </Button>
    </EmptyState>
  );
}
