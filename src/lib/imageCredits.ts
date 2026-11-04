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
  'grid-fermilab': {
    caption: 'Server racks in a grid computing centre at Fermilab',
    title: 'Cable racks at grid computing center, Fermilab with blue lights.jpg',
    author: 'U.S. Department of Energy',
    licence: 'Public domain',
    licenceUrl: 'https://commons.wikimedia.org/wiki/File:Cable_racks_at_grid_computing_center,_Fermilab_with_blue_lights.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Cable_racks_at_grid_computing_center,_Fermilab_with_blue_lights.jpg',
    representative: true,
    sizes: ['960', '1920'],
  },
  'gpu-csiro': {
    caption: 'GPU cluster in a research data centre (CSIRO, Australia)',
    title: 'CSIRO ScienceImage 11313 The CSIRO GPU cluster at the data centre.jpg',
    author: 'CSIRO',
    licence: 'CC BY 3.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/3.0/',
    source: 'https://commons.wikimedia.org/wiki/File:CSIRO_ScienceImage_11313_The_CSIRO_GPU_cluster_at_the_data_centre.jpg',
    representative: true,
    sizes: ['960', '1920'],
  },
  'grid-lhc': {
    caption: 'Computing hall of the Worldwide LHC Computing Grid at CERN',
    title: 'Worldwide LHC Computing Grid.jpg',
    author: 'Sashimi-b',
    licence: 'CC BY 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Worldwide_LHC_Computing_Grid.jpg',
    representative: true,
    sizes: ['960', '1920'],
  },
  'coding-bangalore': {
    caption: 'Students learning to code in a school computer lab in Bengaluru',
    title: 'Students at a school in Bangalore, India learning to code on Progate.jpg',
    author: 'Nayakyashraj',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Students_at_a_school_in_Bangalore,_India_learning_to_code_on_Progate.jpg',
    representative: true,
    sizes: ['960', '1920'],
  },
  'upi-bhopal': {
    caption: 'BHIM / UPI QR code payment stand in Bhopal',
    title: 'Bhim upi ID to accept entrance fee at Shaurya Smarak Bhopal.jpg',
    author: 'Suyash Dwivedi',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Bhim_upi_ID_to_accept_entrance_fee_at_Shaurya_Smarak_Bhopal.jpg',
    representative: true,
    sizes: ['960', '1920'],
  },
  'bpo-dantewada': {
    caption: 'Customer-support agents at a BPO centre in Dantewada, Chhattisgarh',
    title: 'Dantewada Yuva BPO.jpg',
    author: 'Samuel.Wsx',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Dantewada_Yuva_BPO.jpg',
    representative: true,
    sizes: ['960', '1920'],
  },
  'noc-architel': {
    caption: 'Staff monitoring systems in a network operations centre',
    title: 'NOC-Architel.jpg',
    author: 'Mike Reyher',
    licence: 'CC BY 2.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/2.0/',
    source: 'https://commons.wikimedia.org/wiki/File:NOC-Architel.jpg',
    representative: true,
    sizes: ['960', '1920'],
  },
  'gpu-dgx-b200': {
    caption: 'NVIDIA HGX B200 baseboard with eight GPUs',
    title: 'Nvidia DGX-B200-HGX.jpg',
    author: 'Pokiiri',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Nvidia_DGX-B200-HGX.jpg',
    representative: true,
    sizes: ['960'],
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
  'wafer-12in': {
    caption: '300 mm silicon wafer with patterned dies',
    title: '12-inch silicon wafer.jpg',
    author: 'Peellden',
    licence: 'CC BY-SA 3.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    source: 'https://commons.wikimedia.org/wiki/File:12-inch_silicon_wafer.jpg',
    representative: false,
    sizes: ['960'],
  },
  'wafer-researcher': {
    caption: 'Researcher inspecting a silicon wafer in a clean room',
    title: 'Silicon wafer researcher.jpg',
    author: 'U.S. Department of Energy',
    licence: 'Public domain',
    licenceUrl: 'https://commons.wikimedia.org/wiki/File:Silicon_wafer_researcher.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Silicon_wafer_researcher.jpg',
    representative: true,
    sizes: ['960', '1920'],
  },
  'robotics-bitm': {
    caption: 'Robotics work at the Innovation Hub, Birla Industrial & Technological Museum, Kolkata',
    title: 'Robotics - Innovation Hub - BITM - Kolkata 2015-03-28 4878.JPG',
    author: 'Biswarup Ganguly',
    licence: 'CC BY 3.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/3.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Robotics_-_Innovation_Hub_-_BITM_-_Kolkata_2015-03-28_4878.JPG',
    representative: true,
    sizes: ['960', '1920'],
  },
  'mri-jaipur': {
    caption: 'MRI scanner at Narayana Multispeciality Hospital, Jaipur',
    title: 'MRI Scanner at Narayana Multispeciality Hospital, Jaipur.jpg',
    author: 'GeorgeWilliams21',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    source: 'https://commons.wikimedia.org/wiki/File:MRI_Scanner_at_Narayana_Multispeciality_Hospital,_Jaipur.jpg',
    representative: true,
    sizes: ['960', '1920'],
  },
  'infosys-mysore': {
    caption: 'Infosys campus, Mysuru — part of India’s technology services ecosystem',
    title: 'Infosys Mysore Campus.jpg',
    author: 'L’Astorina',
    licence: 'CC BY 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Infosys_Mysore_Campus.jpg',
    representative: true,
    sizes: ['960', '1920'],
  },
  'mg-plant': {
    caption: 'Vehicle production line at MG Motor India’s plant in Halol, Gujarat',
    title: '2019 MG Hector at the MG Motor India manufacturing plant in Halol, Gujarat.png',
    author: 'VNM TV',
    licence: 'CC BY 3.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/3.0/',
    source: 'https://commons.wikimedia.org/wiki/File:2019_MG_Hector_at_the_MG_Motor_India_manufacturing_plant_in_Halol,_Gujarat.png',
    representative: true,
    sizes: ['960', '1920'],
  },
  'retail-bhopal': {
    caption: 'Department store floor at DB Mall, Bhopal',
    title: 'Shoppers Stop store in DB Mall, Bhopal, India (64066).jpg',
    author: 'Suyash Dwivedi',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Shoppers_Stop_store_in_DB_Mall,_Bhopal,_India_(64066).jpg',
    representative: true,
    sizes: ['960', '1920'],
  },
  'odia-workshop': {
    caption: 'Engineering students building Odia-language content at KMBB College of Engineering, Bhubaneswar',
    title: 'Odia Wikipedia workshop KMBB College of Engineering, Bhubaneswar 02.JPG',
    author: 'Manoranjan Behera',
    licence: 'CC BY-SA 3.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Odia_Wikipedia_workshop_KMBB_College_of_Engineering,_Bhubaneswar_02.JPG',
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
