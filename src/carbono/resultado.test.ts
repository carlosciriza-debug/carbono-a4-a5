import { describe, expect, it } from 'vitest'
import { FATORES } from '../compartilhado/fatores'
import type { ResultadoSistema } from '../compartilhado/terreno'
import { emUnidade, formatarCarbono, montarPremissas, pesoPorPonto, totalA4A5 } from './resultado'
import { SISTEMAS } from './sistemas'

const resultado: ResultadoSistema = {
  a4KgCO2e: 100,
  a5KgCO2e: 50,
  a5ResiduosKgCO2e: 50,
  a5TerraKgCO2e: 0,
  referenciaA1A3KgCO2e: 1000,
  detalhamento: [
    { modulo: 'A4', material: 'Concreto', categoria: 'concreto', massaT: 1, pontoId: 'c', distanciaKm: 1, estimada: false, substituicao: false, kgCO2e: 80 },
    { modulo: 'A4', material: 'Aço', categoria: 'aco', massaT: 1, pontoId: 'g', distanciaKm: 1, estimada: false, substituicao: true, kgCO2e: 20 },
    { modulo: 'A5 resíduos', material: 'Concreto', categoria: 'residuos', massaT: 1, pontoId: 'r', distanciaKm: 1, estimada: false, substituicao: false, kgCO2e: 40 },
    { modulo: 'A5 resíduos', material: 'Aço', categoria: 'residuos', massaT: 1, pontoId: 'r', distanciaKm: 1, estimada: false, substituicao: false, kgCO2e: 10 },
  ],
  pendencias: [],
  avisos: [],
}

describe('resultado', () => {
  it('soma A4 e A5', () => {
    expect(totalA4A5(resultado)).toBe(150)
    expect(totalA4A5({ ...resultado, a4KgCO2e: null, a5KgCO2e: null })).toBeNull()
  })

  it('soma o peso de cada rota (o destino de resíduos junta os dois materiais)', () => {
    const pesos = pesoPorPonto(resultado)
    expect(pesos.get('c')).toBe(80)
    expect(pesos.get('r')).toBe(50)
  })

  it('converte para kgCO2e/m² e não divide por zero', () => {
    expect(emUnidade(1500, 'porM2', 1000)).toBe(1.5)
    expect(emUnidade(1500, 'porM2', 0)).toBe(0)
    expect(formatarCarbono(1275.0496, 'total')).toBe('1.275 kgCO₂e')
    expect(formatarCarbono(1.2750496, 'porM2')).toBe('1,28 kgCO₂e/m²')
    expect(formatarCarbono(0.47, 'total')).toBe('0,5 kgCO₂e')
  })
})

describe('montarPremissas', () => {
  it('lista fontes, marca o não verificado e as pendências', () => {
    const lista = montarPremissas(SISTEMAS, [resultado, { ...resultado, pendencias: ['Aço (lajes): massa por m² sem fonte.'] }, resultado], FATORES, {}, 0)
    const textos = lista.map((p) => p.texto).join('\n')
    expect(textos).toContain('Caminhão: 0,0592 kgCO2 por t·km — BNDES / EPL-Iema (2024) (não verificado)')
    expect(textos).toContain('Concreto armado — referência A1–A3: 81 kgCO2/m² — Belizário-Silva et al. (2024)')
    expect(lista.some((p) => p.tipo === 'pendente' && p.texto.startsWith('Aço: '))).toBe(true)
    expect(textos).toContain('energia do canteiro')
    expect(textos).toContain('Madeira: referência de A1–A3 sem fonte brasileira.')
    expect(textos).not.toContain('Tortuosidade')
    expect(textos).not.toContain('Escavação')
  })

  it('cita a tortuosidade quando há distância estimada, e os fatores de terra quando há volume', () => {
    const rota = { pontoId: 'c', distanciaKm: 5, geometria: null, estimada: true }
    const textos = montarPremissas(SISTEMAS, [resultado, resultado, resultado], FATORES, { concreto: rota }, 100)
      .map((p) => p.texto)
      .join('\n')
    expect(textos).toContain('Tortuosidade: 1,23')
    expect(textos).toContain('Concreto e cimento: distância estimada')
    expect(textos).toContain('Escavação: 3,5')
    expect(textos).toContain('Densidade do solo: 1,84')
  })
})
