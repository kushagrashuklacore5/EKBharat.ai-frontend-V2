import { Check, AlertTriangle } from 'lucide-react'
import { Jaali } from '../ui/Jaali'

/**
 * Original illustration (not a photograph) for the Finance card: an invoice is
 * read, its fields are extracted, and each one is checked against the PO and
 * the rules — with the one exception routed to a person.
 */
const FIELDS = [
  { k: 'GSTIN', v: '27AAB•••1Z5', ok: true },
  { k: 'Invoice', v: 'INV-0418', ok: true },
  { k: 'IGST 18%', v: '₹18,000', ok: true },
  { k: 'PO match', v: 'HSN differs', ok: false },
]

export function FinanceVisual({ className = '' }: { className?: string }) {
  return (
    <figure className={className}>
      <div className="deep-card surface-dark stepwell relative overflow-hidden rounded-[14px] p-5">
        <Jaali fade="radial" opacity={0.05} size={30} ink="#bfe3ea" />
        <div className="relative grid grid-cols-[64px_1fr] items-start gap-4">
          {/* the source document, with a scan line passing over it */}
          <div aria-hidden="true" className="relative aspect-[3/4] overflow-hidden rounded-md bg-[#eef3f5] p-2 shadow-[0_14px_28px_-14px_rgba(0,0,0,.7)]">
            <div className="h-[6%] w-[55%] rounded-sm bg-[#17475b]" />
            <div className="mt-[8%] space-y-[6%]">
              {[70, 50, 62, 44].map((w, i) => (
                <div key={i} className="h-[3.5%] min-h-[3px] rounded-sm bg-[#b9c8d0]" style={{ width: `${w}%` }} />
              ))}
            </div>
            <div className="mt-[10%] space-y-[5%] border-t border-[#c9d5db] pt-[8%]">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-[5px] w-[45%] rounded-sm bg-[#c9d5db]" />
                  <div className="h-[5px] w-[22%] rounded-sm bg-[#9fb3bd]" />
                </div>
              ))}
            </div>
            <div className="absolute inset-x-0 h-[14%] bg-gradient-to-b from-transparent via-[#5cc3be]/40 to-transparent [animation:fin-scan_3.2s_ease-in-out_infinite_alternate] motion-reduce:hidden" />
          </div>

          {/* extracted, validated fields */}
          <ul className="space-y-1.5 text-[11.5px]">
            {FIELDS.map((f) => (
              <li key={f.k} className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${f.ok ? 'border-[#9ad5e5]/20 bg-white/5' : 'border-[#e8913a]/50 bg-[#e8913a]/10'}`}>
                {f.ok ? <Check size={12} className="shrink-0 text-[#5cc3be]" /> : <AlertTriangle size={12} className="shrink-0 text-[#e8913a]" />}
                <span className="whitespace-nowrap text-[#8ea8b8]">{f.k}</span>
                <span className="ml-auto truncate font-mono font-semibold text-[#eaf1f4]">{f.v}</span>
              </li>
            ))}
            <li className="pt-1 font-mono text-[11px] text-[#e2c48f]">→ routed to finance for approval</li>
          </ul>
        </div>
      </div>
    </figure>
  )
}
