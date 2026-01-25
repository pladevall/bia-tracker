"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type Bet = { id: string; name: string };
type Belief = { id: string; belief: string; bet_id: string | null };

type QuickAddMode = "action" | "belief";

export default function QuickAddBar() {
  const pathname = usePathname();
  const isEnabled = pathname === "/actions";
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<QuickAddMode>("action");
  const [text, setText] = useState("");
  const [beliefId, setBeliefId] = useState<string | null>(null);
  const [betId, setBetId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [beliefs, setBeliefs] = useState<Belief[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const [beliefsRes, betsRes] = await Promise.all([
        fetch("/api/practice/beliefs"),
        fetch("/api/practice/bets"),
      ]);
      const beliefsData = await beliefsRes.json();
      const betsData = await betsRes.json();
      setBeliefs(Array.isArray(beliefsData) ? beliefsData : []);
      setBets(Array.isArray(betsData) ? betsData : []);
    };
    load();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (mode === "action") {
      const defaultBelief = beliefs[0] ?? null;
      setBeliefId(defaultBelief?.id ?? null);
      setBetId(defaultBelief?.bet_id ?? bets[0]?.id ?? null);
    } else {
      setBeliefId(null);
      setBetId(bets[0]?.id ?? null);
    }
  }, [open, mode, beliefs, bets]);

  useEffect(() => {
    if (!isEnabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable = target?.isContentEditable || tag === "input" || tag === "textarea" || tag === "select";
      if (isEditable) return;

      if (open && e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }

      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        setMode("action");
        setOpen(true);
      }

      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        setMode("belief");
        setOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isEnabled, open]);

  const selectedBelief = useMemo(
    () => beliefs.find((belief) => belief.id === beliefId),
    [beliefs, beliefId]
  );

  const submitAction = useCallback(async () => {
    if (!text.trim()) return;
    setIsSaving(true);
    try {
      const payload = {
        description: text.trim(),
        belief_id: selectedBelief?.id ?? null,
        bet_id: selectedBelief?.bet_id ?? betId ?? null,
      };
      const res = await fetch("/api/practice/bold-takes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setText("");
        setOpen(false);
      }
    } finally {
      setIsSaving(false);
    }
  }, [text, selectedBelief, betId]);

  const submitBelief = useCallback(async () => {
    if (!text.trim()) return;
    setIsSaving(true);
    try {
      const payload = {
        belief: text.trim(),
        status: "untested",
        bet_id: betId ?? null,
      };
      const res = await fetch("/api/practice/beliefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setText("");
        setOpen(false);
      }
    } finally {
      setIsSaving(false);
    }
  }, [text, betId]);

  if (!isEnabled || !open) return null;

  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center">
      <div className="w-[min(720px,calc(100%-2rem))] rounded-xl border border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 shadow-xl backdrop-blur">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800">
          <span className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
            {mode === "action" ? "Action" : "Belief"}
          </span>
          <span className="text-[10px] text-gray-400">A/B</span>
          <span className="text-[10px] text-gray-400">Enter to save</span>
          <span className="text-[10px] text-gray-400">Esc to close</span>
        </div>
        <div className="flex flex-col gap-2 px-3 py-3">
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (mode === "action") {
                  submitAction();
                } else {
                  submitBelief();
                }
              }
              if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder={mode === "action" ? "Describe the action…" : "Describe the belief…"}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />

          {mode === "action" ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={beliefId ?? ""}
                onChange={(e) => {
                  const nextId = e.target.value || null;
                  setBeliefId(nextId);
                  const linked = beliefs.find((belief) => belief.id === nextId);
                  if (linked?.bet_id) {
                    setBetId(linked.bet_id);
                  }
                }}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="">Unlinked action</option>
                {beliefs.map((belief) => {
                  const betName = bets.find((bet) => bet.id === belief.bet_id)?.name;
                  return (
                    <option key={belief.id} value={belief.id}>
                      {belief.belief}{betName ? ` — ${betName}` : ""}
                    </option>
                  );
                })}
              </select>
              <select
                value={selectedBelief?.bet_id ?? betId ?? ""}
                onChange={(e) => setBetId(e.target.value || null)}
                disabled={Boolean(selectedBelief)}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-60"
              >
                <option value="">No bet</option>
                {bets.map((bet) => (
                  <option key={bet.id} value={bet.id}>
                    {bet.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <select
              value={betId ?? ""}
              onChange={(e) => setBetId(e.target.value || null)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="">Unlinked belief</option>
              {bets.map((bet) => (
                <option key={bet.id} value={bet.id}>
                  {bet.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (mode === "action") {
                  submitAction();
                } else {
                  submitBelief();
                }
              }}
              disabled={!text.trim() || isSaving}
              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {isSaving ? "Saving..." : "Add"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
