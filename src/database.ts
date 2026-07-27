import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'gym-companion.db';

export type TrainingPlan = {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
};

export type Workout = {
  id: number;
  trainingPlanId: number;
  title: string;
  position: number;
};

export type Exercise = {
  id: number;
  workoutId: number;
  title: string;
  weight: number;
  sets: number;
  reps: number;
  position: number;
};

export type WorkoutSession = {
  id: number;
  workoutId: number;
  startedAt: string;
  completedAt: string | null;
};

export type WorkoutSessionExercise = {
  id: number;
  workoutSessionId: number;
  exerciseId: number;
  title: string;
  weight: number;
  sets: number;
  reps: number;
  position: number;
  completedAt: string | null;
};

type PlanRow = {
  id: number;
  name: string;
  is_active: number;
  created_at: string;
};

type WorkoutRow = {
  id: number;
  training_plan_id: number;
  title: string;
  position: number;
};

type ExerciseRow = {
  id: number;
  workout_id: number;
  title: string;
  weight: number;
  sets: number;
  reps: number;
  position: number;
};

type WorkoutSessionRow = {
  id: number;
  workout_id: number;
  started_at: string;
  completed_at: string | null;
};

type WorkoutSessionExerciseRow = {
  id: number;
  workout_session_id: number;
  exercise_id: number;
  title: string;
  weight: number;
  sets: number;
  reps: number;
  position: number;
  completed_at: string | null;
};

type ExerciseInput = {
  title: string;
  weight: number;
  sets: number;
  reps: number;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  databasePromise ??= openAndMigrateDatabase();
  return databasePromise;
}

export async function createTrainingPlan(name: string): Promise<TrainingPlan> {
  const database = await getDatabase();
  const normalizedName = requireText(name, 'Training plan name');
  const createdAt = now();
  const activePlan = await database.getFirstAsync<{ id: number }>(
    'SELECT id FROM training_plans WHERE is_active = 1'
  );
  const result = await database.runAsync(
    `INSERT INTO training_plans (name, is_active, created_at)
     VALUES (?, ?, ?)`,
    normalizedName,
    activePlan ? 0 : 1,
    createdAt
  );

  return {
    id: Number(result.lastInsertRowId),
    name: normalizedName,
    isActive: !activePlan,
    createdAt,
  };
}

export async function listTrainingPlans(): Promise<TrainingPlan[]> {
  const database = await getDatabase();
  const plans = await database.getAllAsync<PlanRow>(
    `SELECT id, name, is_active, created_at
     FROM training_plans
     ORDER BY is_active DESC, name COLLATE NOCASE`
  );

  return plans.map(toTrainingPlan);
}

export async function setActiveTrainingPlan(trainingPlanId: number): Promise<void> {
  const database = await getDatabase();

  await database.withTransactionAsync(async () => {
    const plan = await database.getFirstAsync<{ id: number }>(
      'SELECT id FROM training_plans WHERE id = ?',
      trainingPlanId
    );
    if (!plan) {
      throw new Error(`Training plan ${trainingPlanId} does not exist.`);
    }
    await database.runAsync(
      'UPDATE training_plans SET is_active = 0 WHERE id != ?',
      trainingPlanId
    );
    const result = await database.runAsync(
      'UPDATE training_plans SET is_active = 1 WHERE id = ?',
      trainingPlanId
    );
    if (result.changes !== 1) {
      throw new Error(`Training plan ${trainingPlanId} does not exist.`);
    }
  });
}

export async function createWorkout(
  trainingPlanId: number,
  title: string
): Promise<Workout> {
  const database = await getDatabase();
  const normalizedTitle = requireText(title, 'Workout title');
  const position = await nextPosition(database, 'workouts', 'training_plan_id', trainingPlanId);
  const result = await database.runAsync(
    `INSERT INTO workouts (training_plan_id, title, position)
     VALUES (?, ?, ?)`,
    trainingPlanId,
    normalizedTitle,
    position
  );

  return {
    id: Number(result.lastInsertRowId),
    trainingPlanId,
    title: normalizedTitle,
    position,
  };
}

export async function listWorkouts(trainingPlanId: number): Promise<Workout[]> {
  const database = await getDatabase();
  const workouts = await database.getAllAsync<WorkoutRow>(
    `SELECT id, training_plan_id, title, position
     FROM workouts
     WHERE training_plan_id = ?
     ORDER BY position`,
    trainingPlanId
  );

  return workouts.map(toWorkout);
}

export async function getNextWorkout(trainingPlanId: number): Promise<Workout | null> {
  const database = await getDatabase();
  const lastCompleted = await database.getFirstAsync<{ position: number }>(
    `SELECT workouts.position
     FROM workout_sessions
     JOIN workouts ON workouts.id = workout_sessions.workout_id
     WHERE workouts.training_plan_id = ? AND workout_sessions.completed_at IS NOT NULL
     ORDER BY workout_sessions.completed_at DESC, workout_sessions.id DESC
     LIMIT 1`,
    trainingPlanId
  );
  const workout = lastCompleted
    ? await database.getFirstAsync<WorkoutRow>(
        `SELECT id, training_plan_id, title, position
         FROM workouts
         WHERE training_plan_id = ? AND position > ?
         ORDER BY position
         LIMIT 1`,
        trainingPlanId,
        lastCompleted.position
      )
    : null;
  const firstWorkout =
    workout ??
    (await database.getFirstAsync<WorkoutRow>(
      `SELECT id, training_plan_id, title, position
       FROM workouts
       WHERE training_plan_id = ?
       ORDER BY position
       LIMIT 1`,
      trainingPlanId
    ));

  return firstWorkout ? toWorkout(firstWorkout) : null;
}

export async function createExercise(
  workoutId: number,
  input: ExerciseInput
): Promise<Exercise> {
  validateExerciseInput(input);
  const database = await getDatabase();
  const position = await nextPosition(database, 'exercises', 'workout_id', workoutId);
  const result = await database.runAsync(
    `INSERT INTO exercises (workout_id, title, weight, sets, reps, position)
     VALUES (?, ?, ?, ?, ?, ?)`,
    workoutId,
    input.title.trim(),
    input.weight,
    input.sets,
    input.reps,
    position
  );

  return {
    id: Number(result.lastInsertRowId),
    workoutId,
    ...input,
    title: input.title.trim(),
    position,
  };
}

export async function listExercises(workoutId: number): Promise<Exercise[]> {
  const database = await getDatabase();
  const exercises = await database.getAllAsync<ExerciseRow>(
    `SELECT id, workout_id, title, weight, sets, reps, position
     FROM exercises
     WHERE workout_id = ?
     ORDER BY position`,
    workoutId
  );

  return exercises.map(toExercise);
}

export async function startWorkoutSession(workoutId: number): Promise<WorkoutSession> {
  const database = await getDatabase();
  const existingSession = await database.getFirstAsync<WorkoutSessionRow>(
    `SELECT id, workout_id, started_at, completed_at
     FROM workout_sessions
     WHERE workout_id = ? AND completed_at IS NULL
     ORDER BY id DESC
     LIMIT 1`,
    workoutId
  );
  if (existingSession) {
    return toWorkoutSession(existingSession);
  }

  const exercises = await listExercises(workoutId);
  if (exercises.length === 0) {
    throw new Error('A workout must contain at least one exercise before it can start.');
  }

  const startedAt = now();
  let sessionId = 0;
  await database.withTransactionAsync(async () => {
    const session = await database.runAsync(
      'INSERT INTO workout_sessions (workout_id, started_at) VALUES (?, ?)',
      workoutId,
      startedAt
    );
    sessionId = Number(session.lastInsertRowId);

    for (const exercise of exercises) {
      const previousExercise = await database.getFirstAsync<{
        weight: number;
        sets: number;
        reps: number;
      }>(
        `SELECT session_exercises.weight, session_exercises.sets, session_exercises.reps
         FROM workout_session_exercises AS session_exercises
         JOIN workout_sessions ON workout_sessions.id = session_exercises.workout_session_id
         WHERE session_exercises.exercise_id = ? AND workout_sessions.completed_at IS NOT NULL
         ORDER BY workout_sessions.completed_at DESC, workout_sessions.id DESC
         LIMIT 1`,
        exercise.id
      );
      await database.runAsync(
        `INSERT INTO workout_session_exercises
          (workout_session_id, exercise_id, title, weight, sets, reps, position)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        sessionId,
        exercise.id,
        exercise.title,
        previousExercise?.weight ?? exercise.weight,
        previousExercise?.sets ?? exercise.sets,
        previousExercise?.reps ?? exercise.reps,
        exercise.position
      );
    }
  });

  return { id: sessionId, workoutId, startedAt, completedAt: null };
}

export async function listWorkoutSessionExercises(
  workoutSessionId: number
): Promise<WorkoutSessionExercise[]> {
  const database = await getDatabase();
  const exercises = await database.getAllAsync<WorkoutSessionExerciseRow>(
    `SELECT id, workout_session_id, exercise_id, title, weight, sets, reps, position, completed_at
     FROM workout_session_exercises
     WHERE workout_session_id = ?
     ORDER BY position`,
    workoutSessionId
  );

  return exercises.map(toWorkoutSessionExercise);
}

export async function updateWorkoutSessionExercise(
  id: number,
  input: ExerciseInput
): Promise<void> {
  validateExerciseInput(input);
  const database = await getDatabase();
  const result = await database.runAsync(
    `UPDATE workout_session_exercises
     SET title = ?, weight = ?, sets = ?, reps = ?
     WHERE id = ?`,
    input.title.trim(),
    input.weight,
    input.sets,
    input.reps,
    id
  );
  if (result.changes !== 1) {
    throw new Error(`Workout session exercise ${id} does not exist.`);
  }
}

export async function completeWorkoutSessionExercise(id: number): Promise<void> {
  const database = await getDatabase();
  const result = await database.runAsync(
    `UPDATE workout_session_exercises
     SET completed_at = COALESCE(completed_at, ?)
     WHERE id = ?`,
    now(),
    id
  );
  if (result.changes !== 1) {
    throw new Error(`Workout session exercise ${id} does not exist.`);
  }
}

export async function completeWorkoutSession(id: number): Promise<void> {
  const database = await getDatabase();
  const result = await database.runAsync(
    `UPDATE workout_sessions
     SET completed_at = COALESCE(completed_at, ?)
     WHERE id = ?`,
    now(),
    id
  );
  if (result.changes !== 1) {
    throw new Error(`Workout session ${id} does not exist.`);
  }
}

async function openAndMigrateDatabase(): Promise<SQLite.SQLiteDatabase> {
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await database.execAsync(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS training_plans (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
      created_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS one_active_training_plan
      ON training_plans (is_active)
      WHERE is_active = 1;

    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY NOT NULL,
      training_plan_id INTEGER NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      position INTEGER NOT NULL CHECK (position > 0),
      UNIQUE (training_plan_id, position)
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY NOT NULL,
      workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      weight REAL NOT NULL CHECK (weight >= 0),
      sets INTEGER NOT NULL CHECK (sets > 0),
      reps INTEGER NOT NULL CHECK (reps > 0),
      position INTEGER NOT NULL CHECK (position > 0),
      UNIQUE (workout_id, position)
    );

    CREATE TABLE IF NOT EXISTS workout_sessions (
      id INTEGER PRIMARY KEY NOT NULL,
      workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE RESTRICT,
      started_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS workout_sessions_by_workout
      ON workout_sessions (workout_id, completed_at);

    CREATE TABLE IF NOT EXISTS workout_session_exercises (
      id INTEGER PRIMARY KEY NOT NULL,
      workout_session_id INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
      title TEXT NOT NULL,
      weight REAL NOT NULL CHECK (weight >= 0),
      sets INTEGER NOT NULL CHECK (sets > 0),
      reps INTEGER NOT NULL CHECK (reps > 0),
      position INTEGER NOT NULL CHECK (position > 0),
      completed_at TEXT,
      UNIQUE (workout_session_id, position)
    );

    CREATE INDEX IF NOT EXISTS workout_session_exercises_by_exercise
      ON workout_session_exercises (exercise_id);
  `);
  return database;
}

async function nextPosition(
  database: SQLite.SQLiteDatabase,
  table: 'workouts' | 'exercises',
  foreignKey: 'training_plan_id' | 'workout_id',
  parentId: number
): Promise<number> {
  const row = await database.getFirstAsync<{ position: number }>(
    `SELECT COALESCE(MAX(position), 0) + 1 AS position
     FROM ${table}
     WHERE ${foreignKey} = ?`,
    parentId
  );
  return row?.position ?? 1;
}

function requireText(value: string, label: string): string {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    throw new Error(`${label} is required.`);
  }
  return normalizedValue;
}

function validateExerciseInput(input: ExerciseInput): void {
  requireText(input.title, 'Exercise title');
  if (!Number.isFinite(input.weight) || input.weight < 0) {
    throw new Error('Exercise weight must be zero or greater.');
  }
  if (!Number.isInteger(input.sets) || input.sets < 1) {
    throw new Error('Exercise sets must be a positive whole number.');
  }
  if (!Number.isInteger(input.reps) || input.reps < 1) {
    throw new Error('Exercise reps must be a positive whole number.');
  }
}

function now(): string {
  return new Date().toISOString();
}

function toTrainingPlan(row: PlanRow): TrainingPlan {
  return {
    id: row.id,
    name: row.name,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

function toWorkout(row: WorkoutRow): Workout {
  return {
    id: row.id,
    trainingPlanId: row.training_plan_id,
    title: row.title,
    position: row.position,
  };
}

function toExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    workoutId: row.workout_id,
    title: row.title,
    weight: row.weight,
    sets: row.sets,
    reps: row.reps,
    position: row.position,
  };
}

function toWorkoutSession(row: WorkoutSessionRow): WorkoutSession {
  return {
    id: row.id,
    workoutId: row.workout_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function toWorkoutSessionExercise(
  row: WorkoutSessionExerciseRow
): WorkoutSessionExercise {
  return {
    id: row.id,
    workoutSessionId: row.workout_session_id,
    exerciseId: row.exercise_id,
    title: row.title,
    weight: row.weight,
    sets: row.sets,
    reps: row.reps,
    position: row.position,
    completedAt: row.completed_at,
  };
}
