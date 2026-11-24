import { INSTRUCAO_INICIAL, NOME_APP } from './compartilhado/app'

function App() {
  return (
    <main className="pagina">
      <h1>{NOME_APP}</h1>
      <p>{INSTRUCAO_INICIAL}</p>
      <p className="nota">Etapa 0: estrutura do projeto. O mapa chega na etapa 1.</p>
    </main>
  )
}

export default App
