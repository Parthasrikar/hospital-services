import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UiIconComponent, UiInputComponent } from '@hospital-services/ui-kit-web';
import { AuthApiService } from '@hospital-services/api-client';

@Component({
  selector: 'app-onboarding-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, UiIconComponent, UiInputComponent],
  templateUrl: './onboarding.page.html',
  styleUrls: ['./onboarding.page.scss'],
})
export class OnboardingPage {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  public authApi = inject(AuthApiService);

  isLoading = false;
  serverError: string | null = null;

  onboardingForm: FormGroup = this.fb.group({
    phone: ['', [Validators.required, Validators.minLength(10)]],
    role: ['PATIENT', [Validators.required]],
    specialization: [''],
    licenseNumber: [''],
    consultationFee: [100],
  });

  get isDoctor(): boolean {
    return this.onboardingForm.get('role')?.value === 'DOCTOR';
  }

  onSubmit(): void {
    if (this.onboardingForm.invalid) {
      this.onboardingForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.serverError = null;

    const payload = this.onboardingForm.value;

    this.authApi.completeOnboarding(payload).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading = false;
        const msg = err.response?.data?.message || err.error?.message || err.message;
        this.serverError = Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to complete profile onboarding.';
      },
    });
  }
}
