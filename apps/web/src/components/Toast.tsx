import { useCallback, useEffect, useRef, useState } from 'react';

export function useToast() {
  const [msg, setMsg] = useState<{ text: string; id: number } | null>(null);
  const timer = useRef<number>();
  const show = useCallback((text: string) => {
    window.clearTimeout(timer.current);
    setMsg({ text, id: Date.now() });
    timer.current = window.setTimeout(() => setMsg(null), 2600);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const node = msg ? (
    <div className="toast" role="status" key={msg.id}>{msg.text}</div>
  ) : null;
  return { show, node };
}
