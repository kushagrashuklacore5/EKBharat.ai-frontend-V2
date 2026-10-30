import { Info } from 'lucide-react'

export function DemoBadge({ label = 'Illustrative demonstration data', className = '' }: { label?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md bg-saffron/12 px-2 py-1 text-[12px] font-semibold text-saffron ${className}`}>
      <Info size={13} aria-hidden="true" />
      {label}
    </span>
  )
}
