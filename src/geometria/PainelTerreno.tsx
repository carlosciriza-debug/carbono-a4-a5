import { type FormEvent, useState } from 'react'
import { buscarEndereco, ErroBusca, type ResultadoBusca } from './busca'
import { formatarArea, formatarCoordenadas, type Lote } from './lote'

type Props = {
  lote: Lote | null
  desenhando: boolean
  aoEscolherEndereco: (resultado: ResultadoBusca) => void
  aoDesenhar: () => void
  aoApagar: () => void
}

export function PainelTerreno({ lote, desenhando, aoEscolherEndereco, aoDesenhar, aoApagar }: Props) {
  const [texto, setTexto] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultados, setResultados] = useState<ResultadoBusca[]>([])
  const [escolhido, setEscolhido] = useState<ResultadoBusca | null>(null)

  async function buscar(evento: FormEvent) {
    evento.preventDefault()
    if (buscando || !texto.trim()) return
    setBuscando(true)
    setErro(null)
    try {
      const encontrados = await buscarEndereco(texto)
      setResultados(encontrados)
      if (encontrados.length === 0) {
        setErro('Nenhum endereço encontrado. Tente incluir a cidade ou o estado.')
      } else {
        escolher(encontrados[0])
      }
    } catch (e) {
      setErro(e instanceof ErroBusca ? e.message : 'Erro inesperado na busca. Tente de novo.')
    } finally {
      setBuscando(false)
    }
  }

  function escolher(resultado: ResultadoBusca) {
    setEscolhido(resultado)
    aoEscolherEndereco(resultado)
  }

  return (
    <section className="secao">
      <h2>Terreno</h2>

      <form className="busca" onSubmit={buscar}>
        <label htmlFor="endereco">Endereço</label>
        <div className="linha">
          <input
            id="endereco"
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Rua, número, cidade"
            autoComplete="off"
          />
          <button type="submit" disabled={buscando || !texto.trim()}>
            {buscando ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
      </form>

      {erro && <p className="erro">{erro}</p>}

      {resultados.length > 1 && (
        <ul className="resultados">
          {resultados.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                className={r === escolhido ? 'resultado ativo' : 'resultado'}
                onClick={() => escolher(r)}
              >
                {r.nome}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="linha acoes">
        <button type="button" onClick={aoDesenhar} disabled={desenhando}>
          {lote ? 'Redesenhar lote' : 'Desenhar lote'}
        </button>
        <button type="button" onClick={aoApagar} disabled={!lote && !desenhando}>
          {desenhando ? 'Cancelar' : 'Apagar lote'}
        </button>
      </div>

      {desenhando && (
        <p className="dica">
          Clique no mapa para marcar cada vértice. Para fechar o lote, clique no primeiro vértice.
        </p>
      )}

      {lote && (
        <>
          <dl className="medidas">
            <dt>Área do lote</dt>
            <dd>{formatarArea(lote.areaM2)}</dd>
            <dt>Centro (lat, lon)</dt>
            <dd>{formatarCoordenadas(lote.centro)}</dd>
          </dl>
          <p className="dica">
            Para editar, arraste os vértices ou os pontos do meio das arestas. Para mover, arraste o lote.
          </p>
        </>
      )}

      <p className="fonte">Busca: Nominatim · © colaboradores do OpenStreetMap</p>
    </section>
  )
}
