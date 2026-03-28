import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="pb-24">
      <div className="mb-8 px-1">
        <Skeleton className="h-10 w-48 mb-2" />
        <Skeleton className="h-4 w-32" />
      </div>

      <div className="grid grid-cols-1 gap-4 mb-8">
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>

      <div className="space-y-4">
        <Skeleton className="h-6 w-24 ml-1" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
