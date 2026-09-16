import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UiIconComponent, UiInputComponent } from '@hospital-services/ui-kit-web';
import { AuthApiService } from '@hospital-services/api-client';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, UiIconComponent, UiInputComponent],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  public authApi = inject(AuthApiService);

  isLoading = false;
  serverError: string | null = null;

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  get emailError(): string | undefined {
    const control = this.loginForm.get('email');
    if (!control || !control.touched || !control.invalid) return undefined;
    if (control.hasError('required')) return 'Email address is required';
    if (control.hasError('email')) return 'Please enter a valid email address';
    return 'Invalid email address';
  }

  get passwordError(): string | undefined {
    const control = this.loginForm.get('password');
    if (!control || !control.touched || !control.invalid) return undefined;
    if (control.hasError('required')) return 'Password is required';
    if (control.hasError('minlength')) return 'Password must be at least 6 characters';
    return 'Invalid password';
  }

  onGoogleLogin(): void {
    this.authApi.loginWithGoogleRedirect();
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.serverError = null;

    const credentials = {
      email: this.loginForm.value.email,
      password: this.loginForm.value.password,
    };

    this.authApi.login(credentials).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.isProfileComplete === false) {
          this.router.navigate(['/auth/onboarding']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.isLoading = false;
        const msg = err.response?.data?.message || err.error?.message || err.message;
        this.serverError = Array.isArray(msg) ? msg.join(', ') : msg || 'Invalid email or password. Please try again.';
      },
    });
  }
}
