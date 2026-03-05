// backend/src/modules/admin/admin.service.ts
import { supabase } from '../../lib/supabase'

// ─── STATS ───────────────────────────────────────────────

export async function getStats() {
  const [{ count: lehrer }, { count: schueler }, { count: lektionen }] = await Promise.all([
    (supabase as any).from('teachers').select('*', { count: 'exact', head: true }),
    (supabase as any).from('students').select('*', { count: 'exact', head: true }),
    (supabase as any).from('lessons').select('*', { count: 'exact', head: true }),
  ])
  return { lehrer: lehrer || 0, schueler: schueler || 0, lektionen: lektionen || 0 }
}

// ─── LEHRER ──────────────────────────────────────────────

export async function getAllLehrer() {
  const { data } = await (supabase as any)
    .from('teachers')
    .select('id, full_name, is_admin, lesson_id, lessons(title, topic_number)')
    .order('full_name')

  const { data: { users } } = await supabase.auth.admin.listUsers()
  const emailMap = new Map(users.map((u: any) => [u.id, u.email]))

  return (data || []).map((t: any) => ({
    id: t.id,
    full_name: t.full_name,
    email: emailMap.get(t.id) || '',
    is_admin: t.is_admin,
    lesson_id: t.lesson_id,
    lesson_title: t.lessons ? `${t.lessons.topic_number}. ${t.lessons.title}` : null
  }))
}

export async function createLehrer(data: { full_name: string; email: string; password: string; lesson_id?: string; is_admin?: boolean }) {
  const { data: authData, error } = await supabase.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true
  })
  if (error || !authData.user) throw new Error(error?.message || 'User-Erstellung fehlgeschlagen')

  await (supabase as any).from('teachers').insert({
    id: authData.user.id,
    full_name: data.full_name,
    lesson_id: data.lesson_id || null,
    is_admin: data.is_admin || false
  })
  return { id: authData.user.id }
}

export async function updateLehrer(id: string, data: { full_name?: string; email?: string; password?: string; lesson_id?: string | null; is_admin?: boolean }) {
  if (data.email || data.password) {
    const updates: any = {}
    if (data.email) updates.email = data.email
    if (data.password) updates.password = data.password
    await supabase.auth.admin.updateUserById(id, updates)
  }
  const dbUpdate: any = {}
  if (data.full_name !== undefined) dbUpdate.full_name = data.full_name
  if (data.lesson_id !== undefined) dbUpdate.lesson_id = data.lesson_id
  if (data.is_admin !== undefined) dbUpdate.is_admin = data.is_admin
  if (Object.keys(dbUpdate).length > 0) {
    await (supabase as any).from('teachers').update(dbUpdate).eq('id', id)
  }
}

export async function deleteLehrer(id: string, requesterId: string) {
  if (id === requesterId) throw new Error('Du kannst dich nicht selbst löschen')
  await supabase.auth.admin.deleteUser(id)
}

// ─── SCHÜLER ─────────────────────────────────────────────

export async function getAllSchueler() {
  const { data } = await (supabase as any)
    .from('students')
    .select('id, full_name, phone_number, is_active')
    .order('full_name')
  return data || []
}

export async function createSchueler(data: { full_name: string; phone_number: string }) {
  const { data: row, error } = await (supabase as any)
    .from('students')
    .insert({ full_name: data.full_name, phone_number: data.phone_number, is_active: true })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return row
}

export async function updateSchueler(id: string, data: { full_name?: string; phone_number?: string; is_active?: boolean }) {
  await (supabase as any).from('students').update(data).eq('id', id)
}

export async function deleteSchueler(id: string) {
  await (supabase as any).from('students').delete().eq('id', id)
}

// ─── LEKTIONEN ────────────────────────────────────────────

export async function getAllLektionen() {
  const { data } = await (supabase as any)
    .from('lessons')
    .select('id, topic_number, title, status, room_code')
    .order('topic_number')

  const { data: teachers } = await (supabase as any)
    .from('teachers')
    .select('id, full_name, lesson_id')
    .not('lesson_id', 'is', null)

  const teacherMap = new Map((teachers || []).map((t: any) => [t.lesson_id, t.full_name]))

  return (data || []).map((l: any) => ({
    ...l,
    assigned_teacher: teacherMap.get(l.id) || null
  }))
}

export async function createLektion(data: { topic_number: number; title: string; teacher_id?: string }) {
  const { data: row, error } = await (supabase as any)
    .from('lessons')
    .insert({ topic_number: data.topic_number, title: data.title, status: 'entwurf' })
    .select()
    .single()
  if (error) throw new Error(error.message)

  if (data.teacher_id) {
    await (supabase as any).from('teachers').update({ lesson_id: row.id }).eq('id', data.teacher_id)
  }
  return row
}

export async function updateLektion(id: string, data: { topic_number?: number; title?: string; teacher_id?: string | null }) {
  const dbUpdate: any = {}
  if (data.topic_number !== undefined) dbUpdate.topic_number = data.topic_number
  if (data.title !== undefined) dbUpdate.title = data.title
  if (Object.keys(dbUpdate).length > 0) {
    await (supabase as any).from('lessons').update(dbUpdate).eq('id', id)
  }
  if (data.teacher_id !== undefined) {
    await (supabase as any).from('teachers').update({ lesson_id: null }).eq('lesson_id', id)
    if (data.teacher_id) {
      await (supabase as any).from('teachers').update({ lesson_id: id }).eq('id', data.teacher_id)
    }
  }
}

export async function deleteLektion(id: string) {
  await (supabase as any).from('teachers').update({ lesson_id: null }).eq('lesson_id', id)
  await (supabase as any).from('lessons').delete().eq('id', id)
}
