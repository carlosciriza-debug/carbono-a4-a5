import { describe, expect, it } from 'vitest'
import type { Fator } from '../compartilhado/fatores'
import type { Rota } from '../compartilhado/terreno'
import { calcularSistema, emissaoTransporte, type FatoresCalculo, fatoresNaoVerificados, massaMaterialT, type Sistema } from './calculo'

// Valores de TESTE, redondos para conferir à mão. Não são dados reais:
// os valores com fonte ficam em src/dados-fixos/.
const f = (valor: number | null, verificado = false): Fator => ({ valor, unidade: '', fonte: 'teste', url: '', ano: null, verificado })

const sistema: Sistema = {
  id: 'concreto',
  nome: 'Concreto',
  materiais: [
    { id: 'concreto', nome: 'Concreto', categoria: 'concreto', intensidade: f(1000), perda: f(0.05) },
    { id: 'aco', nome: 'Aço', categoria: 'aco', intensidade: f(50), perda: f(0.1) },
  ],
  referenciaA1A3: f(300),
}

const fatores: FatoresCalculo = { caminhao: f(0.1), retornoVazio: f(1.5), escavacao: f(2), densidadeSolo: f(1.8) }

const rota = (pontoId: string, distanciaKm: number, estimada = false): Rota => ({ pontoId, distanciaKm, geometria: null, estimada })

// Caso conferido à mão (o mesmo da tabela do README):
// área 1.000 m², volume de terra 200 m³
// concreto vem de 20 km; aço não tem fornecedor e usa o geral, a 10 km; resíduos vão a 15 km.
const rotas = { concreto: rota('c', 20), geral: rota('g', 10), residuos: rota('r', 15) }
const edificio = { areaConstruidaM2: 1000, volumeTerraM3: 200 }

describe('fórmulas', () => {
  it('massa = área × intensidade ÷ 1000', () => {
    expect(massaMaterialT(1000, 1000)).toBe(1000)
  })
  it('transporte = massa × km × caminhão × retorno', () => {
    expect(emissaoTransporte(1000, 20, 0.1, 1.5)).toBeCloseTo(3000, 9)
  })
})

describe('caso conferido à mão', () => {
  const r = calcularSistema(sistema, edificio, rotas, fatores)

  it('A4: concreto 1000 t × 20 km × 0,1 × 1,5 = 3000; aço 50 t × 10 km × 0,1 × 1,5 = 75', () => {
    const a4 = r.detalhamento.filter((d) => d.modulo === 'A4')
    expect(a4[0].kgCO2e).toBeCloseTo(3000, 9)
    expect(a4[1].kgCO2e).toBeCloseTo(75, 9)
    expect(r.a4KgCO2e).toBeCloseTo(3075, 9)
  })

  it('A5 resíduos: (50 t + 5 t) × 15 km × 0,1 × 1,5 = 123,75', () => {
    expect(r.a5ResiduosKgCO2e).toBeCloseTo(123.75, 9)
  })

  it('A5 terra: 200 m³ × 2 + 200 × 1,8 t × 15 km × 0,1 × 1,5 = 400 + 810 = 1210', () => {
    expect(r.a5TerraKgCO2e).toBeCloseTo(1210, 9)
  })

  it('A5 = 123,75 + 1210 = 1333,75', () => {
    expect(r.a5KgCO2e).toBeCloseTo(1333.75, 9)
  })

  it('referência A1–A3 = 300 × 1000 m² = 300.000, sem cálculo', () => {
    expect(r.referenciaA1A3KgCO2e).toBe(300_000)
  })

  it('avisa que o aço usou o fornecedor geral', () => {
    expect(r.detalhamento[2].substituicao).toBe(true)
    expect(r.avisos.join(' ')).toMatch(/Aço: usado o fornecedor geral/)
    expect(r.pendencias).toEqual([])
  })
})

describe('casos especiais', () => {
  it('categoria sem fornecedor e sem reserva fica pendente e fora da soma', () => {
    const r = calcularSistema(sistema, edificio, { concreto: rota('c', 20), residuos: rota('r', 15) }, fatores)
    expect(r.detalhamento[2].kgCO2e).toBeNull()
    expect(r.a4KgCO2e).toBeCloseTo(3000, 9)
    expect(r.pendencias).toContain('Aço: nenhum fornecedor ativo no raio.')
  })

  it('agregados não usam o fornecedor geral como reserva', () => {
    const comAgregado: Sistema = {
      ...sistema,
      materiais: [{ id: 'areia', nome: 'Areia', categoria: 'agregados', intensidade: f(100), perda: f(0.1) }],
    }
    const r = calcularSistema(comAgregado, edificio, { geral: rota('g', 5), residuos: rota('r', 15) }, fatores)
    expect(r.a4KgCO2e).toBeNull()
    expect(r.pendencias).toContain('Areia: nenhum fornecedor ativo no raio.')
  })

  it('distância estimada entra no cálculo com aviso', () => {
    const r = calcularSistema(sistema, edificio, { ...rotas, concreto: rota('c', 20, true) }, fatores)
    expect(r.a4KgCO2e).toBeCloseTo(3075, 9)
    expect(r.detalhamento[0].estimada).toBe(true)
    expect(r.avisos).toContain('Concreto: distância estimada (linha reta × tortuosidade).')
  })

  it('volume de terra zero: A5 terra = 0, sem pendência', () => {
    const r = calcularSistema(sistema, { areaConstruidaM2: 1000, volumeTerraM3: 0 }, rotas, fatores)
    expect(r.a5TerraKgCO2e).toBe(0)
    expect(r.a5KgCO2e).toBeCloseTo(123.75, 9)
    expect(r.detalhamento.some((d) => d.modulo === 'A5 terra')).toBe(false)
  })

  it('sem destino de resíduos: transporte do A5 pendente', () => {
    const r = calcularSistema(sistema, edificio, { concreto: rota('c', 20), geral: rota('g', 10) }, fatores)
    expect(r.a5ResiduosKgCO2e).toBeNull()
    expect(r.a5TerraKgCO2e).toBeNull()
    expect(r.a5KgCO2e).toBeNull()
    expect(r.pendencias).toContain('Nenhum destino de resíduos ativo: o transporte do A5 fica pendente.')
  })

  it('fator sem fonte (valor null) deixa a parcela pendente em vez de estimar', () => {
    const r = calcularSistema(sistema, edificio, rotas, { ...fatores, escavacao: f(null) })
    expect(r.a5TerraKgCO2e).toBeNull()
    expect(r.a5ResiduosKgCO2e).toBeCloseTo(123.75, 9)
    expect(r.pendencias).toContain('Movimento de terra: fator de escavação sem fonte.')
  })

  it('massa por m² sem fonte deixa o material pendente', () => {
    const semAco: Sistema = { ...sistema, materiais: [{ ...sistema.materiais[1], intensidade: f(null) }] }
    const r = calcularSistema(semAco, edificio, rotas, fatores)
    expect(r.a4KgCO2e).toBeNull()
    expect(r.pendencias).toContain('Aço: massa por m² sem fonte.')
  })

  it('área zero dá zero, não erro', () => {
    const r = calcularSistema(sistema, { areaConstruidaM2: 0, volumeTerraM3: 0 }, rotas, fatores)
    expect(r.a4KgCO2e).toBe(0)
    expect(r.a5KgCO2e).toBe(0)
  })
})

describe('fatoresNaoVerificados', () => {
  it('lista só os fatores em uso ainda não conferidos', () => {
    const lista = fatoresNaoVerificados({ caminhao: f(0.1), retornoVazio: f(1.5, true), escavacao: f(null) }, [sistema])
    expect(lista).toContain('caminhao')
    expect(lista).not.toContain('retornoVazio')
    expect(lista).not.toContain('escavacao')
    expect(lista).toContain('Concreto: referência A1–A3')
  })
})

describe('caso conferido à mão com os dados reais (tabela do README)', async () => {
  const { SISTEMAS } = await import('./sistemas')
  const { FATORES } = await import('../compartilhado/fatores')
  const concreto = SISTEMAS.find((s) => s.id === 'concreto')!
  const r = calcularSistema(concreto, edificio, { concreto: rota('c', 20), geral: rota('g', 10), residuos: rota('r', 15) }, FATORES)

  it('A4 = 528 t × 20 km × 0,0592 × 2 + 20,9 t × 10 km × 0,0592 × 2 = 1.275,05', () => {
    expect(r.a4KgCO2e).toBeCloseTo(1275.0496, 6)
  })
  it('A5 = resíduos 48,74 + terra (200 × 3,5 + 200 × 1,84 × 15 × 0,0592 × 2) 1.353,57 = 1.402,31', () => {
    expect(r.a5ResiduosKgCO2e).toBeCloseTo(48.74232, 6)
    expect(r.a5TerraKgCO2e).toBeCloseTo(1353.568, 6)
    expect(r.a5KgCO2e).toBeCloseTo(1402.31032, 6)
  })
  it('referência A1–A3 = 81 × 1.000 m² = 81.000', () => {
    expect(r.referenciaA1A3KgCO2e).toBe(81_000)
  })
})
