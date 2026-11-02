import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Join from './pages/Join';
import Host from './pages/Host';
import Player from './pages/Player';
import Admin from './pages/Admin';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Entrada do Aluno */}
        <Route path="/" element={<Join />} />
        
        {/* Painel de Criação e Gestão (Bastidores) */}
        <Route path="/admin" element={<Admin />} />
        
        {/* Tela do Telão (Projetor) */}
        <Route path="/host" element={<Host />} />
        
        {/* Tela do Celular do Aluno */}
        <Route path="/player" element={<Player />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;