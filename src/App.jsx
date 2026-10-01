import React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import "./styles.css";
import { supabase } from "./supabase.js";


const DEFAULT_DATA = {

  water: 0,

  protein: 0,

  steps: 0,

  gym: false,

  gymMinutes: 0,

  run: false,

  runMinutes: 0,

  sleep: 0,

  noJunk: false,

  noSugar: false,

  noPhoneEating: false,

  codingMinutes: 0,

  jobApplications: 0,

  jobFocus: false,

  hairCare: false,

  startingWeight: 100,
  targetWeight: 80,

};



const GOALS = {

  water: 3,

  protein: 140,

  steps: 10000,

  sleep: 8,

  codingMinutes: 60,

  jobApplications: 10,

  startingWeight: 100,
  targetWeight: 80,

};





const TRACKER_CHECKS = [

  (d) => Number(d.water) >= GOALS.water,

  (d) => Number(d.protein) >= GOALS.protein,

  (d) => Number(d.steps) >= GOALS.steps,

  (d) => d.gym,

  (d) => d.run,

  (d) => Number(d.sleep) >= GOALS.sleep,

  (d) => d.noJunk,

  (d) => d.noSugar,

  (d) => d.noPhoneEating,

  (d) => Number(d.codingMinutes) >= GOALS.codingMinutes,

  (d) =>

    Number(d.jobApplications) >= GOALS.jobApplications ||

    d.jobFocus,

  (d) => d.hairCare,

];



function getLocalDateKey(date = new Date()) {

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");



  return `${year}-${month}-${day}`;

}



function parseDateKey(key) {

  const [year, month, day] = key.split("-").map(Number);

  return new Date(year, month - 1, day);

}



function getScore(data) {

  const completed = TRACKER_CHECKS.filter((check) =>

    check(data)

  ).length;



  return Math.round(

    (completed / TRACKER_CHECKS.length) * 100

  );

}



function getDayStatus(data) {

  if (!data) return "red";



  const score = getScore(data);



  if (score >= 80) return "green";

  if (score >= 40) return "yellow";



  return "red";

}




function toDbRow(data, userId, dateKey) {
  return {
    user_id: userId,
    log_date: dateKey,
    water: Number(data.water) || 0,
    protein: Number(data.protein) || 0,
    steps: Number(data.steps) || 0,
    workout: Boolean(data.gym),
    workout_minutes: Number(data.gymMinutes) || 0,
    run: Boolean(data.run),
    run_km: Number(data.runMinutes) || 0,
    sleep: Number(data.sleep) || 0,
    no_junk: Boolean(data.noJunk),
    no_sugar: Boolean(data.noSugar),
    no_phone_eating: Boolean(data.noPhoneEating),
    hair_care: Boolean(data.hairCare),
    hair_growth_check_in: Boolean(data.hairGrowthCheckIn),
    hair_photo: Boolean(data.hairPhoto),
    coding_minutes: Number(data.codingMinutes) || 0,
    job_applications: Number(data.jobApplications) || 0,
    focus_self: Boolean(data.jobFocus),
    weight:
      data.weight !== "" && data.weight != null
        ? Number(data.weight)
        : null,
  };
}

function fromDbRow(row) {
  if (!row) return null;
  return {
    ...DEFAULT_DATA,
    water: row.water || 0,
    protein: row.protein || 0,
    steps: row.steps || 0,
    gym: row.workout || false,
    gymMinutes: row.workout_minutes || 0,
    run: row.run || false,
    runMinutes: row.run_km || 0,
    sleep: row.sleep || 0,
    noJunk: row.no_junk || false,
    noSugar: row.no_sugar || false,
    noPhoneEating: row.no_phone_eating || false,
    hairCare: row.hair_care || false,
    hairGrowthCheckIn: row.hair_growth_check_in || false,
    hairPhoto: row.hair_photo || false,
    codingMinutes: row.coding_minutes || 0,
    jobApplications: row.job_applications || 0,
    jobFocus: row.focus_self || false,
    weight: row.weight != null ? String(row.weight) : "",
  };
}


function getMonthDays(year, month) {

  const firstDay = new Date(year, month, 1);

  const lastDay = new Date(year, month + 1, 0);



  const mondayFirstIndex =

    (firstDay.getDay() + 6) % 7;



  const days = [];



  for (let i = 0; i < mondayFirstIndex; i++) {

    days.push(null);

  }



  for (let day = 1; day <= lastDay.getDate(); day++) {

    days.push(

      new Date(year, month, day)

    );

  }



  return days;

}



function calculateStreaks(allDays) {

  const completedDates = Object.entries(allDays)

    .filter(

      ([, data]) =>

        getScore(data) >= 80

    )

    .map(([date]) => date)

    .sort();



  if (!completedDates.length) {

    return {

      current: 0,

      best: 0,

    };

  }



  let best = 0;

  let running = 0;

  let previous = null;



  for (const dateKey of completedDates) {

    const currentDate =

      parseDateKey(dateKey);



    if (

      previous &&

      Math.round(

        (currentDate - previous) /

        (1000 * 60 * 60 * 24)

      ) === 1

    ) {

      running++;

    } else {

      running = 1;

    }



    best = Math.max(best, running);

    previous = currentDate;

  }



  let current = 0;

  let cursor = new Date();

  cursor.setHours(0, 0, 0, 0);



  while (true) {

    const key = getLocalDateKey(cursor);

    const data = allDays[key];



    if (!data || getScore(data) < 80) {

      break;

    }



    current++;



    cursor.setDate(cursor.getDate() - 1);

  }



  return {

    current,

    best,

  };

}



function App() {

  const today = getLocalDateKey();

  // ── Auth ──────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  // ── App state ─────────────────────────────────────────
  const [page, setPage] = useState("dashboard");
  const [data, setData] = useState({ ...DEFAULT_DATA });
  const [showStepsAnimation, setShowStepsAnimation] = useState(false);
  const [allDays, setAllDays] = useState({});
  const [analyticsDate, setAnalyticsDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(today);
  const saveTimerRef = useRef(null);

  // ── Auth listener ─────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => { setUser(session?.user ?? null); }
    );
    return () => subscription.unsubscribe();
  }, []);

  // ── Load today's data ─────────────────────────────────
  useEffect(() => {
    if (!user) { setData({ ...DEFAULT_DATA }); return; }
    setDataLoading(true);
    supabase
      .from("daily_logs")
      .select("*")
      .eq("user_id", user.id)
      .eq("log_date", today)
      .maybeSingle()
      .then(({ data: row }) => {
        setData(row ? fromDbRow(row) : { ...DEFAULT_DATA });
        setDataLoading(false);
      });
  }, [user, today]);

  // ── Load all days ────────────────────────────────────
  const loadAllDays = useCallback(async () => {
    if (!user) return;
    const { data: rows } = await supabase
      .from("daily_logs")
      .select("*")
      .eq("user_id", user.id);
    if (!rows) return;
    const days = {};
    rows.forEach((row) => { days[row.log_date] = fromDbRow(row); });
    setAllDays(days);
  }, [user]);

  useEffect(() => {
    if (user) loadAllDays();
  }, [user, loadAllDays]);

  // ── Debounced save ────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await supabase
        .from("daily_logs")
        .upsert(toDbRow(data, user.id, today), { onConflict: "user_id,log_date" });
      loadAllDays();
    }, 800);
    return () => clearTimeout(saveTimerRef.current);
  }, [data, user, today, loadAllDays]);

  // ── Derived ───────────────────────────────────────────
  const score = useMemo(() => getScore(data), [data]);
  const completedGoals = useMemo(
    () => TRACKER_CHECKS.filter((check) => check(data)).length,
    [data]
  );
  const perfectDay = score === 100;

  // ── Handlers ──────────────────────────────────────────
  function update(field, value) {
    setData((previous) => ({ ...previous, [field]: value }));
  }

  function updateNumber(field, value) {
    update(field, value === "" ? 0 : Number(value));
  }

  function updateSteps(value) {
    const number = value === "" ? 0 : Number(value);
    update("steps", number);
    if (number >= GOALS.steps && Number(data.steps) < GOALS.steps) {
      setShowStepsAnimation(true);
      setTimeout(() => setShowStepsAnimation(false), 3000);
    }
  }

  function resetToday() {
    if (window.confirm("Reset today's Winter Arc data?")) {
      setData({ ...DEFAULT_DATA });
    }
  }

  function goToAnalytics() {
    loadAllDays();
    setPage("analytics");
  }

  function goToDashboard() {
    setPage("dashboard");
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  // ── Guards ────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-ring" />
        <p>Loading Winter Arc…</p>
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  if (dataLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-ring" />
        <p>Syncing your data…</p>
      </div>
    );
  }



  return (

    <div className="winter-app">

      {showStepsAnimation && (

        <div className="celebration-overlay">

          <div className="celebration-card">

            <div className="celebration-icon">

              🔥

            </div>



            <h2>10K STEPS COMPLETE!</h2>



            <p>

              Another promise kept.

            </p>



            <div className="celebration-confetti">

              🎉 🎉 🎉

            </div>

          </div>

        </div>

      )}



      <header className="winter-header">

        <div>

          <p className="eyebrow">

            WINTER ARC • 90 DAY CHALLENGE

          </p>



          <h1>

            {page === "dashboard"

              ? "Today's Battle"

              : "Analytics"}

          </h1>



          <p className="date-text">

            {new Date().toLocaleDateString(

              "en-IN",

              {

                weekday: "long",

                day: "numeric",

                month: "long",

                year: "numeric",

              }

            )}

          </p>

        </div>



        <div className="header-actions">

          <div className="analytics-nav">

            <button

              className={

                page === "dashboard"

                  ? "active"

                  : ""

              }

              onClick={goToDashboard}

            >

              Dashboard

            </button>



            <button

              className={

                page === "analytics"

                  ? "active"

                  : ""

              }

              onClick={goToAnalytics}

            >

              Analytics

            </button>

          </div>



          {page === "dashboard" && (

            <button

              className="secondary-button"

              onClick={resetToday}

            >

              Reset Day

            </button>

          )}

          <button
            className="secondary-button sign-out-btn"
            onClick={signOut}
            title={`Signed in as ${user?.email}`}
          >
            Sign Out
          </button>

        </div>

      </header>



      {page === "dashboard" ? (

        <Dashboard

          data={data}

          score={score}

          completedGoals={completedGoals}

          perfectDay={perfectDay}

          update={update}

          updateNumber={updateNumber}

          updateSteps={updateSteps}

        />

      ) : (

        <Analytics

          allDays={allDays}

          year={analyticsDate.year}

          month={analyticsDate.month}

          setMonth={(year, month) =>

            setAnalyticsDate({

              year,

              month,

            })

          }

          selectedDate={selectedDate}

          setSelectedDate={setSelectedDate}

        />

      )}

    </div>

  );

}



function Dashboard({

  data,

  score,

  completedGoals,

  perfectDay,

  update,

  updateNumber,

  updateSteps,

}) {

  return (

    <main className="dashboard">

      <section className="hero-grid">

        <div className="score-card">

          <div

            className="score-ring"

            style={{

              "--progress": `${score * 3.6}deg`,

            }}

          >

            <div className="score-ring-inner">

              <strong>{score}%</strong>

              <span>CONSISTENCY</span>

            </div>

          </div>



          <div className="score-info">

            <span className="small-label">

              TODAY'S SCORE

            </span>



            <h2>

              {perfectDay

                ? "PERFECT DAY 🔥"

                : score >= 80

                  ? "Strong Day"

                  : score >= 50

                    ? "Keep Pushing"

                    : "Start the Battle"}

            </h2>



            <p>

              {completedGoals} of 12 core goals

              completed.

            </p>

          </div>

        </div>



        <div className="quick-card">

          <span className="small-label">

            10K STEP GOAL

          </span>



          <div className="quick-value">

            {Number(data.steps).toLocaleString()}

            <span>/ 10,000</span>

          </div>



          <div className="progress-bar">

            <div

              style={{

                width: `${Math.min(

                  (Number(data.steps) /

                    GOALS.steps) *

                  100,

                  100

                )}%`,

              }}

            />

          </div>



          <p>

            {Number(data.steps) >=

              GOALS.steps

              ? "Goal achieved 🔥"

              : `${Math.max(

                GOALS.steps -

                Number(data.steps),

                0

              ).toLocaleString()} steps remaining`}

          </p>

        </div>

      </section>



      <section className="tracker-section">

        <div className="section-heading">

          <div>

            <p className="eyebrow">

              BODY

            </p>



            <h2>Health & Fitness</h2>

          </div>

        </div>



        <div className="tracker-grid">

          <div className="tracker-card">

            <div className="card-icon">

              💧

            </div>



            <div className="card-content">

              <h3>Water</h3>

              <p>Goal: 3 L</p>



              <div className="input-row">

                <input

                  type="number"

                  min="0"

                  step="0.1"

                  value={data.water}

                  onChange={(e) =>

                    updateNumber(

                      "water",

                      e.target.value

                    )

                  }

                />



                <span>L</span>

              </div>



              <Progress

                value={data.water}

                goal={GOALS.water}

              />

            </div>

          </div>



          <div className="tracker-card">

            <div className="card-icon">

              🥩

            </div>



            <div className="card-content">

              <h3>Protein</h3>

              <p>Goal: 140 g</p>



              <div className="input-row">

                <input

                  type="number"

                  min="0"

                  value={data.protein}

                  onChange={(e) =>

                    updateNumber(

                      "protein",

                      e.target.value

                    )

                  }

                />



                <span>g</span>

              </div>



              <Progress

                value={data.protein}

                goal={GOALS.protein}

              />

            </div>

          </div>



          <div className="tracker-card">

            <div className="card-icon">

              🚶

            </div>



            <div className="card-content">

              <h3>Steps</h3>

              <p>Goal: 10,000</p>



              <div className="input-row">

                <input

                  type="number"

                  min="0"

                  value={data.steps}

                  onChange={(e) =>

                    updateSteps(

                      e.target.value

                    )

                  }

                />



                <span>steps</span>

              </div>



              <Progress

                value={data.steps}

                goal={GOALS.steps}

              />

            </div>

          </div>



          <ToggleCard

            icon="🏋️"

            title="Gym"

            subtitle="Complete today's workout"

            checked={data.gym}

            onChange={(value) =>

              update("gym", value)

            }

            extra={

              data.gym && (

                <div className="mini-input">

                  <input

                    type="number"

                    min="0"

                    value={data.gymMinutes}

                    onChange={(e) =>

                      updateNumber(

                        "gymMinutes",

                        e.target.value

                      )

                    }

                  />



                  <span>min</span>

                </div>

              )

            }

          />



          <ToggleCard

            icon="🏃"

            title="Run"

            subtitle="Complete today's run"

            checked={data.run}

            onChange={(value) =>

              update("run", value)

            }

            extra={

              data.run && (

                <div className="mini-input">

                  <input

                    type="number"

                    min="0"

                    value={data.runMinutes}

                    onChange={(e) =>

                      updateNumber(

                        "runMinutes",

                        e.target.value

                      )

                    }

                  />



                  <span>min</span>

                </div>

              )

            }

          />



          <div className="tracker-card">

            <div className="card-icon">

              😴

            </div>



            <div className="card-content">

              <h3>Sleep</h3>

              <p>Goal: 8 hours</p>



              <div className="input-row">

                <input

                  type="number"

                  min="0"

                  max="24"

                  step="0.5"

                  value={data.sleep}

                  onChange={(e) =>

                    updateNumber(

                      "sleep",

                      e.target.value

                    )

                  }

                />



                <span>hrs</span>

              </div>



              <Progress

                value={data.sleep}

                goal={GOALS.sleep}

              />

            </div>

          </div>

        </div>

      </section>



      <section className="tracker-section">

        <div className="section-heading">

          <div>

            <p className="eyebrow">

              DISCIPLINE

            </p>



            <h2>Rules of the Arc</h2>

          </div>

        </div>



        <div className="toggle-grid">

          <ToggleCard

            icon="🍔"

            title="No Junk Food"

            subtitle="Stay clean today"

            checked={data.noJunk}

            onChange={(value) =>

              update("noJunk", value)

            }

          />



          <ToggleCard

            icon="🍬"

            title="No Sugar"

            subtitle="Avoid added sugar"

            checked={data.noSugar}

            onChange={(value) =>

              update("noSugar", value)

            }

          />



          <ToggleCard

            icon="📱"

            title="No Phone While Eating"

            subtitle="Be present during meals"

            checked={data.noPhoneEating}

            onChange={(value) =>

              update(

                "noPhoneEating",

                value

              )

            }

          />



          <ToggleCard

            icon="💇"

            title="Hair Care"

            subtitle="Complete today's routine"

            checked={data.hairCare}

            onChange={(value) =>

              update("hairCare", value)

            }

          />

        </div>

      </section>
      <section className="tracker-section">
        <div className="section-heading">
          <div><p className="eyebrow">BODY TRANSFORMATION</p><h2>Weight Progress</h2></div>
        </div>
        <div className="weight-progress-card">
          <div className="weight-main">
            <div className="card-icon">⚖️</div>
            <div><p className="small-label">CURRENT WEIGHT</p>
              <div className="weight-input-row">
                <input type="number" min="0" step="0.1" placeholder="Enter weight" value={data.weight} onChange={(e) => update("weight", e.target.value)} />
                <span>kg</span>
              </div>
            </div>
          </div>
          <div className="weight-stats">
            <div><span>START</span><strong>{GOALS.startingWeight} kg</strong></div>
            <div><span>TARGET</span><strong>{GOALS.targetWeight} kg</strong></div>
            <div><span>REMAINING</span><strong>{data.weight ? Math.max(Number(data.weight) - GOALS.targetWeight, 0).toFixed(1) : "--"} kg</strong></div>
          </div>
          <div className="weight-bar"><div style={{ width: `${data.weight ? Math.min(Math.max(((GOALS.startingWeight - Number(data.weight)) / (GOALS.startingWeight - GOALS.targetWeight)) * 100, 0), 100) : 0}%` }} /></div>
        </div>
      </section>

      <section className="tracker-section">
        <div className="section-heading"><div><p className="eyebrow">HAIR GROWTH</p><h2>Hair Journey</h2></div></div>
        <div className="toggle-grid">
          <ToggleCard icon="💆" title="Hair Care" subtitle="Complete today's hair routine" checked={data.hairCare} onChange={(value) => update("hairCare", value)} />
          <ToggleCard icon="📸" title="Growth Check-In" subtitle="Record your weekly progress" checked={data.hairGrowthCheckIn} onChange={(value) => update("hairGrowthCheckIn", value)} />
          <ToggleCard icon="🪞" title="Progress Photo" subtitle="Record a progress photo" checked={data.hairPhoto} onChange={(value) => update("hairPhoto", value)} />
        </div>
      </section>




      <section className="tracker-section">

        <div className="section-heading">

          <div>

            <p className="eyebrow">

              FUTURE

            </p>



            <h2>Career & Focus</h2>

          </div>

        </div>



        <div className="tracker-grid">

          <div className="tracker-card">

            <div className="card-icon">

              💻

            </div>



            <div className="card-content">

              <h3>Coding</h3>

              <p>Minimum: 60 minutes</p>



              <div className="input-row">

                <input

                  type="number"

                  min="0"

                  value={data.codingMinutes}

                  onChange={(e) =>

                    updateNumber(

                      "codingMinutes",

                      e.target.value

                    )

                  }

                />



                <span>min</span>

              </div>



              <Progress

                value={data.codingMinutes}

                goal={GOALS.codingMinutes}

              />

            </div>

          </div>



          <div className="tracker-card">

            <div className="card-icon">

              💼

            </div>



            <div className="card-content">

              <h3>Job Applications</h3>

              <p>

                Target: 10 applications

              </p>



              <div className="input-row">

                <input

                  type="number"

                  min="0"

                  value={

                    data.jobApplications

                  }

                  onChange={(e) =>

                    updateNumber(

                      "jobApplications",

                      e.target.value

                    )

                  }

                />



                <span>jobs</span>

              </div>



              <Progress

                value={data.jobApplications}

                goal={

                  GOALS.jobApplications

                }

              />



              <label className="checkbox-line">

                <input

                  type="checkbox"

                  checked={data.jobFocus}

                  onChange={(e) =>

                    update(

                      "jobFocus",

                      e.target.checked

                    )

                  }

                />



                At least 30 min focused

                job search

              </label>

            </div>

          </div>

        </div>

      </section>



      <section className="daily-summary">

        <div>

          <p className="eyebrow">

            END OF DAY

          </p>



          <h2>

            {perfectDay

              ? "You completed the Arc today. 🔥"

              : "Keep going. The day isn't over."}

          </h2>

        </div>



        <div className="summary-score">

          <strong>{score}%</strong>

          <span>Consistency</span>

        </div>

      </section>

    </main>

  );

}



function Analytics({

  allDays,

  year,

  month,

  setMonth,

  selectedDate,

  setSelectedDate,

}) {

  const monthDays = getMonthDays(

    year,

    month

  );



  const monthPrefix = `${year}-${String(

    month + 1

  ).padStart(2, "0")}`;



  const monthRecords = Object.entries(

    allDays

  ).filter(([date]) =>

    date.startsWith(monthPrefix)

  );



  const monthScores = monthRecords.map(

    ([, data]) => getScore(data)

  );



  const daysWithData =

    monthRecords.length;



  const perfectDays = monthScores.filter(

    (score) => score === 100

  ).length;



  const partialDays = monthScores.filter(

    (score) => score >= 40 && score < 80

  ).length;



  const missedDays = monthScores.filter(

    (score) => score < 40

  ).length;



  const consistency =

    daysWithData > 0

      ? Math.round(

        monthScores.reduce(

          (sum, score) => sum + score,

          0

        ) / daysWithData

      )

      : 0;



  const streaks =

    calculateStreaks(allDays);



  const selectedData =

    allDays[selectedDate];



  const previousMonth = () => {

    if (month === 0) {

      setMonth(year - 1, 11);

    } else {

      setMonth(year, month - 1);

    }

  };



  const nextMonth = () => {

    if (month === 11) {

      setMonth(year + 1, 0);

    } else {

      setMonth(year, month + 1);

    }

  };



  return (

    <main className="analytics-page">

      <div className="analytics-stats">

        <AnalyticsStat

          icon="🔥"

          value={streaks.current}

          label="Current Streak"

        />



        <AnalyticsStat

          icon="🏆"

          value={streaks.best}

          label="Best Streak"

        />



        <AnalyticsStat

          icon="📊"

          value={`${consistency}%`}

          label="Monthly Consistency"

        />



        <AnalyticsStat

          icon="✅"

          value={perfectDays}

          label="Perfect Days"

        />



        <AnalyticsStat

          icon="❌"

          value={missedDays}

          label="Missed Days"

        />

      </div>



      <section className="calendar-card">

        <div className="calendar-title">

          <div>

            <p className="eyebrow">

              DAILY HISTORY

            </p>



            <h2>

              {new Date(

                year,

                month

              ).toLocaleDateString(

                "en-IN",

                {

                  month: "long",

                  year: "numeric",

                }

              )}

            </h2>

          </div>



          <div className="month-controls">

            <button

              onClick={previousMonth}

              aria-label="Previous month"

            >

              ←

            </button>



            <strong>

              {new Date(

                year,

                month

              ).toLocaleDateString(

                "en-IN",

                {

                  month: "long",

                  year: "numeric",

                }

              )}

            </strong>



            <button

              onClick={nextMonth}

              aria-label="Next month"

            >

              →

            </button>

          </div>

        </div>



        <div className="calendar-legend">

          <div className="legend-item">

            <span className="legend-dot legend-green" />

            Strong

          </div>



          <div className="legend-item">

            <span className="legend-dot legend-yellow" />

            Partial

          </div>



          <div className="legend-item">

            <span className="legend-dot legend-red" />

            Missed

          </div>

        </div>



        <div className="calendar-weekdays">

          {[

            "MON",

            "TUE",

            "WED",

            "THU",

            "FRI",

            "SAT",

            "SUN",

          ].map((day) => (

            <div key={day}>{day}</div>

          ))}

        </div>



        <div className="calendar-grid">

          {monthDays.map(

            (date, index) => {

              if (!date) {

                return (

                  <div

                    key={`empty-${index}`}

                    className="calendar-day empty"

                  />

                );

              }



              const dateKey =

                getLocalDateKey(date);



              const dayData =

                allDays[dateKey];



              const status =

                getDayStatus(dayData);



              const isToday =

                dateKey ===

                getLocalDateKey();



              const isSelected =

                dateKey === selectedDate;



              return (

                <button

                  key={dateKey}

                  className={`calendar-day ${status} ${isToday

                    ? "today"

                    : ""

                    } ${isSelected

                      ? "selected"

                      : ""

                    }`}

                  onClick={() =>

                    setSelectedDate(

                      dateKey

                    )

                  }

                >

                  <div className="calendar-date">

                    {date.getDate()}

                  </div>



                  <div className="calendar-status">

                    {dayData

                      ? status ===

                        "green"

                        ? "✓"

                        : status ===

                          "yellow"

                          ? "•"

                          : "×"

                      : "—"}

                  </div>

                </button>

              );

            }

          )}

        </div>

      </section>



      <section className="day-details">

        <SelectedDay

          dateKey={selectedDate}

          data={selectedData}

        />



        <PerformancePanel

          data={selectedData}

        />

      </section>



      <PerformanceOverview

        allDays={allDays}

        monthPrefix={monthPrefix}

      />



      <TransformationAnalytics allDays={allDays} />

      <WinterArcMaster allDays={allDays} />

      <Heatmap allDays={allDays} />

    </main>

  );

}



function AnalyticsStat({

  icon,

  value,

  label,

}) {

  return (

    <div className="analytics-stat">

      <div className="analytics-stat-icon">

        {icon}

      </div>



      <strong>{value}</strong>



      <span>{label}</span>

    </div>

  );

}



function SelectedDay({

  dateKey,

  data,

}) {

  const formattedDate =

    parseDateKey(

      dateKey

    ).toLocaleDateString(

      "en-IN",

      {

        weekday: "long",

        day: "numeric",

        month: "long",

      }

    );



  const score = data

    ? getScore(data)

    : 0;



  const rows = [

    {

      label: "💧 Water",

      value: data

        ? `${data.water} / ${GOALS.water} L`

        : "—",

      complete: data

        ? Number(data.water) >=

        GOALS.water

        : false,

    },

    {

      label: "🥩 Protein",

      value: data

        ? `${data.protein} / ${GOALS.protein} g`

        : "—",

      complete: data

        ? Number(data.protein) >=

        GOALS.protein

        : false,

    },

    {

      label: "🚶 Steps",

      value: data

        ? `${Number(

          data.steps

        ).toLocaleString()} / 10,000`

        : "—",

      complete: data

        ? Number(data.steps) >=

        GOALS.steps

        : false,

    },

    {

      label: "🏋️ Gym",

      value: data

        ? data.gym

          ? `${data.gymMinutes} min`

          : "Not completed"

        : "—",

      complete: data?.gym || false,

    },

    {

      label: "🏃 Run",

      value: data

        ? data.run

          ? `${data.runMinutes} min`

          : "Not completed"

        : "—",

      complete: data?.run || false,

    },

    {

      label: "😴 Sleep",

      value: data

        ? `${data.sleep} / ${GOALS.sleep} hrs`

        : "—",

      complete: data

        ? Number(data.sleep) >=

        GOALS.sleep

        : false,

    },

    {

      label: "🍔 No Junk Food",

      value: data

        ? data.noJunk

          ? "Yes"

          : "No"

        : "—",

      complete: data?.noJunk || false,

    },

    {

      label: "🍬 No Sugar",

      value: data

        ? data.noSugar

          ? "Yes"

          : "No"

        : "—",

      complete: data?.noSugar || false,

    },

    {

      label: "📱 No Phone While Eating",

      value: data

        ? data.noPhoneEating

          ? "Yes"

          : "No"

        : "—",

      complete:

        data?.noPhoneEating || false,

    },

    {

      label: "💻 Coding",

      value: data

        ? `${data.codingMinutes} / ${GOALS.codingMinutes} min`

        : "—",

      complete: data

        ? Number(data.codingMinutes) >=

        GOALS.codingMinutes

        : false,

    },

    {

      label: "💼 Applications",

      value: data

        ? `${data.jobApplications} / ${GOALS.jobApplications}`

        : "—",

      complete: data

        ? Number(data.jobApplications) >=

        GOALS.jobApplications ||

        data.jobFocus

        : false,

    },

    {

      label: "💇 Hair Care",

      value: data

        ? data.hairCare

          ? "Completed"

          : "Not completed"

        : "—",

      complete:

        data?.hairCare || false,

    },

  ];



  return (

    <div className="day-detail-card">

      <div className="day-detail-header">

        <div>

          <p className="eyebrow">

            SELECTED DAY

          </p>



          <h2>{formattedDate}</h2>

        </div>



        <div className="day-score">

          {data ? `${score}%` : "—"}

        </div>

      </div>



      {!data ? (

        <div className="analytics-empty">

          No data recorded for this day.

          <br />

          Complete the Daily Tracker to

          build your history.

        </div>

      ) : (

        <div className="detail-list">

          {rows.map((row) => (

            <div

              className="detail-row"

              key={row.label}

            >

              <span className="detail-label">

                {row.label}

              </span>



              <span

                className={`detail-value ${row.complete

                  ? "detail-success"

                  : "detail-failed"

                  }`}

              >

                {row.value}{" "}

                {row.complete

                  ? "✓"

                  : "×"}

              </span>

            </div>

          ))}

        </div>

      )}

    </div>

  );

}



function PerformancePanel({

  data,

}) {

  const fitness = data

    ? Math.round(

      ([

        Number(data.steps) >=

        GOALS.steps,

        data.gym,

        data.run,

        Number(data.sleep) >=

        GOALS.sleep,

      ].filter(Boolean).length /

        4) *

      100

    )

    : 0;



  const nutrition = data

    ? Math.round(

      ([

        Number(data.water) >=

        GOALS.water,

        Number(data.protein) >=

        GOALS.protein,

        data.noJunk,

        data.noSugar,

      ].filter(Boolean).length /

        4) *

      100

    )

    : 0;



  const focus = data

    ? Math.round(

      ([

        Number(

          data.codingMinutes

        ) >=

        GOALS.codingMinutes,

        Number(

          data.jobApplications

        ) >=

        GOALS.jobApplications ||

        data.jobFocus,

        data.noPhoneEating,

      ].filter(Boolean).length /

        3) *

      100

    )

    : 0;



  return (

    <div className="day-detail-card">

      <p className="eyebrow">

        DAILY PERFORMANCE

      </p>



      <h2>Category Score</h2>



      <PerformanceBar

        label="Fitness"

        value={fitness}

      />



      <PerformanceBar

        label="Nutrition"

        value={nutrition}

      />



      <PerformanceBar

        label="Focus & Career"

        value={focus}

      />



      <PerformanceBar

        label="Hair Care"

        value={data?.hairCare ? 100 : 0}

      />

    </div>

  );

}



function PerformanceBar({

  label,

  value,

}) {

  return (

    <div className="performance-item">

      <div className="performance-label">

        <span>{label}</span>

        <strong>{value}%</strong>

      </div>



      <div className="performance-bar">

        <div

          style={{

            width: `${value}%`,

          }}

        />

      </div>

    </div>

  );

}



function PerformanceOverview({

  allDays,

  monthPrefix,

}) {

  const records = Object.entries(

    allDays

  ).filter(([date]) =>

    date.startsWith(monthPrefix)

  );



  const average = (values) =>

    values.length

      ? Math.round(

        values.reduce(

          (a, b) => a + b,

          0

        ) / values.length

      )

      : 0;



  const fitness = records.map(

    ([, d]) =>

      [

        Number(d.steps) >=

        GOALS.steps,

        d.gym,

        d.run,

        Number(d.sleep) >=

        GOALS.sleep,

      ].filter(Boolean).length *

      25

  );



  const nutrition = records.map(

    ([, d]) =>

      [

        Number(d.water) >=

        GOALS.water,

        Number(d.protein) >=

        GOALS.protein,

        d.noJunk,

        d.noSugar,

      ].filter(Boolean).length *

      25

  );



  const focus = records.map(

    ([, d]) =>

      [

        Number(

          d.codingMinutes

        ) >= GOALS.codingMinutes,

        Number(

          d.jobApplications

        ) >= GOALS.jobApplications ||

        d.jobFocus,

        d.noPhoneEating,

      ].filter(Boolean).length *

      33.33

  );



  return (

    <section className="performance-grid">

      <div className="performance-card">

        <h3>🏋️ Fitness</h3>



        <PerformanceBar

          label="Steps"

          value={average(

            records.map(([, d]) =>

              Math.min(

                (Number(d.steps) /

                  GOALS.steps) *

                100,

                100

              )

            )

          )}

        />



        <PerformanceBar

          label="Gym"

          value={average(

            records.map(([, d]) =>

              d.gym ? 100 : 0

            )

          )}

        />



        <PerformanceBar

          label="Running"

          value={average(

            records.map(([, d]) =>

              d.run ? 100 : 0

            )

          )}

        />



        <PerformanceBar

          label="Sleep"

          value={average(

            records.map(([, d]) =>

              Math.min(

                (Number(d.sleep) /

                  GOALS.sleep) *

                100,

                100

              )

            )

          )}

        />

      </div>



      <div className="performance-card">

        <h3>🥩 Nutrition</h3>



        <PerformanceBar

          label="Water"

          value={average(

            records.map(([, d]) =>

              Math.min(

                (Number(d.water) /

                  GOALS.water) *

                100,

                100

              )

            )

          )}

        />



        <PerformanceBar

          label="Protein"

          value={average(

            records.map(([, d]) =>

              Math.min(

                (Number(d.protein) /

                  GOALS.protein) *

                100,

                100

              )

            )

          )}

        />



        <PerformanceBar

          label="No Junk Food"

          value={average(

            records.map(([, d]) =>

              d.noJunk ? 100 : 0

            )

          )}

        />



        <PerformanceBar

          label="No Sugar"

          value={average(

            records.map(([, d]) =>

              d.noSugar ? 100 : 0

            )

          )}

        />

      </div>



      <div className="performance-card">

        <h3>💻 Focus & Career</h3>



        <PerformanceBar

          label="Coding"

          value={average(

            records.map(([, d]) =>

              Math.min(

                (Number(

                  d.codingMinutes

                ) /

                  GOALS.codingMinutes) *

                100,

                100

              )

            )

          )}

        />



        <PerformanceBar

          label="Job Applications"

          value={average(

            records.map(([, d]) =>

              Math.min(

                (Number(

                  d.jobApplications

                ) /

                  GOALS.jobApplications) *

                100,

                100

              )

            )

          )}

        />



        <PerformanceBar

          label="No Phone While Eating"

          value={average(

            records.map(([, d]) =>

              d.noPhoneEating

                ? 100

                : 0

            )

          )}

        />

      </div>



      <div className="performance-card">

        <h3>🔥 Monthly Overview</h3>



        <PerformanceBar

          label="Fitness"

          value={average(fitness)}

        />



        <PerformanceBar

          label="Nutrition"

          value={average(nutrition)}

        />



        <PerformanceBar

          label="Focus"

          value={average(focus)}

        />

      </div>

    </section>

  );

}



function getWeightHistory(allDays) {
  return Object.entries(allDays).filter(([, data]) => data.weight !== undefined && data.weight !== "" && Number(data.weight) > 0).map(([date, data]) => ({ date, weight: Number(data.weight) })).sort((a, b) => a.date.localeCompare(b.date));
}

function getHairStats(allDays) {
  const records = Object.values(allDays);
  if (!records.length) return { hairCare: 0, checkIns: 0, photos: 0 };
  return { hairCare: Math.round(records.filter((d) => d.hairCare).length / records.length * 100), checkIns: records.filter((d) => d.hairGrowthCheckIn).length, photos: records.filter((d) => d.hairPhoto).length };
}

function calculateCategoryScore(allDays, keys) {
  const days = Object.values(allDays); if (!days.length) return 0;
  let total = 0, possible = 0;
  days.forEach((data) => keys.forEach((key) => { possible += 1; if (key.endsWith("Minutes")) { if (Number(data[key]) > 0) total += 1; } else if (key === "jobApplications") { if (Number(data[key]) > 0) total += 1; } else if (data[key]) total += 1; }));
  return possible ? Math.round(total / possible * 100) : 0;
}

function TransformationAnalytics({ allDays }) {
  const weightHistory = getWeightHistory(allDays);
  const hairStats = getHairStats(allDays);

  const latestWeight = weightHistory.length
    ? weightHistory[weightHistory.length - 1].weight
    : null;

  const currentWeight = latestWeight || GOALS.startingWeight;

  const lost = GOALS.startingWeight - currentWeight;

  const remaining = Math.max(
    currentWeight - GOALS.targetWeight,
    0
  );

  const weightProgress = Math.min(
    Math.max(
      (lost /
        (GOALS.startingWeight - GOALS.targetWeight)) *
      100,
      0
    ),
    100
  );

  /*
    Calculate a daily Winter Arc score.

    Green  = 70%+
    Yellow = 40–69%
    Red    = below 40%
  */
  const getDailyStatus = (data) => {
    if (!data) {
      return "future";
    }

    const checks = [
      Number(data.water) >= GOALS.water,
      Number(data.protein) >= GOALS.protein,
      Number(data.steps) >= GOALS.steps,
      Number(data.sleep) >= GOALS.sleep,
      Number(data.codingMinutes) >= GOALS.codingMinutes,
      Number(data.jobApplications) >= GOALS.jobApplications,
      Boolean(data.jobFocus),
      Boolean(data.hairCare),
    ];

    const completed = checks.filter(Boolean).length;

    const score = (completed / checks.length) * 100;

    if (score >= 70) {
      return "green";
    }

    if (score >= 40) {
      return "yellow";
    }

    return "red";
  };

  /*
    October 2026
  */
  const year = 2026;
  const month = 9; // October = 9 in JavaScript

  const daysInMonth = new Date(
    year,
    month + 1,
    0
  ).getDate();

  const firstDay = new Date(
    year,
    month,
    1
  ).getDay();

  /*
    Convert Sunday-first JS day
    into Monday-first calendar.

    Sunday = 0
    Monday = 1

    We want:
    Monday Tuesday Wednesday Thursday Friday Saturday Sunday
  */
  const mondayOffset =
    firstDay === 0 ? 6 : firstDay - 1;

  const calendarCells = [];

  for (let i = 0; i < mondayOffset; i++) {
    calendarCells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    calendarCells.push(day);
  }

  const [selectedDate, setSelectedDate] = React.useState(
    null
  );

  const selectedData =
    selectedDate &&
      allDays[selectedDate]
      ? allDays[selectedDate]
      : null;

  const greenDays = Object.entries(allDays).filter(
    ([date, data]) => {
      if (!date.startsWith("2026-10-")) return false;
      return getDailyStatus(data) === "green";
    }
  ).length;

  const yellowDays = Object.entries(allDays).filter(
    ([date, data]) => {
      if (!date.startsWith("2026-10-")) return false;
      return getDailyStatus(data) === "yellow";
    }
  ).length;

  const redDays = Object.entries(allDays).filter(
    ([date, data]) => {
      if (!date.startsWith("2026-10-")) return false;
      return getDailyStatus(data) === "red";
    }
  ).length;

  const trackedDays =
    greenDays + yellowDays + redDays;

  return (
    <section className="transformation-section">

      {/* ================================
          TRANSFORMATION HEADER
      ================================= */}

      <div className="section-heading">
        <div>
          <p className="eyebrow">
            TRANSFORMATION
          </p>

          <h2>
            Body & Hair Progress
          </h2>
        </div>
      </div>


      {/* ================================
          WEIGHT + HAIR
      ================================= */}

      <div className="transformation-grid">

        {/* WEIGHT */}

        <div className="transformation-card">

          <div className="transformation-card-header">

            <div>
              <p className="eyebrow">
                WEIGHT LOSS
              </p>

              <h3>
                {latestWeight
                  ? `${latestWeight} kg`
                  : "-- kg"}
              </h3>
            </div>

            <div className="transformation-icon">
              ⚖️
            </div>

          </div>


          <div className="weight-metrics">

            <div>
              <span>START</span>

              <strong>
                {GOALS.startingWeight} kg
              </strong>
            </div>

            <div>
              <span>LOST</span>

              <strong>
                {lost > 0
                  ? lost.toFixed(1)
                  : "0.0"} kg
              </strong>
            </div>

            <div>
              <span>REMAINING</span>

              <strong>
                {remaining.toFixed(1)} kg
              </strong>
            </div>

          </div>


          <div className="transformation-progress">

            <div className="transformation-progress-label">

              <span>
                Progress to {GOALS.targetWeight} kg
              </span>

              <strong>
                {Math.round(weightProgress)}%
              </strong>

            </div>

            <div className="transformation-progress-bar">

              <div
                style={{
                  width: `${weightProgress}%`,
                }}
              />

            </div>

          </div>


          {weightHistory.length > 1 ? (
            <WeightChart
              history={weightHistory}
              targetWeight={GOALS.targetWeight}
            />
          ) : (
            <div className="analytics-empty">
              Enter weight on at least two dates
              to generate your trend.
            </div>
          )}

        </div>


        {/* HAIR */}

        <div className="transformation-card">

          <div className="transformation-card-header">

            <div>
              <p className="eyebrow">
                HAIR GROWTH
              </p>

              <h3>
                Hair Journey
              </h3>
            </div>

            <div className="transformation-icon">
              💇
            </div>

          </div>


          <div className="hair-stat-main">

            <strong>
              {hairStats.hairCare}%
            </strong>

            <span>
              Hair-care consistency
            </span>

          </div>


          <div className="hair-stat-grid">

            <div>
              <strong>
                {hairStats.checkIns}
              </strong>

              <span>
                Growth Check-ins
              </span>
            </div>

            <div>
              <strong>
                {hairStats.photos}
              </strong>

              <span>
                Progress Photos
              </span>
            </div>

          </div>


          <div className="hair-message">

            {hairStats.hairCare >= 80
              ? "🔥 Excellent consistency. Keep the routine going."
              : hairStats.hairCare >= 50
                ? "⚡ Good progress. Stay consistent."
                : "🌱 Start building your hair routine consistency."}

          </div>

        </div>

      </div>


      {/* =================================================
          OCTOBER ANALYTICS
      ================================================= */}

      <div className="monthly-analytics">

        <div className="monthly-analytics-header">

          <div>
            <p className="eyebrow">
              DAILY HISTORY
            </p>

            <h2>
              OCTOBER 2026
            </h2>

            <p className="monthly-subtitle">
              Your Winter Arc, day by day.
            </p>
          </div>


          <div className="monthly-counts">

            <div className="month-count green-count">
              <strong>
                {greenDays}
              </strong>

              <span>
                🟩 Strong
              </span>
            </div>

            <div className="month-count yellow-count">
              <strong>
                {yellowDays}
              </strong>

              <span>
                🟨 Partial
              </span>
            </div>

            <div className="month-count red-count">
              <strong>
                {redDays}
              </strong>

              <span>
                🟥 Missed
              </span>
            </div>

          </div>

        </div>


        {/* WEEKDAYS */}

        <div className="calendar-weekdays">

          {[
            "Mon",
            "Tue",
            "Wed",
            "Thu",
            "Fri",
            "Sat",
            "Sun",
          ].map((day) => (
            <div key={day}>
              {day}
            </div>
          ))}

        </div>


        {/* CALENDAR */}

        <div className="calendar-grid">

          {calendarCells.map((day, index) => {

            if (!day) {
              return (
                <div
                  key={`empty-${index}`}
                  className="calendar-empty"
                />
              );
            }

            const dateKey =
              `2026-10-${String(day).padStart(
                2,
                "0"
              )}`;

            const data =
              allDays[dateKey];

            const status =
              getDailyStatus(data);

            const today =
              new Date();

            const cellDate =
              new Date(
                year,
                month,
                day
              );

            const isFuture =
              cellDate > today;

            return (
              <button
                key={dateKey}
                type="button"
                className={`calendar-day ${status} ${selectedDate === dateKey
                    ? "selected"
                    : ""
                  } ${isFuture
                    ? "future-day"
                    : ""
                  }`}
                onClick={() =>
                  setSelectedDate(
                    dateKey
                  )
                }
              >

                <span className="calendar-day-number">
                  {day}
                </span>

                <span className="calendar-status">
                  {isFuture
                    ? "·"
                    : status === "green"
                      ? "✓"
                      : status === "yellow"
                        ? "—"
                        : status === "red"
                          ? "×"
                          : "·"}
                </span>

              </button>
            );
          })}

        </div>


        {/* SELECTED DAY */}

        {selectedDate && (

              <div className="selected-day-panel">

                <div className="selected-day-header">

                  <div>

                    <p className="eyebrow">
                      DAILY HISTORY
                    </p>

                    <h3>
                      {new Date(
                        `${selectedDate}T00:00:00`
                      ).toLocaleDateString(
                        "en-IN",
                        {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        }
                      )}
                    </h3>

                  </div>


                  <div
                    className={`selected-status ${getDailyStatus(
                      selectedData
                    )
                      }`}
                  >
                    {getDailyStatus(
                      selectedData
                    ) === "green"
                      ? "🟩 Completed"
                      : getDailyStatus(
                        selectedData
                      ) === "yellow"
                        ? "🟨 Partial"
                        : getDailyStatus(
                          selectedData
                        ) === "red"
                          ? "🟥 Missed"
                          : "⬜ No data"}
                  </div>

                </div>


                {selectedData ? (

                  <div className="selected-day-grid">

                    <div>
                      <span>
                        💧 Water
                      </span>

                      <strong>
                        {selectedData.water || 0} L
                      </strong>
                    </div>

                    <div>
                      <span>
                        🥩 Protein
                      </span>

                      <strong>
                        {selectedData.protein || 0} g
                      </strong>
                    </div>

                    <div>
                      <span>
                        🚶 Steps
                      </span>

                      <strong>
                        {selectedData.steps || 0}
                      </strong>
                    </div>

                    <div>
                      <span>
                        😴 Sleep
                      </span>

                      <strong>
                        {selectedData.sleep || 0} h
                      </strong>
                    </div>

                    <div>
                      <span>
                        💻 Coding
                      </span>

                      <strong>
                        {selectedData.codingMinutes || 0} min
                      </strong>
                    </div>

                    <div>
                      <span>
                        💼 Job Applications
                      </span>

                      <strong>
                        {selectedData.jobApplications || 0}
                      </strong>
                    </div>

                    <div>
                      <span>
                        💇 Hair Care
                      </span>

                      <strong>
                        {selectedData.hairCare
                          ? "✓ Done"
                          : "× Not done"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        ⚖️ Weight
                      </span>

                      <strong>
                        {selectedData.weight
                          ? `${selectedData.weight} kg`
                          : "--"}
                      </strong>
                    </div>

                  </div>

                ) : (

                  <div className="analytics-empty">
                    No activity has been recorded
                    for this date yet.
                  </div>

                )}

              </div>

            )}

          </div>

    </section>
  );
}

function WeightChart({ history, targetWeight }) {
  const width = 700, height = 240, padding = 35, weights = history.map((x) => x.weight), minWeight = Math.min(...weights, targetWeight) - 1, maxWeight = Math.max(...weights) + 1;
  const getX = (i) => padding + (i / Math.max(history.length - 1, 1)) * (width - padding * 2), getY = (w) => height - padding - ((w - minWeight) / Math.max(maxWeight - minWeight, 1)) * (height - padding * 2), points = history.map((x, i) => `${getX(i)},${getY(x.weight)}`).join(" ");
  return <div className="weight-chart"><div className="chart-title"><span>Weight Trend</span><strong>Target: {targetWeight} kg</strong></div><svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"><line x1={padding} y1={getY(targetWeight)} x2={width - padding} y2={getY(targetWeight)} className="target-line" /><polyline points={points} fill="none" className="weight-line" />{history.map((x, i) => <circle key={x.date} cx={getX(i)} cy={getY(x.weight)} r="4" className="weight-point"><title>{x.date} — {x.weight} kg</title></circle>)}</svg><div className="chart-range"><span>{history[0].date}</span><span>{history[history.length - 1].date}</span></div></div>;
}

function WinterArcMaster({ allDays }) {
  const startDate = new Date(); startDate.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 90 }, (_, i) => { const date = new Date(startDate); date.setDate(startDate.getDate() + i); const key = getLocalDateKey(date); const data = allDays[key]; return { day: i + 1, key, status: data ? getDayStatus(data) : "future" }; });
  const completed = days.filter(d => d.status !== "future").length, strong = days.filter(d => d.status === "green").length, missed = days.filter(d => d.status === "red").length, progress = Math.round(completed / 90 * 100), streaks = calculateStreaks(allDays);
  const cats = { Fitness: calculateCategoryScore(allDays, ["gym", "run", "steps", "sleep"]), Nutrition: calculateCategoryScore(allDays, ["water", "protein", "noJunk", "noSugar"]), Coding: calculateCategoryScore(allDays, ["codingMinutes"]), Career: calculateCategoryScore(allDays, ["jobApplications", "jobFocus"]), Discipline: calculateCategoryScore(allDays, ["noPhoneEating", "sleep"]), Hair: calculateCategoryScore(allDays, ["hairCare"]) };
  return <section className="master-section"><div className="section-heading"><div><p className="eyebrow">WINTER ARC</p><h2>90-Day Master Dashboard</h2></div></div><div className="master-hero"><div className="master-ring" style={{ "--master-progress": `${progress}%` }}><div><strong>{progress}%</strong><span>COMPLETE</span></div></div><div className="master-hero-info"><p className="eyebrow">THE 90 DAY CHALLENGE</p><h3>Become the version<br />you said you'd become.</h3><p>Every completed day moves the Winter Arc forward.</p></div></div><div className="master-stats"><div><strong>🔥 {streaks.current}</strong><span>CURRENT STREAK</span></div><div><strong>🏆 {streaks.best}</strong><span>BEST STREAK</span></div><div><strong>🟩 {strong}</strong><span>STRONG DAYS</span></div><div><strong>🟥 {missed}</strong><span>MISSED DAYS</span></div></div><div className="category-master">{Object.entries(cats).map(([name, value]) => <div className="category-master-row" key={name}><div className="category-master-label"><span>{name}</span><strong>{value}%</strong></div><div className="category-master-bar"><div style={{ width: `${value}%` }} /></div></div>)}</div><div className="day-grid">{days.map(d => <div key={d.day} className={`master-day ${d.status}`} title={`Day ${d.day} — ${d.key}`}><span>{d.day}</span></div>)}</div><div className="master-legend"><span><i className="legend-box green" />Strong</span><span><i className="legend-box yellow" />Partial</span><span><i className="legend-box red" />Missed</span><span><i className="legend-box future" />Upcoming</span></div></section>;
}

function Heatmap({

  allDays,

}) {

  const days = [];



  const start = new Date();

  start.setDate(

    start.getDate() - 89

  );



  for (let i = 0; i < 90; i++) {

    const date = new Date(start);



    date.setDate(

      start.getDate() + i

    );



    const key =

      getLocalDateKey(date);



    const data = allDays[key];



    days.push({

      key,

      status: getDayStatus(data),

    });

  }



  return (

    <section className="heatmap-card">

      <p className="eyebrow">

        WINTER ARC

      </p>



      <h2>

        Last 90 Days

      </h2>



      <p>

        Your consistency at a glance.

      </p>



      <div className="heatmap">

        {days.map((day) => (

          <div

            key={day.key}

            className={`heatmap-day ${day.status}`}

            title={day.key}

          />

        ))}

      </div>

    </section>

  );

}



function Progress({

  value,

  goal,

}) {

  const percentage = Math.min(

    (Number(value) / goal) * 100,

    100

  );



  return (

    <div className="progress-wrapper">

      <div className="progress-bar">

        <div

          style={{

            width: `${percentage}%`,

          }}

        />

      </div>



      <span>

        {Math.round(percentage)}%

      </span>

    </div>

  );

}



function ToggleCard({

  icon,

  title,

  subtitle,

  checked,

  onChange,

  extra,

}) {

  return (

    <div

      className={`toggle-card ${checked ? "completed" : ""

        }`}

    >

      <div className="toggle-main">

        <div className="card-icon">

          {icon}

        </div>



        <div>

          <h3>{title}</h3>

          <p>{subtitle}</p>

        </div>



        <button

          className={`toggle-button ${checked ? "active" : ""

            }`}

          onClick={() =>

            onChange(!checked)

          }

          aria-label={`Toggle ${title}`}

        >

          {checked ? "✓" : ""}

        </button>

      </div>



      {extra}

    </div>

  );

}





function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setMessage("✓ Check your email for a confirmation link, then sign in.");
    }
    setLoading(false);
  }

  function switchMode() {
    setMode(mode === "login" ? "signup" : "login");
    setError("");
    setMessage("");
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <p className="eyebrow">WINTER ARC • 90 DAY CHALLENGE</p>
        <h1 className="auth-title">
          {mode === "login" ? "Welcome Back" : "Start Your Arc"}
        </h1>
        <p className="auth-subtitle">
          {mode === "login"
            ? "Sign in to continue your journey."
            : "Create your account to begin the 90-day challenge."}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="auth-field">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-message">{message}</p>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading
              ? "Please wait…"
              : mode === "login"
              ? "Sign In →"
              : "Create Account →"}
          </button>
        </form>

        <p className="auth-toggle">
          {mode === "login" ? "New here? " : "Already have an account? "}
          <button type="button" onClick={switchMode}>
            {mode === "login" ? "Create account" : "Sign in instead"}
          </button>
        </p>
      </div>
    </div>
  );
}

export default App;