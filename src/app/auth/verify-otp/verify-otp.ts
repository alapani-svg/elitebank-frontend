import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-verify-otp',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './verify-otp.html',
  styleUrl:    './verify-otp.scss',
})
export class VerifyOtp implements OnInit, OnDestroy {

  otpForm!: FormGroup;
  challengeId    = '';
  maskedEmail    = '';
  registeredEmail = '';

  loading = false;
  error   = '';

  resendCooldown = 0;
  private resendTimer?: ReturnType<typeof setInterval>;

  constructor(
    private fb:     FormBuilder,
    private auth:   AuthService,
    private route:  ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const navState = (history.state || {}) as {
      challenge_id?: string; masked_email?: string; email?: string;
    };
    const qp = this.route.snapshot.queryParamMap;

    this.challengeId     = navState.challenge_id  || qp.get('challenge_id')  || '';
    this.maskedEmail     = navState.masked_email  || qp.get('masked_email')  || '';
    this.registeredEmail = navState.email         || qp.get('email')         || '';

    if (!this.challengeId) {
      this.router.navigate(['/register']);
      return;
    }

    this.otpForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });

    this.startResendCooldown(30);
  }

  ngOnDestroy(): void {
    this.stopResendCooldown();
  }

  get f() { return this.otpForm.controls; }

  verify(): void {
    if (this.otpForm.invalid || this.loading) return;
    this.loading = true;
    this.error   = '';

    this.auth.verifyRegistration(this.challengeId, this.otpForm.value.code).subscribe({
      next: () => {
        this.loading = false;
        this.stopResendCooldown();
        this.router.navigate(['/login'], {
          queryParams: { verified: '1', email: this.registeredEmail },
        });
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.error   = err.error?.detail || 'Could not verify the code. Please try again.';
        this.otpForm.patchValue({ code: '' });
      },
    });
  }

  resend(): void {
    if (this.resendCooldown > 0 || this.loading || !this.registeredEmail) return;
    this.error = '';
    this.auth.resendRegistrationOtp(this.registeredEmail).subscribe({
      next: (res) => {
        if (res.challenge_id) this.challengeId = res.challenge_id;
        if (res.masked_email) this.maskedEmail = res.masked_email;
        this.startResendCooldown(30);
      },
      error: (err: HttpErrorResponse) => {
        this.error = err.error?.detail || 'Could not resend the code. Please try again.';
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/register']);
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
