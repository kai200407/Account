export default function DashboardPageLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* 标题骨架 */}
      <div className="space-y-1.5">
        <div className="h-6 w-28 bg-muted rounded" />
        <div className="h-4 w-20 bg-muted rounded" />
      </div>

      {/* 快捷操作 2x2 骨架 */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted rounded-lg" />
        ))}
      </div>

      {/* 4个统计卡片骨架 */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 bg-muted rounded-lg" />
        ))}
      </div>
      <div className="h-14 bg-muted rounded-lg" />

      {/* 表格骨架 */}
      <div className="bg-muted rounded-lg p-4 space-y-3">
        <div className="h-5 w-24 bg-muted-foreground/10 rounded" />
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-4 w-20 bg-muted-foreground/10 rounded" />
              <div className="h-4 w-16 bg-muted-foreground/10 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
