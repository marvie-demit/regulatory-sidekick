"use client";

import { useEffect, useState } from "react";
import { useOrgState } from "@/components/app-shell/StateProvider";
import type { Question } from "@/lib/content/types";

export function Quiz({
  phase,
  questions,
}: {
  phase: number;
  questions: Question[];
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const { saveQuiz } = useOrgState();

  const answeredCount = Object.keys(answers).length;
  const correct = Object.entries(answers).filter(
    ([qi, oi]) => questions[+qi].c === oi,
  ).length;
  const done = answeredCount === questions.length;

  useEffect(() => {
    if (done) saveQuiz(phase, correct);
  }, [done, correct, phase, saveQuiz]);

  function choose(qi: number, oi: number) {
    if (answers[qi] != null) return;
    setAnswers((prev) => ({ ...prev, [qi]: oi }));
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="sticky top-0 z-10 rounded-xl border border-line bg-card/95 p-4 text-sm backdrop-blur">
        <b className="text-teal-900">
          {answeredCount} of {questions.length} answered
        </b>{" "}
        · score {correct}/{questions.length}
        {done && (
          <span className="ml-2 rounded-full bg-[#e7f0ec] px-2 py-0.5 text-teal-700">
            Best score saved
          </span>
        )}
      </div>

      {questions.map((q, qi) => {
        const sel = answers[qi];
        const answered = sel != null;
        return (
          <div key={qi} className="rounded-xl border border-line bg-card p-4">
            <div className="font-medium text-teal-900">
              {qi + 1}. {q.q}
            </div>
            <div className="mt-3 space-y-2">
              {q.a.map((opt, oi) => {
                const isSel = sel === oi;
                const isCorrect = q.c === oi;
                let cls = "border-line";
                if (answered) {
                  if (isCorrect) cls = "border-teal-600 bg-[#e7f0ec]";
                  else if (isSel) cls = "border-coral bg-[#fbeae6]";
                }
                return (
                  <button
                    key={oi}
                    disabled={answered}
                    onClick={() => choose(qi, oi)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${cls} ${answered ? "cursor-default" : "hover:border-teal-600"}`}
                  >
                    {answered && isCorrect && (
                      <span className="font-bold text-teal-600">✓</span>
                    )}
                    {answered && isSel && !isCorrect && (
                      <span className="font-bold text-coral">✕</span>
                    )}
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
            {answered && q.e && (
              <p className="mt-3 rounded-lg bg-cream px-3 py-2 text-[13px] text-muted">
                <b className="text-teal-800">Why:</b> {q.e}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
