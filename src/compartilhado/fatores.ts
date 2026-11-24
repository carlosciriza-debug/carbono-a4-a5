import dados from '../dados-fixos/fatores.json'

export type Fator = {
  valor: number | null
  unidade: string
  fonte: string
  url: string
  ano: number | null
  verificado: boolean
  nota?: string
}

export const FATORES = dados as unknown as { tortuosidade: Fator }
