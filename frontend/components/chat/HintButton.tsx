"use client";

export function HintButton() {
  const handleClick = () => {
    window.dispatchEvent(new CustomEvent("chat:request-hint"));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group flex items-center gap-2 rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-2.5 text-sm font-medium text-amber-700 shadow-sm transition-all hover:border-amber-300 hover:shadow-md hover:shadow-amber-100 active:scale-[0.98]"
    >
      <svg className="h-4 w-4 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
      </svg>
      Подсказка от AI
    </button>
  );
}
