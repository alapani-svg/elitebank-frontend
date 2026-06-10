import { Component, OnInit } from '@angular/core';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit {

  loginForm!: FormGroup;
  isLoading = false;
  serverError = '';
  successMessage = '';
  showPassword = false;
  private returnUrl = '/dashboard';

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
    const verified = this.route.snapshot.queryParamMap.get('verified');
    const email = this.route.snapshot.queryParamMap.get('email');
    if (email) {
      this.successMessage = verified === '1'
        ? 'Your email has been verified. Please login.'
        : '';
    }
    if (this.auth.isLoggedIn()) {
      this.router.navigate([this.returnUrl]);
    }

    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });

    const emailFromQuery = this.route.snapshot.queryParamMap.get('email');
    if (emailFromQuery) {
      this.loginForm.patchValue({ email: emailFromQuery });
    }
  }

  get f() { return this.loginForm.controls; }
  togglePassword(): void { this.showPassword = !this.showPassword; }

  onSubmit(): void {
    if (this.loginForm.invalid || this.isLoading) return;
    this.isLoading = true;
    this.serverError = '';

    this.auth.login(this.loginForm.value).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate([this.returnUrl]);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading = false;
        this.serverError = this.parseError(err);
      }
    });
  }

  private parseError(err: HttpErrorResponse): string {
    if (!err.error) return 'An unexpected error occurred. Please try again.';
    if (err.error.detail) return err.error.detail;
    if (typeof err.error === 'string') return err.error;
    const messages: string[] = [];
    for (const key of Object.keys(err.error)) {
      const val = err.error[key];
      messages.push(Array.isArray(val) ? val.join(', ') : String(val));
    }
    return messages.join(' | ') || 'Login failed. Please check your credentials.';
  }
}
