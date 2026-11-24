import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  agruparPorCategoria,
  type BaseFornecedores,
  carregarBase,
  distanciaRetaKm,
  mensagemSemPontos,
  pontosNoRaio,
} from './fornecedores'

const centroRio = [-43.1807, -22.8955]

const base: BaseFornecedores = {
  fonte: 'teste',
  licenca: 'teste',
  extraidoEm: '2026-11-24',
  pontos: [
    { id: 'node/1', nome: 'Perto', categoria: 'agregados', lon: -43.1807, lat: -22.8055 }, // 0,09° ao norte ≈ 10 km
    { id: 'node/2', nome: 'Médio', categoria: 'residuos', lon: -43.1807, lat: -22.4455 }, // 0,45° ≈ 50 km
    { id: 'node/3', nome: null, categoria: 'agregados', lon: -43.1807, lat: -21.9955 }, // 0,9° ≈ 100 km
  ],
}

describe('distanciaRetaKm', () => {
  it('mede 1° de latitude como ≈ 111 km', () => {
    expect(distanciaRetaKm([-43, -22], [-43, -23])).toBeCloseTo(111.2, 0)
  })
})

describe('pontosNoRaio', () => {
  it('mantém só os pontos dentro do raio, do mais perto ao mais longe', () => {
    const r = pontosNoRaio(base, centroRio, 60)
    expect(r.map((p) => p.id)).toEqual(['node/1', 'node/2'])
    expect(r[0].distanciaRetaKm).toBeCloseTo(10, 0)
  })

  it('marca os pontos como do OpenStreetMap e ativos', () => {
    const [p] = pontosNoRaio(base, centroRio, 25)
    expect(p.origem).toBe('osm')
    expect(p.ativo).toBe(true)
    expect(p.coordenadas).toEqual([-43.1807, -22.8055])
  })

  it('aumentar o raio inclui pontos mais distantes', () => {
    expect(pontosNoRaio(base, centroRio, 25)).toHaveLength(1)
    expect(pontosNoRaio(base, centroRio, 200)).toHaveLength(3)
  })
})

describe('agruparPorCategoria', () => {
  it('cria um grupo para cada categoria, mesmo vazio', () => {
    const g = agruparPorCategoria(pontosNoRaio(base, centroRio, 200))
    expect(g.agregados).toHaveLength(2)
    expect(g.residuos).toHaveLength(1)
    expect(g.aco).toEqual([])
  })
})

describe('mensagemSemPontos', () => {
  it('usa o texto da SPEC', () => {
    expect(mensagemSemPontos('Aço', 50)).toBe(
      'Nenhum fornecedor de aço encontrado em 50 km. Aumente o raio ou adicione um no mapa.',
    )
  })
})

describe('carregarBase', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('permite tentar de novo depois de um erro', async () => {
    const falha = vi.fn(async () => new Response('', { status: 503 })) as unknown as typeof fetch
    await expect(carregarBase(falha)).rejects.toThrow('503')
    const sucesso = vi.fn(async () => new Response(JSON.stringify(base))) as unknown as typeof fetch
    await expect(carregarBase(sucesso)).resolves.toMatchObject({ extraidoEm: '2026-11-24' })
  })
})
