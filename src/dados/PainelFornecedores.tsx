import { CATEGORIAS } from '../compartilhado/categorias'
import { agruparPorCategoria, mensagemSemPontos, type PontoComDistancia, RAIOS_KM } from './fornecedores'

export type EstadoBase =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'pronta'; extraidoEm: string }

type Props = {
  temLote: boolean
  raioKm: number
  aoMudarRaio: (raioKm: number) => void
  estado: EstadoBase
  aoTentarDeNovo: () => void
  pontos: PontoComDistancia[]
}

const LIMITE_POR_CATEGORIA = 10

function formatarKm(km: number): string {
  return `${km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
}

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

export function PainelFornecedores({ temLote, raioKm, aoMudarRaio, estado, aoTentarDeNovo, pontos }: Props) {
  const grupos = agruparPorCategoria(pontos)

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
        <div className="categorias">
          {CATEGORIAS.map((c) => {
            const lista = grupos[c.id]
            return (
              <div key={c.id} className="categoria">
                <h3>
                  <span className="marcador" style={{ background: c.cor }}>
                    {c.letra}
                  </span>
                  {c.nome}
                  <span className="contagem">{lista.length}</span>
                </h3>
                {lista.length === 0 ? (
                  <p className="aviso">{mensagemSemPontos(c.nome, raioKm)}</p>
                ) : (
                  <ul className="pontos">
                    {lista.slice(0, LIMITE_POR_CATEGORIA).map((p) => (
                      <li key={p.id}>
                        <span className={p.nome ? '' : 'sem-nome'}>{p.nome ?? 'Sem nome'}</span>
                        <span className="distancia">{formatarKm(p.distanciaRetaKm)}</span>
                      </li>
                    ))}
                    {lista.length > LIMITE_POR_CATEGORIA && (
                      <li className="mais">e mais {lista.length - LIMITE_POR_CATEGORIA} no mapa</li>
                    )}
                  </ul>
                )}
              </div>
            )
          })}
          <p className="dica">Distâncias em linha reta a partir do centro do lote. As distâncias por estrada chegam na etapa 4.</p>
        </div>
      )}

      {estado.tipo === 'pronta' && (
        <p className="fonte">
          Base: OpenStreetMap, extraída em {formatarData(estado.extraidoEm)} · © colaboradores do OpenStreetMap (ODbL)
        </p>
      )}
    </section>
  )
}
