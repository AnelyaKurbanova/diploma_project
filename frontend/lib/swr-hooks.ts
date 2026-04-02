"use client";

import useSWR from "swr";
import {
  apiGet,
  apiGetLeaderboard,
  apiGetMyAchievements,
  apiGetMyStreak,
  apiGetMyXp,
  type LeaderboardMetric,
  type LeaderboardResponse,
  type UserAchievementsResponse,
  type UserStreak,
  type UserXp,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const SWR_CONFIG = {
  revalidateOnFocus: false,
  dedupingInterval: 60_000,
};

function fetcher<T>(path: string, token: string) {
  return apiGet<T>(path, token);
}

export function useProfile() {
  const { accessToken } = useAuth();
  const key = accessToken ? ["/me/profile", accessToken] : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    ([path, token]) => fetcher<{ full_name: string | null; avatar_url?: string | null; [key: string]: unknown }>(path, token),
    SWR_CONFIG,
  );
  return { profile: data, error, isLoading, mutate };
}

export function useSubjects() {
  const { accessToken } = useAuth();
  const key = accessToken ? ["/subjects", accessToken] : null;
  const { data, error, isLoading, mutate } = useSWR(key, ([path, token]) => fetcher(path, token), SWR_CONFIG);
  return { subjects: (data ?? []) as Array<{ id: string; code: string; name_ru: string; [key: string]: unknown }>, error, isLoading, mutate };
}

export function useTopics(subjectId: string | null) {
  const { accessToken } = useAuth();
  const key = accessToken && subjectId ? [`/topics?subject_id=${subjectId}`, accessToken] : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    ([path, token]) => fetcher(path, token),
    SWR_CONFIG,
  );
  return { topics: data ?? [], error, isLoading, mutate };
}

export function useTopic(topicId: string | null) {
  const { accessToken } = useAuth();
  const key = accessToken && topicId ? [`/topics/${topicId}`, accessToken] : null;
  const { data, error, isLoading, mutate } = useSWR(key, ([path, token]) => fetcher(path, token), SWR_CONFIG);
  return { topic: data, error, isLoading, mutate };
}

export function useLessonsForTopic(topicId: string | null, adminView?: boolean) {
  const { accessToken } = useAuth();
  const path = topicId ? `/topics/${topicId}/lessons${adminView ? "?admin_view=1" : ""}` : null;
  const key = accessToken && path ? [path, accessToken] : null;
  const { data, error, isLoading, mutate } = useSWR<
    Array<{ id: string; title: string; order_no: number; [key: string]: unknown }>
  >(
    key,
    ([p, token]) => fetcher(p, token),
    SWR_CONFIG,
  );
  return {
    lessons: (data ?? []) as Array<{ id: string; title: string; order_no: number; [key: string]: unknown }>,
    error,
    isLoading,
    mutate,
  };
}

export function useSubjectGrades(code: string | null) {
  const { accessToken } = useAuth();
  const path = code ? `/subjects/${code}/grades` : null;
  const key = accessToken && path ? [path, accessToken] : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    ([p, token]) => fetcher<number[]>(p, token),
    SWR_CONFIG,
  );
  return { grades: (data ?? []) as number[], error, isLoading, mutate };
}

export function useTopicsForSubjectGrade(code: string | null, grade: number | null) {
  const { accessToken } = useAuth();
  const path = code && grade != null ? `/subjects/${code}/grades/${grade}/topics` : null;
  const key = accessToken && path ? [path, accessToken] : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    ([p, token]) => fetcher<Array<{ id: string; title_ru: string }>>(p, token),
    SWR_CONFIG,
  );
  return { topics: (data ?? []) as Array<{ id: string; title_ru: string }>, error, isLoading, mutate };
}

export function useLesson(lessonId: string | null, adminView?: boolean) {
  const { accessToken } = useAuth();
  const path = lessonId ? `/lessons/${lessonId}${adminView ? "?admin_view=1" : ""}` : null;
  const key = accessToken && path ? [path, accessToken] : null;
  const { data, error, isLoading, mutate } = useSWR(key, ([p, token]) => fetcher(p, token), SWR_CONFIG);
  return { lesson: data, error, isLoading, mutate };
}

export type TopicLessonProgress = {
  user_id: string;
  lesson_id: string;
  completed: boolean;
  completed_at: string;
  time_spent_sec?: number | null;
};

export function useTopicProgress(topicId: string | null) {
  const { accessToken } = useAuth();
  const path = topicId ? `/topics/${topicId}/progress` : null;
  const key = accessToken && path ? [path, accessToken] : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    ([p, token]) => fetcher<TopicLessonProgress[]>(p, token),
    SWR_CONFIG,
  );

  const raw = (data ?? []) as TopicLessonProgress[];
  const progressByLessonId: Record<string, TopicLessonProgress> = {};
  for (const item of raw) {
    progressByLessonId[item.lesson_id] = item;
  }

  return { progress: raw, progressByLessonId, error, isLoading, mutate };
}

export function useProblems() {
  const { accessToken } = useAuth();
  const key = accessToken ? ["/problems", accessToken] : null;
  const { data, error, isLoading, mutate } = useSWR(key, ([path, token]) => fetcher(path, token), SWR_CONFIG);
  return { problems: data ?? [], error, isLoading, mutate };
}

export function useProblem(problemId: string | null) {
  const { accessToken } = useAuth();
  const key = accessToken && problemId ? [`/problems/${problemId}`, accessToken] : null;
  const { data, error, isLoading, mutate } = useSWR(key, ([path, token]) => fetcher(path, token), SWR_CONFIG);
  return { problem: data, error, isLoading, mutate };
}

export function useMyXp() {
  const { accessToken } = useAuth();
  const key = accessToken ? ["/me/xp", accessToken] : null;
  const { data, error, isLoading, mutate } = useSWR<UserXp>(
    key,
    ([, token]) => apiGetMyXp(token),
    SWR_CONFIG,
  );
  return {
    xp: data ?? { total_xp: 0 },
    error,
    isLoading,
    mutate,
  };
}

export function useMyStreak() {
  const { accessToken } = useAuth();
  const key = accessToken ? ["/me/streak", accessToken] : null;
  const { data, error, isLoading, mutate } = useSWR<UserStreak>(
    key,
    ([, token]) => apiGetMyStreak(token),
    SWR_CONFIG,
  );
  return {
    streak: data ?? {
      current_streak: 0,
      longest_streak: 0,
      last_activity_date: null,
    },
    error,
    isLoading,
    mutate,
  };
}

export function useMyAchievements() {
  const { accessToken } = useAuth();
  const key = accessToken ? ["/me/achievements", accessToken] : null;
  const { data, error, isLoading, mutate } = useSWR<UserAchievementsResponse>(
    key,
    ([, token]) => apiGetMyAchievements(token),
    SWR_CONFIG,
  );
  return {
    achievements: data ?? { items: [], unlocked_count: 0, total: 0 },
    error,
    isLoading,
    mutate,
  };
}

export function useLeaderboard(metric: LeaderboardMetric, limit = 20) {
  const { accessToken } = useAuth();
  const key = accessToken ? ["/leaderboard", metric, limit, accessToken] : null;
  const { data, error, isLoading, mutate } = useSWR<LeaderboardResponse>(
    key,
    ([, currentMetric, currentLimit, token]) =>
      apiGetLeaderboard(currentMetric, token, currentLimit),
    SWR_CONFIG,
  );
  return {
    leaderboard: data ?? { metric, items: [], my_entry: null },
    error,
    isLoading,
    mutate,
  };
}
