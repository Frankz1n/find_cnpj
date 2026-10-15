import { describe, expect, it } from "vitest";
import { createIbgeGateway } from "./ibge-client.js";

describe("createIbgeGateway", () => {
  it("encontra Santa Fé do Sul na lista local", async () => {
    const cities = await createIbgeGateway().listByState("sp");

    expect(cities).toContainEqual({ code: "3546603", name: "Santa Fé do Sul", state: "SP" });
  });
});
