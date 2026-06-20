export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'SALES' | 'SHIPPING';
  createdAt: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: 'SALES' | 'SHIPPING';
}
