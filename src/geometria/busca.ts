// Busca de endereço pelo Nominatim (OpenStreetMap).
// Política de uso: https://operations.osmfoundation.org/policies/nominatim/
// - uma consulta por ação do usuário (nunca a cada tecla) e no máximo uma por segundo;
// - o navegador identifica a aplicação pelo cabeçalho Referer (origem do site);
// - resultados repetidos vêm do cache em memória, sem nova consulta.

const URL_NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const INTERVALO_MINIMO_MS = 1000

export type ResultadoBusca = {
  nome: string
  centro: [number, number] // [longitude, latitude]
  caixa: [number, number, number, number] // [oeste, sul, leste, norte]
}

type RespostaNominatim = {
  display_name: string
  lat: string
  lon: string
  boundingbox: [string, string, string, string] // [sul, norte, oeste, leste]
}

export class ErroBusca extends Error {}

const cache = new Map<string, ResultadoBusca[]>()
let ultimaConsulta = 0

export function montarUrlBusca(texto: string): string {
  const parametros = new URLSearchParams({
    q: texto,
    format: 'jsonv2',
    countrycodes: 'br',
    limit: '5',
    'accept-language': 'pt-BR',
  })
  return `${URL_NOMINATIM}?${parametros}`
}

export function converterResposta(itens: RespostaNominatim[]): ResultadoBusca[] {
  return itens.map((item) => {
    const [sul, norte, oeste, leste] = item.boundingbox.map(Number)
    return {
      nome: item.display_name,
      centro: [Number(item.lon), Number(item.lat)],
      caixa: [oeste, sul, leste, norte],
    }
  })
}

export async function buscarEndereco(
  texto: string,
  buscar: typeof fetch = fetch,
  agora: () => number = Date.now,
): Promise<ResultadoBusca[]> {
  const chave = texto.trim().toLowerCase()
  if (!chave) return []

  const guardado = cache.get(chave)
  if (guardado) return guardado

  const espera = ultimaConsulta + INTERVALO_MINIMO_MS - agora()
  if (espera > 0) {
    throw new ErroBusca('Aguarde um segundo antes de buscar de novo.')
  }
  ultimaConsulta = agora()

  let resposta: Response
  try {
    resposta = await buscar(montarUrlBusca(texto), { referrerPolicy: 'strict-origin-when-cross-origin' })
  } catch {
    throw new ErroBusca('Não foi possível acessar o serviço de busca. Verifique a conexão e tente de novo.')
  }
  if (!resposta.ok) {
    throw new ErroBusca(`O serviço de busca respondeu com erro (${resposta.status}). Tente de novo em alguns instantes.`)
  }

  const resultados = converterResposta(await resposta.json())
  cache.set(chave, resultados)
  return resultados
}

export function limparCacheBusca() {
  cache.clear()
  ultimaConsulta = 0
}
