interface Entry {
  label: string;
  score: number;
  isYou: boolean;
}

interface Props {
  entries: Entry[];
}

export function Scoreboard({ entries }: Props) {
  return (
    <div className="flex items-center gap-2 bg-z-card border border-white/8 rounded-2xl px-3 py-2 overflow-x-auto">
      {entries.map((e, i) => (
        <div key={i} className="flex items-center gap-1.5 shrink-0">
          {i > 0 && <span className="text-z-gray-400 text-xs mr-0.5">·</span>}
          <span className={`text-sm font-bold ${e.isYou ? 'text-z-purple-light' : 'text-z-gray-200'}`}>{e.score}</span>
          <span className="text-xs text-z-gray-400 truncate max-w-[6rem]">{e.isYou ? 'You' : e.label}</span>
        </div>
      ))}
    </div>
  );
}
