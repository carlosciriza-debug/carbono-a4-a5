import type { Feature, LineString, Position } from 'geojson'
import type { IdCategoria, Rota } from '../compartilhado/terreno'
import type { PontoComDistancia } from './fornecedores'

// Rotas por estrada pelo OSRM, servidor de demonstração mantido pela FOSSGIS.
// Política: https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server
// - uso razoável e não comercial, no máximo 1 requisição por segundo;
// - hints desligados (generate_hints=false), como pede o servidor;
// - primeiro filtramos os 10 mais próximos em linha reta de cada categoria,
//   depois uma única matriz de distâncias, e só então a geometria das rotas escolhidas.

const SERVIDORES = ['https://router.project-osrm.org', 'https://routing.openstreetmap.de/routed-car']
const INTERVALO_MINIMO_MS = 1100
export const CANDIDATOS_POR_CATEGORIA = 10

export class ErroRotas extends Error {}

// ---------- funções puras ----------

/** Os pontos ativos mais próximos em linha reta, até `n` por categoria. */
export function escolherCandidatos(pontos: PontoComDistancia[], n = CANDIDATOS_POR_CATEGORIA): PontoComDistancia[] {
  const contagem = new Map<IdCategoria, number>()
  const escolhidos: PontoComDistancia[] = []
  for (const p of [...pontos].sort((a, b) => a.distanciaRetaKm - b.distanciaRetaKm)) {
    if (!p.ativo) continue
    const k = contagem.get(p.categoria) ?? 0
    if (k < n) {
      escolhidos.push(p)
      contagem.set(p.categoria, k + 1)
    }
  }
  return escolhidos
}

export type DistanciaEstrada = { km: number | null } // null: o OSRM não achou caminho

/**
 * Para cada categoria, o candidato com a menor distância por estrada.
 * Sem distância por estrada (serviço fora do ar), usa linha reta × tortuosidade e marca como estimada.
 * Sem tortuosidade definida, a categoria fica sem rota (pendente).
 */
export function escolherRotas(
  candidatos: PontoComDistancia[],
  distancias: Map<string, DistanciaEstrada>,
  tortuosidade: number | null,
): Partial<Record<IdCategoria, Rota>> {
  const rotas: Partial<Record<IdCategoria, Rota>> = {}
  const porCategoria = new Map<IdCategoria, PontoComDistancia[]>()
  for (const c of candidatos) porCategoria.set(c.categoria, [...(porCategoria.get(c.categoria) ?? []), c])

  for (const [categoria, lista] of porCategoria) {
    let melhor: Rota | null = null
    for (const p of lista) {
      const d = distancias.get(p.id)
      if (d && d.km !== null) {
        if (!melhor || melhor.estimada || d.km < melhor.distanciaKm) {
          melhor = { pontoId: p.id, distanciaKm: d.km, geometria: null, estimada: false }
        }
      } else if (d === undefined && tortuosidade !== null) {
        const km = p.distanciaRetaKm * tortuosidade
        if (!melhor || (melhor.estimada && km < melhor.distanciaKm)) {
          melhor = { pontoId: p.id, distanciaKm: km, geometria: null, estimada: true }
        }
      }
    }
    if (melhor) rotas[categoria] = melhor
  }
  return rotas
}

/** Linha reta entre o lote e o ponto, usada no mapa quando a rota é estimada. */
export function linhaReta(de: Position, para: Position): Feature<LineString> {
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [de, para] } }
}

export function chaveCentro(centro: Position): string {
  // ~10 m de precisão: mexer pouco no lote não refaz as consultas.
  return `${centro[0].toFixed(4)},${centro[1].toFixed(4)}`
}

function coordenadasUrl(lista: Position[]): string {
  return lista.map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`).join(';')
}

export function montarUrlMatriz(servidor: string, centro: Position, destinos: Position[]): string {
  return `${servidor}/table/v1/driving/${coordenadasUrl([centro, ...destinos])}?sources=0&annotations=distance&generate_hints=false`
}

export function montarUrlRota(servidor: string, de: Position, para: Position): string {
  return `${servidor}/route/v1/driving/${coordenadasUrl([para, de])}?overview=full&geometries=geojson&alternatives=false&steps=false&generate_hints=false`
}

// ---------- rede ----------

let proximaLiberacao = 0

async function aguardarVez() {
  const agora = Date.now()
  const espera = Math.max(0, proximaLiberacao - agora)
  proximaLiberacao = Math.max(agora, proximaLiberacao) + INTERVALO_MINIMO_MS
  if (espera > 0) await new Promise((r) => setTimeout(r, espera))
}

async function consultar<T>(montar: (servidor: string) => string, buscar: typeof fetch): Promise<T> {
  for (const servidor of SERVIDORES) {
    await aguardarVez()
    try {
      const resposta = await buscar(montar(servidor))
      if (!resposta.ok) continue
      const dados = await resposta.json()
      if (dados.code === 'Ok') return dados as T
    } catch {
      // tenta o próximo servidor
    }
  }
  throw new ErroRotas('O serviço de rotas não respondeu. As distâncias foram estimadas pela linha reta.')
}

/** Distâncias por estrada (km) do centro do lote até cada destino. */
export async function buscarDistancias(
  centro: Position,
  destinos: { id: string; coordenadas: Position }[],
  buscar: typeof fetch = fetch,
): Promise<Map<string, DistanciaEstrada>> {
  const resultado = new Map<string, DistanciaEstrada>()
  if (destinos.length === 0) return resultado
  const dados = await consultar<{ distances: (number | null)[][] }>(
    (s) => montarUrlMatriz(s, centro, destinos.map((d) => d.coordenadas)),
    buscar,
  )
  // A linha 0 da matriz é o lote; a coluna 0 é ele mesmo.
  destinos.forEach((d, i) => {
    const metros = dados.distances[0][i + 1]
    resultado.set(d.id, { km: metros === null ? null : metros / 1000 })
  })
  return resultado
}

/** Geometria da rota do ponto até o lote. */
export async function buscarGeometria(
  de: Position,
  para: Position,
  buscar: typeof fetch = fetch,
): Promise<{ geometria: Feature<LineString>; km: number }> {
  const dados = await consultar<{ routes: { geometry: LineString; distance: number }[] }>(
    (s) => montarUrlRota(s, de, para),
    buscar,
  )
  const [rota] = dados.routes
  return { geometria: { type: 'Feature', properties: {}, geometry: rota.geometry }, km: rota.distance / 1000 }
}
