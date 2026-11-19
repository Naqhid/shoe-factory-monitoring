import React from 'react';
import { Layers, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';

export interface LineArticleRow {
  plan_article_id: number;
  sequence_no: number;
  style_name: string;
  style_code: string;
  target: number;
  input: number;
  output: number;
  wip: number;
  completion_percent: number;
  running: boolean;
  assigned_machines: string[];
}

export interface LineArticleSummary {
  work_centre_id: number;
  date: string;
  multi_article: boolean;
  input_machine_id: string;
  eol_machine_id: string;
  articles: LineArticleRow[];
  unassigned: { input: number; output: number };
  total_target: number;
  total_output: number;
  total_wip: number;
  machines: Array<{ machine_id: string; machine_name: string; shared: boolean; plan_article_id: number | null }>;
}

export const fetchLineArticles = async (workCentreId: string | number, date: string): Promise<LineArticleSummary | null> => {
  const res = await apiFetch(
    `${API_BASE}/api/line-articles?work_centre_id=${encodeURIComponent(String(workCentreId))}&date=${encodeURIComponent(date)}`
  );
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load line articles');
  return json.data as LineArticleSummary;
};

/** Per-article progress and machine assignment for one line and day (shown when a line has 2+ articles). */
export const LineArticlesPanel: React.FC<{
  workCentres: Array<{ id: number; code: string; name: string }>;
  date: string;
}> = ({ workCentres, date }) => {
  const [lineId, setLineId] = React.useState('');
  const [summary, setSummary] = React.useState<LineArticleSummary | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!lineId) {
      setSummary(null);
      return;
    }
    setLoading(true);
    try {
      setSummary(await fetchLineArticles(lineId, date));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load line articles');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [lineId, date]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const assign = async (machineId: string, planArticleId: string) => {
    setSaving(machineId);
    try {
      const res = await apiFetch(`${API_BASE}/api/line-articles/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_centre_id: Number(lineId),
          date,
          machine_ids: [machineId],
          plan_article_id: planArticleId ? Number(planArticleId) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Assignment failed');
      toast.success(`Machine ${machineId} updated`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Assignment failed');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-blue-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-blue-600" aria-hidden />
          <span className="text-sm font-bold text-blue-900">Multi-article line · article progress & machine assignment</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={lineId}
            onChange={(e) => setLineId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Select line</option>
            {workCentres.map((wc) => (
              <option key={wc.id} value={wc.id}>{wc.code} — {wc.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void load()}
            disabled={!lineId || loading}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </div>
      </div>

      {!lineId ? (
        <p className="px-4 py-3 text-sm text-slate-500">Pick a line to see each article's target, output and WIP, and to assign machines.</p>
      ) : !summary ? null : !summary.multi_article ? (
        <p className="px-4 py-3 text-sm text-slate-500">
          This line runs a single article on {date}. All machines count towards it automatically.
        </p>
      ) : (
        <div className="space-y-4 p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-1.5">Article</th>
                  <th className="px-2 py-1.5 text-center">Target</th>
                  <th className="px-2 py-1.5 text-center">Input</th>
                  <th className="px-2 py-1.5 text-center">Output</th>
                  <th className="px-2 py-1.5 text-center">WIP</th>
                  <th className="px-2 py-1.5 text-center">Completion</th>
                  <th className="px-2 py-1.5">Machines</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.articles.map((a) => (
                  <tr key={a.plan_article_id}>
                    <td className="px-2 py-1.5 font-semibold text-slate-900">
                      {a.style_name}
                      {a.running && (
                        <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">Running</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{a.target}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums text-blue-700">{a.input}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums font-bold text-green-700">{a.output}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{a.wip}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{a.completion_percent}%</td>
                    <td className="px-2 py-1.5 text-xs text-slate-600">{a.assigned_machines.join(', ') || '—'}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold">
                  <td className="px-2 py-1.5">Line total</td>
                  <td className="px-2 py-1.5 text-center tabular-nums">{summary.total_target}</td>
                  <td className="px-2 py-1.5" />
                  <td className="px-2 py-1.5 text-center tabular-nums">{summary.total_output}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums">{summary.total_wip}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums">
                    {summary.total_target > 0 ? Math.round((summary.total_output / summary.total_target) * 100) : 0}%
                  </td>
                  <td className="px-2 py-1.5" />
                </tr>
              </tbody>
            </table>
          </div>
          {(summary.unassigned.input > 0 || summary.unassigned.output > 0) && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
              Unassigned (machine had no article): input {summary.unassigned.input}, output {summary.unassigned.output}. Included in the line output only.
            </p>
          )}

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Machine assignment</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {summary.machines.map((m) => (
                <label key={m.machine_id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-mono font-semibold">{m.machine_id}</span>{' '}
                    <span className="text-slate-500">{m.machine_name}</span>
                    {m.shared && (
                      <span className="ml-1 rounded bg-violet-100 px-1 text-[10px] font-bold text-violet-800" title="Operator picks the article on each cycle">
                        shared
                      </span>
                    )}
                  </span>
                  <select
                    value={m.plan_article_id == null ? '' : String(m.plan_article_id)}
                    onChange={(e) => void assign(m.machine_id, e.target.value)}
                    disabled={saving === m.machine_id}
                    className="max-w-[55%] rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs"
                  >
                    <option value="">Unassigned</option>
                    {summary.articles.map((a) => (
                      <option key={a.plan_article_id} value={a.plan_article_id}>{a.style_name}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              A change applies to cycles started after it. Earlier cycles keep their article.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
