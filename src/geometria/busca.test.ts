import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buscarEndereco, converterResposta, ErroBusca, limparCacheBusca, montarUrlBusca } from './busca'

const respostaRio = [
  {
    display_name: 'Rio de Janeiro, Brasil',
    lat: '-22.9110137',
    lon: '-43.2093727',
    boundingbox: ['-23.08', '-22.74', '-43.79', '-43.09'] as [string, string, string, string],
  },
]

function fetchFalso(corpo: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(corpo), { status })) as unknown as typeof fetch
}

beforeEach(() => limparCacheBusca())

describe('montarUrlBusca', () => {
  it('restringe ao Brasil e pede resposta em português', () => {
    const url = new URL(montarUrlBusca('Rua do Ouvidor, Rio'))
    expect(url.searchParams.get('countrycodes')).toBe('br')
    expect(url.searchParams.get('accept-language')).toBe('pt-BR')
    expect(url.searchParams.get('q')).toBe('Rua do Ouvidor, Rio')
  })
})

describe('converterResposta', () => {
  it('converte para [longitude, latitude] e caixa [oeste, sul, leste, norte]', () => {
    const [r] = converterResposta(respostaRio)
    expect(r.centro).toEqual([-43.2093727, -22.9110137])
    expect(r.caixa).toEqual([-43.79, -23.08, -43.09, -22.74])
  })
})

describe('buscarEndereco', () => {
  it('não consulta o serviço com texto vazio', async () => {
    const buscar = fetchFalso(respostaRio)
    expect(await buscarEndereco('   ', buscar)).toEqual([])
    expect(buscar).not.toHaveBeenCalled()
  })

  it('usa o cache para a mesma busca', async () => {
    const buscar = fetchFalso(respostaRio)
    await buscarEndereco('Rio de Janeiro', buscar, () => 10_000)
    await buscarEndereco('rio de janeiro', buscar, () => 10_100)
    expect(buscar).toHaveBeenCalledTimes(1)
  })

  it('recusa mais de uma consulta por segundo', async () => {
    const buscar = fetchFalso(respostaRio)
    await buscarEndereco('Rio de Janeiro', buscar, () => 10_000)
    await expect(buscarEndereco('Niterói', buscar, () => 10_500)).rejects.toBeInstanceOf(ErroBusca)
    await expect(buscarEndereco('Niterói', buscar, () => 11_000)).resolves.toHaveLength(1)
  })

  it('explica o erro quando o serviço falha', async () => {
    const buscar = fetchFalso({}, 503)
    await expect(buscarEndereco('Rio', buscar, () => 10_000)).rejects.toThrow('503')
  })
})
