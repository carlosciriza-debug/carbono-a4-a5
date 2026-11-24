import { describe, expect, it } from 'vitest'
import { CATEGORIAS } from '../compartilhado/categorias'
import type { Fator } from '../compartilhado/fatores'
import fatores from '../dados-fixos/fatores.json'
import { SISTEMAS } from './sistemas'

// Regra das fontes (SPEC, seção 7): todo valor tem os campos obrigatórios
// e nenhum valor sem fonte entra como número.

function conferir(nome: string, f: Fator) {
  it(`${nome} tem os campos obrigatórios`, () => {
    expect(typeof f.unidade).toBe('string')
    expect(f.fonte.length).toBeGreaterThan(10)
    expect(typeof f.url).toBe('string')
    expect(typeof f.verificado).toBe('boolean')
    expect(f.valor === null || (typeof f.valor === 'number' && f.valor >= 0)).toBe(true)
  })
  if (f.valor !== null) {
    it(`${nome} tem URL e ano, porque tem valor`, () => {
      expect(f.url).toMatch(/^https:\/\//)
      expect(f.ano).toBeGreaterThan(1900)
      expect(f.fonte).not.toMatch(/^Pendente/)
    })
  }
}

describe('fatores.json', () => {
  for (const [nome, f] of Object.entries(fatores).filter(([k]) => !k.startsWith('_'))) conferir(nome, f as Fator)
})

describe('sistemas.json', () => {
  const categorias = new Set(CATEGORIAS.map((c) => c.id))

  it('tem os três sistemas da SPEC', () => {
    expect(SISTEMAS.map((s) => s.id)).toEqual(['concreto', 'aco', 'madeira'])
  })

  for (const s of SISTEMAS) {
    conferir(`${s.nome} / referência A1–A3`, s.referenciaA1A3)
    for (const m of s.materiais) {
      it(`${s.nome} / ${m.nome} usa uma categoria de fornecedor existente`, () => {
        expect(categorias.has(m.categoria)).toBe(true)
      })
      conferir(`${s.nome} / ${m.nome} (kg/m²)`, m.intensidade)
      conferir(`${s.nome} / ${m.nome} (perda)`, m.perda)
      it(`${s.nome} / ${m.nome}: perda é uma fração entre 0 e 1`, () => {
        if (m.perda.valor !== null) expect(m.perda.valor).toBeLessThan(1)
      })
    }
  }
})
