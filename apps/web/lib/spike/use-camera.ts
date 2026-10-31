'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraStatus = 'idle' | 'starting' | 'live' | 'denied' | 'unavailable' | 'error';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<string>();
  const [torchSupported, setTorchSupported] = useState(false);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      setError('Camera API not available (needs HTTPS and a supported browser).');
      return;
    }
    setStatus('starting');
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        // Ask high: the 80vmin square is only part of the frame, and packet backs need ~1000px+ to stay legible.
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      const track = stream.getVideoTracks()[0];
      // iOS ends or mutes the track when the app is backgrounded; surface it instead of a frozen viewfinder.
      const paused = () => {
        setStatus('error');
        setError('Camera paused (app was in the background). Tap Try again.');
      };
      track.addEventListener('ended', paused);
      track.addEventListener('mute', paused);
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
      setTorchSupported(Boolean(caps.torch));
      setStatus('live');
    } catch (e) {
      const err = e as DOMException;
      if (err.name === 'NotAllowedError') setStatus('denied');
      else if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') setStatus('unavailable');
      else setStatus('error');
      setError(`${err.name}: ${err.message}`);
    }
  }, []);

  const torch = useCallback(async (on: boolean) => {
    const track = streamRef.current?.getVideoTracks()[0];
    await track?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
  }, []);

  useEffect(() => {
    const onVisible = () => {
      const track = streamRef.current?.getVideoTracks()[0];
      if (document.visibilityState === 'visible' && track && (track.readyState !== 'live' || track.muted)) {
        setStatus('error');
        setError('Camera paused (app was in the background). Tap Try again.');
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { videoRef, status, error, start, torch: torchSupported ? torch : undefined };
}
