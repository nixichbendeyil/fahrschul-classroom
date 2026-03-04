export interface LoginRequest {
  phone_number: string
  room_code: string
}

export interface LoginResponse {
  token: string
  student: { id: string; full_name: string }
  lesson: { id: string; topic_number: number; title: string; room_code: string }
}
