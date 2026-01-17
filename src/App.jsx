import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Plus, BookText, LogOut, BookOpen, Trash2, CheckCircle2, XCircle, LayoutGrid } from 'lucide-react';

// 艾宾浩斯记忆周期（单位：天）
const STAGES = [0, 1, 2, 4, 7, 15, 30, 60, 180];

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reviewWords, setReviewWords] = useState([]); // 今日待复习
  const [totalCount, setTotalCount] = useState(0);    // 词库总数
  const [isAdding, setIsAdding] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [newWord, setNewWord] = useState({ en: '', cn: '' });

  // 1. 登录监听
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  // 2. 登录后获取数据
  useEffect(() => {
    if (user) {
      fetchAllStats();
    }
  }, [user]);

  // 获取统计数据的核心函数
  const fetchAllStats = async () => {
    // A. 获取待复习单词
    const { data: rData } = await supabase
      .from('words')
      .select('*')
      .lte('next_review', new Date().toISOString())
      .eq('user_id', user.id)
      .order('next_review', { ascending: true });
    setReviewWords(rData || []);

    // B. 获取词库总数 (使用 count 提高性能)
    const { count, error } = await supabase
      .from('words')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    
    if (!error) setTotalCount(count || 0);
  };

  // 3. 复习动作
  const handleReviewAction = async (word, isCorrect) => {
    let nextStage = isCorrect ? word.stage + 1 : 0;
    if (nextStage >= STAGES.length) nextStage = STAGES.length - 1;

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + STAGES[nextStage]);

    const { error } = await supabase
      .from('words')
      .update({ 
        stage: nextStage, 
        next_review: nextDate.toISOString(),
        wrong_count: isCorrect ? word.wrong_count : word.wrong_count + 1
      })
      .eq('id', word.id);

    if (!error) {
      setShowAnswer(false);
      setReviewWords(reviewWords.filter(w => w.id !== word.id));
      // 复习不影响总数，不需要重新 fetch 总数
    }
  };

  const addWord = async () => {
    if (!newWord.en) return;
    const { data } = await supabase.from('words').insert([{ 
      en: newWord.en, cn: newWord.cn, user_id: user.id, stage: 0, next_review: new Date().toISOString()
    }]).select();
    if (data) {
      setNewWord({ en: '', cn: '' });
      setIsAdding(false);
      fetchAllStats(); // 增加单词后刷新总数和待复习
    }
  };

  if (!user) {
    // 登录界面 (保持之前的样式)
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-[40px] p-10 shadow-2xl">
          <div className="flex justify-center mb-8 text-[#5D5FEF]"><BookOpen size={70} strokeWidth={1.5} /></div>
          <h1 className="text-3xl font-black text-center mb-8 text-slate-800">私人词库</h1>
          <div className="space-y-4">
            <input type="email" placeholder="邮箱" className="w-full p-5 bg-slate-50 rounded-3xl outline-none" value={email} onChange={e => setEmail(e.target.value)} />
            <input type="password" placeholder="密码" className="w-full p-5 bg-slate-50 rounded-3xl outline-none" value={password} onChange={e => setPassword(e.target.value)} />
            <button onClick={() => {
               supabase.auth.signInWithPassword({ email, password }).then(({error}) => error && alert(error.message))
            }} className="w-full py-5 bg-[#5D5FEF] text-white rounded-3xl font-bold">登录</button>
            <button onClick={() => {
               supabase.auth.signUp({ email, password }).then(({error}) => error ? alert(error.message) : alert("注册成功，请登录"))
            }} className="w-full text-[#5D5FEF] font-bold">没有账号？去注册</button>
          </div>
        </div>
      </div>
    );
  }

  // --- 界面 C: 复习模式 ---
  if (isReviewing && reviewWords.length > 0) {
    const currentWord = reviewWords[0];
    return (
      <div className="min-h-screen bg-[#5D5FEF] p-6 flex flex-col items-center justify-center">
        <div className="w-full max-w-sm bg-white rounded-[48px] p-10 shadow-2xl text-center min-h-[420px] flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
               <span className="px-3 py-1 bg-indigo-50 text-[#5D5FEF] rounded-full text-xs font-bold">剩余 {reviewWords.length}</span>
               <p className="text-slate-300 font-black tracking-widest text-xs">REVIEW</p>
            </div>
            <h2 className="text-5xl font-black text-slate-800 mb-6 break-words">{currentWord.en}</h2>
            {showAnswer && (
              <p className="text-2xl text-[#5D5FEF] font-bold animate-in fade-in zoom-in">{currentWord.cn}</p>
            )}
          </div>
          {!showAnswer ? (
            <button onClick={() => setShowAnswer(true)} className="w-full py-5 bg-slate-100 text-slate-500 rounded-3xl font-bold">查看释义</button>
          ) : (
            <div className="flex gap-4">
              <button onClick={() => handleReviewAction(currentWord, false)} className="flex-1 py-5 bg-red-50 text-red-500 rounded-3xl font-bold flex flex-col items-center"><XCircle size={24}/><span>不认识</span></button>
              <button onClick={() => handleReviewAction(currentWord, true)} className="flex-1 py-5 bg-green-50 text-green-500 rounded-3xl font-bold flex flex-col items-center"><CheckCircle2 size={24}/><span>记得</span></button>
            </div>
          )}
        </div>
        <button onClick={() => setIsReviewing(false)} className="mt-10 text-white/60 font-bold">返回主页</button>
      </div>
    );
  }

  // --- 界面 B: 紫色主页 ---
  return (
    <div className="min-h-screen bg-[#F5F7FF] pb-10 font-sans">
      <div className="bg-[#5D5FEF] p-6 pt-14 rounded-b-[48px] shadow-xl flex justify-between items-center text-white">
        <div className="flex items-center gap-3">
          <BookText size={22} />
          <span className="text-xl font-extrabold">共享单词宝</span>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition"><LogOut size={20}/></button>
      </div>

      <div className="px-6 -mt-10">
        {/* 核心统计卡片 */}
        <div className="bg-white rounded-[40px] p-10 shadow-2xl text-center border border-white/50">
          <p className="text-[12px] font-black text-slate-300 tracking-[0.3em] mb-4 uppercase">Today's Tasks</p>
          <div className="text-[100px] font-black text-[#5D5FEF] leading-none mb-2">{reviewWords.length}</div>
          <p className="text-slate-400 font-bold mb-8 text-sm">个单词待复习</p>
          
          {reviewWords.length > 0 ? (
            <button onClick={() => setIsReviewing(true)} className="w-full py-5 bg-[#5D5FEF] text-white rounded-[24px] font-black text-lg shadow-lg shadow-indigo-100 hover:scale-[1.02] active:scale-95 transition">立即开始</button>
          ) : (
            <div className="py-5 bg-green-50 text-green-600 rounded-[24px] font-bold">今日目标已达成！✨</div>
          )}
        </div>

        {!isAdding ? (
          <div className="grid grid-cols-2 gap-6 mt-8">
            {/* 新词录入按钮 */}
            <button onClick={() => setIsAdding(true)} className="bg-white p-8 rounded-[36px] shadow-lg flex flex-col items-center gap-4 hover:bg-slate-50 transition active:scale-95">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center text-green-500"><Plus size={32} /></div>
              <span className="font-bold text-slate-700">新词录入</span>
            </button>
            
            {/* 词库总数显示（这里是你要的新功能） */}
            <div className="bg-white p-8 rounded-[36px] shadow-lg flex flex-col items-center gap-4 border-2 border-indigo-50 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-2 opacity-5"><LayoutGrid size={80}/></div>
               <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500"><BookText size={32} /></div>
               <div className="text-center">
                  <div className="text-2xl font-black text-slate-800">{totalCount}</div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">词库总数</span>
               </div>
            </div>
          </div>
        ) : (
          /* 录入界面 */
          <div className="bg-white p-8 rounded-[40px] shadow-2xl mt-8 animate-in slide-in-from-bottom-5">
             <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-slate-800">Add Word</h2>
                <button onClick={() => setIsAdding(false)} className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-slate-400">✕</button>
             </div>
             <input autoFocus placeholder="English" className="w-full p-5 bg-slate-50 rounded-3xl mb-4 outline-none border-2 border-transparent focus:border-[#5D5FEF] font-bold" 
               value={newWord.en} onChange={e => setNewWord({...newWord, en: e.target.value})} />
             <input placeholder="中文翻译" className="w-full p-5 bg-slate-50 rounded-3xl mb-6 outline-none border-2 border-transparent focus:border-[#5D5FEF]" 
               value={newWord.cn} onChange={e => setNewWord({...newWord, cn: e.target.value})} />
             <button onClick={addWord} className="w-full py-5 bg-[#5D5FEF] text-white rounded-[24px] font-black shadow-lg">保存到云端</button>
          </div>
        )}
      </div>
    </div>
  );
}