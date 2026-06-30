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
    const prev = statusRef.current;
    writeStatus({ ...prev, [id]: label });
    aSetStatus(id, label).catch(() => {
      writeStatus(prev);
      toast(FAIL);
    });
  }, []);

  const bulkSet = useCallback((ids: string[], label: string) => {
    if (!ids.length) return;
    const prev = statusRef.current;
    const next = { ...prev };
    ids.forEach((id) => (next[id] = label));
    writeStatus(next);
    aBulkSet(ids, label).catch(() => {
      writeStatus(prev);
      toast(FAIL);
    });
  }, []);

  const toggleTask = useCallback((id: string, index: number, done: boolean) => {
    const prevTasks = tasksRef.current;
    const cur = { ...(prevTasks[id] || {}) };
    if (done) cur[index] = 1;
    else delete cur[index];
    writeTasks({ ...prevTasks, [id]: cur });
    // Auto-promote not-started → in-progress on first check (matches the server).
    if (done && (statusRef.current[id] || "Not started") === "Not started") {
      writeStatus({ ...statusRef.current, [id]: "In progress" });
    }
    aToggleTask(id, index, done).catch(() => {
      writeTasks(prevTasks);
      toast(FAIL);
    });
  }, []);

  const reset = useCallback(() => {
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
    const prev = quizRef.current;
    writeQuiz({ ...prev, [phase]: score });
    aSetQuiz(phase, score).catch(() => writeQuiz(prev));
  }, []);

  const setProfile = useCallback((p: Record<string, number> | null) => {
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
