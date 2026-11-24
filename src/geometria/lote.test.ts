import type { Feature, Polygon } from 'geojson'
import { describe, expect, it } from 'vitest'
import { calcularLote, formatarArea, formatarCoordenadas } from './lote'

// Quadrado de 0,001° × 0,001° no Rio de Janeiro (latitude ≈ -22,9°).
// Lado norte-sul ≈ 110,7 m; lado leste-oeste ≈ 111,3 × cos(22,9°) ≈ 102,6 m.
// Área esperada ≈ 11 360 m².
const quadrado: Feature<Polygon> = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-43.18, -22.9],
        [-43.179, -22.9],
        [-43.179, -22.901],
        [-43.18, -22.901],
        [-43.18, -22.9],
      ],
    ],
  },
}

describe('calcularLote', () => {
  it('calcula a área em m² de um lote conhecido', () => {
    const { areaM2 } = calcularLote(quadrado)
    expect(areaM2).toBeGreaterThan(11_360 * 0.99)
    expect(areaM2).toBeLessThan(11_360 * 1.01)
  })

  it('calcula o centro do lote', () => {
    const { centro } = calcularLote(quadrado)
    expect(centro[0]).toBeCloseTo(-43.1795, 6)
    expect(centro[1]).toBeCloseTo(-22.9005, 6)
  })
})

describe('formatação', () => {
  it('mostra a área com unidade', () => {
    expect(formatarArea(11359.6)).toBe('11.360 m²')
  })

  it('mostra latitude antes da longitude', () => {
    expect(formatarCoordenadas([-43.1795, -22.9005])).toBe('-22.90050, -43.17950')
  })
})
