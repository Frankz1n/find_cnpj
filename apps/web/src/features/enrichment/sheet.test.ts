import { describe, expect, it } from "vitest";
import { buildImportRows, guessColumns, instagramFromRow } from "./sheet";

const headers = [
  "Carimbo de data/hora",
  "Tipo de Estabelecimento",
  "Nome do Estabelecimento/Ponto",
  "Nome da Secretária",
  "Telefone Fixo do Estabelecimento",
  "WhatsApp do Estabelecimento",
  "Instagram do Profissional",
  "Instagram do Estabelecimento",
  "Nome do Profissional",
  "Especialidade",
  "Endereço Completo",
  "Coluna 11",
];

describe("mapeamento da ficha de entrega", () => {
  it("usa a coluna sem nome como cidade e não troca a especialidade pelo tipo", () => {
    const rows = [
      ["", "Clínica", "Clínica Odonto", ".", "(17)3631-5822", "(17)99711-5082", "https://instagram.com/franciele_bassi", "https://instagram.com/clinicaodontosfs", "RT: Dra. Franciele Bassi", "Cirurgiã dentista", "Rua 5, 1679 - Centro", "Santa fé do Sul"],
      ["", "Clínica", "Zelo Odontologia", ".", "(17)3631-6795", ".", "", "https://instagram.com/zelo.odontologia", "Dra. Paula Minomi", "Odontologia", "Rua 5, 1543 - Centro", "Santa fé do Sul"],
      ["", "Clínica", "Outra", ".", "", "", "", "", "", "Pediatria", "Rua 1, 10", "Jales"],
      ["", "Clínica", "Mais uma", ".", "", "", "", "", "", "Cardiologia", "Rua 2, 20", "Jales"],
    ];

    expect(guessColumns(headers, rows)).toMatchObject({
      name: 2,
      landline: 4,
      mobile: 5,
      professionals: 8,
      specialty: 9,
      address: 10,
      city: 11,
    });
    expect(instagramFromRow(headers, rows[0] ?? [])).toBe(
      "https://instagram.com/franciele_bassi https://instagram.com/clinicaodontosfs",
    );
  });

  it("monta as linhas da ficha sem pedir o mapeamento", () => {
    const built = buildImportRows([
      headers,
      ["", "Clínica", "Clínica Odonto", ".", "(17)3631-5822", "(17)99711-5082", "https://instagram.com/franciele_bassi", "https://instagram.com/clinicaodontosfs", "RT: Dra. Franciele Bassi", "Cirurgiã dentista", "Rua 5, 1679 - Centro", "Santa fé do Sul"],
      ["", "Clínica", "Zelo Odontologia", ".", "(17)3631-6795", ".", "", "", "Dra. Paula Minomi", "Odontologia", "Rua 5, 1543 - Centro", "Santa fé do Sul"],
      ["", "Clínica", "Outra", ".", "", "", "", "", "", "Pediatria", "Rua 1, 10", "Jales"],
      ["", "Clínica", "Ikki Odontologia", ".", "(17)3641-2775", "", "", "", "", "Odontologia", "R. Sete, 1060 - Centro, Santa Fé do Sul - SP, 15775-045", ""],
      ["", "Clínica", "", ".", "", "", "", "", "", "", "", ""],
    ]);

    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.defaultState).toBe("SP");
    expect(built.rows.map((row) => ({ name: row.name, city: row.city, state: row.state, specialty: row.specialty }))).toEqual([
      { name: "Clínica Odonto", city: "Santa fé do Sul", state: null, specialty: "Cirurgiã dentista" },
      { name: "Zelo Odontologia", city: "Santa fé do Sul", state: null, specialty: "Odontologia" },
      { name: "Outra", city: "Jales", state: null, specialty: "Pediatria" },
      { name: "Ikki Odontologia", city: "Santa Fé do Sul", state: "SP", specialty: "Odontologia" },
    ]);
  });
});
