import { useEffect, useState } from "react";

let push = () => {};

export function toast(msg) {
  push(msg);
}

export function ToastHost() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    push = (m) => {
      setMsg(m);
      setTimeout(() => setMsg(null), 3000);
    };
    return () => { push = () => {}; };
  }, []);
  if (!msg) return null;
  return <div className="toast">{msg}</div>;
}

export default ToastHost;

