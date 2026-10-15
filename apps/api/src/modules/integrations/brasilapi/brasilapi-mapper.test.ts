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
      data_inicio_atividade: "2013-10-03",
      natureza_juridica: "Associação Privada",
      porte: "DEMAIS",
      capital_social: 0,
      email: "contato@ok.org.br",
      descricao_identificador_matriz_filial: "MATRIZ",
      cnae_fiscal_descricao: "Atividades de organizações associativas",
      cnaes_secundarios: [{ codigo: 9493600, descricao: "Atividades de organizações associativas ligadas à cultura" }],
      qsa: [{ nome_socio: "MARIA SILVA", qualificacao_socio: "Diretor" }],
    })).toEqual({
      cnpj: "19131243000197",
      legalName: "OPEN KNOWLEDGE BRASIL",
      tradeName: "REDE PELO CONHECIMENTO LIVRE",
      registrationStatus: "ATIVA",
      openedAt: "2013-10-03",
      legalNature: "Associação Privada",
      size: "DEMAIS",
      capital: "R$ 0,00",
      email: "contato@ok.org.br",
      branch: "MATRIZ",
      mainCnae: "Atividades de organizações associativas",
      secondaryCnaes: ["Atividades de organizações associativas ligadas à cultura"],
      partners: [{ name: "MARIA SILVA", role: "Diretor" }],
      phones: ["1123851939"],
      address: "AVENIDA PAULISTA 37, ANDAR 4, BELA VISTA, 01311-902",
      city: "SAO PAULO",
      state: "SP",
    });
  });
});
