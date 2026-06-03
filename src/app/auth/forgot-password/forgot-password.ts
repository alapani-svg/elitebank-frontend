import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './forgot-password.html',
  styleUrl:    './forgot-password.scss',
})
export class ForgotPassword implements OnInit, OnDestroy {

  emailForm!: FormGroup;
  otpForm!:   FormGroup;

  loading      = false;
  otpLoading   = false;
  errorMessage = '';
  otpError     = '';

  challengeId    = '';
  maskedEmail    = '';
  submittedEmail = '';

  resendCooldown = 0;
  private resendTimer?: ReturnType<typeof setInterval>;

  constructor(
    private fb:     FormBuilder,
    private auth:   AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });

    this.otpForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });
  }

  ngOnDestroy(): void {
    this.stopResendCooldown();
  }

  get f()  { return this.emailForm.controls; }
  get of() { return this.otpForm.controls; }

  submit(): void {
    if (this.emailForm.invalid || this.loading) return;
    this.loading      = true;
    this.errorMessage = '';

    this.auth.requestPasswordReset(this.emailForm.value.email).subscribe({
      next: (res) => {
        this.loading        = false;
        this.challengeId    = res.challenge_id || '';
        this.maskedEmail    = res.masked_email || '';
        this.submittedEmail = res.email || this.emailForm.value.email;
        if (this.challengeId) this.startResendCooldown(30);
      },
      error: (err: HttpErrorResponse) => {
        this.loading      = false;
        this.errorMessage = err.error?.detail || 'Something went wrong. Please try again.';
      },
    });
  }

  verifyOtp(): void {
    if (this.otpForm.invalid || this.otpLoading) return;
    this.otpLoading = true;
    this.otpError   = '';

    this.auth.verifyPasswordResetOtp(this.challengeId, this.otpForm.value.code).subscribe({
      next: (res) => {
        this.otpLoading = false;
        this.stopResendCooldown();
        this.router.navigate(['/reset-password'], {
          queryParams: { token: res.reset_token },
        });
      },
      error: (err: HttpErrorResponse) => {
        this.otpLoading = false;
        this.otpError   = err.error?.detail || 'Could not verify the code. Please try again.';
        this.otpForm.patchValue({ code: '' });
      },
    });
  }

  resendOtp(): void {
    if (this.resendCooldown > 0 || this.otpLoading || !this.submittedEmail) return;
    this.otpError = '';
    this.auth.requestPasswordReset(this.submittedEmail).subscribe({
      next: (res) => {
        if (res.challenge_id) this.challengeId = res.challenge_id;
        if (res.masked_email) this.maskedEmail = res.masked_email;
        this.startResendCooldown(30);
      },
      error: (err: HttpErrorResponse) => {
        this.otpError = err.error?.detail || 'Could not resend the code. Please try again.';
      },
    });
  }

  cancelOtp(): void {
    this.challengeId    = '';
    this.maskedEmail    = '';
    this.submittedEmail = '';
    this.otpForm.reset();
    this.stopResendCooldown();
  }

  private startResendCooldown(seconds: number): void {
    this.stopResendCooldown();
    this.resendCooldown = seconds;
    this.resendTimer = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) this.stopResendCooldown();
    }, 1000);
  }

  private stopResendCooldown(): void {
    if (this.resendTimer) { clearInterval(this.resendTimer); this.resendTimer = undefined; }
    this.resendCooldown = 0;
  }
}
