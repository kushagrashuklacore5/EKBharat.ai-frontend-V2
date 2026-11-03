/**
 * Licence and attribution log for every third-party photograph on the site.
 * Each file was checked on its Wikimedia Commons description page. Photos of
 * other organisations' facilities are shown as representative images only —
 * they do not depict Ek भारत.AI premises, staff, customers or infrastructure.
 */
export interface ImageCredit {
  /** short caption shown with the photo */
  caption: string
  title: string
  author: string
  licence: string
  licenceUrl: string
  source: string
  /** true when the photo shows a third-party facility */
  representative: boolean
  /** available widths in /images/<key>-<w>.webp ('' = 1920 master) */
  sizes: ('960' | '1920')[]
}

export const IMAGES = {
  'rack-closeup': {
    caption: 'Server rack in a high-performance computing data centre',
    title: 'Rear of rack at NERSC data center - closeup.jpg',
    author: 'Derrick Coetzee',
    licence: 'CC0 1.0',
    licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Rear_of_rack_at_NERSC_data_center_-_closeup.jpg',
    representative: true,
    sizes: ['960'],
  },
  'dc-cabling': {
    caption: 'Compute racks and power distribution in a supercomputing data centre',
    title: 'UPS Power Management Module, racks with network cabling in NERSC data center.jpg',
    author: 'Derrick Coetzee',
    licence: 'CC0 1.0',
    licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    source: 'https://commons.wikimedia.org/wiki/File:UPS_Power_Management_Module,_racks_with_network_cabling_in_NERSC_data_center.jpg',
    representative: true,
    sizes: ['960', '1920'],
  },
  'isro-cleanroom': {
    caption: 'Chandrayaan-3 lander in an ISRO clean room',
    title: 'Chandrayaan-3 lander in clean-room 03.webp',
    author: 'Indian Space Research Organisation',
    licence: 'GODL-India',
    licenceUrl: 'https://data.gov.in/government-open-data-license-india',
    source: 'https://commons.wikimedia.org/wiki/File:Chandrayaan-3_lander_in_clean-room_03.webp',
    representative: true,
    sizes: ['960', '1920'],
  },
  'port-logistics': {
    caption: 'Container handling at Jawaharlal Nehru Port, Navi Mumbai — the supply chains behind manufacturing and e-commerce',
    title: 'JNPT Port container handling.jpg',
    author: 'Ccmarathe',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    source: 'https://commons.wikimedia.org/wiki/File:JNPT_Port_container_handling.jpg',
    representative: true,
    sizes: ['960', '1920'],
  },
  'college-lab': {
    caption: 'Students in a college computer lab in Andhra Pradesh',
    title: 'VignanDegreeCollegeComputerLab.jpg',
    author: 'Arjuna Rao Chavala',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    source: 'https://commons.wikimedia.org/wiki/File:VignanDegreeCollegeComputerLab.jpg',
    representative: true,
    sizes: ['960', '1920'],
  },
} satisfies Record<string, ImageCredit>

export type ImageKey = keyof typeof IMAGES

/** srcset for a logged image */
export function imageSrc(key: ImageKey) {
  const img: ImageCredit = IMAGES[key]
  const set = img.sizes.map((s) => (s === '1920' ? `/images/${key}.webp 1920w` : `/images/${key}-960.webp 960w`)).join(', ')
  return { src: img.sizes.includes('1920') ? `/images/${key}.webp` : `/images/${key}-960.webp`, srcSet: set }
}
