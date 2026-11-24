import { describe, expect, it } from 'vitest'
import {
  alternarDesligado,
  carregarPreferencias,
  ErroArquivo,
  exportarPreferencias,
  importarPreferencias,
  novoFornecedor,
  PREFERENCIAS_VAZIAS,
  salvarPreferencias,
  validarPreferencias,
} from './preferencias'

function armazenamentoFalso(): Storage {
  const dados = new Map<string, string>()
  return {
    getItem: (k) => dados.get(k) ?? null,
    setItem: (k, v) => void dados.set(k, v),
    removeItem: (k) => void dados.delete(k),
    clear: () => dados.clear(),
    key: () => null,
    get length() {
      return dados.size
    },
  }
}

const armazenamentoQuebrado = {
  getItem: () => {
    throw new Error('bloqueado')
  },
  setItem: () => {
    throw new Error('cota cheia')
  },
} as unknown as Storage

const concreteira = novoFornecedor('  Concreteira Exemplo  ', 'concreto', [-43.2, -22.9])

describe('novoFornecedor', () => {
  it('cria um ponto do usuário, ativo, com nome sem espaços nas pontas', () => {
    expect(concreteira.id).toMatch(/^usuario\//)
    expect(concreteira.nome).toBe('Concreteira Exemplo')
    expect(concreteira.origem).toBe('usuario')
    expect(concreteira.ativo).toBe(true)
  })
})

describe('salvar e carregar', () => {
  it('o que foi salvo volta igual depois de recarregar', () => {
    const armazenamento = armazenamentoFalso()
    const p = { desligados: ['node/1'], proprios: [concreteira] }
    expect(salvarPreferencias(p, armazenamento)).toBe(true)
    expect(carregarPreferencias(armazenamento)).toEqual(p)
  })

  it('não quebra quando o navegador bloqueia o armazenamento', () => {
    expect(carregarPreferencias(armazenamentoQuebrado)).toEqual(PREFERENCIAS_VAZIAS)
    expect(salvarPreferencias(PREFERENCIAS_VAZIAS, armazenamentoQuebrado)).toBe(false)
  })

  it('ignora conteúdo corrompido', () => {
    const armazenamento = armazenamentoFalso()
    armazenamento.setItem('carbono-a4-a5:fornecedores:v1', '{isso não é json')
    expect(carregarPreferencias(armazenamento)).toEqual(PREFERENCIAS_VAZIAS)
  })
})

describe('alternarDesligado', () => {
  it('desliga e liga de novo', () => {
    const desligado = alternarDesligado(PREFERENCIAS_VAZIAS, 'node/1')
    expect(desligado.desligados).toEqual(['node/1'])
    expect(alternarDesligado(desligado, 'node/1').desligados).toEqual([])
  })
})

describe('exportar e importar', () => {
  it('um arquivo exportado é importado de volta', () => {
    const p = { desligados: ['way/7'], proprios: [concreteira] }
    expect(importarPreferencias(exportarPreferencias(p), PREFERENCIAS_VAZIAS)).toEqual(p)
  })

  it('junta com o que já existe sem duplicar', () => {
    const atuais = { desligados: ['node/1'], proprios: [concreteira] }
    const outro = novoFornecedor('Usina de Aço', 'aco', [-43.5, -22.5])
    const arquivo = exportarPreferencias({ desligados: ['node/1', 'node/2'], proprios: [concreteira, outro] })
    const r = importarPreferencias(arquivo, atuais)
    expect(r.desligados).toEqual(['node/1', 'node/2'])
    expect(r.proprios.map((p) => p.nome)).toEqual(['Concreteira Exemplo', 'Usina de Aço'])
  })

  it('recusa arquivo que não é JSON', () => {
    expect(() => importarPreferencias('abc', PREFERENCIAS_VAZIAS)).toThrow(ErroArquivo)
  })

  it('recusa fornecedor com categoria desconhecida ou sem nome', () => {
    const ruim = { ...concreteira, categoria: 'vidro' }
    expect(() => validarPreferencias({ desligados: [], proprios: [ruim] })).toThrow(ErroArquivo)
    const semNome = { ...concreteira, nome: ' ' }
    expect(() => validarPreferencias({ desligados: [], proprios: [semNome] })).toThrow(ErroArquivo)
  })

  it('recusa coordenadas fora do mundo', () => {
    const fora = { ...concreteira, coordenadas: [-43, 95] }
    expect(() => validarPreferencias({ desligados: [], proprios: [fora] })).toThrow(ErroArquivo)
  })
})
