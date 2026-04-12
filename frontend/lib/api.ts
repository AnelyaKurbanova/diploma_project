function resolveApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv) return fromEnv;

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:8000/api";
    }
    return "http://localhost:8000/api";
  }

  return "http://localhost:8000/api";
}

const API_BASE_URL = resolveApiBaseUrl();

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions extends RequestInit {
  accessToken?: string | null;
}

type ApiErrorBody = {
  error?: unknown;
  message?: unknown;
  detail?: unknown;
  details?: unknown;
  request_id?: unknown;
};

export class ApiError extends Error {
  status: number;
  code: string;
  body?: unknown;
  details?: unknown;
  requestId?: string;
  path?: string;

  constructor(
    message: string,
    {
      status,
      code,
      body,
      details,
      requestId,
      path,
    }: {
      status: number;
      code: string;
      body?: unknown;
      details?: unknown;
      requestId?: string;
      path?: string;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
    this.details = details;
    this.requestId = requestId;
    this.path = path;
  }
}

let refreshAccessTokenHandler: (() => Promise<string | null>) | null = null;

export function setRefreshAccessTokenHandler(
  handler: () => Promise<string | null>,
): void {
  refreshAccessTokenHandler = handler;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function statusFallbackMessage(status: number): string {
  if (status === 0) {
    return "Не удалось связаться с сервером. Проверьте интернет или попробуйте позже.";
  }
  if (status === 400) return "Проверьте введённые данные и попробуйте ещё раз.";
  if (status === 401) return "Сессия истекла. Войдите в аккаунт заново.";
  if (status === 403) return "У вас нет доступа к этому действию.";
  if (status === 404) return "Нужные данные не найдены.";
  if (status === 409) return "Действие конфликтует с текущим состоянием данных.";
  if (status === 422) return "Проверьте заполнение полей и попробуйте ещё раз.";
  if (status === 429) return "Слишком много запросов. Попробуйте немного позже.";
  if (status >= 500) return "На сервере произошла ошибка. Попробуйте позже.";
  return `Запрос не выполнен (статус ${status}).`;
}

function formatValidationDetails(details: unknown): string | null {
  if (!Array.isArray(details) || details.length === 0) {
    return null;
  }

  const fields = details
    .slice(0, 3)
    .map((item) => {
      if (!isRecord(item)) return null;
      const field = typeof item.field === "string" ? item.field : null;
      const message = typeof item.message === "string" ? item.message : null;
      if (field && message) return `${field}: ${message}`;
      return field || message;
    })
    .filter(Boolean);

  if (fields.length === 0) {
    return null;
  }

  const suffix = details.length > fields.length ? " и другие поля" : "";
  return `Проверьте поля: ${fields.join("; ")}${suffix}.`;
}

function formatDetail(detail: unknown): string | null {
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  if (Array.isArray(detail)) {
    return formatValidationDetails(
      detail.map((item) => {
        if (!isRecord(item)) return item;
        const loc = Array.isArray(item.loc) ? item.loc.filter((part) => part !== "body") : [];
        return {
          field: loc.join(".") || "request",
          message: item.msg,
        };
      }),
    );
  }
  return null;
}

function messageFromBody(body: unknown, status: number): string {
  if (!isRecord(body)) {
    return statusFallbackMessage(status);
  }

  const typed = body as ApiErrorBody;
  const message = typeof typed.message === "string" ? typed.message.trim() : "";
  if (message) return message;

  const detailMessage = formatDetail(typed.detail);
  if (detailMessage) return detailMessage;

  const detailsMessage = formatValidationDetails(typed.details);
  if (detailsMessage) return detailsMessage;

  return statusFallbackMessage(status);
}

async function readJsonSafely(response: Response): Promise<unknown> {
  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  return response.json().catch(() => null);
}

export async function apiErrorFromResponse(
  response: Response,
  path?: string,
): Promise<ApiError> {
  const body = await readJsonSafely(response);
  const code = isRecord(body) && typeof body.error === "string" ? body.error : "http_error";
  const requestId =
    (isRecord(body) && typeof body.request_id === "string" ? body.request_id : null) ??
    response.headers.get("X-Request-ID") ??
    undefined;

  return new ApiError(messageFromBody(body, response.status), {
    status: response.status,
    code,
    body,
    details: isRecord(body) ? body.details : undefined,
    requestId,
    path,
  });
}

export async function readApiErrorMessage(
  response: Response,
  fallback?: string,
): Promise<string> {
  const error = await apiErrorFromResponse(response);
  return error.message || fallback || statusFallbackMessage(response.status);
}

export function getErrorMessage(
  error: unknown,
  fallback = "Не удалось выполнить действие. Попробуйте ещё раз.",
): string {
  if (error instanceof ApiError) {
    return error.requestId
      ? `${error.message} Код обращения: ${error.requestId}.`
      : error.message;
  }
  if (error instanceof TypeError) {
    return "Не удалось связаться с сервером. Проверьте интернет или попробуйте позже.";
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

async function request<T>(
  path: string,
  method: HttpMethod,
  options: RequestOptions = {},
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  let currentOptions = options;

  for (let attempt = 0; attempt < 2; attempt++) {
    const headers = new Headers(currentOptions.headers ?? {});
    headers.set("Accept", "application/json");

    if (currentOptions.accessToken) {
      headers.set("Authorization", `Bearer ${currentOptions.accessToken}`);
    }

    const init: RequestInit = {
      ...currentOptions,
      method,
      headers,
      cache: "no-store",
    };

    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw error;
      }
      throw new ApiError(statusFallbackMessage(0), {
        status: 0,
        code: "network_error",
        path,
      });
    }

    const contentType = response.headers.get("Content-Type") ?? "";
    const isJson = contentType.includes("application/json");

    if (!response.ok) {
      if (
        response.status === 401 &&
        options.accessToken &&
        attempt === 0 &&
        typeof refreshAccessTokenHandler === "function"
      ) {
        const newToken = await refreshAccessTokenHandler();
        if (newToken) {
          currentOptions = {
            ...currentOptions,
            accessToken: newToken,
          };
          continue;
        }
      }

      throw await apiErrorFromResponse(response, path);
    }

    if (response.status === 204 || !isJson) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  }

  throw new ApiError("Запрос не выполнен после повторной попытки. Попробуйте позже.", {
    status: 0,
    code: "retry_failed",
    path,
  });
}

export function apiGet<T>(
  path: string,
  accessToken?: string | null,
  options?: Omit<RequestOptions, "method" | "accessToken">,
): Promise<T> {
  return request<T>(path, "GET", {
    ...(options ?? {}),
    accessToken,
  });
}

export function apiPost<T>(
  path: string,
  body?: unknown,
  accessToken?: string | null,
  options?: Omit<RequestOptions, "method" | "accessToken" | "body">,
): Promise<T> {
  const headers = new Headers(options?.headers ?? {});

  if (body !== undefined && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  return request<T>(path, "POST", {
    ...(options ?? {}),
    headers,
    accessToken,
    body:
      body instanceof FormData || body === undefined
        ? (body as BodyInit | undefined)
        : (JSON.stringify(body) as BodyInit),
  });
}

export function apiPatch<T>(
  path: string,
  body?: unknown,
  accessToken?: string | null,
  options?: Omit<RequestOptions, "method" | "accessToken" | "body">,
): Promise<T> {
  const headers = new Headers(options?.headers ?? {});

  if (body !== undefined && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  return request<T>(path, "PATCH", {
    ...(options ?? {}),
    headers,
    accessToken,
    body:
      body instanceof FormData || body === undefined
        ? (body as BodyInit | undefined)
        : (JSON.stringify(body) as BodyInit),
  });
}

export function apiDelete<T>(
  path: string,
  accessToken?: string | null,
  options?: Omit<RequestOptions, "method" | "accessToken">,
): Promise<T> {
  return request<T>(path, "DELETE", {
    ...(options ?? {}),
    accessToken,
  });
}

export { API_BASE_URL };

export type TeacherClass = {
  id: string;
  name: string;
  join_code: string;
  created_at: string;
  students_count: number;
};

export type ClassStudent = {
  id: string;
  email: string;
  full_name: string | null;
  joined_at: string;
  overall_progress: number | null;
};

export type ClassStats = {
  total_students: number;
  avg_overall_progress: number;
};

export type ClassDetail = {
  id: string;
  name: string;
  join_code: string;
  created_at: string;
  students: ClassStudent[];
  stats: ClassStats;
};

export type StudentClass = {
  id: string;
  name: string;
  teacher_name: string | null;
  joined_at: string;
  overall_progress: number | null;
};

export type StudentAssessment = {
  id: string;
  class_id: string;
  class_name: string;
  title: string;
  description: string | null;
  due_at: string | null;
  time_limit_min: number | null;
  items_count: number;
  total_points: number;
};

export type StudentAssessmentItem = {
  id: string;
  problem_id: string;
  problem_title: string | null;
  order_no: number;
  points: number;
};

export type StudentAssessmentDetail = StudentAssessment & {
  items: StudentAssessmentItem[];
};

export type ClassAssessmentItem = {
  id: string;
  problem_id: string;
  problem_title: string | null;
  order_no: number;
  points: number;
};

export type ClassAssessment = {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  time_limit_min: number | null;
  is_published: boolean;
  created_at: string;
  items_count: number;
  total_points: number;
};

export type ClassAssessmentDetail = ClassAssessment & {
  items: ClassAssessmentItem[];
};

export type TeacherAssessmentStudentProgress = {
  student_id: string;
  email: string;
  full_name: string | null;
  attempted_count: number;
  solved_count: number;
  total_items: number;
  progress_percent: number;
  score: number;
  total_points: number;
};

export type TeacherAssessmentProgress = {
  assessment_id: string;
  class_id: string;
  class_name: string;
  assessment_title: string;
  total_items: number;
  total_points: number;
  avg_progress_percent: number;
  avg_score: number;
  students: TeacherAssessmentStudentProgress[];
};

export type UserXp = {
  total_xp: number;
};

export type UserStreak = {
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
};

export type UserAchievement = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  icon_name: string | null;
  icon_url: string | null;
  xp_reward: number | null;
  is_active: boolean;
  trigger_type: string | null;
  created_at: string;
  updated_at: string;
  unlocked_at: string | null;
  is_unlocked: boolean;
};

export type UserAchievementsResponse = {
  items: UserAchievement[];
  unlocked_count: number;
  total: number;
};

export type UserNotification = {
  id: string;
  type: "achievement_unlocked" | "friend_request_received" | "friend_added";
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_avatar_url: string | null;
  action_url: string | null;
};

export type UserNotificationsResponse = {
  items: UserNotification[];
  unread_count: number;
};

export type LeaderboardMetric = "xp" | "solved_problems" | "streak";

export type LeaderboardEntry = {
  rank: number;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  city: string | null;
  score: number;
  is_me: boolean;
};

export type LeaderboardResponse = {
  metric: LeaderboardMetric;
  items: LeaderboardEntry[];
  my_entry: LeaderboardEntry | null;
};

export type CreateClassAssessmentPayload = {
  title: string;
  description?: string | null;
  due_at?: string | null;
  time_limit_min?: number | null;
  items: Array<{
    problem_id: string;
    points: number;
  }>;
};

export function apiListTeacherClasses(
  accessToken: string,
): Promise<TeacherClass[]> {
  return apiGet<TeacherClass[]>("/classes", accessToken);
}

export function apiCreateClass(
  name: string,
  accessToken: string,
): Promise<TeacherClass> {
  return apiPost<TeacherClass>("/classes", { name }, accessToken);
}

export function apiGetClassDetail(
  classId: string,
  accessToken: string,
): Promise<ClassDetail> {
  return apiGet<ClassDetail>(`/classes/${classId}`, accessToken);
}

export function apiRemoveClassStudent(
  classId: string,
  studentId: string,
  accessToken: string,
): Promise<void> {
  return apiDelete<void>(
    `/classes/${classId}/students/${studentId}`,
    accessToken,
  );
}

export function apiJoinClassByCode(
  joinCode: string,
  accessToken: string,
): Promise<StudentClass> {
  return apiPost<StudentClass>(
    "/classes/me/join",
    { join_code: joinCode },
    accessToken,
  );
}

export function apiListStudentClasses(
  accessToken: string,
): Promise<StudentClass[]> {
  return apiGet<StudentClass[]>("/classes/me", accessToken);
}

export function apiListStudentAssessments(
  accessToken: string,
): Promise<StudentAssessment[]> {
  return apiGet<StudentAssessment[]>("/classes/me/assessments", accessToken);
}

export function apiGetStudentAssessmentDetail(
  assessmentId: string,
  accessToken: string,
): Promise<StudentAssessmentDetail> {
  return apiGet<StudentAssessmentDetail>(
    `/classes/me/assessments/${assessmentId}`,
    accessToken,
  );
}

export function apiListClassAssessments(
  classId: string,
  accessToken: string,
): Promise<ClassAssessment[]> {
  return apiGet<ClassAssessment[]>(`/classes/${classId}/assessments`, accessToken);
}

export function apiCreateClassAssessment(
  classId: string,
  payload: CreateClassAssessmentPayload,
  accessToken: string,
): Promise<ClassAssessment> {
  return apiPost<ClassAssessment>(`/classes/${classId}/assessments`, payload, accessToken);
}

export function apiGetClassAssessmentDetail(
  classId: string,
  assessmentId: string,
  accessToken: string,
): Promise<ClassAssessmentDetail> {
  return apiGet<ClassAssessmentDetail>(
    `/classes/${classId}/assessments/${assessmentId}`,
    accessToken,
  );
}

export function apiGetClassAssessmentProgress(
  classId: string,
  assessmentId: string,
  accessToken: string,
): Promise<TeacherAssessmentProgress> {
  return apiGet<TeacherAssessmentProgress>(
    `/classes/${classId}/assessments/${assessmentId}/progress`,
    accessToken,
  );
}

export function apiGetMyXp(accessToken: string): Promise<UserXp> {
  return apiGet<UserXp>("/me/xp", accessToken);
}

export function apiGetMyStreak(accessToken: string): Promise<UserStreak> {
  return apiGet<UserStreak>("/me/streak", accessToken);
}

export function apiGetMyAchievements(
  accessToken: string,
): Promise<UserAchievementsResponse> {
  return apiGet<UserAchievementsResponse>("/me/achievements", accessToken);
}

export function apiGetMyNotifications(
  accessToken: string,
): Promise<UserNotificationsResponse> {
  return apiGet<UserNotificationsResponse>("/me/notifications", accessToken);
}

export function apiMarkNotificationRead(
  notificationId: string,
  accessToken: string,
): Promise<void> {
  return apiPost<void>(`/me/notifications/${notificationId}/read`, undefined, accessToken);
}

export function apiMarkAllNotificationsRead(
  accessToken: string,
): Promise<void> {
  return apiPost<void>("/me/notifications/read-all", undefined, accessToken);
}

export function apiGetLeaderboard(
  metric: LeaderboardMetric,
  accessToken: string,
  limit = 20,
): Promise<LeaderboardResponse> {
  return apiGet<LeaderboardResponse>(
    `/leaderboard?metric=${metric}&limit=${limit}`,
    accessToken,
  );
}
