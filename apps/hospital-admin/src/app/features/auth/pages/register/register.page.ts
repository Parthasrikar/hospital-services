import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UiIconComponent, UiInputComponent } from '@hospital-services/ui-kit-web';
import { AuthApiService } from '@hospital-services/api-client';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  if (password && confirmPassword && password !== confirmPassword) {
    return { passwordMismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, UiIconComponent, UiInputComponent],
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authApi = inject(AuthApiService);

  isLoading = false;
  serverError: string | null = null;

  registerForm: FormGroup = this.fb.group(
    {
      fullName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator }
  );

  get fullNameError(): string | undefined {
    const control = this.registerForm.get('fullName');
    if (!control || !control.touched || !control.invalid) return undefined;
    if (control.hasError('required')) return 'Full name is required';
    return undefined;
  }

  get emailError(): string | undefined {
    const control = this.registerForm.get('email');
    if (!control || !control.touched || !control.invalid) return undefined;
    if (control.hasError('required')) return 'Email address is required';
    if (control.hasError('email')) return 'Please enter a valid email address';
    return undefined;
  }

  get passwordError(): string | undefined {
    const control = this.registerForm.get('password');
    if (!control || !control.touched || !control.invalid) return undefined;
    if (control.hasError('required')) return 'Password is required';
    if (control.hasError('minlength')) return 'Password must be at least 6 characters';
    return undefined;
  }

  get confirmPasswordError(): string | undefined {
    const control = this.registerForm.get('confirmPassword');
    if (!control || !control.touched) return undefined;
    if (control.hasError('required')) return 'Please confirm your password';
    if (this.registerForm.hasError('passwordMismatch')) return 'Passwords do not match';
    return undefined;
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.serverError = null;

    const payload = {
      fullName: this.registerForm.value.fullName,
      email: this.registerForm.value.email,
      password: this.registerForm.value.password,
      phone: this.registerForm.value.phone || undefined,
    };

    this.authApi.register(payload).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading = false;
        const msg = err.response?.data?.message || err.error?.message || err.message;
        this.serverError = Array.isArray(msg) ? msg.join(', ') : msg || 'Registration failed. Please try again.';
      },
    });
  }
}
