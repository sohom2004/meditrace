import React, { useState } from 'react';
import { Clock, FileText, FlaskConical, Pill, Stethoscope, ChevronRight } from 'lucide-react';

interface TimelineProps {
  events: any[];
}

export const TimelineSection: React.FC<TimelineProps> = ({ events }) => {
  const [filter, setFilter] = useState<'all' | 'lab_report' | 'prescription' | 'consultation'>('all');

  const filteredEvents = events.filter((e) => {
    if (filter === 'all') return true;
    return e.event_type === filter;
  });

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'lab_report':
        return <FlaskConical className="w-4 h-4 text-sky-400" />;
      case 'prescription':
        return <Pill className="w-4 h-4 text-purple-400" />;
      case 'consultation':
        return <Stethoscope className="w-4 h-4 text-emerald-400" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="glass-card p-5 border border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            <span>Longitudinal Health Memory Timeline</span>
          </h3>
          <p className="text-xs text-slate-400 font-medium">
            Relational projection rebuildable from verified clinical facts & outbox events
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          {(['all', 'lab_report', 'prescription'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1 rounded-lg font-semibold capitalize transition-all cursor-pointer ${
                filter === t
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t === 'all' ? 'All Records' : t.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
        {filteredEvents.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-4">No events found for this filter.</p>
        ) : (
          filteredEvents.map((e) => (
            <div key={e.id} className="relative group">
              {/* Dot */}
              <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-slate-950 border-2 border-sky-500 flex items-center justify-center shadow-md shadow-sky-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
              </div>

              {/* Event Card */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 transition-all">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800">
                      {getEventIcon(e.event_type)}
                    </div>
                    <h4 className="text-xs font-bold text-white">{e.title}</h4>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {new Date(e.event_date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed pl-8">{e.summary}</p>
                {e.source_fact_id && (
                  <div className="mt-2 pl-8 flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-sky-400 border border-slate-800">
                      fact_id: {e.source_fact_id}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
