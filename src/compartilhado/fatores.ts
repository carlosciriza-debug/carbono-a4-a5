import dados from '../dados-fixos/fatores.json'

export type Fator = {
  valor: number | null
  unidade: string
  fonte: string
  url: string
  ano: number | null
  verificado: boolean
  citacao?: string // forma curta, para a interface
  nota?: string
}

export type Fatores = {
  caminhao: Fator // kgCO2 por t·km
  retornoVazio: Fator // multiplicador da distância
  tortuosidade: Fator // km estrada / km linha reta
  escavacao: Fator // kgCO2e por m³
  densidadeSolo: Fator // t/m³
  alturaPorPavimento: Fator // m (só contexto 3D)
}

export const FATORES = dados as unknown as Fatores
