import { describe, expect, it } from 'vitest'
import { INSTRUCAO_INICIAL, NOME_APP } from './app'

describe('textos da aplicação', () => {
  it('tem nome e instrução inicial', () => {
    expect(NOME_APP).toBe('Terreno Carbono A4–A5')
    expect(INSTRUCAO_INICIAL).toContain('desenhe o lote')
  })
})
