import { motion } from 'framer-motion';
import { HeaderBackButton } from '@/components/shared/HeaderBackButton';

interface Props {
  lessonTitle: string;
  current: number;
  total: number;
  onClose: () => void;
}

export function LessonHeader({ lessonTitle: _lessonTitle, current, total, onClose }: Props) {
  const progress = current / total;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <HeaderBackButton icon="close" onClick={onClose} />

      <div className="flex-1">
        <div className="h-3 bg-z-surface rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-primary"
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
        </div>
      </div>

      <span className="text-xs font-semibold text-z-gray-300 tracking-wide">
        {current}/{total}
      </span>
    </div>
  );
}
