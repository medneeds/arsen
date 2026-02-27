import { useCallback, useRef } from 'react';

export function useNotificationSound() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playNotificationSound = useCallback(() => {
    try {
      // Create or reuse AudioContext
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      
      // Resume context if suspended (required for autoplay policies)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;

      // Create a pleasant two-tone notification sound
      const playTone = (frequency: number, startTime: number, duration: number, volume: number) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, startTime);

        // Envelope: quick attack, gentle decay
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      // Play a pleasant ascending two-note chime
      playTone(880, now, 0.15, 0.3);        // A5
      playTone(1108.73, now + 0.12, 0.2, 0.25); // C#6

      console.log('Notification sound played');
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }, []);

  return { playNotificationSound };
}
