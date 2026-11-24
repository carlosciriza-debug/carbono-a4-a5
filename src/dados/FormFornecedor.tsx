import { type FormEvent, useState } from 'react'
import { CATEGORIAS } from '../compartilhado/categorias'
import type { IdCategoria } from '../compartilhado/terreno'

type Props = {
  titulo: string
  nomeInicial?: string
  categoriaInicial?: IdCategoria
  aoSalvar: (nome: string, categoria: IdCategoria) => void
  aoCancelar: () => void
}

export function FormFornecedor({ titulo, nomeInicial = '', categoriaInicial = 'concreto', aoSalvar, aoCancelar }: Props) {
  const [nome, setNome] = useState(nomeInicial)
  const [categoria, setCategoria] = useState<IdCategoria>(categoriaInicial)

  function salvar(e: FormEvent) {
    e.preventDefault()
    if (nome.trim()) aoSalvar(nome, categoria)
  }

  return (
    <form className="form-fornecedor" onSubmit={salvar}>
      <p className="titulo-form">{titulo}</p>
      <label htmlFor="nome-fornecedor">Nome</label>
      <input
        id="nome-fornecedor"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Ex.: Concreteira Santa Rita"
        autoFocus
      />
      <label htmlFor="categoria-fornecedor">Categoria</label>
      <select id="categoria-fornecedor" value={categoria} onChange={(e) => setCategoria(e.target.value as IdCategoria)}>
        {CATEGORIAS.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
      <div className="linha acoes">
        <button type="submit" disabled={!nome.trim()}>
          Salvar
        </button>
        <button type="button" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
