<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { adminApi } from '@/services/api'
import type { User, SystemStats, AuditLog } from '@/types/types'

const authStore = useAuthStore()

// Data
const stats = ref<SystemStats | null>(null)
const users = ref<User[]>([])
const auditLogs = ref<AuditLog[]>([])
const loading = ref({
  stats: false,
  users: false,
  auditLogs: false,
  userAction: false
})

const userDialog = ref(false)
const auditDialog = ref(false)
const selectedUser = ref<User | null>(null)

// Pagination
const userPagination = ref({
  page: 1,
  limit: 20,
  total: 0
})

const auditPagination = ref({
  page: 1,
  limit: 50,
  total: 0
})

// Filters
const userFilters = ref({
  role: '',
  status: '',
  search: ''
})

const auditFilters = ref({
  userId: '',
  eventType: '',
  startDate: '',
  endDate: ''
})

// Headers for data tables
const userHeaders = [
  { title: 'Username', key: 'username', align: 'start' },
  { title: 'Email', key: 'email' },
  { title: 'Role', key: 'role' },
  { title: 'Status', key: 'isActive' },
  { title: 'Created', key: 'createdAt' },
  { title: 'Last Login', key: 'lastLogin' },
  { title: 'Actions', key: 'actions', sortable: false }
]

const auditHeaders = [
  { title: 'Timestamp', key: 'timestamp', align: 'start' },
  { title: 'User', key: 'username' },
  { title: 'Event', key: 'eventType' },
  { title: 'IP Address', key: 'ipAddress' },
  { title: 'Success', key: 'success' }
]

// Computed properties
const filteredUsers = computed(() => {
  let result = users.value

  if (userFilters.value.role) {
    result = result.filter(user => user.role === userFilters.value.role)
  }

  if (userFilters.value.status) {
    const isActive = userFilters.value.status === 'active'
    result = result.filter(user => user.isActive === isActive)
  }

  if (userFilters.value.search) {
    const search = userFilters.value.search.toLowerCase()
    result = result.filter(user =>
      user.username.toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search)
    )
  }

  return result
})

const filteredAuditLogs = computed(() => {
  let result = auditLogs.value

  if (auditFilters.value.userId) {
    result = result.filter(log => log.userId === auditFilters.value.userId)
  }

  if (auditFilters.value.eventType) {
    result = result.filter(log => log.eventType === auditFilters.value.eventType)
  }

  if (auditFilters.value.startDate) {
    const startDate = new Date(auditFilters.value.startDate)
    result = result.filter(log => new Date(log.timestamp) >= startDate)
  }

  if (auditFilters.value.endDate) {
    const endDate = new Date(auditFilters.value.endDate)
    endDate.setHours(23, 59, 59, 999)
    result = result.filter(log => new Date(log.timestamp) <= endDate)
  }

  return result
})

// Methods
const loadStats = async () => {
  try {
    loading.value.stats = true
    const response = await adminApi.getSystemStats()
    stats.value = response
  } catch (error) {
    console.error('Failed to load stats:', error)
  } finally {
    loading.value.stats = false
  }
}

const loadUsers = async () => {
  try {
    loading.value.users = true
    const response = await adminApi.getAllUsers(
      userPagination.value.page,
      userPagination.value.limit
    )
    users.value = response.users
    userPagination.value.total = response.total
  } catch (error) {
    console.error('Failed to load users:', error)
  } finally {
    loading.value.users = false
  }
}

const loadAuditLogs = async () => {
  try {
    loading.value.auditLogs = true
    const response = await adminApi.getAuditLogs(
      auditPagination.value.page,
      auditPagination.value.limit,
      auditFilters.value
    )
    auditLogs.value = response.auditLogs
    auditPagination.value.total = response.total
  } catch (error) {
    console.error('Failed to load audit logs:', error)
  } finally {
    loading.value.auditLogs = false
  }
}

const toggleUserBan = async (user: User) => {
  try {
    loading.value.userAction = true
    const response = await adminApi.toggleUserBan(user._id)

    // Update user in the list
    const index = users.value.findIndex(u => u._id === user._id)
    if (index !== -1) {
      users.value[index] = response.user
    }
  } catch (error) {
    console.error('Failed to toggle user ban:', error)
  } finally {
    loading.value.userAction = false
  }
}

const changeUserRole = async (user: User, newRole: 'user' | 'admin') => {
  try {
    loading.value.userAction = true
    const response = await adminApi.updateUserRole(user._id, newRole)

    // Update user in the list
    const index = users.value.findIndex(u => u._id === user._id)
    if (index !== -1) {
      users.value[index] = response.user
    }
  } catch (error) {
    console.error('Failed to change user role:', error)
  } finally {
    loading.value.userAction = false
  }
}

const viewUserDetails = (user: User) => {
  selectedUser.value = user
  userDialog.value = true
}

const formatDate = (dateString: string) => {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleString()
}

const formatTimestamp = (timestamp: string) => {
  return new Date(timestamp).toLocaleString()
}

const getRoleColor = (role: string) => {
  return role === 'admin' ? 'warning' : 'primary'
}

const getStatusColor = (isActive: boolean) => {
  return isActive ? 'success' : 'error'
}

// Lifecycle
onMounted(async () => {
  await Promise.all([
    loadStats(),
    loadUsers(),
    loadAuditLogs()
  ])
})
</script>

<template>
  <v-container class="fill-height">
    <v-row>
      <!-- System Stats -->
      <v-col cols="12">
        <h1 class="text-h3 font-weight-bold mb-6">
          Admin Dashboard
        </h1>

        <!-- Stats Cards -->
        <v-row class="mb-6">
          <v-col cols="12" sm="6" md="3">
            <v-card elevation="2" class="h-100">
              <v-card-text class="text-center">
                <v-icon size="40" color="primary" class="mb-2">
                  mdi-account-group
                </v-icon>
                <div class="text-h4 font-weight-bold">
                  {{ stats?.totalUsers || 0 }}
                </div>
                <div class="text-subtitle-1 text-medium-emphasis">
                  Total Users
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" sm="6" md="3">
            <v-card elevation="2" class="h-100">
              <v-card-text class="text-center">
                <v-icon size="40" color="success" class="mb-2">
                  mdi-account-check
                </v-icon>
                <div class="text-h4 font-weight-bold">
                  {{ stats?.activeUsers || 0 }}
                </div>
                <div class="text-subtitle-1 text-medium-emphasis">
                  Active Users
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" sm="6" md="3">
            <v-card elevation="2" class="h-100">
              <v-card-text class="text-center">
                <v-icon size="40" color="info" class="mb-2">
                  mdi-message
                </v-icon>
                <div class="text-h4 font-weight-bold">
                  {{ stats?.totalMessages || 0 }}
                </div>
                <div class="text-subtitle-1 text-medium-emphasis">
                  Total Messages
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" sm="6" md="3">
            <v-card elevation="2" class="h-100">
              <v-card-text class="text-center">
                <v-icon size="40" color="warning" class="mb-2">
                  mdi-wifi
                </v-icon>
                <div class="text-h4 font-weight-bold">
                  {{ stats?.totalConnections || 0 }}
                </div>
                <div class="text-subtitle-1 text-medium-emphasis">
                  Active Connections
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Users Management -->
        <v-card elevation="2" class="mb-6">
          <v-card-title class="d-flex align-center pa-4">
            <v-icon start>mdi-account-group</v-icon>
            Users Management
            <v-spacer />
            <v-btn
              color="primary"
              variant="outlined"
              prepend-icon="mdi-refresh"
              :loading="loading.users"
              @click="loadUsers"
            >
              Refresh
            </v-btn>
          </v-card-title>

          <v-card-text class="pa-0">
            <!-- User Filters -->
            <v-row class="pa-4 pb-0">
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="userFilters.search"
                  label="Search users..."
                  prepend-inner-icon="mdi-magnify"
                  variant="outlined"
                  density="compact"
                  clearable
                />
              </v-col>
              <v-col cols="12" sm="4">
                <v-select
                  v-model="userFilters.role"
                  label="Role"
                  :items="[
                    { title: 'All', value: '' },
                    { title: 'User', value: 'user' },
                    { title: 'Admin', value: 'admin' }
                  ]"
                  variant="outlined"
                  density="compact"
                  clearable
                />
              </v-col>
              <v-col cols="12" sm="4">
                <v-select
                  v-model="userFilters.status"
                  label="Status"
                  :items="[
                    { title: 'All', value: '' },
                    { title: 'Active', value: 'active' },
                    { title: 'Inactive', value: 'inactive' }
                  ]"
                  variant="outlined"
                  density="compact"
                  clearable
                />
              </v-col>
            </v-row>

            <!-- Users Table -->
            <v-data-table
              :headers="userHeaders"
              :items="filteredUsers"
              :loading="loading.users"
              :items-per-page="userPagination.limit"
              class="elevation-0"
            >
              <template #[`item.role`]="{ item }">
                <v-chip
                  :color="getRoleColor(item.role)"
                  variant="flat"
                  size="small"
                >
                  {{ item.role }}
                </v-chip>
              </template>

              <template #[`item.isActive`]="{ item }">
                <v-chip
                  :color="getStatusColor(item.isActive)"
                  variant="flat"
                  size="small"
                >
                  {{ item.isActive ? 'Active' : 'Banned' }}
                </v-chip>
              </template>

              <template #[`item.createdAt`]="{ item }">
                <span class="text-caption">
                  {{ formatDate(item.createdAt) }}
                </span>
              </template>

              <template #[`item.lastLogin`]="{ item }">
                <span class="text-caption">
                  {{ formatDate(item.lastLogin) }}
                </span>
              </template>

              <template #[`item.actions`]="{ item }">
                <div class="d-flex ga-2">
                  <v-btn
                    size="small"
                    variant="text"
                    color="primary"
                    @click="viewUserDetails(item)"
                  >
                    <v-icon>mdi-eye</v-icon>
                  </v-btn>

                  <v-btn
                    size="small"
                    variant="text"
                    :color="item.isActive ? 'error' : 'success'"
                    :loading="loading.userAction"
                    @click="toggleUserBan(item)"
                  >
                    <v-icon>{{ item.isActive ? 'mdi-account-off' : 'mdi-account-check' }}</v-icon>
                  </v-btn>

                  <v-menu v-if="item.role !== 'admin' || item._id !== authStore.user?._id">
                    <template #activator="{ props }">
                      <v-btn
                        size="small"
                        variant="text"
                        v-bind="props"
                      >
                        <v-icon>mdi-dots-vertical</v-icon>
                      </v-btn>
                    </template>

                    <v-list>
                      <v-list-item
                        @click="changeUserRole(item, item.role === 'user' ? 'admin' : 'user')"
                        :loading="loading.userAction"
                      >
                        <v-list-item-title>
                          Make {{ item.role === 'user' ? 'Admin' : 'User' }}
                        </v-list-item-title>
                      </v-list-item>
                    </v-list>
                  </v-menu>
                </div>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>

        <!-- Audit Logs -->
        <v-card elevation="2">
          <v-card-title class="d-flex align-center pa-4">
            <v-icon start>mdi-history</v-icon>
            Audit Logs
            <v-spacer />
            <v-btn
              color="primary"
              variant="outlined"
              prepend-icon="mdi-refresh"
              :loading="loading.auditLogs"
              @click="loadAuditLogs"
            >
              Refresh
            </v-btn>
          </v-card-title>

          <v-card-text class="pa-0">
            <!-- Audit Filters -->
            <v-row class="pa-4 pb-0">
              <v-col cols="12" sm="3">
                <v-text-field
                  v-model="auditFilters.userId"
                  label="User ID"
                  variant="outlined"
                  density="compact"
                  clearable
                />
              </v-col>
              <v-col cols="12" sm="3">
                <v-select
                  v-model="auditFilters.eventType"
                  label="Event Type"
                  :items="[
                    { title: 'All Events', value: '' },
                    { title: 'Login', value: 'login_success' },
                    { title: 'Login Failed', value: 'login_failed' },
                    { title: 'Logout', value: 'logout' },
                    { title: 'Message Sent', value: 'message_sent' },
                    { title: 'User Banned', value: 'user_banned' }
                  ]"
                  variant="outlined"
                  density="compact"
                  clearable
                />
              </v-col>
              <v-col cols="12" sm="3">
                <v-text-field
                  v-model="auditFilters.startDate"
                  label="Start Date"
                  type="date"
                  variant="outlined"
                  density="compact"
                  clearable
                />
              </v-col>
              <v-col cols="12" sm="3">
                <v-text-field
                  v-model="auditFilters.endDate"
                  label="End Date"
                  type="date"
                  variant="outlined"
                  density="compact"
                  clearable
                />
              </v-col>
            </v-row>

            <!-- Audit Logs Table -->
            <v-data-table
              :headers="auditHeaders"
              :items="filteredAuditLogs"
              :loading="loading.auditLogs"
              :items-per-page="auditPagination.limit"
              class="elevation-0"
            >
              <template #[`item.timestamp`]="{ item }">
                <span class="text-caption">
                  {{ formatTimestamp(item.timestamp) }}
                </span>
              </template>

              <template #[`item.eventType`]="{ item }">
                <v-chip
                  variant="tonal"
                  size="small"
                  :color="item.success ? 'success' : 'error'"
                >
                  {{ item.eventType.replace(/_/g, ' ').toUpperCase() }}
                </v-chip>
              </template>

              <template #[`item.success`]="{ item }">
                <v-icon
                  :color="item.success ? 'success' : 'error'"
                  size="small"
                >
                  {{ item.success ? 'mdi-check-circle' : 'mdi-close-circle' }}
                </v-icon>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- User Details Dialog -->
    <v-dialog v-model="userDialog" max-width="500">
      <v-card v-if="selectedUser">
        <v-card-title class="d-flex align-center">
          <v-icon start>mdi-account-details</v-icon>
          User Details
          <v-spacer />
          <v-btn icon variant="text" @click="userDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>

        <v-card-text>
          <v-list>
            <v-list-item>
              <v-list-item-title>Username</v-list-item-title>
              <v-list-item-subtitle>{{ selectedUser.username }}</v-list-item-subtitle>
            </v-list-item>

            <v-list-item>
              <v-list-item-title>Email</v-list-item-title>
              <v-list-item-subtitle>{{ selectedUser.email }}</v-list-item-subtitle>
            </v-list-item>

            <v-list-item>
              <v-list-item-title>Role</v-list-item-title>
              <v-list-item-subtitle>
                <v-chip
                  :color="getRoleColor(selectedUser.role)"
                  variant="flat"
                  size="small"
                >
                  {{ selectedUser.role }}
                </v-chip>
              </v-list-item-subtitle>
            </v-list-item>

            <v-list-item>
              <v-list-item-title>Status</v-list-item-title>
              <v-list-item-subtitle>
                <v-chip
                  :color="getStatusColor(selectedUser.isActive)"
                  variant="flat"
                  size="small"
                >
                  {{ selectedUser.isActive ? 'Active' : 'Banned' }}
                </v-chip>
              </v-list-item-subtitle>
            </v-list-item>

            <v-list-item>
              <v-list-item-title>Account Created</v-list-item-title>
              <v-list-item-subtitle>{{ formatDate(selectedUser.createdAt) }}</v-list-item-subtitle>
            </v-list-item>

            <v-list-item>
              <v-list-item-title>Last Login</v-list-item-title>
              <v-list-item-subtitle>{{ formatDate(selectedUser.lastLogin) }}</v-list-item-subtitle>
            </v-list-item>

            <v-list-item v-if="selectedUser.oauthProvider">
              <v-list-item-title>OAuth Provider</v-list-item-title>
              <v-list-item-subtitle>{{ selectedUser.oauthProvider }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn @click="userDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.v-container {
  min-height: 100vh;
  background: linear-gradient(135deg, var(--v-theme-surface) 0%, var(--v-theme-surface-variant) 100%);
}

.v-card {
  border-radius: 12px;
}

.v-data-table {
  border-radius: 0;
}

.v-data-table :deep(.v-data-table__tr:hover) {
  background-color: rgba(var(--v-theme-primary), 0.04);
}
</style>