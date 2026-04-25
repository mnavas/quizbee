"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ToastType = "success" | "error" | "info";
type Toast = { id: number; message: string; type: ToastType };

const Ctx = createContext<(msg: string, type?: ToastType) => void>(() => {});
let _id = 0;

const STYLES: Record<ToastType, string> = {
  success: "bg-gray-900 text-white",
  error:   "bg-red-600 text-white",
  info:    "bg-blue-600 text-white",
};

const ICONS: Record<ToastType, string> = {
  success: "✓",
  error:   "✕",
  info:    "i",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);

  const add = useCallback((message: string, type: ToastType = "success") => {
    const id = ++_id;
    setList((p) => [...p, { id, message, type }]);
    setTimeout(() => setList((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <Ctx.Provider value={add}>
      {children}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 items-end pointer-events-none">
        {list.map((t) => (
          <div
            key={t.id}
            className={`${STYLES[t.type]} flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium max-w-xs toast-enter pointer-events-auto`}
          >
            <span className="text-xs font-bold opacity-80">{ICONS[t.type]}</span>
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
