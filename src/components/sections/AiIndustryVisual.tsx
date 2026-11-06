import { BarChart3, FileText, Image as ImageIcon, Radio, ShoppingCart, Activity, GraduationCap, Factory, Receipt } from 'lucide-react'
import { Jaali } from '../ui/Jaali'
import { TransformerCanvas } from './TransformerCanvas'

/**
 * Original illustration (not a photograph): business data enters a living
 * Transformer block and comes out as contextual understanding for each industry.
 */
const INPUTS = [
  { t: 'Documents', icon: FileText },
  { t: 'Images & scans', icon: ImageIcon },
  { t: 'Sensor data', icon: Radio },
  { t: 'Transactions', icon: Receipt },
]
const OUTPUTS = [
  { t: 'Education', icon: GraduationCap },
  { t: 'Healthcare', icon: Activity },
  { t: 'Finance', icon: BarChart3 },
  { t: 'E-commerce', icon: ShoppingCart },
  { t: 'Manufacturing', icon: Factory },
]

export function AiIndustryVisual({ className = '' }: { className?: string }) {
  return (
    <figure className={className}>
      <div className="deep-card surface-dark stepwell relative overflow-hidden rounded-[14px] p-5 sm:p-8">
        <Jaali fade="radial" opacity={0.05} size={40} ink="#bfe3ea" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_60%_at_50%_45%,rgba(92,195,190,.13),transparent_70%)]" />
        <div className="relative grid items-center gap-6 lg:grid-cols-[auto_1fr_auto]">
          {/* inputs */}
          <ul className="flex flex-wrap gap-2 lg:flex-col" aria-label="Data that goes in">
            {INPUTS.map(({ t, icon: Icon }) => (
              <li key={t} className="glass-chip flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-semibold text-[#17475b]">
                <Icon size={15} /> {t}
              </li>
            ))}
          </ul>

          <TransformerCanvas />

          {/* outputs */}
          <ul className="flex flex-wrap gap-2 lg:flex-col" aria-label="Where it is applied">
            {OUTPUTS.map(({ t, icon: Icon }) => (
              <li key={t} className="flex items-center gap-2 rounded-lg border border-line-strong bg-ink-850/70 px-3 py-2 text-[12.5px] font-semibold text-fg">
                <Icon size={15} className="text-teal" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </figure>
  )
}
