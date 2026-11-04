'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createCameraSession, type CameraStatus } from './camera-session';

export type { CameraStatus } from './camera-session';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<string>();
  const [torchSupported, setTorchSupported] = useState(false);

  const sessionRef = useRef<ReturnType<typeof createCameraSession> | null>(null);
  if (!sessionRef.current && typeof window !== 'undefined') {
    sessionRef.current = createCameraSession({
      getUserMedia: () =>
        navigator.mediaDevices.getUserMedia({
          audio: false,
          // Ask high: the 80vmin square is only part of the frame, and packet backs need ~1000px+ to stay legible.
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } },
        }),
      attach: async (stream) => {
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        if (stream) await video.play();
      },
      onStatus: (s, e) => {
        setStatus(s);
        setError(e);
      },
      onTorch: setTorchSupported,
      now: () => performance.now(),
    });
  }

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      setError('Camera API not available (needs HTTPS and a supported browser).');
      return;
    }
    await sessionRef.current?.start();
  }, []);

  const torch = useCallback(async (on: boolean) => {
    await sessionRef.current?.track()?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
  }, []);

  useEffect(() => {
    const session = sessionRef.current!;
    // iOS blanks the camera in the background and never restores it: release on hide, reopen on show.
    const onVisibility = () => (document.visibilityState === 'hidden' ? session.suspend() : void session.resume());
    const onPageHide = () => session.suspend();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onVisibility);
      session.stop();
    };
  }, []);

  return { videoRef, status, error, start, torch: torchSupported ? torch : undefined };
}
