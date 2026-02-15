import { useState, useEffect, useRef } from "react";
import { getAnalysisResult } from "../services/api";

export default function usePolling(jobId, interval = 3000) {
  const [result, setResult] = useState(null);
  const [polling, setPolling] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!jobId) return;

    setPolling(true);

    const poll = async () => {
      try {
        const data = await getAnalysisResult(jobId);
        setResult(data);

        if (data.status === "completed" || data.status === "failed") {
          setPolling(false);
          clearInterval(timerRef.current);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    poll();
    timerRef.current = setInterval(poll, interval);

    return () => {
      clearInterval(timerRef.current);
      setPolling(false);
    };
  }, [jobId, interval]);

  return { result, polling };
}
