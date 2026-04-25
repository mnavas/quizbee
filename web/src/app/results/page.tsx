"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import RichTextViewer from "@/components/RichTextViewer";
import { XIcon, SkeletonRow } from "@/components/ui";

type SessionSummary = {
  id: string; taker_email: string | null; status: string;
  review_status: string; score_pct: number | null; passed: boolean | null;
  started_at: string; submitted_at: string | null;
};

type AnswerDetail = {
  question_id: string; question_type: string;
  prompt_json: any; options_json: any; correct_answer: any;
  value: any; auto_score: number | null; manual_score: number | null; needs_review: boolean;
};

type SessionDetail = SessionSummary & { answers: AnswerDetail[] };

// ── Helpers ───────────────────────────────────────────────────────────────────

function takerValue(a: AnswerDetail): string | null {
  if (!a.value) return null;
  if (a.value.selected !== undefined)
    return Array.isArray(a.value.selected) ? a.value.selected.join(", ") : String(a.value.selected);
  if (a.value.text !== undefined) return a.value.text;
  return JSON.stringify(a.value);
}

function isCorrectOption(optId: string, correct_answer: any): boolean {
  if (!correct_answer) return false;
  if (typeof correct_answer === "string") return correct_answer === optId;
  if (Array.isArray(correct_answer)) return correct_answer.includes(optId);
  return false;
}

function isTakerSelected(optId: string, value: any): boolean {
  if (!value) return false;
  if (typeof value.selected === "string") return value.selected === optId;
  if (Array.isArray(value.selected)) return value.selected.includes(optId);
  return false;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed:   "bg-green-100 text-green-700",
    submitted:   "bg-blue-100 text-blue-700",
    in_progress: "bg-amber-100 text-amber-700",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function ScoreBar({ pct, passed }: { pct: number; passed: boolean | null }) {
  const color = passed === false ? "bg-red-400" : passed ? "bg-green-400" : "bg-amber-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold w-9 text-right ${passed === false ? "text-red-500" : passed ? "text-green-600" : "text-gray-600"}`}>
        {pct}%
      </span>
    </div>
  );
}

// ── Answer row ────────────────────────────────────────────────────────────────

function AnswerRow({ a, idx }: { a: AnswerDetail; idx: number }) {
  const hasOptions = Array.isArray(a.options_json) && a.options_json.length > 0;
  const plainValue = takerValue(a);
  const isInfoOnly = ["passage", "divider", "audio_prompt", "video_prompt"].includes(a.question_type);

  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-400 font-medium">Q{idx + 1}</span>
        <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{a.question_type}</span>
        {a.auto_score !== null && !isInfoOnly && (
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${a.auto_score > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
            {a.auto_score > 0 ? `✓ ${a.auto_score} pt${a.auto_score !== 1 ? "s" : ""}` : "✗ 0 pts"}
          </span>
        )}
        {a.needs_review && (
          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Needs review</span>
        )}
      </div>

      <RichTextViewer content={a.prompt_json} className="text-sm font-medium text-gray-800" />

      {hasOptions && (
        <div className="space-y-1 mt-1">
          {a.options_json.map((opt: any) => {
            const correct = isCorrectOption(opt.id, a.correct_answer);
            const selected = isTakerSelected(opt.id, a.value);
            let cls = "border-gray-200 text-gray-600";
            if (correct && selected) cls = "border-green-400 bg-green-50 text-green-800";
            else if (correct) cls = "border-green-300 bg-green-50 text-green-700";
            else if (selected) cls = "border-red-300 bg-red-50 text-red-700";
            return (
              <div key={opt.id} className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-sm ${cls}`}>
                <span className="font-medium shrink-0">{opt.id}.</span>
                <RichTextViewer content={opt.content_json} className="flex-1" />
                {correct && <span className="text-xs shrink-0 font-medium">✓</span>}
                {selected && !correct && <span className="text-xs shrink-0 text-red-500 font-medium">← taker</span>}
                {correct && selected && <span className="text-xs shrink-0 font-medium">← taker</span>}
              </div>
            );
          })}
        </div>
      )}

      {a.question_type === "true_false" && (
        <div className="flex gap-3 mt-1">
          {["true", "false"].map((v) => {
            const correct = String(a.correct_answer?.value ?? a.correct_answer) === v;
            const selected = a.value?.selected === v;
            let cls = "border-gray-200 text-gray-500";
            if (correct && selected) cls = "border-green-400 bg-green-50 text-green-800";
            else if (correct) cls = "border-green-300 bg-green-50 text-green-700";
            else if (selected) cls = "border-red-300 bg-red-50 text-red-700";
            return (
              <div key={v} className={`flex-1 text-center py-2 rounded-lg border text-sm font-medium ${cls}`}>
                {v === "true" ? "True" : "False"}{correct && " ✓"}
              </div>
            );
          })}
        </div>
      )}

      {(a.question_type === "short_text" || a.question_type === "long_text") && plainValue !== null && (
        <div className="mt-1">
          <p className="text-xs text-gray-400 mb-0.5">Taker&apos;s answer:</p>
          <p className="text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2">{plainValue}</p>
          {a.correct_answer?.text && (
            <p className="text-xs text-green-600 mt-1">✓ Expected: <strong>{a.correct_answer.text}</strong></p>
          )}
        </div>
      )}

      {!isInfoOnly && plainValue === null && !hasOptions && a.question_type !== "true_false" && (
        <p className="text-xs text-gray-400 italic">No answer submitted</p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type TestOption = { id: string; title: string; published_at: string | null };

function ResultsContent() {
  const params = useSearchParams();
  const testId = params.get("test_id") ?? "";
  const [tests, setTests] = useState<TestOption[]>([]);
  const [activeTestId, setActiveTestId] = useState(testId);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selected, setSelected] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get("/tests").then((r) => setTests(r.data)).catch(() => {}); }, []);
  useEffect(() => { if (testId) setActiveTestId(testId); }, [testId]);

  async function load(id: string) {
    if (!id) return;
    setLoading(true);
    try { setSessions((await api.get("/results", { params: { test_id: id } })).data); }
    finally { setLoading(false); }
  }

  useEffect(() => { setSessions([]); load(activeTestId); }, [activeTestId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openDetail(id: string) {
    const res = await api.get(`/results/${id}`);
    setSelected(res.data);
  }

  function handleExport() {
    const url = `${process.env.NEXT_PUBLIC_API_URL}/results/export/csv?test_id=${activeTestId}`;
    window.open(url, "_blank");
  }

  const passCount = sessions.filter((s) => s.passed === true).length;
  const avgScore = sessions.length > 0 && sessions.some((s) => s.score_pct !== null)
    ? Math.round(sessions.filter((s) => s.score_pct !== null).reduce((a, s) => a + s.score_pct!, 0) / sessions.filter((s) => s.score_pct !== null).length)
    : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Results</h1>
        {activeTestId && sessions.length > 0 && (
          <button onClick={handleExport} className="btn-primary">Export CSV</button>
        )}
      </div>

      {/* Test picker */}
      <div className="mb-6">
        <select
          value={activeTestId}
          onChange={(e) => setActiveTestId(e.target.value)}
          className="input w-full max-w-sm"
        >
          <option value="">— Select a test —</option>
          {tests.map((t) => (
            <option key={t.id} value={t.id}>{t.title}{!t.published_at ? " (draft)" : ""}</option>
          ))}
        </select>
      </div>

      {/* Stats row */}
      {!loading && sessions.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card text-center py-3">
            <p className="text-2xl font-bold text-gray-900">{sessions.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">Submissions</p>
          </div>
          {avgScore !== null && (
            <div className="card text-center py-3">
              <p className="text-2xl font-bold text-amber-500">{avgScore}%</p>
              <p className="text-xs text-gray-400 mt-0.5">Avg score</p>
            </div>
          )}
          {sessions.some((s) => s.passed !== null) && (
            <div className="card text-center py-3">
              <p className="text-2xl font-bold text-green-500">{passCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">Passed</p>
            </div>
          )}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
        </div>
      )}

      {!loading && activeTestId && sessions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">No submissions yet for this test.</p>
        </div>
      )}

      {sessions.length > 0 && (
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="card space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold text-gray-900">{s.taker_email ?? "Anonymous"}</p>
                    <StatusBadge status={s.status} />
                    {s.passed === true && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Passed</span>}
                    {s.passed === false && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">✗ Failed</span>}
                    {s.review_status === "needs_review" && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Needs review</span>}
                  </div>
                  {s.score_pct !== null && <ScoreBar pct={s.score_pct} passed={s.passed} />}
                  <p className="text-xs text-gray-400 mt-1">{new Date(s.started_at).toLocaleString()}</p>
                </div>
                <button onClick={() => openDetail(s.id)} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 shrink-0 font-medium">
                  View
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-start px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selected.taker_email ?? "Anonymous"}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <StatusBadge status={selected.status} />
                  {selected.passed === true && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Passed</span>}
                  {selected.passed === false && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">✗ Failed</span>}
                  {selected.score_pct !== null && <span className="text-xs font-semibold text-gray-600">{selected.score_pct}%</span>}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-4 space-y-3">
              {selected.answers.map((a, i) => (
                <AnswerRow key={a.question_id} a={a} idx={i} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<p className="text-gray-400 text-sm p-8">Loading…</p>}>
      <ResultsContent />
    </Suspense>
  );
}
