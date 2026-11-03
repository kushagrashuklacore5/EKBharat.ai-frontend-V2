/** layer names, in the order the layers are built (bottom → top) */
export const GPU_LAYERS = [
  { name: 'Backplate & I/O bracket', note: 'Rigidity, mounting and display/IO outputs' },
  { name: 'Multi-layer PCB', note: 'Copper planes, routing and thousands of passives' },
  { name: 'Power delivery', note: 'Chokes, MOSFETs and capacitors for clean power' },
  { name: 'GPU package', note: 'The die on its substrate, with micro-bumps and BGA' },
  { name: 'Memory', note: '12 high-bandwidth memory packages around the GPU' },
  { name: 'Thermal interface', note: 'Paste on the die, pads on memory and power stages' },
  { name: 'Cold plate', note: 'Machined contact plate with retention springs' },
  { name: 'Heat pipes', note: 'Copper pipes carrying heat to the fin stack' },
  { name: 'Heatsink', note: 'Aluminium fin stack inside the shroud' },
] as const
