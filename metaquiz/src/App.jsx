import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Join from './pages/Join';
import Host from './pages/Host';
import Player from './pages/Player';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* A rota '/' é a página inicial onde o aluno acessa */}
        <Route path="/" element={<Join />} />
        
        {/* A rota '/host' é o painel do telão */}
        <Route path="/host" element={<Host />} />
        
        {/* A rota '/player' é a tela de jogo do aluno */}
        <Route path="/player" element={<Player />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;