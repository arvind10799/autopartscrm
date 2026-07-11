export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'SALES' | 'SHIPPING';
  createdAt: string;
  status?: 'ACTIVE';
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
}
