const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions extends RequestInit {
  accessToken?: string | null;
}

let refreshAccessTokenHandler: (() => Promise<string | null>) | null = null;

export function setRefreshAccessTokenHandler(
  handler: () => Promise<string | null>,
): void {
  refreshAccessTokenHandler = handler;
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

    const response = await fetch(url, init);

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

      const errorBody = isJson ? await response.json().catch(() => null) : null;
      const message =
        (errorBody && (errorBody.message ?? errorBody.detail)) ??
        `Запрос ${path} не выполнен (статус ${response.status})`;

      const error = new Error(message) as Error & {
        status?: number;
        body?: unknown;
      };
      error.status = response.status;
      error.body = errorBody;
      throw error;
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

  throw new Error(`Запрос ${path} не выполнен после повторной попытки`);
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
