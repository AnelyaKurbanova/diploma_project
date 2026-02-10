'use client';

import { EntHeader } from "@/components/ent-header";
import { buttonClasses } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <EntHeader />

      {/* Главная — CTA к входу на том же фоне, что и форма */}
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 py-8">
        <div className="w-full max-w-[1143px] flex justify-center">
          <div className="w-full max-w-xl rounded-2xl bg-white p-10 shadow-[0px_8px_10px_-6px_rgba(0,0,0,0.10),0px_20px_25px_-5px_rgba(0,0,0,0.10)] outline outline-1 outline-offset-[-1px] outline-gray-200">
            <h1 className="mb-3 text-2xl font-bold leading-8 text-slate-950">
              Дипломный проект в формате ENT Platform
            </h1>
            <p className="mb-6 text-sm leading-5 text-slate-500">
              Это интерфейс для работы с уроками, задачами и отправкой решений.
              Чтобы начать, авторизуйтесь в системе.
            </p>
            <a
              href="/auth"
              className={buttonClasses({ variant: "primary", size: "lg" })}
            >
              Перейти к входу
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

