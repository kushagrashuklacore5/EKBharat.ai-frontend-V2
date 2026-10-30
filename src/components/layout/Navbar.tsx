import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react'
import { Logo } from '../ui/Logo'
import { PRODUCTS, SERVICES, type NavItem } from '../../lib/nav'

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const { pathname } = useLocation()
  const menuRef = useRef<HTMLDivElement>(null)
  const hoverTimer = useRef<number>(0)

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  useEffect(() => {
    setOpen(false)
    setMenu(false)
  }, [pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu])

  const hover = (v: boolean) => {
    window.clearTimeout(hoverTimer.current)
    hoverTimer.current = window.setTimeout(() => setMenu(v), v ? 90 : 160)
  }

  const link = ({ isActive }: { isActive: boolean }) =>
    `relative rounded-md px-3 py-2 text-[14px] font-medium transition-colors ${isActive ? 'text-fg' : 'text-fg-soft hover:text-fg'}`

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-300 ${
        scrolled || open || menu ? 'bg-ink-900/85 shadow-[0_1px_0_var(--color-line)] backdrop-blur-xl' : 'bg-transparent'
      }`}
    >
      <nav aria-label="Primary" className="container-x flex h-[68px] items-center justify-between">
        <Logo />

        <div className="hidden items-center gap-1 lg:flex">
          <div ref={menuRef} className="relative" onMouseEnter={() => hover(true)} onMouseLeave={() => hover(false)}>
            <button
              type="button"
              aria-expanded={menu}
              aria-controls="platform-menu"
              onClick={() => setMenu((m) => !m)}
              className="flex items-center gap-1 rounded-md px-3 py-2 text-[14px] font-medium text-fg-soft hover:text-fg"
            >
              Platform <ChevronDown size={15} className={`transition-transform duration-300 ${menu ? 'rotate-180' : ''}`} />
            </button>
            <div
              id="platform-menu"
              className={`absolute left-1/2 top-full w-[760px] -translate-x-1/2 pt-3 transition-[opacity,transform,visibility] duration-300 ease-[cubic-bezier(.16,1,.3,1)] ${
                menu ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1.5 opacity-0'
              }`}
            >
              <div className="panel-raised grid grid-cols-[1fr_1fr_1.05fr] gap-2 p-2.5">
                <MenuGroup title="Products" items={PRODUCTS} />
                <MenuGroup title="Services" items={SERVICES} />
                <Link to="/workflow-studio" className="surface-dark group flex flex-col justify-between rounded-[10px] p-5">
                  <span>
                    <span className="label text-cyan">Flagship product</span>
                    <span className="mt-2 block text-[17px] font-semibold leading-snug text-fg">Workflow Studio</span>
                    <span className="mt-1.5 block text-[13px] leading-relaxed text-muted">Design AI-native automation on a visual canvas — then run it.</span>
                  </span>
                  <MiniFlow />
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg">
                    Try the live demo <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </div>
            </div>
          </div>
          <NavLink to="/workflow-studio" className={link}>
            Workflow Studio
          </NavLink>
          <NavLink to="/gpu-cloud" className={link}>
            GPU Cloud
          </NavLink>
          <NavLink to="/solutions" className={link}>
            Solutions
          </NavLink>
          <NavLink to="/about" className={link}>
            About
          </NavLink>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/contact" className="hidden rounded-md px-3 py-2 text-[14px] font-medium text-fg-soft hover:text-fg sm:block">
            Contact
          </Link>
          <Link
            to="/build-with-us"
            className="hidden h-10 items-center rounded-lg bg-fg px-4 text-[14px] font-semibold text-ink-950 transition-colors hover:bg-electric hover:text-white sm:inline-flex"
          >
            Build with us
          </Link>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-lg text-fg hover:bg-ink-700/60 lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div
        id="mobile-nav"
        className={`fixed inset-x-0 bottom-0 top-[68px] overflow-y-auto bg-ink-900 transition-[opacity,visibility] duration-300 lg:hidden ${
          open ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      >
        <div className="container-x py-6">
          <MobileGroup title="Products" items={PRODUCTS} />
          <MobileGroup title="Services" items={SERVICES} />
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[15px] font-medium text-fg-soft">
            <Link to="/about">About</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/developers">Developers</Link>
          </div>
          <Link to="/build-with-us" className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-[10px] bg-fg text-[15px] font-semibold text-ink-950">
            Build with us
          </Link>
        </div>
      </div>
    </header>
  )
}

function MiniFlow() {
  return (
    <svg viewBox="0 0 200 48" className="my-4 w-full" aria-hidden="true">
      <path d="M30 24 H85 M115 24 C130 24 130 10 150 10 M115 24 C130 24 130 38 150 38" fill="none" stroke="#7cc4dd" strokeOpacity=".6" strokeWidth="1.5" />
      <rect x="4" y="14" width="26" height="20" rx="5" fill="#e9b56b" />
      <rect x="85" y="12" width="30" height="24" rx="5" fill="#7cc4dd" />
      <rect x="150" y="1" width="44" height="18" rx="5" fill="#eef3f7" fillOpacity=".9" />
      <rect x="150" y="29" width="44" height="18" rx="5" fill="#eef3f7" fillOpacity=".5" />
    </svg>
  )
}

function MobileGroup({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div className="mb-8">
      <p className="label mb-2 text-faint">{title}</p>
      <ul>
        {items.map((i) => (
          <li key={i.to} className="border-b border-line">
            <Link to={i.to} className="block py-3.5">
              <span className="block text-[18px] font-semibold tracking-tight text-fg">{i.label}</span>
              <span className="block text-[13px] text-muted">{i.desc}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MenuGroup({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div className="p-2">
      <p className="label px-3 pb-2 pt-1 text-faint">{title}</p>
      {items.map((i) => (
        <Link key={i.to} to={i.to} className="group block rounded-lg px-3 py-2.5 transition-colors hover:bg-ink-900">
          <span className="block text-[14px] font-semibold text-fg">{i.label}</span>
          <span className="block text-[12.5px] leading-snug text-muted">{i.desc}</span>
        </Link>
      ))}
    </div>
  )
}
