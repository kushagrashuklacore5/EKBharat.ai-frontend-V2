import { useEffect } from 'react'
import { Hero } from '../components/hero/Hero'
import { ProductExplorer } from '../components/sections/ProductExplorer'
import { ArchitectureSection } from '../components/architecture/ArchitectureSection'
import { IndustriesSection } from '../components/sections/IndustriesSection'
import { PillarsSection } from '../components/sections/PillarsSection'
import { FinalCta } from '../components/sections/FinalCta'
import { BrandReveal } from '../components/sections/BrandReveal'

export default function Home() {
  useEffect(() => {
    document.title = 'Ek भारत.AI — Build, Connect, Automate, Orchestrate'
  }, [])
  return (
    <>
      <Hero />
      <BrandReveal />
      {/* overview: each capability links to its product page, where the full detail lives */}
      <ProductExplorer />
      <ArchitectureSection index="02" />
      <IndustriesSection index="03" />
      <PillarsSection index="04" />
      <FinalCta />
    </>
  )
}
