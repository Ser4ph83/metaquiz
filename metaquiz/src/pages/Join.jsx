import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function Join() {
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // 1. Busca a sala pelo PIN digitado
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('*')
      .eq('pin', pin.trim())
      .single();

    if (quizError || !quiz) {
      setLoading(false);
      return setError('PIN inválido! Verifique o código no telão.');
    }

    // 2. Cadastra o aluno no banco de dados
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert([{ quiz_id: quiz.id, name: name.trim() }])
      .select()
      .single();

    if (playerError) {
      setLoading(false);
      return setError('Erro ao entrar na sala. Tente novamente.');
    }

    // 3. Redireciona para o controle remoto (/player) passando os dados
    navigate('/player', {
      state: {
        name: player.name,
        playerId: player.id,
        quizId: quiz.id
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4 font-sans text-white">
      <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/80 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center">
        
        {/* Logotipo MetaQuiz */}
        <div className="mb-8">
          <h1 className="text-5xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
            METAQUIZ
          </h1>
          <p className="text-slate-400 font-medium text-sm mt-1">Plataforma Interativa de Aprendizagem</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-5">
          <div>
            <label className="block text-slate-300 font-bold text-left mb-2 text-sm uppercase tracking-wider">PIN da Sala</label>
            <input 
              type="text" 
              placeholder="Ex: 123456" 
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full text-center text-3xl font-black tracking-widest p-4 bg-slate-900/90 border-2 border-slate-700 rounded-2xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all text-white placeholder-slate-600"
              required
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold text-left mb-2 text-sm uppercase tracking-wider">Seu Nome / Apelido</label>
            <input 
              type="text" 
              placeholder="Como quer ser chamado?" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-center text-xl font-bold p-4 bg-slate-900/90 border-2 border-slate-700 rounded-2xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all text-white placeholder-slate-600"
              maxLength={15}
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-5 text-2xl font-black bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-2xl shadow-xl transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer mt-2"
          >
            {loading ? 'Entrando...' : 'Entrar no Jogo 🚀'}
          </button>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl text-sm font-bold">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}