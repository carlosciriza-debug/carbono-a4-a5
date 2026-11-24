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
  material: string
  massaT: number
  pontoId: string | null
  distanciaKm: number | null
  kgCO2e: number | null
}

export type ResultadoSistema = {
  a4KgCO2e: number | null
  a5KgCO2e: number | null
  detalhamento: DetalheMaterial[]
  pendencias: string[]
}

export type Terreno = {
  lote: Lote | null
  edificio: Edificio
  pontos: Ponto[]
  rotas: Partial<Record<IdCategoria, Rota>>
  resultados: Partial<Record<IdSistema, ResultadoSistema>>
}
