import Link from "next/link";

type EntHeaderProps = {
  
  rightSlot?: React.ReactNode;
};

export function EntHeader({ rightSlot }: EntHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1)]">
      <div className="mx-auto flex h-16 max-w-[1143px] items-center justify-between px-8">
        {}
        <Link
          href="/"
          className="text-[24px] leading-10 tracking-[-0.5309px] text-[#0f2d51] font-normal"
          style={{ fontFamily: "var(--font-rostov)" }}
        >
          ÖrkenAI
        </Link>

        {}
        {rightSlot ?? (
          <nav className="flex items-center gap-6">
            <Link
              href="/auth"
              className="flex h-[26px] w-[98px] items-center justify-center rounded-xl border border-black/15 bg-[#fafbfc] text-[16px] leading-6 tracking-[-0.3125px] text-[#0a0a0a] transition-colors hover:bg-gray-100"
              style={{ fontFamily: "var(--font-jost)" }}
            >
              Войти
            </Link>
            <Link
              href="/auth/register"
              className="flex h-[26px] w-[104px] items-center justify-center rounded-xl bg-[#0f2d51] text-[16px] leading-6 tracking-[-0.3125px] text-white shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1)] transition-colors hover:bg-[#0d2645]"
              style={{ fontFamily: "var(--font-jost)" }}
            >
              Регистрация
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
