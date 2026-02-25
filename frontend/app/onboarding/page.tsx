'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost } from "@/lib/api";
import { EntHeader } from "@/components/ent-header";
import { Button } from "@/components/ui/button";

const STUDENT_STEPS = 4;
const TEACHER_STEPS = 2;

type School = { id: string; name: string };

type PrimaryGoal = 'unt_prep' | 'problem_solving' | 'material_review' | 'classroom_learning';

const GOAL_OPTIONS: { value: PrimaryGoal; label: string; description: string }[] = [
  { value: 'unt_prep', label: 'Подготовка к ЕНТ', description: 'Систематическая подготовка к экзаменам' },
  { value: 'problem_solving', label: 'Решение задач', description: 'Практика и улучшение навыков' },
  { value: 'material_review', label: 'Повторение материала', description: 'Закрепление пройденных тем' },
  { value: 'classroom_learning', label: 'Обучение в классе', description: 'Работа с учителем и классом' },
];

const SUBJECT_OPTIONS: { code: string; label: string }[] = [
  { code: 'mathematics', label: 'Математика' },
  { code: 'physics', label: 'Физика' },
  { code: 'chemistry', label: 'Химия' },
  { code: 'biology', label: 'Биология' },
  { code: 'geography', label: 'География' },
  { code: 'history', label: 'История' },
  { code: 'literature', label: 'Литература' },
  { code: 'english', label: 'Английский язык' },
];

export default function OnboardingPage() {
  const { user, isLoading, accessToken } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [is_teacher, setIsTeacher] = useState<boolean | null>(null);
  const [primary_goal, setPrimaryGoal] = useState<PrimaryGoal | null>(null);
  const [grade_level, setGradeLevel] = useState<number | null>(null);
  const [interested_subjects, setInterestedSubjects] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Teacher path
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [school_id, setSchoolId] = useState<string>("");
  const [teacher_code, setTeacherCode] = useState("");

  const totalSteps = is_teacher === true ? TEACHER_STEPS : STUDENT_STEPS;

  useEffect(() => {
    if (isLoading) return;
    if (!user || !accessToken) {
      router.replace("/auth");
    }
  }, [isLoading, user, accessToken, router]);

  useEffect(() => {
    if (is_teacher !== true) return;
    (async () => {
      setSchoolsLoading(true);
      try {
        const list = await apiGet<School[]>("/schools");
        setSchools(list ?? []);
      } catch {
        setSchools([]);
      } finally {
        setSchoolsLoading(false);
      }
    })();
  }, [is_teacher]);

  const progressPercent = (step / totalSteps) * 100;

  const canContinueStep1 = is_teacher !== null;
  const canContinueStep2 = primary_goal !== null;
  const canContinueStep3 = grade_level !== null;
  const canContinueStep4 = interested_subjects.length > 0;
  const canContinueTeacherStep2 = school_id.trim() !== "" && teacher_code.trim() !== "";

  const toggleSubject = (code: string) => {
    setInterestedSubjects((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSubmitStudent = async () => {
    if (is_teacher !== false || primary_goal === null || grade_level === null || interested_subjects.length === 0) return;
    setSubmitError(null);
    try {
      setIsSubmitting(true);
      await apiPost(
        "/me/onboarding",
        {
          is_teacher: false,
          primary_goal,
          grade_level,
          interested_subjects,
          difficulties: "",
          notes: "",
        },
        accessToken
      );
      router.replace("/dashboard");
    } catch (err) {
      const message = (err as Error & { body?: { message?: string } }).body?.message ?? (err as Error).message;
      setSubmitError(typeof message === "string" ? message : "Не удалось сохранить. Попробуйте снова.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitTeacher = async () => {
    if (is_teacher !== true || !school_id.trim() || !teacher_code.trim()) return;
    setSubmitError(null);
    try {
      setIsSubmitting(true);
      await apiPost(
        "/me/onboarding",
        {
          is_teacher: true,
          school_id: school_id.trim(),
          teacher_code: teacher_code.trim(),
        },
        accessToken
      );
      router.replace("/dashboard");
    } catch (err) {
      const message = (err as Error & { body?: { message?: string } }).body?.message ?? (err as Error).message;
      setSubmitError(typeof message === "string" ? message : "Неверный код учителя");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !user || !accessToken) {
    return (
      <div className="min-h-screen bg-white text-slate-900">
        <EntHeader />
        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 py-8">
          <p className="text-sm text-slate-500">Загрузка...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <EntHeader />

      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 py-8">
        <div className="w-full max-w-[600px] animate-page-in">
          <div className="rounded-2xl bg-white p-8 shadow-[0px_8px_10px_-6px_rgba(0,0,0,0.10),0px_20px_25px_-5px_rgba(0,0,0,0.10)] outline outline-1 outline-offset-[-1px] outline-gray-200 transition-shadow duration-300 hover:shadow-lg">
            {/* Icon + Welcome */}
            <div className="mb-6 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <h1 className="mb-1 text-center text-2xl font-bold text-slate-900">Добро пожаловать!</h1>
            <p className="mb-6 text-center text-sm text-slate-500">
              Давайте настроим платформу специально для вас
            </p>

            {/* Progress */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Шаг {step} из {totalSteps}</span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Step content */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">Кто вы?</h2>
                <p className="text-sm text-slate-500">Выберите вашу роль на платформе</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setIsTeacher(false)}
                    className={`flex flex-col items-center rounded-xl border-2 p-6 text-left transition-all ${
                      is_teacher === false
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-slate-600 hover:border-gray-300"
                    }`}
                  >
                    <span className="mb-2 text-3xl">🎓</span>
                    <span className="font-semibold">Ученик</span>
                    <span className="mt-1 block text-xs opacity-90">Я хочу учиться и готовиться к экзаменам</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTeacher(true)}
                    className={`flex flex-col items-center rounded-xl border-2 p-6 text-left transition-all ${
                      is_teacher === true
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-slate-600 hover:border-gray-300"
                    }`}
                  >
                    <span className="mb-2 text-3xl">👩‍🏫</span>
                    <span className="font-semibold">Учитель</span>
                    <span className="mt-1 block text-xs opacity-90">Я хочу создавать классы и отслеживать прогресс</span>
                  </button>
                </div>
              </div>
            )}

            {step === 2 && is_teacher === true && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">Выберите свою школу</h2>
                <p className="text-sm text-slate-500">Укажите школу и введите код учителя</p>
                {schoolsLoading ? (
                  <p className="text-sm text-slate-500">Загрузка списка школ...</p>
                ) : (
                  <>
                    <label className="block space-y-1 text-sm">
                      <span className="font-semibold text-gray-700">Школа</span>
                      <select
                        value={school_id}
                        onChange={(e) => setSchoolId(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      >
                        <option value="">— Выберите школу —</option>
                        {schools.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1 text-sm">
                      <span className="font-semibold text-gray-700">Код учителя</span>
                      <input
                        type="password"
                        value={teacher_code}
                        onChange={(e) => setTeacherCode(e.target.value)}
                        placeholder="Введите код"
                        className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                    </label>
                  </>
                )}
              </div>
            )}

            {step === 2 && is_teacher === false && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">Какая ваша цель?</h2>
                <p className="text-sm text-slate-500">Выберите основную цель использования платформы</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {GOAL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPrimaryGoal(opt.value)}
                      className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                        primary_goal === opt.value
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-white text-slate-600 hover:border-gray-300"
                      }`}
                    >
                      <span className="text-xl">🎯</span>
                      <div>
                        <span className="font-semibold">{opt.label}</span>
                        <p className="mt-0.5 text-xs opacity-90">{opt.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && is_teacher === false && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">В каком вы классе?</h2>
                <p className="text-sm text-slate-500">Выберите ваш текущий класс обучения</p>
                <div className="flex flex-wrap gap-2">
                  {[5, 6, 7, 8, 9, 10, 11].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGradeLevel(g)}
                      className={`flex flex-col items-center justify-center rounded-xl border-2 px-6 py-4 transition-all ${
                        grade_level === g
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-gray-200 bg-white text-slate-600 hover:border-gray-300"
                      }`}
                    >
                      <span className="text-xl font-bold">{g}</span>
                      <span className="text-xs opacity-90">класс</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 4 && is_teacher === false && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">Какие предметы вас интересуют?</h2>
                <p className="text-sm text-slate-500">Выберите один или несколько предметов</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {SUBJECT_OPTIONS.map((s) => (
                    <button
                      key={s.code}
                      type="button"
                      onClick={() => toggleSubject(s.code)}
                      className={`rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all ${
                        interested_subjects.includes(s.code)
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-white text-slate-600 hover:border-gray-300"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {interested_subjects.length > 0 && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <p className="mb-2 text-xs font-medium text-slate-500">Выбрано предметов: {interested_subjects.length}</p>
                    <div className="flex flex-wrap gap-2">
                      {interested_subjects.map((code) => {
                        const s = SUBJECT_OPTIONS.find((o) => o.code === code);
                        return (
                          <span
                            key={code}
                            className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                          >
                            {s?.label ?? code}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {submitError && (
              <p className="mt-4 text-sm text-rose-600">{submitError}</p>
            )}

            {/* Navigation */}
            <div className="mt-8 flex items-center justify-between gap-4">
              <div className="w-24">
                {step > 1 ? (
                  <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
                    Назад
                  </Button>
                ) : null}
              </div>
              <div className="flex-1" />
              <div className="w-40">
                {is_teacher === true && step === 2 ? (
                  <Button
                    type="button"
                    className="w-full"
                    disabled={!canContinueTeacherStep2 || isSubmitting || schoolsLoading}
                    onClick={handleSubmitTeacher}
                  >
                    {isSubmitting ? "Сохранение..." : "Начать обучение"}
                  </Button>
                ) : step < totalSteps ? (
                  <Button
                    type="button"
                    className="w-full"
                    disabled={
                      (step === 1 && !canContinueStep1) ||
                      (step === 2 && is_teacher === false && !canContinueStep2) ||
                      (step === 3 && !canContinueStep3) ||
                      (step === 4 && !canContinueStep4)
                    }
                    onClick={() => setStep((s) => s + 1)}
                  >
                    Продолжить
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="w-full"
                    disabled={!canContinueStep4 || isSubmitting}
                    onClick={handleSubmitStudent}
                  >
                    {isSubmitting ? "Сохранение..." : "Начать обучение"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
