const messagesRu: Record<string, string> = {
  // ── common ────────────────────────────────────────────────────────
  loading: "Загрузка...",
  error_generic: "Произошла ошибка. Попробуйте ещё раз.",
  save: "Сохранить",
  saving: "Сохраняем...",
  cancel: "Отмена",
  delete: "Удалить",
  back: "Назад",
  submit: "Отправить",
  no_data: "Нет данных",

  // ── auth ──────────────────────────────────────────────────────────
  login: "Войти",
  register: "Зарегистрироваться",
  logout: "Выйти",
  email_placeholder: "Введите email",
  code_placeholder: "Введите код",
  send_code: "Отправить код",
  verify_code: "Подтвердить код",
  login_with_google: "Войти через Google",
  or_separator: "или",

  // ── problems ──────────────────────────────────────────────────────
  all_problems: "Все задачи",
  practice_hint: "Практикуйтесь на задачах разной сложности",
  all_filter: "Все",
  back_to_problems: "Назад к задачам",
  submit_solution: "Отправить решение",
  checking_solution: "Проверяем решение...",
  please_wait: "Пожалуйста, подождите",
  your_answer: "Ваш ответ",
  enter_answer_number: "Введите ответ (число, дробь, с единицами и т.д.)",
  enter_answer_text: "Введите ваш ответ",
  correct_great: "Верно! Отличная работа!",
  incorrect_try_again: "Неверно. Попробуйте ещё раз.",
  on_review: "На проверке",
  score_template: "Баллы: {score} из {max}",
  explanation: "Объяснение",

  // ── proxy errors ──────────────────────────────────────────────────
  submission_proxy_error: "Ошибка при отправке решения",
  request_failed: "Запрос не выполнен (статус {status})",
};

const activeLocale = messagesRu;

export function t(key: string, params?: Record<string, string | number>): string {
  let template = activeLocale[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      template = template.replace(`{${k}}`, String(v));
    }
  }
  return template;
}
