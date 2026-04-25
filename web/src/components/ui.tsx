// Shared primitive UI components

export function XIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export function UploadIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12V4m0 0L8 8m4-4l4 4" />
    </svg>
  );
}

export function SkeletonCard() {
  return (
    <div className="card animate-pulse space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded-md w-2/3" />
          <div className="h-3 bg-gray-100 rounded-md w-1/3" />
        </div>
        <div className="h-8 w-16 bg-gray-200 rounded-lg shrink-0" />
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="card animate-pulse flex items-center justify-between gap-4">
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-gray-200 rounded-md w-1/3" />
        <div className="h-3 bg-gray-100 rounded-md w-1/2" />
      </div>
      <div className="h-5 w-10 bg-gray-200 rounded-md shrink-0" />
    </div>
  );
}
