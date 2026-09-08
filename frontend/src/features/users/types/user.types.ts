export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'SALES' | 'SHIPPING';
  isActive: boolean;
  createdAt: string;
  status: 'ACTIVE' | 'DISABLED';
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: 'SALES' | 'SHIPPING';
}

export interface UpdateUserPasswordPayload {
  password: string;
}

export interface UpdateUserPayload {
  email?: string;
  role?: 'SALES' | 'SHIPPING';
  isActive?: boolean;
}
