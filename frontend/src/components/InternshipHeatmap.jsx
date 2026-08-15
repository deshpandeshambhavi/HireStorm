import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Flame, CalendarDays } from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function dateKey(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getLevel(hours) {
  if (!hours) return 0;
  if (hours <= 2) return 1;
  if (hours <= 4) return 2;
  if (hours <= 7) return 3;
  return 4;
}

const levelStyles = {
  0: {
    background: 'var(--clr-surface-2)',
    border: '1px solid var(--clr-border)',
  },
  1: {
    background: 'rgba(79,126,248,0.18)',
    border: '1px solid rgba(79,126,248,0.20)',
  },
  2: {
    background: 'rgba(79,126,248,0.38)',
    border: '1px solid rgba(79,126,248,0.35)',
  },
  3: {
    background: 'rgba(79,126,248,0.62)',
    border: '1px solid rgba(79,126,248,0.55)',
  },
  4: {
    background: 'var(--clr-primary)',
    border: '1px solid var(--clr-primary)',
  },
};

export default function InternshipHeatmap({ internship }) {
  const logs = internship?.dailyLogs || [];
  const startDate = internship?.startDate ? new Date(internship.startDate) : null;
  const endDate = internship?.endDate ? new Date(internship.endDate) : null;

  const availableMonths = useMemo(() => {
    if (!startDate || Number.isNaN(startDate.getTime())) return [];

    const start = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = endDate && !Number.isNaN(endDate.getTime())
      ? new Date(endDate.getFullYear(), endDate.getMonth(), 1)
      : new Date();

    const months = [];
    const cursor = new Date(start);
    while (cursor <= end && months.length < 24) {
      months.push({
        year: cursor.getFullYear(),
        month: cursor.getMonth(),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return months;
  }, [internship?.startDate, internship?.endDate]);

  const today = new Date();
  const initialIndex = Math.max(
    0,
    availableMonths.findIndex(m => m.year === today.getFullYear() && m.month === today.getMonth())
  );
  const [monthIndex, setMonthIndex] = useState(initialIndex);

  const selected = availableMonths[monthIndex] || availableMonths[0];

  const logByDate = useMemo(() => {
    const map = {};
    logs.forEach(log => {
      const key = dateKey(log.date);
      if (!key) return;

      // A date can only have one log, but keep the most productive entry if
      // old data happens to contain duplicates.
      const hours = Number(log.hoursWorked) || 0;
      if (!map[key] || hours > (Number(map[key].hoursWorked) || 0)) {
        map[key] = { ...log, hoursWorked: hours };
      }
    });
    return map;
  }, [logs]);

  const days = useMemo(() => {
    if (!selected) return [];

    const first = new Date(selected.year, selected.month, 1);
    const lastDay = new Date(selected.year, selected.month + 1, 0).getDate();

    return Array.from({ length: lastDay }, (_, i) => {
      const date = new Date(selected.year, selected.month, i + 1);
      const key = dateKey(date);
      const log = logByDate[key];
      const insideInternship =
        (!startDate || date >= new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())) &&
        (!endDate || date <= new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()));

      return {
        date,
        key,
        log,
        insideInternship,
        level: insideInternship ? getLevel(log?.hoursWorked) : 0,
      };
    });
  }, [selected, logByDate, internship?.startDate, internship?.endDate]);

  const monthHours = days.reduce((sum, day) => sum + (Number(day.log?.hoursWorked) || 0), 0);
  const monthLogs = days.filter(day => day.log).length;

  if (!availableMonths.length) return null;

  const monthName = `${MONTHS[selected.month]} ${selected.year}`;
  const canGoPrev = monthIndex > 0;
  const canGoNext = monthIndex < availableMonths.length - 1;

  return (
    <div className="card" style={{ marginBottom: 28, overflow: 'hidden' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        flexWrap: 'wrap',
        marginBottom: 20,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: 'rgba(79,126,248,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--clr-primary)',
            }}>
              <Flame size={18} />
            </div>
            <h3 style={{ fontWeight: 800, margin: 0 }}>Internship Activity</h3>
          </div>
          <p className="text-sm text-muted" style={{ margin: 0 }}>
            Your daily work consistency, based on hours logged.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setMonthIndex(i => i - 1)}
            disabled={!canGoPrev}
            aria-label="Previous month"
            style={{ padding: 7 }}
          >
            <ChevronLeft size={16} />
          </button>
          <div style={{
            minWidth: 130,
            textAlign: 'center',
            fontWeight: 750,
            fontSize: '0.88rem',
          }}>
            {monthName}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setMonthIndex(i => i + 1)}
            disabled={!canGoNext}
            aria-label="Next month"
            style={{ padding: 7 }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: 20,
        flexWrap: 'wrap',
        marginBottom: 20,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          color: 'var(--clr-text-2)',
          fontSize: '0.78rem',
        }}>
          <CalendarDays size={14} />
          <strong style={{ color: 'var(--clr-text)' }}>{monthLogs}</strong> days logged
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          color: 'var(--clr-text-2)',
          fontSize: '0.78rem',
        }}>
          <Clock size={14} />
          <strong style={{ color: 'var(--clr-text)' }}>{monthHours}h</strong> worked
        </div>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ minWidth: 430 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(28px, 1fr))',
            gap: 5,
            marginBottom: 7,
          }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div
                key={day}
                style={{
                  textAlign: 'center',
                  fontSize: '0.65rem',
                  color: 'var(--clr-text-3)',
                  fontWeight: 600,
                }}
              >
                {day}
              </div>
            ))}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(28px, 1fr))',
            gap: 5,
          }}>
            {Array.from({ length: new Date(selected.year, selected.month, 1).getDay() }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {days.map(day => {
              const hours = Number(day.log?.hoursWorked) || 0;
              const isToday = dateKey(day.date) === dateKey(new Date());
              const style = levelStyles[day.level];

              return (
                <div
                  key={day.key}
                  title={
                    !day.insideInternship
                      ? `${day.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — Outside internship`
                      : day.log
                        ? `${day.date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}: ${hours}h logged`
                        : `${day.date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}: No work logged`
                  }
                  style={{
                    aspectRatio: '1',
                    minWidth: 28,
                    maxWidth: 42,
                    borderRadius: 5,
                    ...style,
                    opacity: day.insideInternship ? 1 : 0.35,
                    boxShadow: isToday ? '0 0 0 2px var(--clr-primary)' : 'none',
                    transition: 'transform 0.12s ease, opacity 0.12s ease',
                    cursor: day.insideInternship ? 'default' : 'not-allowed',
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 7,
        marginTop: 16,
        fontSize: '0.68rem',
        color: 'var(--clr-text-3)',
      }}>
        <span>Less</span>
        {[0, 1, 2, 3, 4].map(level => (
          <span
            key={level}
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              ...levelStyles[level],
            }}
          />
        ))}
        <span>More</span>
      </div>

      <div style={{
        marginTop: 10,
        paddingTop: 12,
        borderTop: '1px solid var(--clr-border)',
        fontSize: '0.7rem',
        color: 'var(--clr-text-3)',
      }}>
        Intensity: <strong>1–2h</strong> light · <strong>3–4h</strong> moderate · <strong>5–7h</strong> strong · <strong>8h+</strong> full day
      </div>
    </div>
  );
}
