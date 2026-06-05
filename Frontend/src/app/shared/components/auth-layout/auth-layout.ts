import { Component } from '@angular/core';
import { LanguageSwitcher } from '../language-switcher/language-switcher';
import { Footer } from '../footer/footer';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [LanguageSwitcher, Footer],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.css',
})
export class AuthLayout {}
