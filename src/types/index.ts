export type UserRole = 'manager' | 'employee';

export type HoursQuotaType = 'daily' | 'weekly' | 'monthly';

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string;
  employee_number: string | null;
  department_id: string | null;
  phone: string | null;
  avatar_url: string | null;
  birth_date: string | null;
  hire_date: string | null;
  status: 'active' | 'deleted';
  created_at: string;
  department?: Department | null;
  work_days: number[] | null;
  hours_quota_type: HoursQuotaType | null;
  hours_quota: number | null;
  overtime_eligible: boolean | null;
  overtime_threshold: number | null;
};

export type Department = {
  id: string;
  name: string;
  created_at: string;
};

export type AllowedLocation = {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  radius_meters: number;
  created_at: string;
};

export type EmployeeLocation = {
  id: string;
  location_id: string;
  employee_id: string;
  created_at: string;
  employee?: Profile | null;
};

export type AttendanceStatus = 'pending' | 'approved' | 'rejected';

export type Attendance = {
  id: string;
  user_id: string;
  clock_in: string | null;
  clock_out: string | null;
  lat: number | null;
  lng: number | null;
  location_verified: boolean;
  qr_verified: boolean;
  note: string | null;
  status: AttendanceStatus;
  created_at: string;
  profile?: Profile | null;
};

export type ShiftStatus = 'scheduled' | 'completed' | 'cancelled';

export type Shift = {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  role_project: string | null;
  status: ShiftStatus;
  created_at: string;
  profile?: Profile | null;
};

export type RequestStatus = 'pending' | 'approved' | 'rejected';

export type EmployeeRequest = {
  id: string;
  user_id: string;
  type: string;
  description: string | null;
  requested_date: string | null;
  status: RequestStatus;
  manager_note: string | null;
  created_at: string;
  profile?: Profile | null;
};

export type AppNotification = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
};

export type Reminder = {
  id: string;
  user_id: string;
  title: string;
  due_date: string | null;
  done: boolean;
  created_at: string;
};

export type Expense = {
  id: string;
  user_id: string;
  amount: number;
  description: string | null;
  month: string;
  created_at: string;
  profile?: Profile | null;
};

export type TaskStatus = 'pending' | 'in_progress' | 'done';

export type Task = {
  id: string;
  user_id: string;
  title: string;
  assignee_id: string | null;
  status: TaskStatus;
  due_date: string | null;
  created_at: string;
  assignee?: Profile | null;
};

export type ProfileField = {
  id: string;
  label: string;
  key: string;
  type: 'text' | 'number' | 'date' | 'phone' | 'email' | 'select';
  options: string | null;
  required: boolean;
  active: boolean;
  sort_order: number;
  created_at: string;
};

export type QuickSticker = {
  id: string;
  label: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  created_at: string;
};
