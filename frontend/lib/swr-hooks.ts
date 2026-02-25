"use client";

import useSWR from "swr";
import { apiGet } from "@/lib/api";
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
  const { data, error, isLoading, mutate } = useSWR(key, ([p, token]) => fetcher(p, token), SWR_CONFIG);
  return { lessons: data ?? [], error, isLoading, mutate };
}

export function useLesson(lessonId: string | null, adminView?: boolean) {
  const { accessToken } = useAuth();
  const path = lessonId ? `/lessons/${lessonId}${adminView ? "?admin_view=1" : ""}` : null;
  const key = accessToken && path ? [path, accessToken] : null;
  const { data, error, isLoading, mutate } = useSWR(key, ([p, token]) => fetcher(p, token), SWR_CONFIG);
  return { lesson: data, error, isLoading, mutate };
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
