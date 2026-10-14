import { describe, expect, it } from "vitest";
import { mapBrasilApiCompany } from "./brasilapi-mapper.js";

describe("mapBrasilApiCompany", () => {
  it("normaliza a ficha publicada na documentação", () => {
    expect(mapBrasilApiCompany({
      cnpj: "19131243000197",
      razao_social: "OPEN KNOWLEDGE BRASIL",
      nome_fantasia: "REDE PELO CONHECIMENTO LIVRE",
      descricao_situacao_cadastral: "ATIVA",
      descricao_tipo_de_logradouro: "AVENIDA",
      logradouro: "PAULISTA 37",
      numero: "37",
      complemento: "ANDAR 4",
      bairro: "BELA VISTA",
      cep: "01311902",
      municipio: "SAO PAULO",
      uf: "SP",
      ddd_telefone_1: "1123851939",
      ddd_telefone_2: "",
    })).toEqual({
      cnpj: "19131243000197",
      legalName: "OPEN KNOWLEDGE BRASIL",
      tradeName: "REDE PELO CONHECIMENTO LIVRE",
      registrationStatus: "ATIVA",
      phones: ["1123851939"],
      address: "AVENIDA PAULISTA 37, ANDAR 4, BELA VISTA, 01311-902",
      city: "SAO PAULO",
      state: "SP",
    });
  });
});
