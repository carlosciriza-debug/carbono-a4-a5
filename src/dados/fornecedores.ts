import distance from '@turf/distance'
import type { Position } from 'geojson'
import type { IdCategoria, Ponto } from '../compartilhado/terreno'

// Base extraída do OpenStreetMap por scripts/extrair-fornecedores.mjs.
// O navegador baixa o arquivo uma vez e filtra pelo raio localmente,
// sem consultar o Overpass a cada lote.

export const RAIOS_KM = [25, 50, 100, 200] as const
export const RAIO_INICIAL_KM = 50

export type BaseFornecedores = {
  fonte: string
  licenca: string
  extraidoEm: string
  pontos: { id: string; nome: string | null; categoria: IdCategoria; lon: number; lat: number }[]
}

export class ErroBase extends Error {}

let carregamento: Promise<BaseFornecedores> | null = null

export function carregarBase(buscar: typeof fetch = fetch): Promise<BaseFornecedores> {
  carregamento ??= (async () => {
    let resposta: Response
    try {
      resposta = await buscar(`${import.meta.env.BASE_URL}dados/fornecedores-br.json`)
    } catch {
      throw new ErroBase('Não foi possível baixar a base de fornecedores. Verifique a conexão e tente de novo.')
    }
    if (!resposta.ok) {
      throw new ErroBase(`A base de fornecedores não carregou (erro ${resposta.status}). Tente de novo.`)
    }
    return resposta.json()
  })()
  // Em caso de erro, permite tentar de novo.
  carregamento.catch(() => (carregamento = null))
  return carregamento
}

export function distanciaRetaKm(a: Position, b: Position): number {
  return distance(a, b, { units: 'kilometers' })
}

export type PontoComDistancia = Ponto & { distanciaRetaKm: number }

export function pontosNoRaio(base: BaseFornecedores, centro: Position, raioKm: number): PontoComDistancia[] {
  const resultado: PontoComDistancia[] = []
  for (const p of base.pontos) {
    const coordenadas = [p.lon, p.lat]
    const d = distanciaRetaKm(centro, coordenadas)
    if (d <= raioKm) {
      resultado.push({
        id: p.id,
        nome: p.nome,
        categoria: p.categoria,
        coordenadas,
        origem: 'osm',
        ativo: true,
        distanciaRetaKm: d,
      })
    }
  }
  return resultado.sort((a, b) => a.distanciaRetaKm - b.distanciaRetaKm)
}

export function agruparPorCategoria<T extends Ponto>(pontos: T[]): Record<IdCategoria, T[]> {
  const grupos: Record<IdCategoria, T[]> = {
    concreto: [],
    aco: [],
    madeira: [],
    agregados: [],
    geral: [],
    residuos: [],
  }
  for (const p of pontos) grupos[p.categoria].push(p)
  return grupos
}

export function mensagemSemPontos(nomeCategoria: string, raioKm: number): string {
  return `Nenhum fornecedor de ${nomeCategoria.toLowerCase()} encontrado em ${raioKm} km. Aumente o raio ou adicione um no mapa.`
}

/**
 * Junta os pontos da base dentro do raio com as escolhas do usuário:
 * marca os desligados e inclui os fornecedores próprios. Os próprios entram
 * sempre, mesmo fora do raio, porque foram cadastrados de propósito.
 */
export function combinarPontos(
  noRaio: PontoComDistancia[],
  proprios: Ponto[],
  desligados: string[],
  centro: Position,
): PontoComDistancia[] {
  const fora = new Set(desligados)
  const todos = [
    ...noRaio,
    ...proprios.map((p) => ({ ...p, distanciaRetaKm: distanciaRetaKm(centro, p.coordenadas) })),
  ]
  return todos
    .map((p) => ({ ...p, ativo: !fora.has(p.id) }))
    .sort((a, b) => a.distanciaRetaKm - b.distanciaRetaKm)
}
