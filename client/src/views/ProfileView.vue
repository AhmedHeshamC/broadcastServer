<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

const form = ref({
  username: authStore.user?.username || '',
  email: authStore.user?.email || '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)
const isSubmitting = ref(false)

const errors = ref<Record<string, string>>({})

const isPasswordFormValid = computed(() => {
  return (
    form.value.currentPassword &&
    form.value.newPassword &&
    form.value.confirmPassword &&
    form.value.newPassword.length >= 6 &&
    form.value.newPassword === form.value.confirmPassword
  )
})

const validatePasswordForm = () => {
  const newErrors: Record<string, string> = {}

  if (!form.value.currentPassword) {
    newErrors.currentPassword = 'Current password is required'
  }

  if (!form.value.newPassword) {
    newErrors.newPassword = 'New password is required'
  } else if (form.value.newPassword.length < 6) {
    newErrors.newPassword = 'Password must be at least 6 characters'
  }

  if (!form.value.confirmPassword) {
    newErrors.confirmPassword = 'Please confirm your new password'
  } else if (form.value.newPassword !== form.value.confirmPassword) {
    newErrors.confirmPassword = 'Passwords do not match'
  }

  errors.value = newErrors
  return Object.keys(newErrors).length === 0
}

const handleUpdateProfile = async () => {
  try {
    isSubmitting.value = true
    // TODO: Implement API call to update profile
    // await authApi.updateProfile(form.value.username, form.value.email)
    console.log('Profile update not yet implemented')
  } catch (error) {
    console.error('Profile update failed:', error)
  } finally {
    isSubmitting.value = false
  }
}

const handleChangePassword = async () => {
  if (!validatePasswordForm()) return

  try {
    isSubmitting.value = true
    // TODO: Implement API call to change password
    // await authApi.changePassword(form.value.currentPassword, form.value.newPassword)
    console.log('Password change not yet implemented')
  } catch (error) {
    console.error('Password change failed:', error)
  } finally {
    isSubmitting.value = false
  }
}

const clearForms = () => {
  form.value.currentPassword = ''
  form.value.newPassword = ''
  form.value.confirmPassword = ''
  errors.value = {}
}
</script>

<template>
  <v-container class="fill-height">
    <v-row justify="center" align="center">
      <v-col cols="12" sm="8" md="6" lg="5">
        <v-card class="elevation-8">
          <v-card-title class="text-center pa-6">
            <h1 class="text-h4 font-weight-bold text-primary">
              Profile
            </h1>
            <p class="text-subtitle-1 mt-2">
              Manage your account settings
            </p>
          </v-card-title>

          <v-card-text class="pa-6">
            <!-- Profile Information -->
            <v-form @submit.prevent="handleUpdateProfile">
              <h3 class="text-h6 mb-4">Profile Information</h3>

              <!-- Username Field -->
              <v-text-field
                v-model="form.username"
                label="Username"
                prepend-inner-icon="mdi-account"
                variant="outlined"
                class="mb-4"
                disabled
              />

              <!-- Email Field -->
              <v-text-field
                v-model="form.email"
                label="Email"
                type="email"
                prepend-inner-icon="mdi-email"
                variant="outlined"
                class="mb-4"
                disabled
              />

              <!-- Role -->
              <v-text-field
                :model-value="authStore.user?.role"
                label="Role"
                prepend-inner-icon="mdi-shield-account"
                variant="outlined"
                class="mb-4"
                disabled
              />

              <!-- Account Created -->
              <v-text-field
                :model-value="new Date(authStore.user?.createdAt || '').toLocaleDateString()"
                label="Account Created"
                prepend-inner-icon="mdi-calendar"
                variant="outlined"
                class="mb-4"
                disabled
              />

              <v-alert
                type="info"
                variant="tonal"
                class="mb-4"
              >
                Profile editing is not yet implemented. Contact an admin to make changes.
              </v-alert>
            </v-form>

            <!-- Password Change -->
            <v-divider class="my-6" />

            <v-form @submit.prevent="handleChangePassword">
              <h3 class="text-h6 mb-4">Change Password</h3>

              <!-- Current Password -->
              <v-text-field
                v-model="form.currentPassword"
                label="Current Password"
                :type="showCurrentPassword ? 'text' : 'password'"
                prepend-inner-icon="mdi-lock"
                :append-inner-icon="showCurrentPassword ? 'mdi-eye' : 'mdi-eye-off'"
                @click:append-inner="showCurrentPassword = !showCurrentPassword"
                variant="outlined"
                class="mb-4"
                :error-messages="errors.currentPassword"
                :disabled="isSubmitting"
                @input="errors.currentPassword = ''"
              />

              <!-- New Password -->
              <v-text-field
                v-model="form.newPassword"
                label="New Password"
                :type="showNewPassword ? 'text' : 'password'"
                prepend-inner-icon="mdi-lock-plus"
                :append-inner-icon="showNewPassword ? 'mdi-eye' : 'mdi-eye-off'"
                @click:append-inner="showNewPassword = !showNewPassword"
                variant="outlined"
                class="mb-4"
                :error-messages="errors.newPassword"
                :disabled="isSubmitting"
                @input="errors.newPassword = ''"
              />

              <!-- Confirm New Password -->
              <v-text-field
                v-model="form.confirmPassword"
                label="Confirm New Password"
                :type="showConfirmPassword ? 'text' : 'password'"
                prepend-inner-icon="mdi-lock-check"
                :append-inner-icon="showConfirmPassword ? 'mdi-eye' : 'mdi-eye-off'"
                @click:append-inner="showConfirmPassword = !showConfirmPassword"
                variant="outlined"
                class="mb-4"
                :error-messages="errors.confirmPassword"
                :disabled="isSubmitting"
                @input="errors.confirmPassword = ''"
              />

              <v-alert
                type="info"
                variant="tonal"
                class="mb-4"
              >
                Password change is not yet implemented. Contact an admin for assistance.
              </v-alert>

              <v-btn
                type="submit"
                color="primary"
                size="large"
                block
                :loading="isSubmitting"
                :disabled="!isPasswordFormValid || isSubmitting"
                @click="handleChangePassword"
              >
                Change Password
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.v-card {
  border-radius: 16px;
}

.v-container {
  min-height: 100vh;
  background: linear-gradient(135deg, var(--v-theme-surface) 0%, var(--v-theme-surface-variant) 100%);
}
</style>