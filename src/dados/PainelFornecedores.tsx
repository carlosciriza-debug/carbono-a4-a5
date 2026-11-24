import { type ChangeEvent, useRef, useState } from 'react'
import { type Categoria, CATEGORIAS } from '../compartilhado/categorias'
import type { IdCategoria, Rota } from '../compartilhado/terreno'
import type { EstadoRotas } from './useRotas'
import { FormFornecedor } from './FormFornecedor'
import { CANDIDATOS_POR_CATEGORIA } from './rotas'
import { agruparPorCategoria, mensagemSemPontos, type PontoComDistancia, RAIOS_KM } from './fornecedores'

export type EstadoBase =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'pronta'; extraidoEm: string }

export type EstadoAdicao = null | { etapa: 'local' } | { etapa: 'dados' }

type Props = {
  temLote: boolean
  raioKm: number
  aoMudarRaio: (raioKm: number) => void
  estado: EstadoBase
  aoTentarDeNovo: () => void
  pontos: PontoComDistancia[]
  rotas: Partial<Record<IdCategoria, Rota>>
  estadoRotas: EstadoRotas
  aoTentarRotasDeNovo: () => void
  aoAlternar: (id: string) => void
  aoEditar: (id: string, nome: string, categoria: IdCategoria) => void
  aoRemover: (id: string) => void
  adicao: EstadoAdicao
  aoIniciarAdicao: () => void
  aoCancelarAdicao: () => void
  aoSalvarNovo: (nome: string, categoria: IdCategoria) => void
  aoExportar: () => void
  aoImportar: (texto: string) => void
  mensagemArquivo: { tipo: 'ok' | 'erro'; texto: string } | null
  salvouNoNavegador: boolean
}

const LIMITE_POR_CATEGORIA = 10

function formatarKm(km: number): string {
  return `${km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
}

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

type ListaProps = Pick<Props, 'aoAlternar' | 'aoEditar' | 'aoRemover' | 'raioKm'> & {
  categoria: Categoria
  lista: PontoComDistancia[]
  rota: Rota | undefined
  calculando: boolean
}

function ListaCategoria({ categoria: c, lista, rota, calculando, raioKm, aoAlternar, aoEditar, aoRemover }: ListaProps) {
  const [todos, setTodos] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const ativos = lista.filter((p) => p.ativo).length
  const visiveis = todos ? lista : lista.slice(0, LIMITE_POR_CATEGORIA)

  return (
    <div className="categoria">
      <h3>
        <span className="marcador" style={{ background: c.cor }}>
          {c.letra}
        </span>
        {c.nome}
        <span className="contagem" title="ativos / encontrados">
          {ativos} / {lista.length}
        </span>
      </h3>

      {rota && (
        <p className={rota.estimada ? 'rota estimada' : 'rota'}>
          Rota: {lista.find((p) => p.id === rota.pontoId)?.nome ?? 'Sem nome'} ·{' '}
          <strong>
            {rota.estimada ? '≈ ' : ''}
            {formatarKm(rota.distanciaKm)}
          </strong>{' '}
          {rota.estimada ? '(estimado: linha reta × tortuosidade)' : 'por estrada'}
        </p>
      )}
      {!rota && ativos > 0 && calculando && <p className="dica rota">Calculando rota…</p>}

      {lista.length === 0 && <p className="aviso">{mensagemSemPontos(c.nome, raioKm)}</p>}
      {lista.length > 0 && ativos === 0 && (
        <p className="aviso">Todos os pontos desta categoria estão desligados. Ligue algum ou adicione um no mapa.</p>
      )}

      {lista.length > 0 && (
        <ul className="pontos">
          {visiveis.map((p) =>
            editando === p.id ? (
              <li key={p.id}>
                <FormFornecedor
                  titulo="Editar fornecedor"
                  nomeInicial={p.nome ?? ''}
                  categoriaInicial={p.categoria}
                  aoSalvar={(nome, categoria) => {
                    aoEditar(p.id, nome, categoria)
                    setEditando(null)
                  }}
                  aoCancelar={() => setEditando(null)}
                />
              </li>
            ) : (
              <li key={p.id} className={p.ativo ? '' : 'desligado'}>
                <label className="ponto">
                  <input type="checkbox" checked={p.ativo} onChange={() => aoAlternar(p.id)} />
                  <span className={p.nome ? '' : 'sem-nome'}>{p.nome ?? 'Sem nome'}</span>
                  {rota?.pontoId === p.id && <span className="selo escolhido">rota</span>}
                  {p.origem === 'usuario' && <span className="selo">próprio</span>}
                </label>
                <span className="distancia">{formatarKm(p.distanciaRetaKm)}</span>
                {p.origem === 'usuario' && (
                  <span className="acoes-ponto">
                    <button type="button" className="link" onClick={() => setEditando(p.id)}>
                      editar
                    </button>
                    <button type="button" className="link" onClick={() => aoRemover(p.id)}>
                      remover
                    </button>
                  </span>
                )}
              </li>
            ),
          )}
          {lista.length > LIMITE_POR_CATEGORIA && (
            <li>
              <button type="button" className="link" onClick={() => setTodos(!todos)}>
                {todos ? 'Mostrar menos' : `Mostrar todos (${lista.length})`}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

export function PainelFornecedores(props: Props) {
  const { temLote, raioKm, aoMudarRaio, estado, aoTentarDeNovo, pontos, adicao, mensagemArquivo } = props
  const grupos = agruparPorCategoria(pontos)
  const arquivo = useRef<HTMLInputElement>(null)

  async function lerArquivo(e: ChangeEvent<HTMLInputElement>) {
    const escolhido = e.target.files?.[0]
    e.target.value = ''
    if (escolhido) props.aoImportar(await escolhido.text())
  }

  return (
    <section className="secao">
      <h2>Fornecedores</h2>

      <label htmlFor="raio">Raio de busca a partir do centro do lote</label>
      <select id="raio" value={raioKm} onChange={(e) => aoMudarRaio(Number(e.target.value))}>
        {RAIOS_KM.map((r) => (
          <option key={r} value={r}>
            {r} km
          </option>
        ))}
      </select>

      {estado.tipo === 'carregando' && <p className="dica">Carregando a base de fornecedores…</p>}

      {estado.tipo === 'erro' && (
        <div className="erro">
          <p>{estado.mensagem}</p>
          <button type="button" onClick={aoTentarDeNovo}>
            Tentar de novo
          </button>
        </div>
      )}

      {estado.tipo === 'pronta' && !temLote && <p className="pendente">Desenhe o lote para ver os fornecedores.</p>}

      {estado.tipo === 'pronta' && temLote && (
        <>
          <div className="adicionar">
            {adicao === null && (
              <button type="button" onClick={props.aoIniciarAdicao}>
                Adicionar fornecedor no mapa
              </button>
            )}
            {adicao?.etapa === 'local' && (
              <>
                <p className="dica">Clique no mapa onde fica o fornecedor.</p>
                <button type="button" onClick={props.aoCancelarAdicao}>
                  Cancelar
                </button>
              </>
            )}
            {adicao?.etapa === 'dados' && (
              <FormFornecedor titulo="Novo fornecedor" aoSalvar={props.aoSalvarNovo} aoCancelar={props.aoCancelarAdicao} />
            )}
          </div>

          {props.estadoRotas.erro && (
            <div className="erro">
              <p>{props.estadoRotas.erro}</p>
              <button type="button" onClick={props.aoTentarRotasDeNovo}>
                Tentar de novo
              </button>
            </div>
          )}

          <div className="categorias">
            {CATEGORIAS.map((c) => (
              <ListaCategoria
                key={c.id}
                categoria={c}
                lista={grupos[c.id]}
                rota={props.rotas[c.id]}
                calculando={props.estadoRotas.calculando}
                raioKm={raioKm}
                aoAlternar={props.aoAlternar}
                aoEditar={props.aoEditar}
                aoRemover={props.aoRemover}
              />
            ))}
            <p className="dica">
              A lista mostra a distância em linha reta. Para cada categoria, a rota usa o ponto ativo com a menor
              distância por estrada, entre os {CANDIDATOS_POR_CATEGORIA} mais próximos em linha reta. Desmarque um ponto
              para tirá-lo do cálculo; no mapa, clique no ponto.
            </p>
            <p className="fonte">
              Rotas: OSRM, servidor de demonstração da FOSSGIS · dados © colaboradores do OpenStreetMap ·{' '}
              <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">
                corrigir o mapa
              </a>
            </p>
          </div>
        </>
      )}

      <div className="linha acoes">
        <button type="button" onClick={props.aoExportar}>
          Exportar
        </button>
        <button type="button" onClick={() => arquivo.current?.click()}>
          Importar
        </button>
        <input ref={arquivo} type="file" accept="application/json,.json" hidden onChange={lerArquivo} />
      </div>
      <p className="dica">Exporta e importa seus fornecedores e os pontos desligados, num arquivo JSON.</p>
      {mensagemArquivo && <p className={mensagemArquivo.tipo === 'erro' ? 'erro' : 'dica'}>{mensagemArquivo.texto}</p>}
      {!props.salvouNoNavegador && (
        <p className="aviso-forte">
          O navegador não deixou salvar suas alterações. Elas somem ao recarregar a página; use Exportar para não perder.
        </p>
      )}

      {estado.tipo === 'pronta' && (
        <p className="fonte">
          Base: OpenStreetMap, extraída em {formatarData(estado.extraidoEm)} · © colaboradores do OpenStreetMap (ODbL)
        </p>
      )}
    </section>
  )
}
