import { useRef, useState } from 'react'
import { INSTRUCAO_INICIAL, NOME_APP } from './compartilhado/app'
import { type ControleMapa, Mapa } from './geometria/Mapa'
import { PainelTerreno } from './geometria/PainelTerreno'
import type { Lote } from './geometria/lote'

function App() {
  const mapa = useRef<ControleMapa>(null)
  const [lote, setLote] = useState<Lote | null>(null)
  const [desenhando, setDesenhando] = useState(false)

  return (
    <div className="aplicacao">
      <Mapa ref={mapa} aoMudarLote={setLote} aoMudarDesenho={setDesenhando} />

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

        <section className="secao">
          <h2>Fornecedores</h2>
          <p className="pendente">Disponível na próxima etapa.</p>
        </section>

        <section className="secao">
          <h2>Resultado</h2>
          <p className="pendente">Disponível em uma etapa futura.</p>
        </section>
      </aside>
    </div>
  )
}

export default App
