"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  bulkSetStatus as aBulkSet,
  resetAllState as aReset,
  setActivityStatus as aSetStatus,
  setDeviceProfile as aSetProfile,
  setQuizBest as aSetQuiz,
  toggleTask as aToggleTask,
} from "@/lib/db/mutations";
import { toast } from "@/lib/toast";

export type OrgStateShape = {
  status: Record<string, string>;
  tasks: Record<string, Record<number, 1>>;
  quiz: Record<number, number>;
  profile: Record<string, number> | null;
};

type Ctx = OrgStateShape & {
  setStatus: (id: string, label: string) => void;
  bulkSet: (ids: string[], label: string) => void;
  toggleTask: (id: string, index: number, done: boolean) => void;
  reset: () => void;
  saveQuiz: (phase: number, score: number) => void;
  setProfile: (profile: Record<string, number> | null) => void;
};

const StateCtx = createContext<Ctx | null>(null);

export function useOrgState(): Ctx {
  const v = useContext(StateCtx);
  if (!v) throw new Error("useOrgState must be used within <StateProvider>");
  return v;
}

const FAIL = "Couldn't save — check your connection";

// Single client source of truth for per-org state, seeded once from the server
// (the (app) layout reads it). Every mutation updates the store optimistically
// and persists via a Server Action, rolling back on failure. Refs mirror state
// so the callbacks stay referentially stable but can read/restore latest values.
//
// Rollback rule: on failure we revert ONLY the key this operation touched, and
// only if our optimistic value still stands — never a whole-map snapshot, which
// would erase a concurrent save to a different key that landed during the await.
export function StateProvider({
  initial,
  children,
}: {
  initial: OrgStateShape;
  children: React.ReactNode;
}) {
  const [status, setStatusS] = useState(initial.status);
  const [tasks, setTasksS] = useState(initial.tasks);
  const [quiz, setQuizS] = useState(initial.quiz);
  const [profile, setProfileS] = useState(initial.profile);

  const statusRef = useRef(status);
  const tasksRef = useRef(tasks);
  const quizRef = useRef(quiz);
  const profileRef = useRef(profile);

  const writeStatus = (v: Record<string, string>) => {
    statusRef.current = v;
    setStatusS(v);
  };
  const writeTasks = (v: Record<string, Record<number, 1>>) => {
    tasksRef.current = v;
    setTasksS(v);
  };
  const writeQuiz = (v: Record<number, number>) => {
    quizRef.current = v;
    setQuizS(v);
  };
  const writeProfile = (v: Record<string, number> | null) => {
    profileRef.current = v;
    setProfileS(v);
  };

  const setStatus = useCallback((id: string, label: string) => {
    const before = statusRef.current[id];
    writeStatus({ ...statusRef.current, [id]: label });
    aSetStatus(id, label).catch(() => {
      if (statusRef.current[id] === label) {
        const m = { ...statusRef.current };
        if (before === undefined) delete m[id];
        else m[id] = before;
        writeStatus(m);
      }
      toast(FAIL);
    });
  }, []);

  const bulkSet = useCallback((ids: string[], label: string) => {
    if (!ids.length) return;
    const before: Record<string, string | undefined> = {};
    ids.forEach((id) => (before[id] = statusRef.current[id]));
    const next = { ...statusRef.current };
    ids.forEach((id) => (next[id] = label));
    writeStatus(next);
    aBulkSet(ids, label).catch(() => {
      const m = { ...statusRef.current };
      ids.forEach((id) => {
        if (m[id] !== label) return; // superseded by a newer save — leave it
        const b = before[id];
        if (b === undefined) delete m[id];
        else m[id] = b;
      });
      writeStatus(m);
      toast(FAIL);
    });
  }, []);

  const toggleTask = useCallback((id: string, index: number, done: boolean) => {
    const beforeTask = tasksRef.current[id]?.[index]; // 1 | undefined
    const cur = { ...(tasksRef.current[id] || {}) };
    if (done) cur[index] = 1;
    else delete cur[index];
    writeTasks({ ...tasksRef.current, [id]: cur });

    // Auto-promote not-started → in-progress on first check (matches the server).
    const beforeStatus = statusRef.current[id];
    const promoted =
      done && (beforeStatus || "Not started") === "Not started";
    if (promoted) writeStatus({ ...statusRef.current, [id]: "In progress" });

    aToggleTask(id, index, done).catch(() => {
      // Revert only this task, and only if our optimistic value still stands.
      if ((tasksRef.current[id]?.[index] === 1) === done) {
        const t = { ...tasksRef.current };
        const entry = { ...(t[id] || {}) };
        if (beforeTask === undefined) delete entry[index];
        else entry[index] = beforeTask;
        t[id] = entry;
        writeTasks(t);
      }
      // Roll back the auto-promotion we applied, if it still stands.
      if (promoted && statusRef.current[id] === "In progress") {
        const s = { ...statusRef.current };
        if (beforeStatus === undefined) delete s[id];
        else s[id] = beforeStatus;
        writeStatus(s);
      }
      toast(FAIL);
    });
  }, []);

  const reset = useCallback(() => {
    // Reset is an all-or-nothing clear, so a full snapshot restore is correct.
    const prevS = statusRef.current;
    const prevT = tasksRef.current;
    writeStatus({});
    writeTasks({});
    aReset().catch(() => {
      writeStatus(prevS);
      writeTasks(prevT);
      toast(FAIL);
    });
  }, []);

  const saveQuiz = useCallback((phase: number, score: number) => {
    if (score <= (quizRef.current[phase] ?? -1)) return;
    const before = quizRef.current[phase];
    writeQuiz({ ...quizRef.current, [phase]: score });
    aSetQuiz(phase, score).catch(() => {
      if (quizRef.current[phase] === score) {
        const q = { ...quizRef.current };
        if (before === undefined) delete q[phase];
        else q[phase] = before;
        writeQuiz(q);
      }
      toast(FAIL);
    });
  }, []);

  const setProfile = useCallback((p: Record<string, number> | null) => {
    // Profile is one atomic value, so a full restore is correct.
    const prev = profileRef.current;
    writeProfile(p);
    aSetProfile(p ? Object.keys(p) : null).catch(() => {
      writeProfile(prev);
      toast(FAIL);
    });
  }, []);

  return (
    <StateCtx.Provider
      value={{
        status,
        tasks,
        quiz,
        profile,
        setStatus,
        bulkSet,
        toggleTask,
        reset,
        saveQuiz,
        setProfile,
      }}
    >
      {children}
    </StateCtx.Provider>
  );
}
