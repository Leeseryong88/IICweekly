
import React from 'react';
import { ChatMessage as Message, MessageSender } from '../types';
import BotIcon from './icons/BotIcon';
import UserIcon from './icons/UserIcon';

interface ChatMessageProps {
  message: Message;
}

// AI 응답의 마크다운을 렌더링하기 위한 파서 함수 (표 지원)
const parseMarkdownToHtml = (markdown: string): string => {
    if (!markdown) return '';

    const lines = markdown.split(/\r?\n/);
    const htmlParts: string[] = [];
    let listType: 'ul' | 'ol' | null = null;
    let i = 0;
    let inFence = false;
    let fenceLang = '';
    let fenceBuffer: string[] = [];

    const formatInline = (text: string) => {
        return text
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded">$1</code>');
    };

    const isTableSeparator = (line: string) => {
        const t = line.trim();
        // 허용: |---|---| 또는 ---|--- 또는 :---: 등
        if (!t) return false;
        // 양끝 파이프 제거
        const core = t.replace(/^\|/, '').replace(/\|$/, '');
        const parts = core.split('|').map(s => s.trim());
        if (parts.length < 2) return false;
        return parts.every(p => /^:?-{3,}:?$/.test(p));
    };

    while (i < lines.length) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // fenced code blocks ```
        if (trimmedLine.startsWith('```')) {
            if (!inFence) {
                inFence = true;
                fenceLang = trimmedLine.slice(3).trim();
                fenceBuffer = [];
            } else {
                // close fence
                const codeHtml = fenceBuffer
                    .map(l => l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'))
                    .join('\n');
                htmlParts.push(`<pre class="bg-slate-800 border border-slate-700 rounded p-3 overflow-x-auto"><code class="language-${fenceLang}">${codeHtml}</code></pre>`);
                inFence = false;
                fenceLang = '';
                fenceBuffer = [];
            }
            i++;
            continue;
        }
        if (inFence) {
            fenceBuffer.push(line);
            i++;
            continue;
        }

        // 표 감지: 헤더 줄 | 구분자 줄 | 데이터 ...
        const next = i + 1 < lines.length ? lines[i + 1] : '';
        if ((trimmedLine.includes('|')) && isTableSeparator(next)) {
            const headerCore = trimmedLine.replace(/^\|/, '').replace(/\|$/, '');
            const headerCells = headerCore.split('|').map(c => c.trim());
            i += 2; // separator 건너뜀
            const bodyRows: string[][] = [];
            while (i < lines.length && lines[i].includes('|')) {
                const rowCore = lines[i].trim().replace(/^\|/, '').replace(/\|$/, '');
                const cells = rowCore.split('|').map(c => c.trim());
                bodyRows.push(cells);
                i++;
            }
            const thead = `<thead><tr>${headerCells.map(h=>`<th class="px-3 py-2 border border-slate-700 bg-slate-800 text-slate-300 text-sm">${formatInline(h)}</th>`).join('')}</tr></thead>`;
            const tbody = `<tbody>${bodyRows.map(r=>`<tr>${r.map(c=>`<td class="px-3 py-2 border border-slate-700 text-slate-200 text-sm align-top">${formatInline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
            htmlParts.push(`<div class="overflow-x-auto"><table class="min-w-full border border-slate-700 rounded-md">${thead}${tbody}</table></div>`);
            continue; // while 루프의 증가 건너뜀 (i는 이미 이동됨)
        }

        // 목록 처리
        const unorderedMatch = trimmedLine.match(/^([*-])\s+(.*)/);
        const orderedMatch = trimmedLine.match(/^(\d+\.|\d+\)|[a-zA-Z][.)])\s+(.*)/);

        if (unorderedMatch) {
            if (listType !== 'ul') {
                if (listType === 'ol') htmlParts.push('</ol>');
                htmlParts.push('<ul>');
                listType = 'ul';
            }
            htmlParts.push(`<li>${formatInline(unorderedMatch[2])}</li>`);
            i++;
            continue;
        }
        if (orderedMatch) {
            if (listType !== 'ol') {
                if (listType === 'ul') htmlParts.push('</ul>');
                htmlParts.push('<ol>');
                listType = 'ol';
            }
            htmlParts.push(`<li>${formatInline(orderedMatch[2])}</li>`);
            i++;
            continue;
        }

        if (listType) {
            htmlParts.push(`</${listType}>`);
            listType = null;
        }
        if (trimmedLine.length > 0) {
            htmlParts.push(`<p>${formatInline(line)}</p>`);
        }
        i++;
    }

    if (listType) htmlParts.push(`</${listType}>`);
    return htmlParts.join('');
};


const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  if (message.sender === MessageSender.SYSTEM) {
    return (
      <div className="text-center my-4">
        <p className="text-xs text-slate-500 italic bg-slate-700/50 px-3 py-1 rounded-full inline-block">
          {message.text}
        </p>
      </div>
    );
  }

  const isUser = message.sender === MessageSender.USER;

  return (
    <div className={`flex items-start gap-3 my-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600">
          <BotIcon className="w-5 h-5 text-sky-400" />
        </div>
      )}
      <div
        className={`max-w-xl p-3 px-4 rounded-2xl text-white ${isUser ? 'bg-sky-600 rounded-br-lg' : 'bg-slate-700 rounded-bl-lg'}`}
      >
        {isUser ? (
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.text}</p>
        ) : (
            <div 
                className="markdown-content text-sm"
                dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(message.text) }} 
            />
        )}
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600">
          <UserIcon className="w-5 h-5 text-slate-400" />
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
