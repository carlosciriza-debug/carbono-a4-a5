import { describe, expect, it } from 'vitest'
import { alturaContexto } from './alturaContexto'

describe('altura de contexto 3D', () => {
  it('prefere altura explicitamente informada', () => {
    expect(alturaContexto({ height: '21', render_height: 18 }, 3)).toEqual({ metros: 21, tipo: 'informada' })
  })
  it('não apresenta altura de renderização como real', () => {
    expect(alturaContexto({ render_height: 12 }, 3)).toEqual({ metros: 12, tipo: 'estimada' })
  })
  it('usa o fator padrão quando faltam dados ou o valor é ambíguo', () => {
    expect(alturaContexto({}, 3)).toEqual({ metros: 3, tipo: 'padrao' })
    expect(alturaContexto({ render_height: 5 }, 3)).toEqual({ metros: 3, tipo: 'padrao' })
  })
  it('não inventa altura quando o fator também falta', () => {
    expect(alturaContexto({ height: -1, render_height: 'inválida' }, null)).toEqual({ metros: null, tipo: 'pendente' })
  })
})
