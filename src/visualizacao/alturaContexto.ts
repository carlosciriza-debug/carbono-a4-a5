/** Alturas da cartografia não equivalem a uma medição de campo. */
export type TipoAltura = 'informada' | 'estimada' | 'padrao' | 'pendente'
export type AlturaContexto = { metros: number | null; tipo: TipoAltura }

function positivo(v: unknown): number | null {
  if (typeof v !== 'number' && typeof v !== 'string') return null
  if (typeof v === 'string' && v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** OpenMapTiles pode gerar render_height a partir de pavimentos ou de um fallback de 5 m.
 *  Esse campo não permite confirmar a proveniência da altura. Nunca o chamar de real.
 *  5 m é ambíguo: tratar como fallback conservador, não como altura confirmada.
 */
export function alturaContexto(p: Record<string, unknown>, padrao: number | null): AlturaContexto {
  const direta = positivo(p.height)
  if (direta !== null) return { metros: direta, tipo: 'informada' }
  const render = positivo(p.render_height)
  if (render !== null && render !== 5) return { metros: render, tipo: 'estimada' }
  const valor = positivo(padrao)
  return { metros: valor, tipo: valor === null ? 'pendente' : 'padrao' }
}
