import type { IbgeGateway, IbgeMunicipality } from "./run-job.js";
import { ibgeMunicipalities } from "./ibge-municipalities.js";

// O site do IBGE envia o certificado sem a cadeia intermediária.
// O Node recusa essa conexão e a pesquisa parava com "fetch failed".
export function createIbgeGateway(): IbgeGateway {
  return {
    async listByState(state) {
      const uf = state.trim().toUpperCase();
      return ibgeMunicipalities.flatMap((municipality): IbgeMunicipality[] => {
        if (municipality.state !== uf) return [];
        return [{ code: municipality.code, name: municipality.name, state: uf }];
      });
    },
  };
}
