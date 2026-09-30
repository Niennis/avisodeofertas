import type { PriceProblem } from "./errors";

/** Dónde ocurrió el fallo: al agregar un producto o en la revisión periódica. */
export type FailureSource = "add" | "check";

/** Registro de un enlace que la app no pudo leer, para que quien administra lo revise. */
export interface FailureReport {
  id: string;
  url: string;
  host: string;
  problem: PriceProblem;
  message: string;
  detail: string | null;
  source: FailureSource;
  userId: string | null;
  createdAt: Date;
  notifiedAt: Date | null;
}

export type NewFailureReport = Omit<FailureReport, "id" | "createdAt" | "notifiedAt" | "host">;

/** Fallos agrupados por tienda, del más reciente al más antiguo. */
export interface StoreFailures {
  host: string;
  count: number;
  problems: PriceProblem[];
  lastAt: Date;
  lastUrl: string;
  lastDetail: string | null;
  fromAdds: number;
  fromChecks: number;
}

/** Cuántas revisiones seguidas debe fallar un producto para reportarlo (evita ruido por caídas pasajeras). */
export const CHECK_FAILURES_TO_REPORT = 2;

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function groupFailuresByStore(reports: FailureReport[]): StoreFailures[] {
  const byHost = new Map<string, FailureReport[]>();
  for (const report of reports) byHost.set(report.host, [...(byHost.get(report.host) ?? []), report]);
  return [...byHost.entries()]
    .map(([host, list]) => {
      const last = list.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
      return {
        host,
        count: list.length,
        problems: [...new Set(list.map((r) => r.problem))],
        lastAt: last.createdAt,
        lastUrl: last.url,
        lastDetail: last.detail,
        fromAdds: list.filter((r) => r.source === "add").length,
        fromChecks: list.filter((r) => r.source === "check").length,
      };
    })
    .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
}

export const PROBLEM_LABELS: Record<PriceProblem, string> = {
  unsupported: "No compatible",
  blocked: "Bloquea consultas",
  unavailable: "No respondió",
  not_found: "Página inexistente",
};
