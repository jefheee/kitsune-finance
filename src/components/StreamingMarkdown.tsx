"use client";

import { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface StreamingMarkdownProps {
  content: string;
  isNew?: boolean;
  onUpdate?: () => void;
  onComplete?: () => void;
}

export default function StreamingMarkdown({
  content,
  isNew = false,
  onUpdate,
  onComplete,
}: StreamingMarkdownProps) {
  const [displayedLength, setDisplayedLength] = useState(() => (isNew ? 0 : content.length));
  const onUpdateRef = useRef(onUpdate);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    if (!isNew) {
      setDisplayedLength(content.length);
      return;
    }

    if (displayedLength >= content.length) {
      onCompleteRef.current?.();
      return;
    }

    // Calcula velocidade dinâmica: mais rápido para textos longos para não demorar demais
    const remaining = content.length - displayedLength;
    const chunkSize = remaining > 1000 ? 16 : remaining > 300 ? 8 : remaining > 100 ? 4 : 2;
    const intervalMs = 18; // Fluido e agradável (não muito rápido nem muito lento)

    const timer = setInterval(() => {
      setDisplayedLength((prev) => {
        const next = Math.min(prev + chunkSize, content.length);
        onUpdateRef.current?.();
        if (next >= content.length) {
          clearInterval(timer);
          onCompleteRef.current?.();
        }
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [content, isNew, displayedLength]);

  const textToRender = isNew ? content.slice(0, displayedLength) : content;

  return (
    <div className="kitsune-markdown prose prose-invert max-w-none text-sm font-sans leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {textToRender}
      </ReactMarkdown>
      {isNew && displayedLength < content.length && (
        <span className="inline-block w-2 h-4 ml-1 bg-amber-400 animate-pulse align-middle rounded-sm" />
      )}
    </div>
  );
}
