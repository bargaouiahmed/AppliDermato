import { Injectable } from '@angular/core';
import iziToast from 'izitoast';

@Injectable({ providedIn: 'root' })
export class InternalMessagingNotificationService {
  private audioCtx?: AudioContext;

  async requestPermission(): Promise<void> {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }

  initAudio(): void {
    const AudioContextCtor =
      window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) {
      return;
    }

    if (!this.audioCtx) {
      this.audioCtx = new AudioContextCtor();
    }

    if (this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }
  }

  notify(title: string, body: string): void {
    this.notifySoundOnly();

    iziToast.show({
      title,
      message: body,
      titleColor: '#800f2f',
      messageColor: '#800f2f',
      progressBarColor: '#c9184a',
      backgroundColor: '#ff8fa3',
      position: 'topRight',
      timeout: 6000,
      transitionIn: 'flipInX',
      transitionOut: 'flipOutX',
    });

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  }

  notifySoundOnly(): void {
    if (!this.audioCtx) {
      return;
    }

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.1;
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.15);
  }
}
