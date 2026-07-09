import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import './index.css';
import App from './App';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          {/* reducedMotion="user": every framer-motion animation in the app honors the OS-level
              prefers-reduced-motion setting (transforms/layout animations are skipped, opacity fades
              are kept) — the accessibility gap flagged in PRODUCT.md, fixed once globally. */}
          <MotionConfig reducedMotion="user">
            <App />
            {/* Home-screen install offer + "new version" refresh toast (PWA). */}
            <InstallPrompt />
          </MotionConfig>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
);
