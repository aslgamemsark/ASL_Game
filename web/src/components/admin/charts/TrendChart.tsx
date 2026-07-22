import {
  ResponsiveContainer, ComposedChart, AreaChart, Bar, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import type { GrowthPoint, ActiveWithRolling } from '@/lib/adminAnalytics';

// Shared look for both charts: axis/grid in muted grey, tooltip on the app's card surface so it
// reads in both light and dark themes (colors are CSS vars that flip with the theme).
const AXIS = { stroke: 'var(--color-z-gray-400)', fontSize: 11 } as const;
const GRID = 'var(--color-z-surface)';
const TOOLTIP_STYLE = {
  background: 'var(--color-z-card)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  fontSize: 12,
  color: 'var(--color-z-gray-100)',
} as const;

// Show every Nth day label so a 90-day axis doesn't turn into an unreadable smear.
function tickInterval(count: number): number {
  return Math.max(0, Math.ceil(count / 8) - 1);
}

// Drop the year from an ISO day for a compact `MM-DD` axis label.
function shortDay(iso: string): string {
  return iso.slice(5);
}

/** Signups per day (bars) with the running total of all users (line, right axis). */
export function GrowthChart({ data }: { data: GrowthPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="day" tickFormatter={shortDay} interval={tickInterval(data.length)} {...AXIS} />
        <YAxis yAxisId="left" allowDecimals={false} {...AXIS} />
        <YAxis yAxisId="right" orientation="right" allowDecimals={false} {...AXIS} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(label) => shortDay(String(label))} />
        <Bar yAxisId="left" dataKey="signups" name="New signups" fill="var(--color-z-purple)" radius={[3, 3, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="cumulative" name="Total users" stroke="var(--color-z-green)" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Daily active users (area) with the 7-day rolling sum as a trend line. */
export function ActiveChart({ data }: { data: ActiveWithRolling[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="dauFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-z-purple)" stopOpacity={0.5} />
            <stop offset="100%" stopColor="var(--color-z-purple)" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="day" tickFormatter={shortDay} interval={tickInterval(data.length)} {...AXIS} />
        <YAxis allowDecimals={false} {...AXIS} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(label) => shortDay(String(label))} />
        <Area type="monotone" dataKey="dau" name="Active that day" stroke="var(--color-z-purple)" strokeWidth={2} fill="url(#dauFill)" />
        <Line type="monotone" dataKey="wau7" name="Active in last 7 days" stroke="var(--color-z-yellow)" strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
