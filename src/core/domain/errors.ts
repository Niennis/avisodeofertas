/** Error esperable del negocio; su mensaje se puede mostrar al usuario. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "No encontrado") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Por qué no se pudo leer un precio. */
export type PriceProblem = "unsupported" | "blocked" | "unavailable" | "not_found";

const PROBLEM_MESSAGES: Record<PriceProblem, string> = {
  unsupported: "Todavía no sabemos leer el precio de esta tienda.",
  blocked: "La tienda está bloqueando la consulta automática.",
  unavailable: "La tienda no respondió bien. Intenta de nuevo en un rato; si sigue igual, revisa el enlace.",
  not_found: "La tienda dice que esta página no existe. Revisa el enlace.",
};

/**
 * No se pudo leer el precio. El mensaje es para la persona; `detail` guarda el motivo técnico
 * (qué plataforma se probó, qué respondió la tienda) para los registros.
 */
export class PriceUnavailableError extends DomainError {
  constructor(
    readonly problem: PriceProblem,
    readonly detail?: string,
    message: string = PROBLEM_MESSAGES[problem],
  ) {
    super(message);
    this.name = "PriceUnavailableError";
  }
}
