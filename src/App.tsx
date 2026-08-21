import { useState } from "react";
import { applySession, loadState, saveState } from "./lib/storage";
import { stageLabel } from "./lib/pick";
import type { AppState, SessionRecap } from "./lib/types";
import { Home } from "./views/Home";
import { Lesson } from "./views/Lesson";
import { Practice } from "./views/Practice";

type View = "home" | "lesson" | "practice";

export function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [view, setView] = useState<View>("home");

  function commit(next: AppState) {
    setState(next);
    saveState(next);
  }

  function onFinished(recap: SessionRecap, passed: boolean) {
    const next = applySession(state, recap, passed);
    commit(next);
  }

  return (
    <div className="app">
      <div className="top">
        <div className="brand">开口<span>练</span></div>
        <div className="meta">
          {stageLabel(state.stage)}
          <div>
            <button className="btn ghost" type="button" onClick={() => setView("home")} style={{ padding: "6px 12px" }}>
              首页
            </button>
          </div>
        </div>
      </div>

      {view === "home" && (
        <Home
          state={state}
          onLesson={() => setView("lesson")}
          onPractice={() => setView("practice")}
        />
      )}
      {view === "lesson" && (
        <Lesson
          onDone={() => {
            commit({ ...state, lessonDone: true });
            setView("practice");
          }}
          onSkip={() => setView("practice")}
        />
      )}
      {view === "practice" && (
        <Practice
          state={state}
          onFinished={onFinished}
          onHome={() => setView("home")}
        />
      )}
    </div>
  );
}
