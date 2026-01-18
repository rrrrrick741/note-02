import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Plus, BookText, LogOut, BookOpen, CheckCircle2, XCircle, ChevronLeft } from 'lucide-react';

const STAGES = [0, 1, 2, 4, 7, 15, 30, 60, 180];

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reviewWords, setReviewWords] = useState([]); 
  const [allWords, setAllWords] = useState([]);       
  const [totalCount, setTotalCount] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isListView, setIsListView] = useState(false); 
  const [showAnswer, setShowAnswer] = useState(false);
  const [newWord, setNewWord] = useState({ en: '', cn: '' });
  const [toast, setToast] = useState({ show: false, msg: '', color: '' });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (user) fetchStats(); }, [user]);

  const fetchStats = async () => {
    // 获取待复习
    const { data: rData } = await supabase.from('words').select('*')
      .lte('next_review', new Date().toISOString()).eq('user_id', user.id);
    setReviewWords(rData || []);

    // 获取总数
    const { count } = await supabase.from('words').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    setTotalCount(count || 0);
  };

  const fetchListView = async () => {
    // 修复点：移除 created_at 排序以防万一，直接查询
    const { data, error } = await supabase.from('words').select('*').eq('user_id', user.id);
    if (error) {
        console.error("查询列表失败:", error.message);
        alert("获取词库失败，请检查数据库列");
    } else {
        setAllWords(data || []);
        setIsListView(true);
    }
  };

  const showMsg = (msg, type) => {
    setToast({ show: true, msg, color: type === 'success' ? 'bg-green-500' : 'bg-red-500' });
    setTimeout(() => setToast({ show: false, msg: '', color: '' }), 2000);
  };

  const handleReviewAction = async (word, isCorrect) => {
    if (!word?.id) return;
    let nextStage = isCorrect ? (word.stage || 0) + 1 : 0;
    if (nextStage >= STAGES.length) nextStage = STAGES.length - 1;
    
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + STAGES[nextStage]);

    const { error } = await supabase.from('words').update({ 
        stage: nextStage, 
        next_review: nextDate.toISOString(),
        wrong_count: isCorrect ? (word.wrong_count || 0) : (word.wrong_count || 0) + 1
    }).eq('id', word.id);

    if (!error) {
      isCorrect ? showMsg(`你已学会 ${word.en}`, 'success') : showMsg(`已为你放入错题本`, 'error');
      setShowAnswer(false);
      setReviewWords(prev => prev.filter(w => w.id !== word.id));
      setTotalCount(prev => isCorrect ? prev : prev);
    }
  };

  const addWord = async () => {
    if (!newWord.en) return;
    const { data, error } = await supabase.from('words').insert([{ 
      en: newWord.en, cn: newWord.cn, user_id: user.id, stage: 0, 
      next_review: new Date().toISOString(), wrong_count: 0 
    }]).select();
    
    if (!error) {
      setNewWord({ en: '', cn: '' });
      setIsAdding(false);
      fetchStats();
      showMsg("存入成功！", "success");
    } else {
      alert("添加失败: " + error.message);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-[40px] p-10 shadow-2xl text-center">
          <BookOpen size={60} className="mx-auto text-[#5D5FEF] mb-6" />
          <h1 className="text-2xl font-black mb-8 text-slate-800">私人云词库</h1>
          <div className="space-y-4 text-left">
            <input placeholder="邮箱" className="w-full p-4 bg-slate-50 rounded-2xl outline-none" value={email} onChange={e => setEmail(e.target.value)} />
            <input type="password" placeholder="密码" className="w-full p-4 bg-slate-50 rounded-2xl outline-none" value={password} onChange={e => setPassword(e.target.value)} />
            <button onClick={() => supabase.auth.signInWithPassword({ email, password }).then(({error}) => error && alert(error.message))} className="w-full py-4 bg-[#5D5FEF] text-white rounded-2xl font-bold">进入词库</button>
            <button onClick={() => supabase.auth.signUp({ email, password }).then(({error}) => error ? alert(error.message) : alert("注册成功，请重新登录"))} className="w-full text-[#5D5FEF] font-bold text-sm text-center">创建新账号</button>
          </div>
        </div>
      </div>
    );
  }

  if (isListView) {
    return (
      <div className="min-h-screen bg-[#F5F7FF]">
        <div className="bg-[#5D5FEF] p-6 pt-12 flex items-center gap-4 text-white shadow-lg">
          <button onClick={() => setIsListView(false)}><ChevronLeft size={28} /></button>
          <span className="text-xl font-bold">所有单词 ({allWords.length})</span>
        </div>
        <div className="p-6 space-y-4">
          {allWords.length > 0 ? allWords.map(w => (
            <div key={w.id} className="bg-white p-5 rounded-[28px] shadow-sm flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{w.en}</h3>
                <p className="text-slate-400 text-sm">{w.cn}</p>
              </div>
              <div className="text-[10px] bg-indigo-50 text-indigo-500 px-3 py-1 rounded-full font-bold uppercase tracking-wider">阶段 {w.stage}</div>
            </div>
          )) : (
            <div className="text-center py-20 text-slate-300 font-bold tracking-widest uppercase opacity-50">Empty Library</div>
          )}
        </div>
      </div>
    );
  }

  if (isReviewing && reviewWords.length > 0) {
    const currentWord = reviewWords[0];
    return (
      <div className="min-h-screen bg-[#5D5FEF] p-6 flex flex-col items-center justify-center">
        <div className="w-full max-w-sm bg-white rounded-[48px] p-10 shadow-2xl text-center min-h-[420px] flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex justify-between items-center mb-10">
               <span className="px-3 py-1 bg-indigo-50 text-[#5D5FEF] rounded-full text-[10px] font-black uppercase tracking-tighter">Remaining: {reviewWords.length}</span>
            </div>
            <h2 className="text-5xl font-black text-slate-800 mb-6">{currentWord.en}</h2>
            {showAnswer && <p className="text-2xl text-[#5D5FEF] font-bold animate-in zoom-in">{currentWord.cn}</p>}
          </div>
          {!showAnswer ? (
            <button onClick={() => setShowAnswer(true)} className="w-full py-5 bg-slate-50 text-slate-400 rounded-3xl font-bold">查看释义</button>
          ) : (
            <div className="flex gap-4">
              <button onClick={() => handleReviewAction(currentWord, false)} className="flex-1 py-5 bg-red-50 text-red-500 rounded-3xl font-bold flex flex-col items-center"><XCircle size={24}/><span>不认识</span></button>
              <button onClick={() => handleReviewAction(currentWord, true)} className="flex-1 py-5 bg-green-50 text-green-600 rounded-3xl font-bold flex flex-col items-center"><CheckCircle2 size={24}/><span>记得</span></button>
            </div>
          )}
        </div>
        <button onClick={() => setIsReviewing(false)} className="mt-8 text-white/50 font-bold">返回主页</button>
        {toast.show && <div className={`fixed top-10 px-8 py-4 rounded-full text-white font-bold shadow-2xl animate-in slide-in-from-top-5 z-50 ${toast.color}`}>{toast.msg}</div>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FF] pb-10">
      <div className="bg-[#5D5FEF] p-6 pt-14 rounded-b-[48px] shadow-xl flex justify-between items-center text-white">
        <div className="flex items-center gap-3"><BookText size={22} /><span className="text-xl font-extrabold">共享单词宝</span></div>
        <button onClick={() => supabase.auth.signOut()} className="p-3 bg-white/10 rounded-2xl"><LogOut size={20}/></button>
      </div>
      <div className="px-6 -mt-10">
        <div className="bg-white rounded-[40px] p-10 shadow-2xl text-center border border-white/50">
          <p className="text-[10px] font-black text-slate-300 tracking-[0.3em] mb-4 uppercase">Pending Review</p>
          <div className="text-[100px] font-black text-[#5D5FEF] leading-none mb-2">{reviewWords.length}</div>
          {reviewWords.length > 0 ? (
            <button onClick={() => setIsReviewing(true)} className="w-full py-5 bg-[#5D5FEF] text-white rounded-[24px] font-black text-lg shadow-lg">开始学习</button>
          ) : (
            <div className="py-5 bg-green-50 text-green-600 rounded-[24px] font-bold">今日已全部完成！✨</div>
          )}
        </div>
        {!isAdding ? (
          <div className="grid grid-cols-2 gap-6 mt-8">
            <button onClick={() => setIsAdding(true)} className="bg-white p-8 rounded-[36px] shadow-lg flex flex-col items-center gap-4 active:scale-95 transition">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center text-green-500"><Plus size={30} /></div>
              <span className="font-bold text-slate-700">新词录入</span>
            </button>
            <button onClick={fetchListView} className="bg-white p-8 rounded-[36px] shadow-lg flex flex-col items-center gap-4 border-2 border-indigo-50 active:scale-95 transition">
               <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500"><BookText size={30} /></div>
               <div className="text-center">
                  <div className="text-2xl font-black text-slate-800">{totalCount}</div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">词库总数</span>
               </div>
            </button>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-[40px] shadow-2xl mt-8">
             <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-slate-800">New Word</h2>
                <button onClick={() => setIsAdding(false)} className="text-slate-300 text-xl">✕</button>
             </div>
             <input autoFocus placeholder="English" className="w-full p-5 bg-slate-50 rounded-2xl mb-4 outline-none border-2 border-transparent focus:border-[#5D5FEF] font-bold" value={newWord.en} onChange={e => setNewWord({...newWord, en: e.target.value})} />
             <input placeholder="中文翻译" className="w-full p-5 bg-slate-50 rounded-2xl mb-6 outline-none border-2 border-transparent focus:border-[#5D5FEF]" value={newWord.cn} onChange={e => setNewWord({...newWord, cn: e.target.value})} />
             <button onClick={addWord} className="w-full py-5 bg-[#5D5FEF] text-white rounded-[20px] font-black shadow-lg">确认存入</button>
          </div>
        )}
      </div>
      {toast.show && <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 px-8 py-4 rounded-full text-white font-bold shadow-2xl z-50 animate-in slide-in-from-bottom-5 ${toast.color}`}>{toast.msg}</div>}
    </div>
  );
}