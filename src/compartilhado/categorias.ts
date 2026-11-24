import dados from '../dados-fixos/categorias.json'
import type { IdCategoria } from './terreno'

export type Categoria = {
  id: IdCategoria
  nome: string
  usadaEm: ('A4' | 'A5')[]
  reserva?: boolean
  cor: string
  letra: string
  filtros: string[]
}

export const CATEGORIAS = dados.categorias as Categoria[]

export const CATEGORIA_POR_ID = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c])) as Record<IdCategoria, Categoria>
