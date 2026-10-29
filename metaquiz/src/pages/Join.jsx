import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function Join() {
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState(1); // Passo 1: PIN | Passo 2: Nome
  const [error, setError] = useState('');
  const [quizId, setQuizId] = useState(null);
  const navigate = useNavigate();

  // Função para verificar se o PIN existe no banco
  const checkPin = async (e) => {
    e.preventDefault();
    setError('');
    
    const { data, error } = await supabase
      .from('quizzes')
      .select('id, is_active')
      .eq('pin', pin)
      .single();

    if (error || !data) {
      setError('PIN inválido ou sala não encontrada.');
      return;
    }

    if (!data.is_active) {
      setError('O professor ainda não iniciou esta sala.');
      return;
    }

    setQuizId(data.id);
    setStep(2); // Avança para a tela de digitar o nome
  };

  // Função para salvar o aluno no banco e entrar no jogo
  const joinGame = async (e) => {
    e.preventDefault();
    setError('');

    const { data, error } = await supabase
      .from('players')
      .insert([{ quiz_id: quizId, name: name }])
      .select()
      .single();

    if (error) {
      setError('Erro ao entrar na sala. Tente novamente.');
      return;
    }

    // Vai para a tela do jogador levando as informações dele
    navigate('/player', { state: { playerId: data.id, quizId: quizId, name: name } });
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
      <h1>MetaQuiz</h1>
      
      {error && <p style={{ color: 'red', fontWeight: 'bold' }}>{error}</p>}

      {step === 1 ? (
        <form onSubmit={checkPin}>
          <input 
            type="text" 
            placeholder="PIN do Jogo" 
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            style={{ fontSize: '24px', padding: '10px', textAlign: 'center', width: '200px' }}
            required
          />
          <br /><br />
          <button type="submit" style={{ fontSize: '20px', padding: '10px 40px', cursor: 'pointer' }}>Entrar</button>
        </form>
      ) : (
        <form onSubmit={joinGame}>
          <input 
            type="text" 
            placeholder="Seu Apelido" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ fontSize: '24px', padding: '10px', textAlign: 'center', width: '250px' }}
            required
          />
          <br /><br />
          <button type="submit" style={{ fontSize: '20px', padding: '10px 40px', cursor: 'pointer' }}>Pronto, vamos lá!</button>
        </form>
      )}
    </div>
  );
}