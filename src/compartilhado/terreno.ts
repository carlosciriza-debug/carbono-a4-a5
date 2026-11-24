// Formato comum do "terreno" (SPEC, seção 5.1). Os três módulos —
// geometria, dados e carbono — só conversam entre si por este objeto.

import type { Feature, LineString, Polygon, Position } from 'geojson'

export type IdCategoria = 'concreto' | 'aco' | 'madeira' | 'agregados' | 'geral' | 'residuos'
export type IdSistema = 'concreto' | 'aco' | 'madeira'

export type Lote = {
  poligono: Feature<Polygon>
  areaM2: number
  centro: Position // [longitude, latitude]
}

export type Edificio = {
  areaConstruidaM2: number
  volumeTerraM3: number
}

export type Ponto = {
  id: string // "node/123" para o OpenStreetMap; "usuario/…" para fornecedor próprio
  nome: string | null
  categoria: IdCategoria
  coordenadas: Position // [longitude, latitude]
  origem: 'osm' | 'usuario'
  ativo: boolean
}

export type Rota = {
  pontoId: string
  distanciaKm: number
  geometria: Feature<LineString> | null
  estimada: boolean
}

export type DetalheMaterial = {
  modulo: 'A4' | 'A5 resíduos' | 'A5 terra'
  material: string
  massaT: number | null
  pontoId: string | null
  distanciaKm: number | null
  estimada: boolean
  substituicao: boolean // usou a categoria geral no lugar da específica
  kgCO2e: number | null // null: pendente
}

export type ResultadoSistema = {
  a4KgCO2e: number | null // soma das parcelas calculadas; null se nenhuma pôde ser calculada
  a5KgCO2e: number | null
  a5ResiduosKgCO2e: number | null
  a5TerraKgCO2e: number | null
  referenciaA1A3KgCO2e: number | null
  detalhamento: DetalheMaterial[]
  pendencias: string[] // o que não entrou na soma, e por quê
  avisos: string[] // o que entrou, mas com ressalva (estimado, substituição)
}

export type Terreno = {
  lote: Lote | null
  edificio: Edificio
  pontos: Ponto[]
  rotas: Partial<Record<IdCategoria, Rota>>
  resultados: Partial<Record<IdSistema, ResultadoSistema>>
}
