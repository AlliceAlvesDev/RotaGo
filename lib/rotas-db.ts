import { env } from "cloudflare:workers";

export function getRotasDb() {
  if (!env.DB) {
    throw new Error("Banco de dados temporariamente indisponível.");
  }

  return env.DB;
}
