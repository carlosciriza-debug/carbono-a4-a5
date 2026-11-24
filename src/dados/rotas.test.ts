import { describe, expect, it, vi } from 'vitest'
import type { PontoComDistancia } from './fornecedores'
import {
  buscarDistancias,
  chaveCentro,
  escolherCandidatos,
  escolherRotas,
  ErroRotas,
  montarUrlMatriz,
  montarUrlRota,
} from './rotas'

function ponto(id: string, categoria: PontoComDistancia['categoria'], km: number, ativo = true): PontoComDistancia {
  return { id, nome: id, categoria, coordenadas: [-43 + km / 100, -22.9], origem: 'osm', ativo, distanciaRetaKm: km }
}

describe('escolherCandidatos', () => {
  it('pega só pontos ativos, até n por categoria, dos mais próximos', () => {
    const pontos = [ponto('a3', 'agregados', 3), ponto('a1', 'agregados', 1), ponto('a2', 'agregados', 2, false), ponto('r1', 'residuos', 5)]
    expect(escolherCandidatos(pontos, 1).map((p) => p.id)).toEqual(['a1', 'r1'])
    expect(escolherCandidatos(pontos, 10).map((p) => p.id)).toEqual(['a1', 'a3', 'r1'])
  })
})

describe('escolherRotas', () => {
  const candidatos = [ponto('perto-reta', 'agregados', 5), ponto('perto-estrada', 'agregados', 8)]

  it('escolhe a menor distância por estrada, não a menor em linha reta', () => {
    const d = new Map([
      ['perto-reta', { km: 20 }],
      ['perto-estrada', { km: 11 }],
    ])
    expect(escolherRotas(candidatos, d, 1.23).agregados).toEqual({
      pontoId: 'perto-estrada',
      distanciaKm: 11,
      geometria: null,
      estimada: false,
    })
  })

  it('ignora ponto sem caminho por estrada', () => {
    const d = new Map([
      ['perto-reta', { km: null }],
      ['perto-estrada', { km: 11 }],
    ])
    expect(escolherRotas(candidatos, d, 1.23).agregados!.pontoId).toBe('perto-estrada')
  })

  it('sem resposta do serviço, estima pela linha reta × tortuosidade', () => {
    const r = escolherRotas(candidatos, new Map(), 1.23).agregados!
    expect(r.pontoId).toBe('perto-reta')
    expect(r.distanciaKm).toBeCloseTo(6.15, 6) // 5 km × 1,23
    expect(r.estimada).toBe(true)
  })

  it('distância por estrada vence a estimada, mesmo maior', () => {
    const d = new Map([['perto-estrada', { km: 30 }]])
    const r = escolherRotas(candidatos, d, 1.23).agregados!
    expect(r).toMatchObject({ pontoId: 'perto-estrada', estimada: false })
  })

  it('sem tortuosidade definida e sem serviço, a categoria fica pendente', () => {
    expect(escolherRotas(candidatos, new Map(), null).agregados).toBeUndefined()
  })

  it('categoria sem candidatos não tem rota', () => {
    expect(escolherRotas(candidatos, new Map(), 1.23).aco).toBeUndefined()
  })
})

describe('URLs do OSRM', () => {
  it('matriz com o lote como origem e distâncias', () => {
    const url = montarUrlMatriz('https://x', [-43.1, -22.9], [[-43.2, -22.8]])
    expect(url).toBe(
      'https://x/table/v1/driving/-43.100000,-22.900000;-43.200000,-22.800000?sources=0&annotations=distance&generate_hints=false',
    )
  })

  it('rota do ponto até o lote em GeoJSON', () => {
    const url = montarUrlRota('https://x', [-43.1, -22.9], [-43.2, -22.8])
    expect(url).toContain('/route/v1/driving/-43.200000,-22.800000;-43.100000,-22.900000?')
    expect(url).toContain('geometries=geojson')
  })

  it('chave do centro ignora movimentos pequenos', () => {
    expect(chaveCentro([-43.18032, -22.89552])).toBe(chaveCentro([-43.18028, -22.89548]))
  })
})

describe('buscarDistancias', () => {
  it('converte metros em km e mantém o null de quem não tem caminho', async () => {
    const buscar = vi.fn(
      async () => new Response(JSON.stringify({ code: 'Ok', distances: [[0, 12500, null]] })),
    ) as unknown as typeof fetch
    const r = await buscarDistancias(
      [-43, -22],
      [
        { id: 'a', coordenadas: [-43.1, -22] },
        { id: 'b', coordenadas: [-43.2, -22] },
      ],
      buscar,
    )
    expect(r.get('a')).toEqual({ km: 12.5 })
    expect(r.get('b')).toEqual({ km: null })
  })

  it('tenta o servidor reserva e, se os dois falharem, avisa', async () => {
    const buscar = vi.fn(async () => new Response('', { status: 502 })) as unknown as typeof fetch
    await expect(buscarDistancias([-43, -22], [{ id: 'a', coordenadas: [-43.1, -22] }], buscar)).rejects.toBeInstanceOf(
      ErroRotas,
    )
    expect(buscar).toHaveBeenCalledTimes(2)
  })
})
