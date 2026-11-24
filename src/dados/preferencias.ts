import type { Position } from 'geojson'
import { CATEGORIAS } from '../compartilhado/categorias'
import type { IdCategoria, Ponto } from '../compartilhado/terreno'

// O que o usuário muda na lista de fornecedores: pontos desligados e
// fornecedores próprios. Fica salvo no navegador e pode ir e voltar como JSON.

export type Preferencias = {
  desligados: string[]
  proprios: Ponto[]
}

export const PREFERENCIAS_VAZIAS: Preferencias = { desligados: [], proprios: [] }

const CHAVE = 'carbono-a4-a5:fornecedores:v1'
const IDS_CATEGORIAS = new Set<string>(CATEGORIAS.map((c) => c.id))

export class ErroArquivo extends Error {}

function coordenadaValida(c: unknown): c is Position {
  return (
    Array.isArray(c) &&
    c.length === 2 &&
    c.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
    Math.abs(c[0]) <= 180 &&
    Math.abs(c[1]) <= 90
  )
}

function pontoProprioValido(p: unknown): p is Ponto {
  if (typeof p !== 'object' || p === null) return false
  const q = p as Record<string, unknown>
  return (
    typeof q.id === 'string' &&
    q.id.startsWith('usuario/') &&
    typeof q.nome === 'string' &&
    q.nome.trim() !== '' &&
    typeof q.categoria === 'string' &&
    IDS_CATEGORIAS.has(q.categoria) &&
    coordenadaValida(q.coordenadas)
  )
}

export function validarPreferencias(dados: unknown): Preferencias {
  if (typeof dados !== 'object' || dados === null) {
    throw new ErroArquivo('O arquivo não está no formato esperado.')
  }
  const { desligados, proprios } = dados as Record<string, unknown>
  if (!Array.isArray(desligados) || !desligados.every((d) => typeof d === 'string')) {
    throw new ErroArquivo('O arquivo não tem uma lista válida de pontos desligados.')
  }
  if (!Array.isArray(proprios) || !proprios.every(pontoProprioValido)) {
    throw new ErroArquivo('O arquivo tem fornecedores próprios incompletos ou inválidos.')
  }
  return {
    desligados: [...new Set(desligados)],
    proprios: proprios.map((p) => ({ ...p, nome: p.nome!.trim(), origem: 'usuario', ativo: true })),
  }
}

export function carregarPreferencias(armazenamento: Storage | undefined = globalThis.localStorage): Preferencias {
  try {
    const texto = armazenamento?.getItem(CHAVE)
    return texto ? validarPreferencias(JSON.parse(texto)) : PREFERENCIAS_VAZIAS
  } catch {
    // Sem acesso ao armazenamento ou conteúdo corrompido: começa do zero.
    return PREFERENCIAS_VAZIAS
  }
}

/** Devolve false se o navegador não deixou salvar (modo privado, cota cheia etc.). */
export function salvarPreferencias(p: Preferencias, armazenamento: Storage | undefined = globalThis.localStorage): boolean {
  try {
    if (!armazenamento) return false
    armazenamento.setItem(CHAVE, JSON.stringify(p))
    return true
  } catch {
    return false
  }
}

export function exportarPreferencias(p: Preferencias, agora = new Date()): string {
  return JSON.stringify(
    { aplicacao: 'carbono-a4-a5', versao: 1, exportadoEm: agora.toISOString(), ...p },
    null,
    2,
  )
}

export function importarPreferencias(texto: string, atuais: Preferencias): Preferencias {
  let dados: unknown
  try {
    dados = JSON.parse(texto)
  } catch {
    throw new ErroArquivo('O arquivo não é um JSON válido.')
  }
  const novas = validarPreferencias(dados)
  // Junta com o que já existe; um fornecedor com o mesmo id é substituído pelo do arquivo.
  const idsNovos = new Set(novas.proprios.map((p) => p.id))
  return {
    desligados: [...new Set([...atuais.desligados, ...novas.desligados])],
    proprios: [...atuais.proprios.filter((p) => !idsNovos.has(p.id)), ...novas.proprios],
  }
}

export function novoFornecedor(nome: string, categoria: IdCategoria, coordenadas: Position): Ponto {
  return {
    id: `usuario/${crypto.randomUUID()}`,
    nome: nome.trim(),
    categoria,
    coordenadas: coordenadas.map((n) => Number(n.toFixed(6))),
    origem: 'usuario',
    ativo: true,
  }
}

export function alternarDesligado(p: Preferencias, id: string): Preferencias {
  const desligados = p.desligados.includes(id) ? p.desligados.filter((d) => d !== id) : [...p.desligados, id]
  return { ...p, desligados }
}
