import { Injectable } from '@angular/core';
import iziToast from 'izitoast';

@Injectable({ providedIn: 'root' })
export class ToastService {
  success(message: string): void {
    iziToast.show({
      message: message?.trim() || 'Bien enregistré',
      messageColor: '#386641',
      progressBarColor: '#6a994e',
      position: 'topRight',
      timeout: 3200,
      backgroundColor: '#dde5b6',
      transitionIn: 'flipInX',
      transitionOut: 'flipOutX',
    });
  }

  info(message: string): void {
    iziToast.show({
      message: message?.trim() || 'Information',
      messageColor: '#175042',
      progressBarColor: '#c89568',
      position: 'topRight',
      timeout: 3200,
      backgroundColor: '#f6efe6',
      transitionIn: 'flipInX',
      transitionOut: 'flipOutX',
    });
  }

  error(message: string): void {
    iziToast.show({
      message,
      messageColor: '#800f2f',
      titleColor: '#800f2f',
      progressBarColor: '#c9184a',
      position: 'topRight',
      timeout: 5000,
      backgroundColor: '#ff8fa3',
      transitionIn: 'flipInX',
      transitionOut: 'flipOutX',
      overlay: true,
      overlayClose: true,
    });
  }
}
