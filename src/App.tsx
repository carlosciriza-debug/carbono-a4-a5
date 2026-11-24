import { useEffect, useMemo, useRef, useState } from 'react'
import { INSTRUCAO_INICIAL, NOME_APP } from './compartilhado/app'
import { type BaseFornecedores, carregarBase, ErroBase, pontosNoRaio, RAIO_INICIAL_KM } from './dados/fornecedores'
import { type EstadoBase, PainelFornecedores } from './dados/PainelFornecedores'
import { type ControleMapa, Mapa } from './geometria/Mapa'
import { PainelTerreno } from './geometria/PainelTerreno'
import type { Lote } from './geometria/lote'

function App() {
  const mapa = useRef<ControleMapa>(null)
  const [lote, setLote] = useState<Lote | null>(null)
  const [desenhando, setDesenhando] = useState(false)
  const [raioKm, setRaioKm] = useState(RAIO_INICIAL_KM)
  const [base, setBase] = useState<BaseFornecedores | null>(null)
  const [estadoBase, setEstadoBase] = useState<EstadoBase>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let cancelado = false
    carregarBase()
      .then((b) => {
        if (cancelado) return
        setBase(b)
        setEstadoBase({ tipo: 'pronta', extraidoEm: b.extraidoEm })
      })
      .catch((e) => {
        if (cancelado) return
        setEstadoBase({ tipo: 'erro', mensagem: e instanceof ErroBase ? e.message : 'Erro inesperado ao carregar a base.' })
      })
    return () => {
      cancelado = true
    }
  }, [tentativa])

  const pontos = useMemo(
    () => (base && lote ? pontosNoRaio(base, lote.centro, raioKm) : []),
    [base, lote, raioKm],
  )

  return (
    <div className="aplicacao">
      <Mapa ref={mapa} pontos={pontos} aoMudarLote={setLote} aoMudarDesenho={setDesenhando} />

      <aside className="painel">
        <header>
          <h1>{NOME_APP}</h1>
          {!lote && !desenhando && <p className="instrucao">{INSTRUCAO_INICIAL}</p>}
        </header>

        <PainelTerreno
          lote={lote}
          desenhando={desenhando}
          aoEscolherEndereco={(r) => mapa.current?.irPara(r)}
          aoDesenhar={() => mapa.current?.desenharLote()}
          aoApagar={() => mapa.current?.apagarLote()}
        />

        <PainelFornecedores
          temLote={lote !== null}
          raioKm={raioKm}
          aoMudarRaio={setRaioKm}
          estado={estadoBase}
          aoTentarDeNovo={() => {
            setEstadoBase({ tipo: 'carregando' })
            setTentativa((t) => t + 1)
          }}
          pontos={pontos}
        />

        <section className="secao">
          <h2>Resultado</h2>
          <p className="pendente">Disponível em uma etapa futura.</p>
        </section>
      </aside>
    </div>
  )
}

export default App
