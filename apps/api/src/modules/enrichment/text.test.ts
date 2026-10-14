import { describe, expect, it } from "vitest";
import { extractProfessionals, normalizeStreet, phoneKey } from "./text.js";

describe("normalização", () => {
  it("reduz o logradouro a um número, com ou sem prefixo e por extenso", () => {
    expect(normalizeStreet("R. Sete")).toBe("7");
    expect(normalizeStreet("Rua 7")).toBe("7");
    expect(normalizeStreet("07")).toBe("7");
    expect(normalizeStreet("SETE")).toBe("7");
    expect(normalizeStreet("Rua Trinta e Um")).toBe("31");
    expect(normalizeStreet("Navarro de Andrade")).toBe("NAVARRO DE ANDRADE");
  });

  it("compara telefone pelos últimos 8 dígitos", () => {
    expect(phoneKey("(17) 3631-2174")).toBe("36312174");
    expect(phoneKey("17997115082")).toBe("97115082");
  });

  it("extrai os profissionais sem título", () => {
    expect(extractProfessionals("RT: Dra. Franciele Bassi")).toEqual(["FRANCIELE BASSI"]);
    expect(extractProfessionals("Dra. Rubia Laranjo, Dra. Silvia Maria M. Laranjo")).toEqual([
      "RUBIA LARANJO",
      "SILVIA MARIA M LARANJO",
    ]);
  });
});
