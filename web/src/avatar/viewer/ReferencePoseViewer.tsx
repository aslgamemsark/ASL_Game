/**
 * AvatarLab: Reference Pose viewer — the browser half of the permanent Reference Pose System (see
 * docs/REFERENCE_POSE_SPEC.md). Side by side: the human-posed Blender ground truth (left) vs the
 * engine's current solver output for the same sign/frame (right), plus a per-bone numeric diff list
 * that is exactly what referencePoseRegression.test.ts asserts on in CI — this view exists so a
 * failing test can be understood visually, not as a separate source of truth from the numbers.
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { parseGlb } from '../calibration/glbBinary.ts';
import { buildHierarchy } from '../calibration/SkeletonInspector.ts';
import { buildCalibration } from '../calibration/CalibrationEngine.ts';
import { compareReferencePose } from '../reference/ReferencePoseCompare.ts';
import { resolveAnimationForSign } from '../animation/AnimationSource.ts';
import type { AvatarHierarchy, CalibrationProfile } from '../calibration/types.ts';
import type { ReferencePoseComparisonResult, ReferencePoseIndex, ReferencePoseMetadata } from '../reference/types.ts';

const AVATAR_URL = '/models/avatar/ybot.glb';

function stripName(n: string) {
  return n.replace(/^mixamorig:?/i, '');
}

function createViewport(container: HTMLDivElement) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x151a23);
  scene.add(new THREE.GridHelper(2, 20, 0x333844, 0x22262f));
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(1, 2, 1);
  scene.add(dirLight);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  camera.position.set(0.9, 1.5, 1.6);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.0, 0);
  controls.enableDamping = true;

  const bones = new Map<string, THREE.Object3D>();
  new GLTFLoader().load(AVATAR_URL, (gltf) => {
    scene.add(gltf.scene);
    gltf.scene.traverse((obj) => {
      if (obj.name) bones.set(stripName(obj.name), obj);
    });
  });

  const resize = () => {
    if (container.clientWidth === 0 || container.clientHeight === 0) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  let raf = 0;
  const animate = () => {
    raf = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  };
  animate();

  return {
    bones,
    dispose: () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    },
  };
}

export function ReferencePoseViewer() {
  const refContainerRef = useRef<HTMLDivElement>(null);
  const solverContainerRef = useRef<HTMLDivElement>(null);
  const refBonesRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const solverBonesRef = useRef<Map<string, THREE.Object3D>>(new Map());

  const [hierarchy, setHierarchy] = useState<AvatarHierarchy | null>(null);
  const [calibration, setCalibration] = useState<CalibrationProfile | null>(null);
  const [poseIds, setPoseIds] = useState<string[] | null>(null); // null = still loading
  const [selectedPoseId, setSelectedPoseId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ReferencePoseMetadata | null>(null);
  const [allPoses, setAllPoses] = useState<ReferencePoseMetadata[]>([]);
  const [comparison, setComparison] = useState<ReferencePoseComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(AVATAR_URL)
      .then((r) => r.arrayBuffer())
      .then((buffer) => {
        const h = buildHierarchy(parseGlb(buffer).json, AVATAR_URL);
        setHierarchy(h);
        setCalibration(buildCalibration(h, buffer));
      })
      .catch((e) => setError(`Rig load failed: ${(e as Error).message}`));

    fetch('/reference_poses/metadata/index.json')
      .then((r) => (r.ok ? r.json() : { poses: [] }))
      .then(async (idx: ReferencePoseIndex) => {
        const ids = idx.poses ?? [];
        setPoseIds(ids);
        if (ids.length) setSelectedPoseId(ids[0]);
        const loaded = await Promise.all(ids.map((id) => fetch(`/reference_poses/metadata/${id}.json`).then((r) => r.json())));
        setAllPoses(loaded);
      })
      .catch(() => setPoseIds([]));
  }, []);

  useEffect(() => {
    const refContainer = refContainerRef.current;
    const solverContainer = solverContainerRef.current;
    if (!refContainer || !solverContainer) return;
    const refVp = createViewport(refContainer);
    const solverVp = createViewport(solverContainer);
    refBonesRef.current = refVp.bones;
    solverBonesRef.current = solverVp.bones;
    return () => {
      refVp.dispose();
      solverVp.dispose();
    };
  }, []);

  useEffect(() => {
    if (!selectedPoseId) {
      setMetadata(null);
      return;
    }
    fetch(`/reference_poses/metadata/${selectedPoseId}.json`)
      .then((r) => r.json())
      .then(setMetadata)
      .catch((e) => setError(`Reference pose load failed: ${(e as Error).message}`));
  }, [selectedPoseId]);

  useEffect(() => {
    if (!hierarchy || !calibration || !metadata) {
      setComparison(null);
      return;
    }
    try {
      setComparison(compareReferencePose(hierarchy, calibration, metadata, allPoses));
    } catch (e) {
      setError(`Comparison failed: ${(e as Error).message}`);
    }
  }, [hierarchy, calibration, metadata, allPoses]);

  // Pose the reference viewport directly from the metadata's bone rotations (every bone it recorded).
  useEffect(() => {
    if (!metadata) return;
    const bones = refBonesRef.current;
    for (const [boneName, pose] of Object.entries(metadata.bones)) {
      const obj = bones.get(stripName(boneName));
      if (obj) obj.quaternion.set(pose.rotation[0], pose.rotation[1], pose.rotation[2], pose.rotation[3]);
    }
  }, [metadata]);

  // Pose the solver viewport via the SAME resolveAnimationForSign path compareReferencePose just
  // used — whichever source it actually resolved to (keyframe-driven or procedural IK), applying
  // every bone that source computed, not just arms (so a keyframe-driven pose renders faithfully).
  useEffect(() => {
    if (!hierarchy || !calibration || !metadata || !comparison) return;
    try {
      const result = resolveAnimationForSign(hierarchy, calibration, metadata.signName, allPoses);
      const frameBones = result.frames[comparison.frameIndex];
      const bones = solverBonesRef.current;
      for (const [boneName, q] of Object.entries(frameBones)) {
        const obj = bones.get(stripName(boneName));
        if (obj) obj.quaternion.set(q.x, q.y, q.z, q.w);
      }
    } catch {
      // No animation source for this sign — leave the solver viewport at rest.
    }
  }, [hierarchy, calibration, metadata, comparison, allPoses]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: '#d7dde8', fontFamily: 'monospace', fontSize: 13 }}>
      <div style={{ display: 'flex', gap: 8, padding: 8, alignItems: 'center', borderBottom: '1px solid #2a2f3a' }}>
        {poseIds === null && <span>Loading reference pose index…</span>}
        {poseIds !== null && poseIds.length === 0 && (
          <span style={{ color: '#8b93a3' }}>No reference poses yet — create one via docs/BLENDER_WORKFLOW.md, then run extractReferencePose.ts.</span>
        )}
        {poseIds !== null && poseIds.length > 0 && (
          <select value={selectedPoseId ?? ''} onChange={(e) => setSelectedPoseId(e.target.value)}>
            {poseIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        )}
        {error && <span style={{ color: '#ff6b6b' }}>{error}</span>}
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #2a2f3a' }}>
          <div style={{ padding: 4, textAlign: 'center', background: '#1b212c' }}>Reference (Blender ground truth)</div>
          <div ref={refContainerRef} style={{ flex: 1, minHeight: 0 }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #2a2f3a' }}>
          <div style={{ padding: 4, textAlign: 'center', background: '#1b212c' }} title="Whatever AnimationSource actually resolves to for this sign (keyframe-driven if this sign has 2+ reference poses, else procedural IK) — matches exactly what compareReferencePose.ts/CI verifies.">
            Solver output ({allPoses.filter((p) => p.signName === metadata?.signName).length >= 2 ? 'keyframe-driven' : 'procedural IK'})
          </div>
          <div ref={solverContainerRef} style={{ flex: 1, minHeight: 0 }} />
        </div>
        <div style={{ width: 320, overflowY: 'auto', padding: 12, background: '#0f131a' }}>
          <strong>Difference</strong>
          {!comparison && <div style={{ marginTop: 8, color: '#8b93a3' }}>Select a reference pose to compare.</div>}
          {comparison && (
            <>
              <div style={{ margin: '8px 0', color: comparison.pass ? '#69db7c' : '#ff6b6b' }}>
                {comparison.pass ? 'PASS' : 'FAIL'} — frame {comparison.frameIndex} ({metadata!.frameFraction})
              </div>
              {comparison.bones
                .filter((b) => b.status !== 'unsolved')
                .map((b) => (
                  <div key={b.boneName} style={{ color: b.status === 'ok' ? '#69db7c' : '#ff6b6b' }}>
                    {b.boneName.replace(/^mixamorig:?/i, '')}: {b.angularErrorDeg!.toFixed(1)}deg
                  </div>
                ))}
              <div style={{ marginTop: 8, color: '#8b93a3', fontSize: 11 }}>
                {comparison.bones.filter((b) => b.status === 'unsolved').length} bone(s) not yet solved (fingers/palm-roll — M6+).
              </div>
              <div style={{ marginTop: 8 }}>
                {comparison.positions.map((p) => (
                  <div key={p.label} style={{ color: p.errorMeters <= comparison.positionThresholdMeters ? '#69db7c' : '#ff6b6b' }}>
                    {p.label}: {(p.errorMeters * 1000).toFixed(1)}mm
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
