/** Starter body dimensions are shared by art and physics.
 * Bodies have distinct silhouettes and matching physical hitboxes.
 * Vary silhouettes, not just heights: Vector is an upright rally hatch; future
 * bodies should explore distinct buggy, truck or van proportions and details.
 */
export const bodies = {
  // Simulation's neutral spawn collider. The garage always replaces this
  // with the selected body before a match begins.
  standard: {
    name: "Standard",
    halfWidth: 0.42,
    halfHeight: 0.18,
    halfLength: 0.59,
    hitboxY: 0.04,
    axle: 0.43,
  },
  vector: {
    name: "Vector",
    halfWidth: 0.43,
    halfHeight: 0.19,
    halfLength: 0.6,
    hitboxY: 0.05, // A slightly taller replacement body with matching roof clearance.
    axle: 0.43,
  },
  riptide: {
    name: "Riptide",
    halfWidth: 0.43,
    halfHeight: 0.22,
    halfLength: 0.64,
    hitboxY: 0.1,
    axle: 0.47,
  },
} as const;
export type BodyId = keyof typeof bodies;
export type PresetBodyId = Exclude<BodyId, "standard">;
export const inventory = {
  body: [
    { id: "vector", name: "Vector" },
    { id: "riptide", name: "Riptide" },
  ],
  wheels: [
    { id: "apex", name: "Apex" },
    { id: "disc", name: "Orbit" },
  ],
  boost: [
    { id: "plasma", name: "Plasma" },
    { id: "ember", name: "Ember" },
  ],
  topper: [
    { id: "none", name: "None" },
    { id: "cat-ears", name: "Cat Ears" },
    { id: "fox-ears", name: "Fox Ears" },
    { id: "spike-crown", name: "Spike Crown" },
    { id: "shark-fin", name: "Shark Fin" },
    { id: "owl", name: "Owl" },
  ],
  decal: [
    { id: "none", name: "None" },
    { id: "circuit", name: "Circuit" },
  ],
  explosion: [
    { id: "pulse", name: "Pulse" },
    { id: "forest-growth", name: "Forest Growth" },
    { id: "blue-out", name: "Blue Out" },
    { id: "skull", name: "Skull" },
  ],
} as const;
export type CosmeticSlot = keyof typeof inventory;
export type Team = "blue" | "orange";
export interface Preset {
  id: string;
  name: string;
  body: PresetBodyId;
  blue: string;
  orange: string;
  wheels: string;
  boost: string;
  topper: string;
  decal: string;
  explosion: string;
}
export const palette = [
  "#e6faff",
  "#80e5ef",
  "#36cedd",
  "#138dba",
  "#185690",
  "#203b63",
  "#f0eaff",
  "#b8b0fa",
  "#8173e9",
  "#6950b2",
  "#4f3388",
  "#30244e",
  "#ffe5f2",
  "#f5a6cf",
  "#e066a5",
  "#be3982",
  "#8b2862",
  "#531d41",
  "#ffebe0",
  "#ffc693",
  "#f89a49",
  "#e36a30",
  "#ab4225",
  "#672b24",
  "#fff7d6",
  "#ffe69b",
  "#edc74d",
  "#be962c",
  "#876521",
  "#4d411e",
  "#e2ffee",
  "#9fedc2",
  "#50d59e",
  "#249a7a",
  "#176557",
  "#1a403b",
  "#f2f6fa",
  "#c3d0db",
  "#8c9daa",
  "#5c6f80",
  "#354756",
  "#1b2734",
];
export const starter = (): Preset => ({
  id: "starter",
  name: "Preset 1",
  body: "vector",
  blue: "#36cedd",
  orange: "#f89a49",
  wheels: "apex",
  boost: "plasma",
  topper: "none",
  decal: "none",
  explosion: "pulse",
});
