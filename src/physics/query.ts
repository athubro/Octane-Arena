import type RAPIER from "@dimforge/rapier3d-compat";

/** Ray queries for arena surfaces must ignore colliders disabled for this mode. */
export function activeStaticCollider(collider: RAPIER.Collider) {
  return collider.parent() === null && collider.collisionGroups() !== 0;
}
