import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEED_USERS = [
  {
    email: 'manager@bezman.co.il',
    password: 'Manager123!',
    fullName: 'מנהל מערכת',
    role: 'manager',
    employeeNumber: 'M-001',
    departmentId: null,
    phone: '050-1234567',
    birthDate: '1980-03-15',
    hireDate: '2018-01-01',
  },
  {
    email: 'e0583296967@gmail.com',
    password: '1234',
    fullName: 'מנהל',
    role: 'manager',
    employeeNumber: 'M-002',
    departmentId: null,
    phone: '050-0000000',
    birthDate: '1990-01-01',
    hireDate: '2020-01-01',
  },
  {
    email: 'employee@bezman.co.il',
    password: 'Employee123!',
    fullName: 'יוסי כהן',
    role: 'employee',
    employeeNumber: 'E-1001',
    departmentId: 'd0000000-0000-0000-0000-000000000001',
    phone: '052-1112233',
    birthDate: '1992-07-22',
    hireDate: '2021-05-01',
  },
  {
    email: 'ruti@bezman.co.il',
    password: 'Employee123!',
    fullName: 'רותי לוי',
    role: 'employee',
    employeeNumber: 'E-1002',
    departmentId: 'd0000000-0000-0000-0000-000000000002',
    phone: '054-3334455',
    birthDate: '1995-12-03',
    hireDate: '2022-02-15',
  },
  {
    email: 'avi@bezman.co.il',
    password: 'Employee123!',
    fullName: 'אבי מזרחי',
    role: 'employee',
    employeeNumber: 'E-1003',
    departmentId: 'd0000000-0000-0000-0000-000000000003',
    phone: '053-5556677',
    birthDate: '1988-09-18',
    hireDate: '2020-11-01',
  },
  {
    email: 'shira@bezman.co.il',
    password: 'Employee123!',
    fullName: 'שירה פרץ',
    role: 'employee',
    employeeNumber: 'E-1004',
    departmentId: 'd0000000-0000-0000-0000-000000000001',
    phone: '058-7778899',
    birthDate: '1998-03-28',
    hireDate: '2023-08-01',
  },
  {
    email: 'daniel@bezman.co.il',
    password: 'Employee123!',
    fullName: 'דניאל אברהם',
    role: 'employee',
    employeeNumber: 'E-1005',
    departmentId: 'd0000000-0000-0000-0000-000000000004',
    phone: '050-9991122',
    birthDate: '1990-11-11',
    hireDate: '2019-06-01',
  },
];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const results: { email: string; status: string }[] = [];

    for (const u of SEED_USERS) {
      // Check if user already exists
      const { data: existing } = await supabase.auth.admin.listUsers();
      const found = existing?.users?.find((x) => x.email === u.email);

      let userId: string;

      if (found) {
        // Update password
        const { data, error } = await supabase.auth.admin.updateUserById(found.id, {
          password: u.password,
          email_confirm: true,
          user_metadata: { full_name: u.fullName, role: u.role },
        });
        if (error) {
          results.push({ email: u.email, status: `update error: ${error.message}` });
          continue;
        }
        userId = data!.user!.id;
        results.push({ email: u.email, status: 'updated' });
      } else {
        // Create new user
        const { data, error } = await supabase.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { full_name: u.fullName, role: u.role },
        });
        if (error) {
          results.push({ email: u.email, status: `create error: ${error.message}` });
          continue;
        }
        userId = data!.user!.id;
        results.push({ email: u.email, status: 'created' });
      }

      // Upsert profile
      await supabase.from('profiles').upsert({
        id: userId,
        role: u.role,
        full_name: u.fullName,
        employee_number: u.employeeNumber,
        department_id: u.departmentId,
        phone: u.phone,
        birth_date: u.birthDate,
        hire_date: u.hireDate,
        status: 'active',
      }, { onConflict: 'id' });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
