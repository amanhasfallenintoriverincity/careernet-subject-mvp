'use client';

import { FormEvent, useState } from 'react';
import { markdownToSafeHtml } from '../lib/markdown';
import type { GeminiGuidanceResponse } from '../lib/gemini-guidance';
import { SubjectVisualizer } from './subject-visualizer';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

const starterPrompts = [
  '저는 고2이고 정보와 수학을 좋아해요. AI 개발자 쪽 진로가 맞을까요?',
  '간호사가 궁금해요. 생명과학은 좋아하지만 화학은 조금 부담돼요.',
  '천안오성고에서 인공지능 개발자 진로에 맞는 과목이 열리는지 확인해줘.',
  '충남 지역에서 데이터 과학 과목을 들을 수 있는 학교를 찾아줘.'
];

export function CareerChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '안녕하세요! 관심 있는 것, 좋아하는 과목, 부담스러운 과목, 학교명이나 지역을 편하게 말해주세요. Gemini가 CareerNet과 NEIS 근거를 함께 확인해서 진로와 과목을 추천해드릴게요.'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<GeminiGuidanceResponse | null>(null);
  const [lastInteractionId, setLastInteractionId] = useState<string | undefined>();

  async function sendMessage(content: string) {
    const clean = content.trim();
    if (!clean || loading) return;
    const nextMessages = [...messages, { role: 'user' as const, content: clean }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, previousInteractionId: lastInteractionId })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? '채팅 요청에 실패했습니다.');
      const result = json as GeminiGuidanceResponse;
      setLastResult(result);
      setLastInteractionId(result.interactionId ?? lastInteractionId);
      setMessages([...nextMessages, { role: 'assistant', content: result.reply }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      setMessages([...nextMessages, { role: 'assistant', content: `죄송합니다. ${message}` }]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <section className="chat-layout" aria-label="Gemini 대화형 진로 추천">
      <div className="chat-card card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Gemini conversational guidance</p>
            <h2>대화로 진로를 찾아가기</h2>
          </div>
          <span className="badge subtle">CareerNet + NEIS 근거</span>
        </div>
        <div className="chat-window" aria-live="polite">
          {messages.map((message, index) => (
            <article key={`${message.role}-${index}`} className={`chat-message ${message.role}`}>
              <span>{message.role === 'user' ? '나' : 'AI'}</span>
              {message.role === 'assistant' ? (
                <div className="markdown-body" dangerouslySetInnerHTML={{ __html: markdownToSafeHtml(message.content) }} />
              ) : (
                <p>{message.content}</p>
              )}
            </article>
          ))}
          {loading && <article className="chat-message assistant"><span>AI</span><p>CareerNet과 NEIS 근거를 확인하고 있습니다...</p></article>}
        </div>
        <form className="chat-input" onSubmit={onSubmit}>
          <label className="sr-only" htmlFor="chat-message">진로 상담 메시지</label>
          <textarea
            id="chat-message"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="예: 고2이고 정보·수학을 좋아해요. AI 개발자 진로와 우리 학교 과목을 확인해줘."
            rows={3}
          />
          <button disabled={loading || !input.trim()}>{loading ? '분석 중' : '보내기'}</button>
        </form>
        <div className="chips chat-starters" aria-label="예시 질문">
          {starterPrompts.map((prompt) => (
            <button key={prompt} type="button" onClick={() => void sendMessage(prompt)} disabled={loading}>{prompt}</button>
          ))}
        </div>
      </div>

      <SubjectVisualizer result={lastResult} />
    </section>
  );
}
