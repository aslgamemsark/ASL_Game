import { HeaderBackButton } from '@/components/shared/HeaderBackButton';
import { ProgressBar } from '@/components/shared/ProgressBar';

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
        <ProgressBar
          value={progress}
          label={`Lesson progress: step ${current} of ${total}`}
          size="lg"
        />
      </div>

      <span className="text-xs font-semibold text-z-gray-300 tracking-wide">
        {current}/{total}
      </span>
    </div>
  );
}
