import RAPIER from "@dimforge/rapier3d-compat";
import { Vector3, Quaternion } from "three";
import { P } from "../config/physics";
import { Car } from "../car/car";
import { createArena, createRingPlatform } from "../arena/physics";
import { Pose } from "./pose";
import type { Controls } from "../input/types";
import {
  neutralInput,
  type PlayerEntity,
  type PlayerInput,
} from "../../shared/player";
import type { MatchSnapshot } from "../../shared/party";
import { canDemolish, respawnLocations } from "../game/demolition";
import { bodies } from "../game/inventory";
export interface Hit {
  position: Vector3;
  normal: Vector3;
  relative: Vector3;
  impulse: Vector3;
  strength: number;
  age: number;
}
function insideRoundedArena(x: number, z: number, inset = 0) {
  const { halfWidth, halfLength, corner } = P.arena,
    width = halfWidth - inset,
    length = halfLength - inset,
    radius = Math.max(0, corner - inset),
    ax = Math.abs(x),
    az = Math.abs(z);
  if (ax > width || az > length) return false;
  if (ax <= width - radius || az <= length - radius) return true;
  const dx = ax - (width - radius),
    dz = az - (length - radius);
  return dx * dx + dz * dz <= radius * radius;
}
function insideGoalTunnel(x: number, y: number, z: number, inset = 0) {
  const { halfLength, goalDepth, goalHalf, goalLip, goalHeight } = P.arena;
  return (
    Math.abs(z) > halfLength &&
    Math.abs(z) <= halfLength + goalDepth - inset &&
    Math.abs(x) <= goalHalf + goalLip - inset &&
    y <= goalHeight + goalLip - inset
  );
}
function carInsideArenaEnvelope(
  car: Car,
  x: number,
  z: number,
  rotation = car.body.rotation(),
) {
  const { halfWidth, halfLength, corner } = P.arena;
  const dimensions = bodies[car.bodyId];
  const right = new Vector3(1, 0, 0).applyQuaternion(
    new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w),
  );
  const forward = new Vector3(0, 0, -1).applyQuaternion(
    new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w),
  );
  const halfX =
      Math.abs(right.x) * dimensions.halfWidth +
      Math.abs(forward.x) * dimensions.halfLength,
    halfZ =
      Math.abs(right.z) * dimensions.halfWidth +
      Math.abs(forward.z) * dimensions.halfLength,
    ax = Math.abs(x),
    az = Math.abs(z),
    cornerX = halfWidth - corner,
    cornerZ = halfLength - corner,
    margin = 0.05;

  // Expand the straight walls by the rotated car footprint. At the rounded
  // corners, expand along the local wall normal instead of using one large
  // radius for every direction.
  if (ax <= cornerX && az <= cornerZ) return true;
  if (ax <= cornerX) return az <= halfLength + halfZ + margin;
  if (az <= cornerZ) return ax <= halfWidth + halfX + margin;
  const dx = ax - cornerX,
    dz = az - cornerZ,
    distance = Math.hypot(dx, dz);
  if (distance <= corner || distance === 0) return true;
  const nx = dx / distance,
    nz = dz / distance,
    support =
      Math.abs(nx * right.x + nz * right.z) * dimensions.halfWidth +
      Math.abs(nx * forward.x + nz * forward.z) * dimensions.halfLength;
  return distance <= corner + support + margin;
}
function carInsideArenaBounds(
  car: Car,
  x: number,
  y: number,
  z: number,
  rotation = car.body.rotation(),
) {
  return (
    y >= -2.5 &&
    (carInsideArenaEnvelope(car, x, z, rotation) ||
      insideGoalTunnel(
        x,
        y,
        z,
        -(
          Math.max(
            bodies[car.bodyId].halfWidth,
            bodies[car.bodyId].halfLength,
          ) + 0.05
        ),
      ))
  );
}
export class Simulation {
  world: RAPIER.World;
  private arenaColliders: RAPIER.Collider[];
  private ringPlatform: RAPIER.Collider[];
  private ringCourseEnabled = false;
  private ringSpawn = { x: 0, y: 0.36, z: 51 };
  cars: Car[];
  ball: RAPIER.RigidBody;
  ballCollider: RAPIER.Collider;
  ballPose: Pose;
  events = new RAPIER.EventQueue(true);
  hits: Hit[] = [];
  clock = 0;
  demolitions: {
    attackerId: string;
    victimId: string;
    position: Vector3;
    age: number;
  }[] = [];
  lastTouchId: string | null = null;
  private velocities: Vector3[] = [];
  private cooldown: number[] = [];
  private relative: Vector3[] = [];
  private safeCarTransforms = new Map<
    Car,
    { position: Vector3; rotation: Quaternion }
  >();
  configuredCount: number;
  private readonly flatArena: boolean;
  constructor(
    flat = false,
    players: PlayerEntity[] = [
      { id: "player", name: "Guest", team: 0, controller: "local" },
      { id: "bot", name: "Rival", team: 1, controller: "bot" },
    ],
  ) {
    this.flatArena = flat;
    if (
      players.length < 1 ||
      players.length > 4 ||
      new Set(players.map((p) => p.id)).size !== players.length ||
      players.some((p) => !p.id || ![0, 1].includes(p.team))
    )
      throw Error("A simulation needs 1–4 unique player IDs and valid teams");
    this.configuredCount = players.length;
    this.world = new RAPIER.World({ x: 0, y: -P.gravity, z: 0 });
    this.world.timestep = P.dt;
    this.world.numSolverIterations = 8;
    this.arenaColliders = createArena(this.world, flat);
    this.ringPlatform = createRingPlatform(this.world);
    for (const collider of this.ringPlatform) collider.setCollisionGroups(0);
    this.cars = players.map(() => new Car(this.world));
    this.velocities = players.map(() => new Vector3());
    this.relative = players.map(() => new Vector3());
    this.cooldown = players.map(() => 0);
    this.cars.forEach((c, i) => {
      c.id = players[i].id;
      c.team = players[i].team;
      c.displayName = players[i].name;
      c.controller = players[i].controller;
    });
    this.cars.forEach((c) =>
      c.collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    );
    this.ball = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, P.ball.radius + 0.02, 0)
        .setCcdEnabled(true)
        .setLinearDamping(P.ball.drag)
        .setAngularDamping(P.ball.angularDrag),
    );
    this.ballCollider = this.world.createCollider(
      RAPIER.ColliderDesc.ball(P.ball.radius)
        .setMass(P.ball.mass)
        .setFriction(P.ball.friction)
        .setRestitution(P.ball.restitution)
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      this.ball,
    );
    this.ballPose = new Pose(this.ball);
    this.reset();
    this.world.step();
    this.cars.forEach((c) => c.pose.snap());
    this.ballPose.snap();
  }
  setRingCourse(enabled: boolean, spawn = { x: 0, y: 0.36, z: 51 }) {
    this.ringCourseEnabled = enabled;
    this.ringSpawn = spawn;
    for (const collider of this.arenaColliders)
      collider.setCollisionGroups(enabled ? 0 : 0xffffffff);
    for (const collider of this.ringPlatform)
      collider.setCollisionGroups(enabled ? 0xffffffff : 0);
  }
  reset() {
    this.safeCarTransforms.clear();
    for (const c of this.cars) {
      if (!c.active) {
        c.body.setEnabled(false);
        c.collider.setCollisionGroups(0);
        continue;
      }
      if (c.demolitionState !== "active") {
        c.body.setEnabled(true);
        c.collider.setCollisionGroups(0xffffffff);
      }
    }
    this.demolitions = [];
    this.lastTouchId = null;
    this.ballCollider.setCollisionGroups(0xffffffff);
    this.ball.setEnabled(true);
    for (const c of this.cars) {
      if (!c.active) continue;
      const team = this.cars.filter((p) => p.active && p.team === c.team),
        slot = team.indexOf(c);
      if (this.ringCourseEnabled)
        c.reset(this.ringSpawn.x, this.ringSpawn.z, 0, this.ringSpawn.y);
      else
        c.reset(
          team.length === 1 ? 0 : (slot - (team.length - 1) / 2) * 12,
          c.team === 0 ? 26 : -26,
          c.team === 0 ? 0 : Math.PI,
        );
    }
    this.ball.setTranslation({ x: 0, y: P.ball.radius + 0.02, z: 0 }, true);
    this.ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.ballPose.snap();
    this.hits = [];
    this.cooldown = this.cars.map(() => 0);
  }
  configurePlayers(players: PlayerEntity[]) {
    if (
      players.length < 1 ||
      players.length > this.cars.length ||
      new Set(players.map((p) => p.id)).size !== players.length ||
      players.some((p) => !p.id || ![0, 1].includes(p.team))
    )
      throw Error("A simulation needs valid, unique player IDs and teams");
    this.configuredCount = players.length;
    this.cars.forEach((car, i) => {
      const player = players[i];
      car.active = !!player;
      if (!player) {
        car.body.setEnabled(false);
        car.collider.setCollisionGroups(0);
        return;
      }
      car.id = player.id;
      car.displayName = player.name;
      car.team = player.team;
      car.controller = player.controller;
      car.body.setEnabled(true);
      car.collider.setCollisionGroups(0xffffffff);
    });
  }
  setActiveCount(count: number) {
    if (!Number.isInteger(count) || count < 1 || count > this.configuredCount)
      throw Error("Invalid active player count");
    this.cars.forEach((car, i) => {
      car.active = i < count;
      car.body.setEnabled(car.active);
      car.collider.setCollisionGroups(car.active ? 0xffffffff : 0);
    });
  }
  applyNetworkSnapshot(snapshot: MatchSnapshot) {
    this.clock = snapshot.clock;
    this.lastTouchId = snapshot.lastTouchId;
    const ball = snapshot.ball;
    this.ballPose.before();
    this.ball.setEnabled(ball.enabled);
    this.ballCollider.setCollisionGroups(ball.enabled ? 0xffffffff : 0);
    this.ball.setTranslation(
      { x: ball.position[0], y: ball.position[1], z: ball.position[2] },
      true,
    );
    this.ball.setRotation(
      {
        x: ball.rotation[0],
        y: ball.rotation[1],
        z: ball.rotation[2],
        w: ball.rotation[3],
      },
      true,
    );
    this.ball.setLinvel(
      { x: ball.velocity[0], y: ball.velocity[1], z: ball.velocity[2] },
      true,
    );
    this.ball.setAngvel(
      {
        x: ball.angularVelocity[0],
        y: ball.angularVelocity[1],
        z: ball.angularVelocity[2],
      },
      true,
    );
    this.ballPose.after();
    for (const state of snapshot.cars) {
      const car = this.cars.find((candidate) => candidate.id === state.id);
      if (!car) continue;
      car.pose.before();
      car.body.setEnabled(state.enabled);
      car.collider.setCollisionGroups(state.enabled ? 0xffffffff : 0);
      car.body.setTranslation(
        { x: state.position[0], y: state.position[1], z: state.position[2] },
        true,
      );
      car.body.setRotation(
        {
          x: state.rotation[0],
          y: state.rotation[1],
          z: state.rotation[2],
          w: state.rotation[3],
        },
        true,
      );
      car.body.setLinvel(
        { x: state.velocity[0], y: state.velocity[1], z: state.velocity[2] },
        true,
      );
      car.body.setAngvel(
        {
          x: state.angularVelocity[0],
          y: state.angularVelocity[1],
          z: state.angularVelocity[2],
        },
        true,
      );
      car.pose.after();
      car.boost = state.boost;
      car.boosting = state.boosting;
      car.demolitionState = state.demolitionState;
      car.respawnTimer = state.respawnTimer;
      car.supersonic = state.supersonic;
      car.forwardSpeed = state.forwardSpeed;
      car.steerAngle = state.steerAngle;
      car.grounded = state.grounded;
      state.wheelOrigins.forEach((v, i) =>
        car.wheelOrigins[i]?.set(v[0], v[1], v[2]),
      );
      state.wheelHits.forEach((v, i) =>
        car.wheelHits[i]?.set(v[0], v[1], v[2]),
      );
      car.wheelContact.splice(
        0,
        car.wheelContact.length,
        ...state.wheelContact,
      );
      const q = car.body.rotation(),
        rotation = new Quaternion(q.x, q.y, q.z, q.w);
      car.forward.set(0, 0, -1).applyQuaternion(rotation);
      car.right.set(1, 0, 0).applyQuaternion(rotation);
      car.up.set(0, 1, 0).applyQuaternion(rotation);
    }
  }
  /** Physical blast; the match keeps steering, aerial control and boost live. */
  explode(origin: { x: number; y: number; z: number }) {
    this.ballCollider.setCollisionGroups(0);
    this.ball.setEnabled(false);
    for (const c of this.cars) {
      if (c.demolitionState !== "active") continue;
      const direction = new Vector3().subVectors(c.body.translation(), origin);
      const distance = direction.length();
      direction.y = Math.max(3, distance * 0.28);
      const speed =
        P.match.explosionFar +
        (P.match.explosionNear - P.match.explosionFar) *
          Math.exp(-distance / 40);
      c.body.applyImpulse(
        direction.normalize().multiplyScalar(P.car.mass * speed),
        true,
      );
      c.body.applyTorqueImpulse(
        { x: 35, y: 0, z: c.body.translation().x >= 0 ? 45 : -45 },
        true,
      );
      c.boosting = false;
    }
  }
  step(inputs: Controls[] | ReadonlyMap<string, PlayerInput>, passive = false) {
    this.clock += P.dt;
    this.demolitions = this.demolitions.filter((e) => (e.age += P.dt) < 1);
    this.cars.forEach((c) => {
      if (c.demolitionState === "active") return;
      c.respawnTimer = Math.max(0, c.respawnTimer - P.dt);
      if (c.respawnTimer > 1e-8) return;
      c.demolitionState = "respawning";
      const locations = respawnLocations(c.team),
        start = Math.floor(Math.random() * locations.length);
      for (let i = 0; i < locations.length; i++) {
        const p = locations[(start + i) % locations.length];
        if (
          this.cars.some(
            (other) =>
              other !== c &&
              other.body.isEnabled() &&
              p.distanceTo(other.body.translation()) < 4,
          ) ||
          p.distanceTo(this.ball.translation()) < 2.5
        )
          continue;
        c.reset(p.x, p.z, c.team === 0 ? 0 : Math.PI);
        c.boost = P.demolition.boost;
        c.collider.setCollisionGroups(0xffffffff);
        c.body.setEnabled(true);
        break;
      }
    });
    this.hits = this.hits.filter((h) => (h.age += P.dt) < 0.6);
    this.cars.forEach((c, i) => {
      if (
        !this.flatArena &&
        !this.ringCourseEnabled &&
        c.active &&
        c.body.isEnabled()
      ) {
        const position = c.body.translation();
        if (carInsideArenaBounds(c, position.x, position.y, position.z))
          this.rememberSafeCarTransform(c);
      }
      c.pose.before();
      if (!passive && c.body.isEnabled())
        c.tick(
          (Array.isArray(inputs) ? inputs[i] : inputs.get(c.id)) ??
            neutralInput(),
        );
      c.constrainSurface();
      c.updateSupersonic(P.dt);
      this.velocities[i].copy(c.body.linvel());
      this.relative[i].copy(c.body.linvel()).sub(this.ball.linvel());
      this.cooldown[i] = Math.max(0, this.cooldown[i] - P.dt);
    });
    this.ballPose.before();
    this.world.step(this.events);
    this.events.drainCollisionEvents((a, b, started) => {
      if (
        started &&
        this.cars.some((c) => c.collider.handle === a) &&
        this.cars.some((c) => c.collider.handle === b)
      ) {
        this.bump(
          this.cars.findIndex((c) => c.collider.handle === a),
          this.cars.findIndex((c) => c.collider.handle === b),
        );
        return;
      }
      if (
        !started ||
        (a !== this.ballCollider.handle && b !== this.ballCollider.handle)
      )
        return;
      const carIndex = this.cars.findIndex(
        (c) => c.collider.handle === (a === this.ballCollider.handle ? b : a),
      );
      if (carIndex >= 0) {
        this.lastTouchId = this.cars[carIndex].id;
        this.strike(carIndex);
      } else {
        const speed = new Vector3()
          .subVectors(
            this.ball.linvel(),
            this.ballPose.current
              .clone()
              .sub(this.ballPose.previous)
              .multiplyScalar(1 / P.dt),
          )
          .length();
        if (speed > 1)
          this.hits.push({
            position: new Vector3().copy(this.ball.translation()),
            normal: new Vector3(0, 1, 0),
            relative: new Vector3(),
            impulse: new Vector3(),
            strength: Math.min(speed, 20),
            age: 0,
          });
      }
    });
    const cap = (body: RAPIER.RigidBody, speed: number, angular: number) => {
      const v = new Vector3().copy(body.linvel()),
        w = new Vector3().copy(body.angvel());
      if (v.length() > speed) body.setLinvel(v.clampLength(0, speed), true);
      if (w.length() > angular) body.setAngvel(w.clampLength(0, angular), true);
    };
    cap(this.ball, P.ball.maxSpeed, P.ball.maxAngular);
    this.cars.forEach((c) => {
      c.constrainSurface(true);
      cap(c.body, c.maxLinearSpeed, c.angularLimit);
      c.pose.after();
    });
    this.ballPose.after();
    if (this.ringCourseEnabled) this.recoverRingEscape();
    else if (!this.flatArena) this.recoverEscapedBodies();
  }
  private recoverRingEscape() {
    for (const car of this.cars) {
      if (!car.active || !car.body.isEnabled()) continue;
      const p = car.body.translation();
      // Keep the course inside its visible deck and prevent corner/collider
      // tunnelling from launching a car into the disabled stadium shell.
      // Test the full car center against the physical deck footprint. The
      // larger margin accounts for the car body before it can cross a rail.
      if (
        Math.abs(p.x) <= 11.1 &&
        p.z >= -96.9 &&
        p.z <= 56.9 &&
        p.y >= -1.5 &&
        p.y <= 35
      )
        continue;
      const boost = car.boost;
      car.reset(this.ringSpawn.x, this.ringSpawn.z, 0, this.ringSpawn.y);
      car.boost = boost;
    }
  }
  private rememberSafeCarTransform(car: Car) {
    let safe = this.safeCarTransforms.get(car);
    if (!safe) {
      safe = { position: new Vector3(), rotation: new Quaternion() };
      this.safeCarTransforms.set(car, safe);
    }
    safe.position.copy(car.body.translation());
    safe.rotation.copy(car.body.rotation());
  }
  private recoverEscapedBodies() {
    for (const car of this.cars) {
      if (!car.active || !car.body.isEnabled()) continue;
      const p = car.body.translation();
      if (carInsideArenaBounds(car, p.x, p.y, p.z)) {
        this.rememberSafeCarTransform(car);
        continue;
      }

      // A missed wall contact must not turn into a kickoff-style respawn.
      // Restore this physics step's known-good transform and cancel only the
      // outward part of the motion that carried the car beyond the boundary.
      const safe = this.safeCarTransforms.get(car),
        last = safe?.position ?? car.pose.previous,
        lastRotation = safe?.rotation ?? car.pose.previousQ;
      if (
        carInsideArenaBounds(
          car,
          last.x,
          last.y,
          last.z,
          lastRotation,
        )
      ) {
        const displacement =
            p.y < -2.5
              ? new Vector3(0, p.y - last.y, 0)
              : new Vector3(p.x - last.x, 0, p.z - last.z),
          velocity = new Vector3().copy(car.body.linvel());
        if (displacement.lengthSq() > 1e-8) {
          displacement.normalize();
          const outwardSpeed = velocity.dot(displacement);
          if (outwardSpeed > 0)
            velocity.addScaledVector(displacement, -outwardSpeed);
        }
        if (p.y < -2.5 && velocity.y < 0) velocity.y = 0;
        car.body.setTranslation({ x: last.x, y: last.y, z: last.z }, true);
        car.body.setRotation(lastRotation, true);
        car.body.setLinvel(velocity, true);
        car.pose.snap();
        this.rememberSafeCarTransform(car);
        continue;
      }

      // If no safe sample exists, project this pose back into the rounded
      // playable footprint. Do not turn a collision recovery into a respawn.
      const dimensions = bodies[car.bodyId],
        rotation = new Quaternion().copy(car.body.rotation()),
        velocity = new Vector3().copy(car.body.linvel());
      let x = p.x,
        z = p.z;
      for (let i = 0; i < 80 && !carInsideArenaEnvelope(car, x, z, rotation); i++) {
        x *= 0.94;
        z *= 0.94;
      }
      const y = p.y < -2.5 ? Math.max(0.36, dimensions.hitboxY + dimensions.halfHeight) : p.y,
        outward = new Vector3(p.x - x, p.y - y, p.z - z);
      if (outward.lengthSq() > 1e-8) {
        outward.normalize();
        const outwardSpeed = velocity.dot(outward);
        if (outwardSpeed > 0)
          velocity.addScaledVector(outward, -outwardSpeed);
      }
      if (p.y < -2.5 && velocity.y < 0) velocity.y = 0;
      car.body.setTranslation({ x, y, z }, true);
      car.body.setLinvel(velocity, true);
      car.pose.snap();
      this.rememberSafeCarTransform(car);
    }
    const p = this.ball.translation();
    if (
      p.y < -2.5 ||
      (!insideRoundedArena(p.x, p.z, P.ball.radius - 1.5) &&
        !insideGoalTunnel(p.x, p.y, p.z, P.ball.radius - 1.5))
    ) {
      this.ball.setTranslation({ x: 0, y: P.ball.radius + 0.02, z: 0 }, true);
      this.ball.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      this.ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
      this.ballPose.snap();
    }
  }
  private strike(i: number) {
    if (this.cooldown[i] > 0) return;
    this.cooldown[i] = P.hit.cooldown;
    const c = this.cars[i],
      n = new Vector3()
        .subVectors(this.ball.translation(), c.body.translation())
        .normalize(),
      closing = Math.max(0, this.relative[i].dot(n));
    if (closing < P.hit.minClosing) return;
    const local = n
      .clone()
      .applyQuaternion(new Quaternion().copy(c.body.rotation()).invert());
    const front = Math.max(0, -local.z),
      roof = Math.max(0, local.y),
      underside = Math.max(0, -local.y);
    const gain =
      P.hit.sideGain +
      (P.hit.frontGain - P.hit.sideGain) * front * front +
      (P.hit.roofGain - P.hit.sideGain) * roof * roof +
      (P.hit.undersideGain - P.hit.sideGain) * underside * underside;
    const direction = n
      .clone()
      .lerp(c.forward, 0.22 * front)
      .normalize();
    const impulse = direction.multiplyScalar(
      Math.min(P.hit.maxExtra, closing * gain) * P.ball.mass,
    );
    const point = new Vector3()
      .copy(this.ball.translation())
      .addScaledVector(n, -P.ball.radius);
    this.ball.applyImpulseAtPoint(impulse, point, true);
    this.hits.push({
      position: point,
      normal: n,
      relative: this.relative[i].clone(),
      impulse: impulse.clone(),
      strength: closing,
      age: 0,
    });
  }
  private bump(first: number, second: number) {
    const a = this.cars[first],
      b = this.cars[second];
    for (const [i, j] of [
      [first, second],
      [second, first],
    ]) {
      const attacker = this.cars[i],
        victim = this.cars[j];
      if (
        !canDemolish(attacker, victim, this.velocities[i], this.velocities[j])
      )
        continue;
      let bumperContact = false;
      this.world.contactPair(
        attacker.collider,
        victim.collider,
        (manifold, flipped) => {
          for (let k = 0; k < manifold.numContacts(); k++) {
            const point = flipped
              ? manifold.localContactPoint2(k)
              : manifold.localContactPoint1(k);
            if (
              point &&
              point.z < -bodies[attacker.bodyId].halfLength * 0.8 &&
              manifold.contactDist(k) < 0.03
            )
              bumperContact = true;
          }
        },
      );
      if (!bumperContact) continue;
      victim.demolitionState = "demolished";
      victim.respawnTimer = P.demolition.respawn;
      victim.boosting = victim.supersonic = false;
      victim.skidIntensity = 0;
      victim.wheelContact.fill(false);
      victim.collider.setCollisionGroups(0);
      victim.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      victim.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      victim.body.setEnabled(false);
      this.demolitions.push({
        attackerId: attacker.id,
        victimId: victim.id,
        position: new Vector3().copy(victim.body.translation()),
        age: 0,
      });
      return;
    }
    const normal = new Vector3()
      .subVectors(b.body.translation(), a.body.translation())
      .normalize();
    const relative = this.relative[first].clone().sub(this.relative[second]);
    const closing = Math.max(0, relative.dot(normal));
    if (closing < P.bump.minClosing) return;
    const impulse = normal
      .clone()
      .multiplyScalar(
        Math.min(P.bump.maxExtra, closing * P.bump.gain) * P.car.mass,
      );
    a.body.applyImpulse(impulse.clone().negate(), true);
    b.body.applyImpulse(impulse, true);
    a.impactTime = b.impactTime = P.bump.recovery;
    this.hits.push({
      position: new Vector3()
        .copy(a.body.translation())
        .lerp(b.body.translation(), 0.5),
      normal,
      relative,
      impulse,
      strength: closing,
      age: 0,
    });
  }
  dispose() {
    this.events.free();
    this.world.free();
  }
}
