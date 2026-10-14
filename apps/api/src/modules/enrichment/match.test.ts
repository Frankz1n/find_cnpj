import { describe, expect, it } from "vitest";
import { genericPhoneKeys, matchRow } from "./match.js";
import { SANTA_FE_DO_SUL_COMPANIES, SANTA_FE_DO_SUL_ROWS } from "./santa-fe-fixture.js";

describe("casos validados de Santa Fé do Sul", () => {
  const byLine = new Map(SANTA_FE_DO_SUL_ROWS.map((row) => [row.line, matchRow(row, SANTA_FE_DO_SUL_COMPANIES)]));

  it("reconhece Clínica Odonto pelo endereço e pelo telefone fixo", () => {
    const result = byLine.get(1);
    expect(result?.cnpj).toBe("58475175000135");
    expect(["ALTA", "MEDIA"]).toContain(result?.confidence);
  });

  it("reconhece RDO Radiologia com confiança alta", () => {
    expect(byLine.get(2)).toMatchObject({ cnpj: "52185340000138", confidence: "ALTA" });
  });

  it("reconhece Clínica Laranjo só pelo nome, porque a Receita não tem endereço", () => {
    expect(byLine.get(3)).toMatchObject({ cnpj: "37306530000172", confidence: "MEDIA" });
    expect(byLine.get(3)?.justification).toMatch(/Receita não trouxe endereço/);
  });

  it("reconhece Zelo Odontologia e guarda a alternativa do mesmo endereço", () => {
    const result = byLine.get(4);
    expect(result).toMatchObject({ cnpj: "20433893000176", confidence: "ALTA" });
    expect(result?.alternatives.map((item) => item.cnpj)).toContain("61874778000114");
  });

  it("não usa o telefone genérico da Pediatria como evidência", () => {
    expect(genericPhoneKeys(SANTA_FE_DO_SUL_COMPANIES).has("36312290")).toBe(true);
    expect(byLine.get(5)).toMatchObject({ cnpj: "36736535000172", confidence: "MEDIA" });
    expect(byLine.get(5)?.justification).not.toMatch(/3631-2290/);
  });

  it("não aceita a clínica médica cujo único CNPJ está baixado", () => {
    const result = byLine.get(6);
    expect(["BAIXA", "NAO_ENCONTRADO"]).toContain(result?.confidence);
    expect(result?.cnpj).toBeNull();
    expect(JSON.stringify(result)).toContain("20702409000167");
  });

  it("reconhece a clínica da Dra. Nahiara pelo endereço, telefone e razão social", () => {
    const result = byLine.get(7);
    expect(result).toMatchObject({ cnpj: "48923458000149", confidence: "ALTA" });
    expect(result?.justification).toMatch(/Rua 7, 1061/);
    expect(result?.justification).toMatch(/3631-2174/);
  });

  it("reconhece o Centro Odontológico e registra a divergência de um dígito no telefone", () => {
    const result = byLine.get(8);
    expect(result).toMatchObject({ cnpj: "35512645000198", confidence: "ALTA" });
    expect(result?.justification).toMatch(/3641-0880/);
    expect(result?.justification).toMatch(/3631-0880/);
    expect(result?.justification).toMatch(/digitação/);
  });

  it("reconhece a Ikki Odontologia com o endereço escrito de outra forma", () => {
    expect(byLine.get(9)).toMatchObject({ cnpj: "41928526000113", confidence: "ALTA" });
  });
});
