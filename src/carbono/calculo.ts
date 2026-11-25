// Cálculo de A4 e A5 (SPEC, seção 8). Funções puras, sem rede, para serem testáveis.

import type { Fator } from '../compartilhado/fatores'
import type { DetalheMaterial, Edificio, IdCategoria, IdSistema, ResultadoSistema, Rota } from '../compartilhado/terreno'

export type Material = {
  id: string
  nome: string
  categoria: Extract<IdCategoria, 'concreto' | 'aco' | 'madeira' | 'agregados'>
  intensidade: Fator // kg por m² de área construída
  perda: Fator // fração (0,05 = 5%)
}

export type Sistema = {
  id: IdSistema
  nome: string
  materiais: Material[]
  referenciaA1A3: Fator // kgCO2e por m²
}

export type FatoresCalculo = {
  caminhao: Fator
  retornoVazio: Fator
  escavacao: Fator
  densidadeSolo: Fator
}

type Rotas = Partial<Record<IdCategoria, Rota>>

// Categorias que podem usar a de "material de construção em geral" como reserva (SPEC, seção 6).
const ACEITAM_RESERVA = new Set<IdCategoria>(['concreto', 'aco', 'madeira'])

export function rotaDoMaterial(categoria: IdCategoria, rotas: Rotas): { rota: Rota; substituicao: boolean } | null {
  const propria = rotas[categoria]
  if (propria) return { rota: propria, substituicao: false }
  if (ACEITAM_RESERVA.has(categoria) && rotas.geral) return { rota: rotas.geral, substituicao: true }
  return null
}

/** massa (t) = área (m²) × intensidade (kg/m²) ÷ 1000 */
export function massaMaterialT(areaM2: number, intensidadeKgM2: number): number {
  return (areaM2 * intensidadeKgM2) / 1000
}

/** kgCO2e = massa (t) × distância (km) × fator do caminhão × fator de retorno vazio */
export function emissaoTransporte(massaT: number, distanciaKm: number, caminhao: number, retornoVazio: number): number {
  return massaT * distanciaKm * caminhao * retornoVazio
}

function soma(valores: (number | null)[]): number | null {
  const calculados = valores.filter((v): v is number => v !== null)
  return calculados.length === 0 ? null : calculados.reduce((a, b) => a + b, 0)
}

export function calcularSistema(
  sistema: Sistema,
  edificio: Edificio,
  rotas: Rotas,
  fatores: FatoresCalculo,
): ResultadoSistema {
  const detalhamento: DetalheMaterial[] = []
  const pendencias: string[] = []
  const avisos: string[] = []
  const area = edificio.areaConstruidaM2

  const caminhao = fatores.caminhao.valor
  const retorno = fatores.retornoVazio.valor
  const transporteDefinido = caminhao !== null && retorno !== null
  if (!transporteDefinido) {
    pendencias.push('Fator do caminhão ou de retorno vazio sem fonte: A4 e o transporte do A5 ficam pendentes.')
  }

  const destino = rotas.residuos ?? null
  if (!destino) pendencias.push('Nenhum destino de resíduos ativo: o transporte do A5 fica pendente.')
  else if (destino.estimada) avisos.push('Distância até o destino de resíduos estimada (linha reta × tortuosidade).')

  // ---------- A4 e resíduos do A5, material por material ----------
  for (const m of sistema.materiais) {
    const intensidade = m.intensidade.valor
    const massa = intensidade === null ? null : massaMaterialT(area, intensidade)
    if (intensidade === null) pendencias.push(`${m.nome}: massa por m² sem fonte.`)

    // A4
    const origem = rotaDoMaterial(m.categoria, rotas)
    if (!origem) pendencias.push(`${m.nome}: nenhum fornecedor ativo no raio.`)
    else if (massa !== null) {
      // Só avisa sobre o que de fato entrou na soma.
      if (origem.substituicao) avisos.push(`${m.nome}: usado o fornecedor geral mais próximo, por falta de um específico.`)
      if (origem.rota.estimada) avisos.push(`${m.nome}: distância estimada (linha reta × tortuosidade).`)
    }
    detalhamento.push({
      modulo: 'A4',
      material: m.nome,
      categoria: m.categoria,
      massaT: massa,
      pontoId: origem?.rota.pontoId ?? null,
      distanciaKm: origem?.rota.distanciaKm ?? null,
      estimada: origem?.rota.estimada ?? false,
      substituicao: origem?.substituicao ?? false,
      kgCO2e:
        massa !== null && origem && transporteDefinido
          ? emissaoTransporte(massa, origem.rota.distanciaKm, caminhao!, retorno!)
          : null,
    })

    // A5 resíduos
    const perda = m.perda.valor
    if (perda === null) pendencias.push(`${m.nome}: percentual de perda sem fonte.`)
    const massaResiduo = massa !== null && perda !== null ? massa * perda : null
    detalhamento.push({
      modulo: 'A5 resíduos',
      material: m.nome,
      categoria: 'residuos',
      massaT: massaResiduo,
      pontoId: destino?.pontoId ?? null,
      distanciaKm: destino?.distanciaKm ?? null,
      estimada: destino?.estimada ?? false,
      substituicao: false,
      kgCO2e:
        massaResiduo !== null && destino && transporteDefinido
          ? emissaoTransporte(massaResiduo, destino.distanciaKm, caminhao!, retorno!)
          : null,
    })
  }

  // ---------- A5 movimento de terra ----------
  const volume = edificio.volumeTerraM3
  let a5Terra: number | null = 0
  if (volume > 0) {
    const escavacao = fatores.escavacao.valor
    const densidade = fatores.densidadeSolo.valor
    if (escavacao === null) pendencias.push('Movimento de terra: fator de escavação sem fonte.')
    if (densidade === null) pendencias.push('Movimento de terra: densidade do solo sem fonte.')
    const parcelaEscavacao = escavacao === null ? null : volume * escavacao
    const massaSolo = densidade === null ? null : volume * densidade
    const parcelaTransporte =
      massaSolo !== null && destino && transporteDefinido
        ? emissaoTransporte(massaSolo, destino.distanciaKm, caminhao!, retorno!)
        : null
    a5Terra = parcelaEscavacao !== null && parcelaTransporte !== null ? parcelaEscavacao + parcelaTransporte : null
    if (a5Terra === null) pendencias.push('Movimento de terra: parcela pendente.')
    detalhamento.push({
      modulo: 'A5 terra',
      material: 'Solo escavado',
      categoria: 'residuos',
      massaT: massaSolo,
      pontoId: destino?.pontoId ?? null,
      distanciaKm: destino?.distanciaKm ?? null,
      estimada: destino?.estimada ?? false,
      substituicao: false,
      kgCO2e: a5Terra,
    })
  }

  const a4 = soma(detalhamento.filter((d) => d.modulo === 'A4').map((d) => d.kgCO2e))
  const a5Residuos = soma(detalhamento.filter((d) => d.modulo === 'A5 resíduos').map((d) => d.kgCO2e))
  // Sem movimento de terra, o zero da terra não é uma parcela calculada: A5 depende só dos resíduos.
  const a5 = volume > 0 ? soma([a5Residuos, a5Terra]) : a5Residuos
  const referencia = sistema.referenciaA1A3.valor

  return {
    a4KgCO2e: a4,
    a5KgCO2e: a5,
    a5ResiduosKgCO2e: a5Residuos,
    a5TerraKgCO2e: a5Terra,
    referenciaA1A3KgCO2e: referencia === null ? null : referencia * area,
    detalhamento,
    pendencias: [...new Set(pendencias)],
    avisos: [...new Set(avisos)],
  }
}

/** Fatores em uso que ainda não foram conferidos por alguém do grupo. */
export function fatoresNaoVerificados(fatores: Record<string, Fator>, sistemas: Sistema[]): string[] {
  const lista: string[] = []
  for (const [nome, f] of Object.entries(fatores)) if (f.valor !== null && !f.verificado) lista.push(nome)
  for (const s of sistemas) {
    if (s.referenciaA1A3.valor !== null && !s.referenciaA1A3.verificado) lista.push(`${s.nome}: referência A1–A3`)
    for (const m of s.materiais) {
      if (m.intensidade.valor !== null && !m.intensidade.verificado) lista.push(`${s.nome}: ${m.nome} (kg/m²)`)
      if (m.perda.valor !== null && !m.perda.verificado) lista.push(`${s.nome}: ${m.nome} (perda)`)
    }
  }
  return lista
}
