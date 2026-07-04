/**
 * Skeleton Discovery (spec Chapter 3).
 *
 * Purpose: understand the avatar BEFORE animating it. This module only reads — it never rotates,
 * never animates, never assumes bone names. Every name is matched by PATTERN (side + anatomical
 * keyword), not hardcoded to one avatar, so a future avatar with different naming should still be
 * discoverable without code changes (spec: "Never hardcode names... search intelligently").
 *
 * Patterns currently recognized (documented, not hidden, per spec Rule 7/11):
 *   - Mixamo:           "mixamorig:LeftHandIndex1"  (colon prefix, stripped before matching)
 *   - Ready Player Me:  "LeftHandIndex1"             (no prefix)
 *   - Side:             name starts with "Left"/"Right" (case-insensitive) after prefix-strip.
 *   - Finger:           side + "Hand" + {Thumb,Index,Middle,Ring,Pinky} + digit(s).
 *   - Arm chain:        side + one of Shoulder / Arm (not ForeArm) / ForeArm / Hand (bare).
 *   - Spine:            "Hips" (root) then "Spine", "Spine1", "Spine2", ... in numeric order.
 *   - Head:             "Neck", "Head" (HeadTop_End is a tip marker, not part of the head bone itself).
 * If a future avatar uses a different convention (e.g. "hand_l", "thumb_01_l"), this function will
 * report those names in `unclassified` rather than silently misreading them — see spec Rule "Fail
 * Loudly": never guess, surface what couldn't be classified.
 */
import { decompose, distance, fromTRS, getTranslation, isFiniteVec3, multiply } from './math3d.ts';
import type { Mat4 } from './math3d.ts';
import type { GlTFDocument, GlTFNode } from './glbBinary.ts';
import type { ArmChain, AvatarHierarchy, BoneInfo, FingerChain, FingerName, HandSide, Quat, Vec3 } from './types.ts';

const FINGER_PATTERN = /(Thumb|Index|Middle|Ring|Pinky)(\d+)/i;
const ARM_KEYWORDS = ['Shoulder', 'ForeArm', 'LowerArm', 'Arm', 'Hand'] as const;

function stripPrefix(name: string): string {
  // Mixamo exports everything as "mixamorig:Bone" or "mixamoriginal_Bone" depending on exporter version.
  return name.replace(/^mixamorig:?/i, '');
}

function detectSide(strippedName: string): HandSide | null {
  if (/^Left/i.test(strippedName)) return 'left';
  if (/^Right/i.test(strippedName)) return 'right';
  return null;
}

function vec3FromArray(arr: [number, number, number] | undefined, fallback: number): Vec3 {
  if (!arr) return { x: fallback, y: fallback, z: fallback };
  return { x: arr[0], y: arr[1], z: arr[2] };
}

function quatFromArray(arr: [number, number, number, number] | undefined): Quat {
  if (!arr) return { x: 0, y: 0, z: 0, w: 1 };
  return { x: arr[0], y: arr[1], z: arr[2], w: arr[3] };
}

function localMatrix(node: GlTFNode): Mat4 {
  if (node.matrix) return node.matrix as Mat4;
  const t = vec3FromArray(node.translation, 0);
  const r = quatFromArray(node.rotation);
  const s = vec3FromArray(node.scale, 1);
  return fromTRS(t, r, s);
}

export function buildHierarchy(doc: GlTFDocument, sourceFile: string): AvatarHierarchy {
  const warnings: string[] = [];
  const nodes = doc.nodes ?? [];
  if (nodes.length === 0) {
    warnings.push('glTF document has zero nodes.');
  }

  // glTF only stores child pointers; invert to find each node's parent.
  const parentOf = new Map<number, number>();
  nodes.forEach((node, idx) => {
    for (const childIdx of node.children ?? []) {
      parentOf.set(childIdx, idx);
    }
  });

  // A node only counts as a "bone" if it's a joint referenced by a skin — this excludes mesh
  // container nodes (e.g. "Armature", "Alpha_Surface") that share the same node array.
  const skin = doc.skins?.[0];
  const jointIndices = new Set(skin?.joints ?? nodes.map((_, i) => i));
  if (!skin) {
    warnings.push('No skin found in glTF document — treating every node as a candidate bone.');
  }

  // Forward kinematics: world matrix = parent.world * local. Resolve in index order isn't safe
  // (children can have lower indices than parents in some exporters), so resolve recursively with
  // memoization instead of assuming array order.
  const worldMatrixCache = new Map<number, Mat4>();
  function worldMatrix(idx: number): Mat4 {
    const cached = worldMatrixCache.get(idx);
    if (cached) return cached;
    const node = nodes[idx];
    const local = localMatrix(node);
    const parentIdx = parentOf.get(idx);
    const world = parentIdx === undefined ? local : multiply(worldMatrix(parentIdx), local);
    worldMatrixCache.set(idx, world);
    return world;
  }

  const bones: Record<string, BoneInfo> = {};
  const nameByIndex = new Map<number, string>();

  for (const idx of jointIndices) {
    const node = nodes[idx];
    if (!node?.name) {
      warnings.push(`Joint node ${idx} has no name — skipped (cannot be referenced by future stages).`);
      continue;
    }
    nameByIndex.set(idx, node.name);
  }

  for (const idx of jointIndices) {
    const node = nodes[idx];
    const name = nameByIndex.get(idx);
    if (!node || !name) continue;

    const parentIdx = parentOf.get(idx);
    const parentIsJoint = parentIdx !== undefined && jointIndices.has(parentIdx);

    let t: Vec3;
    let r: Quat;
    let s: Vec3;
    if (parentIsJoint) {
      // Normal case: local transform is already relative to a tracked joint parent — use as-is.
      t = vec3FromArray(node.translation, 0);
      r = quatFromArray(node.rotation);
      s = vec3FromArray(node.scale, 1);
    } else {
      // This bone's real glTF parent (if any) is a non-joint container node — e.g. Mixamo's
      // "Armature" wrapper, which carries the scene's overall scale (commonly 0.01 for
      // centimeter-authored rigs). That scale is invisible to anything reading node.translation in
      // isolation. Bake the full accumulated transform (container + self) into this bone's local
      // fields instead, so "no joint parent" consistently means "my local transform already equals
      // my world transform" for every downstream consumer (the calibration validator, retargeting).
      const decomposed = decompose(worldMatrix(idx));
      t = decomposed.translation;
      r = decomposed.rotation;
      s = decomposed.scale;
      if (decomposed.mirrored) {
        warnings.push(`Bone "${name}" has a mirrored (negative-determinant) ancestor transform — scale sign may be unreliable.`);
      }
    }

    const world = getTranslation(worldMatrix(idx));
    if (!isFiniteVec3(world)) {
      warnings.push(`Bone "${name}" has a non-finite world position — check the rest pose / parent chain.`);
    }

    const parentName = parentIsJoint ? (nameByIndex.get(parentIdx!) ?? null) : null;
    const childNames = (node.children ?? [])
      .map((c) => nameByIndex.get(c))
      .filter((n): n is string => Boolean(n));

    bones[name] = {
      name,
      nodeIndex: idx,
      parent: parentName,
      children: childNames,
      localPosition: t,
      localRotation: r,
      localScale: s,
      worldPosition: world,
      length: null, // filled in below once all world positions are known
    };
  }

  // Bone length = distance to the first child (a simple, documented convention — see file header.
  // Multi-child bones like Hand have 5 finger children; length here is just for display/debug
  // capsules, not used by any retargeting math, which always reads worldPosition directly.
  for (const bone of Object.values(bones)) {
    const firstChildName = bone.children[0];
    const child = firstChildName ? bones[firstChildName] : undefined;
    bone.length = child ? distance(bone.worldPosition, child.worldPosition) : null;
  }

  // --- Anatomical classification (name-pattern based, see file header) ---
  const arms: Record<HandSide, ArmChain> = {
    left: { shoulder: null, upperArm: null, forearm: null, hand: null },
    right: { shoulder: null, upperArm: null, forearm: null, hand: null },
  };
  const hands: Record<HandSide, { hand: string | null; fingers: Partial<Record<FingerName, FingerChain>> }> = {
    left: { hand: null, fingers: {} },
    right: { hand: null, fingers: {} },
  };
  const spineEntries: { name: string; order: number }[] = [];
  let head: string | null = null;
  let root: string | null = null;
  const unclassified: string[] = [];

  const fingerJoints: Record<HandSide, Partial<Record<FingerName, { idx: number; name: string }[]>>> = {
    left: {},
    right: {},
  };

  for (const name of Object.values(bones).map((b) => b.name)) {
    const stripped = stripPrefix(name);
    const side = detectSide(stripped);
    const rest = side ? stripped.slice(side === 'left' ? 4 : 5) : stripped; // remove "Left"/"Right"

    if (/^Hips$/i.test(rest)) {
      root = name;
      continue;
    }
    if (/^Spine(\d*)$/i.test(rest)) {
      const m = rest.match(/^Spine(\d*)$/i)!;
      spineEntries.push({ name, order: m[1] ? parseInt(m[1], 10) : 0 });
      continue;
    }
    if (/^Neck$/i.test(rest)) continue; // included structurally via spine->head chain, not separately tracked
    if (/^Head$/i.test(rest)) {
      head = name;
      continue;
    }
    if (/^HeadTop_End$/i.test(rest)) continue; // tip marker, not an animatable bone

    if (side) {
      const fingerMatch = rest.match(FINGER_PATTERN);
      if (/Hand/i.test(rest) && fingerMatch) {
        const finger = fingerMatch[1].toLowerCase() as FingerName;
        const jointNum = parseInt(fingerMatch[2], 10);
        (fingerJoints[side][finger] ??= []).push({ idx: jointNum, name });
        continue;
      }
      if (/^Hand$/i.test(rest)) {
        arms[side].hand = name;
        hands[side].hand = name;
        continue;
      }
      if (/^Shoulder$/i.test(rest)) {
        arms[side].shoulder = name;
        continue;
      }
      if (/^(ForeArm|LowerArm)$/i.test(rest)) {
        arms[side].forearm = name;
        continue;
      }
      if (/^Arm$/i.test(rest)) {
        arms[side].upperArm = name;
        continue;
      }
      // Legs and other side-prefixed bones aren't relevant to ASL hand/arm animation — note and skip.
      if (/^(UpLeg|Leg|Foot|ToeBase|Toe_End)$/i.test(rest)) continue;
    }

    unclassified.push(name);
  }

  for (const side of ['left', 'right'] as const) {
    for (const finger of Object.keys(fingerJoints[side]) as FingerName[]) {
      const joints = fingerJoints[side][finger]!;
      joints.sort((a, b) => a.idx - b.idx);
      hands[side].fingers[finger] = joints.map((j) => j.name);
    }
  }

  spineEntries.sort((a, b) => a.order - b.order);
  const spine = spineEntries.map((e) => e.name);

  for (const side of ['left', 'right'] as const) {
    const { shoulder, upperArm, forearm, hand } = arms[side];
    if (!upperArm || !forearm || !hand) {
      warnings.push(`${side} arm chain incomplete (shoulder=${shoulder ?? 'none'}, upperArm=${upperArm ?? 'MISSING'}, forearm=${forearm ?? 'MISSING'}, hand=${hand ?? 'MISSING'}).`);
    }
    const expectedFingers: FingerName[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
    for (const f of expectedFingers) {
      const chain = hands[side].fingers[f];
      if (!chain || chain.length < 3) {
        warnings.push(`${side} ${f} finger chain has only ${chain?.length ?? 0} joint(s) (expected >= 3).`);
      }
    }
  }
  if (!root) warnings.push('No "Hips" root bone found — spine/world-position chain may be incomplete.');
  if (spine.length === 0) warnings.push('No Spine bones found.');
  if (!head) warnings.push('No Head bone found.');
  ARM_KEYWORDS; // referenced in docstring only — kept for readers grepping for the pattern list

  return {
    sourceFile,
    generatedAt: new Date().toISOString(),
    totalNodes: nodes.length,
    totalBones: Object.keys(bones).length,
    bones,
    root,
    arms,
    hands,
    spine,
    head,
    unclassified,
    warnings,
  };
}
