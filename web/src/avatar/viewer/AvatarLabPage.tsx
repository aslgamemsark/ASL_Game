/**
 * AvatarLab (spec Rule 18): "All avatar development inside AvatarLab... do not debug inside the
 * game." This route is dev-only — not linked from the real game navigation, gated behind
 * import.meta.env.DEV so it never ships in production builds' reachable UI (see App.tsx wiring).
 */
import { useState } from 'react';
import { SkeletonViewer } from './SkeletonViewer.tsx';
import { LandmarkViewer } from './LandmarkViewer.tsx';
import { RetargetViewer } from './RetargetViewer.tsx';
import { ReferencePoseViewer } from './ReferencePoseViewer.tsx';

const TABS = ['Skeleton', 'Landmarks', 'Retarget', 'Reference Pose'] as const;

export function AvatarLabPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Skeleton');

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#0b0e13' }}>
      <div style={{ display: 'flex', gap: 4, padding: '8px 12px', background: '#151a23', borderBottom: '1px solid #2a2f3a' }}>
        <strong style={{ color: '#d7dde8', fontFamily: 'monospace', marginRight: 16 }}>AvatarLab</strong>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '4px 12px',
              background: tab === t ? '#2d6bff' : 'transparent',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === 'Skeleton' && <SkeletonViewer />}
        {tab === 'Landmarks' && <LandmarkViewer />}
        {tab === 'Retarget' && <RetargetViewer />}
        {tab === 'Reference Pose' && <ReferencePoseViewer />}
      </div>
    </div>
  );
}
