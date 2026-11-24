import { describe, expect, it } from 'vitest'
import { calcularLote } from '../geometria/lote'
import exemplo from './terreno-exemplo.json'
import type { Terreno } from './terreno'

const terreno = exemplo as unknown as Terreno

describe('terreno de exemplo', () => {
  it('tem área e centro coerentes com o polígono', () => {
    const calculado = calcularLote(terreno.lote!.poligono)
    expect(terreno.lote!.areaM2).toBeCloseTo(calculado.areaM2, 0)
    expect(terreno.lote!.centro[0]).toBeCloseTo(calculado.centro[0], 5)
    expect(terreno.lote!.centro[1]).toBeCloseTo(calculado.centro[1], 5)
  })

  it('tem pontos do OpenStreetMap, ativos, em categorias conhecidas', () => {
    expect(terreno.pontos.length).toBeGreaterThan(0)
    for (const p of terreno.pontos) {
      expect(p.origem).toBe('osm')
      expect(p.ativo).toBe(true)
      expect(['concreto', 'aco', 'madeira', 'agregados', 'geral', 'residuos']).toContain(p.categoria)
    }
  })
})
