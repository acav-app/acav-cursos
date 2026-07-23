"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardPageShellSkeleton({
  showHeaderAction = true,
  filterColumns = 3,
  rowCount = 4,
}) {
  return (
    <div className="mx-auto max-w-6xl px-2 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-4 w-28 rounded-full" />
          <Skeleton className="mt-4 h-10 w-full max-w-md rounded-2xl" />
          <Skeleton className="mt-3 h-4 w-full max-w-2xl rounded-xl" />
        </div>
        {showHeaderAction ? <Skeleton className="h-11 w-40 rounded-2xl" /> : null}
      </div>

      <Card className="mt-8 rounded-3xl border border-border/60 bg-card">
        <CardContent className="p-6">
          <div className={`grid gap-3 ${filterColumns === 1 ? "" : filterColumns === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
            {Array.from({ length: filterColumns }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-xl" />
            ))}
          </div>

          <Skeleton className="mt-3 h-4 w-28 rounded-xl" />

          <div className="mt-6 grid gap-4">
            {Array.from({ length: rowCount }).map((_, index) => (
              <div key={index} className="rounded-3xl border border-border/60 bg-background p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-6 w-48 rounded-xl" />
                    <Skeleton className="mt-3 h-4 w-full max-w-md rounded-xl" />
                    <Skeleton className="mt-2 h-4 w-4/5 max-w-sm rounded-xl" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-10 w-24 rounded-xl" />
                    <Skeleton className="h-10 w-24 rounded-xl" />
                    <Skeleton className="h-10 w-24 rounded-xl" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-2 py-8">
      <Skeleton className="mb-6 h-5 w-36 rounded-xl" />

      <Card className="rounded-3xl border border-border/60 bg-card">
        <CardHeader className="space-y-3">
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="h-10 w-full max-w-md rounded-2xl" />
          <Skeleton className="h-4 w-full max-w-sm rounded-xl" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-border/60 bg-background p-6">
              <Skeleton className="h-5 w-32 rounded-xl" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-4 w-full rounded-xl" />
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-border/60 bg-background p-6">
              <Skeleton className="h-5 w-24 rounded-xl" />
              <div className="mt-4 space-y-3">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-40 rounded-xl" />
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-border/60 bg-background p-6">
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
            <div className="rounded-3xl border border-border/60 bg-background p-6">
              <Skeleton className="h-5 w-16 rounded-xl" />
              <div className="mt-4 space-y-3">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardSettingsSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-2 py-8">
      <Card className="rounded-3xl border border-border/60 bg-card">
        <CardHeader className="space-y-3">
          <Skeleton className="h-4 w-40 rounded-full" />
          <Skeleton className="h-10 w-full max-w-md rounded-2xl" />
          <Skeleton className="h-4 w-full max-w-xl rounded-xl" />
        </CardHeader>
        <CardContent className="space-y-10">
          {Array.from({ length: 5 }).map((_, sectionIndex) => (
            <div key={sectionIndex} className="space-y-6">
              <Skeleton className="h-6 w-32 rounded-xl" />
              <div className="grid gap-6 md:grid-cols-2">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
              <Skeleton className="h-28 w-full rounded-2xl" />
            </div>
          ))}
          <Skeleton className="h-11 w-40 rounded-2xl" />
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardLayoutSkeleton() {
  return (
    <div className="flex min-h-screen w-full bg-default-50 dark:bg-background">
      <div className="hidden w-[280px] shrink-0 border-r border-border/60 bg-card/80 xl:block">
        <div className="space-y-4 p-6">
          <Skeleton className="h-10 w-36 rounded-2xl" />
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-11 w-full rounded-2xl" />
          ))}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="border-b border-border/60 bg-card/70 px-4 py-4 md:px-6">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-10 w-40 rounded-2xl" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-10 w-32 rounded-2xl" />
            </div>
          </div>
        </div>
        <div className="p-4 md:p-6">
          <DashboardPageShellSkeleton />
        </div>
      </div>
    </div>
  );
}
