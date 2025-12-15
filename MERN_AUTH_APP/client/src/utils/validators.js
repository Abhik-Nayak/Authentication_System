export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/


export function validateRegister({ name, email, password }) {
const errors = {}
if (!name || name.trim().length === 0) errors.name = 'Name is required'
if (!email || !emailRegex.test(email)) errors.email = 'Valid email is required'
if (!password || password.length < 8) errors.password = 'Password must be 8+ chars'
return errors
}