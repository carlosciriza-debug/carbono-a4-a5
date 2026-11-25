import { CATEGORIA_POR_ID } from '../compartilhado/categorias'
import type { Fator, Fatores } from '../compartilhado/fatores'
import type { IdCategoria, ResultadoSistema, Rota } from '../compartilhado/terreno'
import type { Sistema } from './calculo'

export type Unidade = 'total' | 'porM2'

export function totalA4A5(r: ResultadoSistema): number | null {
  if (r.a4KgCO2e === null && r.a5KgCO2e === null) return null
  return (r.a4KgCO2e ?? 0) + (r.a5KgCO2e ?? 0)
}

/** Quanto cada ponto (rota) pesa no total A4 + A5 do sistema, em kgCO2e. */
export function pesoPorPonto(r: ResultadoSistema): Map<string, number> {
  const pesos = new Map<string, number>()
  for (const d of r.detalhamento) {
    if (d.pontoId && d.kgCO2e !== null) pesos.set(d.pontoId, (pesos.get(d.pontoId) ?? 0) + d.kgCO2e)
  }
  return pesos
}

export function emUnidade(kg: number, unidade: Unidade, areaM2: number): number {
  return unidade === 'porM2' ? (areaM2 > 0 ? kg / areaM2 : 0) : kg
}

export function formatarCarbono(kg: number, unidade: Unidade): string {
  // Valores pequenos ganham casas decimais para não aparecerem como zero.
  const casas = unidade === 'porM2' ? 2 : kg !== 0 && Math.abs(kg) < 10 ? 1 : 0
  const numero = kg.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
  return `${numero} ${unidade === 'porM2' ? 'kgCO₂e/m²' : 'kgCO₂e'}`
}

export type Premissa = { tipo: 'fonte' | 'estimado' | 'pendente' | 'escopo'; texto: string }

function descreverFator(nome: string, f: Fator): Premissa {
  const valor = f.valor!.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
  return {
    tipo: 'fonte',
    texto: `${nome}: ${valor} ${f.unidade} — ${f.citacao ?? f.fonte}${f.verificado ? '' : ' (não verificado)'}`,
  }
}

/**
 * Lista de premissas sempre visível (F6): fonte de cada fator em uso,
 * o que é estimado e o que está pendente.
 */
export function montarPremissas(
  sistemas: Sistema[],
  resultados: ResultadoSistema[],
  fatores: Fatores,
  rotas: Partial<Record<IdCategoria, Rota>>,
  volumeTerraM3: number,
): Premissa[] {
  const lista: Premissa[] = []

  lista.push(descreverFator('Caminhão', fatores.caminhao))
  lista.push(descreverFator('Retorno vazio', fatores.retornoVazio))
  if (Object.values(rotas).some((r) => r?.estimada)) lista.push(descreverFator('Tortuosidade', fatores.tortuosidade))
  if (volumeTerraM3 > 0) {
    if (fatores.escavacao.valor !== null) lista.push(descreverFator('Escavação', fatores.escavacao))
    if (fatores.densidadeSolo.valor !== null) lista.push(descreverFator('Densidade do solo', fatores.densidadeSolo))
  }

  for (const s of sistemas) {
    for (const m of s.materiais) {
      if (m.intensidade.valor !== null) lista.push(descreverFator(`${s.nome} — ${m.nome}`, m.intensidade))
    }
    if (s.referenciaA1A3.valor !== null) lista.push(descreverFator(`${s.nome} — referência A1–A3`, s.referenciaA1A3))
  }
  const perdas = new Set(sistemas.flatMap((s) => s.materiais.map((m) => m.perda.citacao).filter(Boolean)))
  if (perdas.size) lista.push({ tipo: 'fonte', texto: `Perdas em obra: ${[...perdas].join(', ')} (não verificado)` })

  for (const [categoria, r] of Object.entries(rotas) as [IdCategoria, Rota][]) {
    if (r.estimada) {
      lista.push({
        tipo: 'estimado',
        texto: `${CATEGORIA_POR_ID[categoria].nome}: distância estimada (linha reta × tortuosidade), o serviço de rotas não respondeu.`,
      })
    }
  }
  const avisos = new Set(resultados.flatMap((r) => r.avisos.filter((a) => a.includes('fornecedor geral'))))
  for (const a of avisos) lista.push({ tipo: 'estimado', texto: a })

  resultados.forEach((r, i) => {
    for (const p of r.pendencias) lista.push({ tipo: 'pendente', texto: `${sistemas[i].nome}: ${p}` })
    if (sistemas[i].referenciaA1A3.valor === null) {
      lista.push({ tipo: 'pendente', texto: `${sistemas[i].nome}: referência de A1–A3 sem fonte brasileira.` })
    }
  })

  lista.push({ tipo: 'escopo', texto: 'Consumo de energia do canteiro não entra nesta versão do A5.' })
  lista.push({
    tipo: 'escopo',
    texto: 'O fator do caminhão e a referência de A1–A3 do concreto contam só CO₂ (sem CH₄ e N₂O); os resultados são mostrados em kgCO₂e.',
  })
  lista.push({
    tipo: 'escopo',
    texto: 'As massas por m² vêm de estudos com escopos diferentes: concreto só dos pavimentos-tipo, sem fundação (Belizário-Silva et al.); aço só dos perfis, sem lajes (Machado). Os sistemas não são diretamente comparáveis.',
  })
  return lista
}
